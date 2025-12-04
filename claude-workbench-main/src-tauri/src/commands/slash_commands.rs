use anyhow::{Context, Result};
use dirs;
use log::{debug, error, info};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Represents a custom slash command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlashCommand {
    /// Unique identifier for the command (derived from file path)
    pub id: String,
    /// Command name (without prefix)
    pub name: String,
    /// Full command with prefix (e.g., "/project:optimize")
    pub full_command: String,
    /// Command scope: "project" or "user"
    pub scope: String,
    /// Optional namespace (e.g., "frontend" in "/project:frontend:component")
    pub namespace: Option<String>,
    /// Path to the markdown file
    pub file_path: String,
    /// Command content (markdown body)
    pub content: String,
    /// Optional description from frontmatter
    pub description: Option<String>,
    /// Allowed tools from frontmatter
    pub allowed_tools: Vec<String>,
    /// Whether the command has bash commands (!)
    pub has_bash_commands: bool,
    /// Whether the command has file references (@)
    pub has_file_references: bool,
    /// Whether the command uses $ARGUMENTS placeholder
    pub accepts_arguments: bool,
}

/// YAML frontmatter structure
#[derive(Debug, Deserialize)]
struct CommandFrontmatter {
    #[serde(rename = "allowed-tools")]
    allowed_tools: Option<Vec<String>>,
    description: Option<String>,
}

/// Parse a markdown file with optional YAML frontmatter
fn parse_markdown_with_frontmatter(content: &str) -> Result<(Option<CommandFrontmatter>, String)> {
    let lines: Vec<&str> = content.lines().collect();

    // Check if the file starts with YAML frontmatter
    if lines.is_empty() || lines[0] != "---" {
        // No frontmatter
        return Ok((None, content.to_string()));
    }

    // Find the end of frontmatter
    let mut frontmatter_end = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            frontmatter_end = Some(i);
            break;
        }
    }

    if let Some(end) = frontmatter_end {
        // Extract frontmatter
        let frontmatter_content = lines[1..end].join("\n");
        let body_content = lines[(end + 1)..].join("\n");

        // Parse YAML
        match serde_yaml::from_str::<CommandFrontmatter>(&frontmatter_content) {
            Ok(frontmatter) => Ok((Some(frontmatter), body_content)),
            Err(e) => {
                debug!("Failed to parse frontmatter: {}", e);
                // Return full content if frontmatter parsing fails
                Ok((None, content.to_string()))
            }
        }
    } else {
        // Malformed frontmatter, treat as regular content
        Ok((None, content.to_string()))
    }
}

/// Extract command name and namespace from file path
fn extract_command_info(file_path: &Path, base_path: &Path) -> Result<(String, Option<String>)> {
    let relative_path = file_path
        .strip_prefix(base_path)
        .context("Failed to get relative path")?;

    // Remove .md extension
    let path_without_ext = relative_path
        .with_extension("")
        .to_string_lossy()
        .to_string();

    // Split into components
    let components: Vec<&str> = path_without_ext.split('/').collect();

    if components.is_empty() {
        return Err(anyhow::anyhow!("Invalid command path"));
    }

    if components.len() == 1 {
        // No namespace
        Ok((components[0].to_string(), None))
    } else {
        // Last component is the command name, rest is namespace
        let command_name = components.last().unwrap().to_string();
        let namespace = components[..components.len() - 1].join(":");
        Ok((command_name, Some(namespace)))
    }
}

/// Load a single command from a markdown file
fn load_command_from_file(file_path: &Path, base_path: &Path, scope: &str) -> Result<SlashCommand> {
    debug!("Loading command from: {:?}", file_path);

    // Read file content
    let content = fs::read_to_string(file_path).context("Failed to read command file")?;

    // Parse frontmatter
    let (frontmatter, body) = parse_markdown_with_frontmatter(&content)?;

    // Extract command info
    let (name, namespace) = extract_command_info(file_path, base_path)?;

    // Build full command (no scope prefix, just /command or /namespace:command)
    let full_command = match &namespace {
        Some(ns) => format!("/{ns}:{name}"),
        None => format!("/{name}"),
    };

    // Generate unique ID
    let id = format!(
        "{}-{}",
        scope,
        file_path.to_string_lossy().replace('/', "-")
    );

    // Check for special content
    let has_bash_commands = body.contains("!`");
    let has_file_references = body.contains('@');
    let accepts_arguments = body.contains("$ARGUMENTS");

    // Extract metadata from frontmatter
    let (description, allowed_tools) = if let Some(fm) = frontmatter {
        (fm.description, fm.allowed_tools.unwrap_or_default())
    } else {
        (None, Vec::new())
    };

    Ok(SlashCommand {
        id,
        name,
        full_command,
        scope: scope.to_string(),
        namespace,
        file_path: file_path.to_string_lossy().to_string(),
        content: body,
        description,
        allowed_tools,
        has_bash_commands,
        has_file_references,
        accepts_arguments,
    })
}

/// Recursively find all markdown files in a directory
fn find_markdown_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
    if !dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        // Skip hidden files/directories
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
        }

        if path.is_dir() {
            find_markdown_files(&path, files)?;
        } else if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" {
                    files.push(path);
                }
            }
        }
    }

    Ok(())
}

/// Create default/built-in slash commands
fn create_default_commands() -> Vec<SlashCommand> {
    vec![
        // 添加额外的工作目录
        SlashCommand {
            id: "default-add-dir".to_string(),
            name: "add-dir".to_string(),
            full_command: "/add-dir".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Add additional working directories".to_string(),
            description: Some("添加额外的工作目录".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 管理专门任务的自定义AI子代理
        SlashCommand {
            id: "default-agents".to_string(),
            name: "agents".to_string(),
            full_command: "/agents".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Manage custom AI subagents for specialized tasks".to_string(),
            description: Some("管理专门任务的自定义AI子代理".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 报告错误（发送对话给Anthropic）
        SlashCommand {
            id: "default-bug".to_string(),
            name: "bug".to_string(),
            full_command: "/bug".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Report bugs (sends conversation to Anthropic)".to_string(),
            description: Some("报告错误（发送对话给Anthropic）".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 清除对话历史
        SlashCommand {
            id: "default-clear".to_string(),
            name: "clear".to_string(),
            full_command: "/clear".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Clear conversation history".to_string(),
            description: Some("清除对话历史".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 压缩对话内容以节省令牌
        SlashCommand {
            id: "default-compact".to_string(),
            name: "compact".to_string(),
            full_command: "/compact".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Compact conversation with optional focus instructions".to_string(),
            description: Some("压缩对话内容以节省令牌".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 查看/修改配置
        SlashCommand {
            id: "default-config".to_string(),
            name: "config".to_string(),
            full_command: "/config".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "View/modify configuration".to_string(),
            description: Some("查看/修改配置".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 显示令牌使用统计
        SlashCommand {
            id: "default-cost".to_string(),
            name: "cost".to_string(),
            full_command: "/cost".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Show token usage statistics".to_string(),
            description: Some("显示令牌使用统计".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 检查Claude Code安装的健康状态
        SlashCommand {
            id: "default-doctor".to_string(),
            name: "doctor".to_string(),
            full_command: "/doctor".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Checks the health of your Claude Code installation".to_string(),
            description: Some("检查Claude Code安装的健康状态".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 获取使用帮助
        SlashCommand {
            id: "default-help".to_string(),
            name: "help".to_string(),
            full_command: "/help".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Get usage help".to_string(),
            description: Some("获取使用帮助".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 使用CLAUDE.md指南初始化项目
        SlashCommand {
            id: "default-init".to_string(),
            name: "init".to_string(),
            full_command: "/init".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Initialize project with CLAUDE.md guide".to_string(),
            description: Some("使用CLAUDE.md指南初始化项目".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 切换Anthropic账户
        SlashCommand {
            id: "default-login".to_string(),
            name: "login".to_string(),
            full_command: "/login".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Switch Anthropic accounts".to_string(),
            description: Some("切换Anthropic账户".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 退出Anthropic账户
        SlashCommand {
            id: "default-logout".to_string(),
            name: "logout".to_string(),
            full_command: "/logout".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Sign out from your Anthropic account".to_string(),
            description: Some("退出Anthropic账户".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 管理MCP服务器连接和OAuth认证
        SlashCommand {
            id: "default-mcp".to_string(),
            name: "mcp".to_string(),
            full_command: "/mcp".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Manage MCP server connections and OAuth authentication".to_string(),
            description: Some("管理MCP服务器连接和OAuth认证".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 编辑CLAUDE.md记忆文件
        SlashCommand {
            id: "default-memory".to_string(),
            name: "memory".to_string(),
            full_command: "/memory".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Edit CLAUDE.md memory files".to_string(),
            description: Some("编辑CLAUDE.md记忆文件".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 选择或更改AI模型
        SlashCommand {
            id: "default-model".to_string(),
            name: "model".to_string(),
            full_command: "/model".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Select or change the AI model".to_string(),
            description: Some("选择或更改AI模型".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 查看或更新权限
        SlashCommand {
            id: "default-permissions".to_string(),
            name: "permissions".to_string(),
            full_command: "/permissions".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "View or update permissions".to_string(),
            description: Some("查看或更新权限".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 查看拉取请求评论
        SlashCommand {
            id: "default-pr_comments".to_string(),
            name: "pr_comments".to_string(),
            full_command: "/pr_comments".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "View pull request comments".to_string(),
            description: Some("查看拉取请求评论".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 请求代码审查
        SlashCommand {
            id: "default-review".to_string(),
            name: "review".to_string(),
            full_command: "/review".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Request code review".to_string(),
            description: Some("请求代码审查".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 查看账户和系统状态
        SlashCommand {
            id: "default-status".to_string(),
            name: "status".to_string(),
            full_command: "/status".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "View account and system statuses".to_string(),
            description: Some("查看账户和系统状态".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 安装Shift+Enter键绑定用于换行
        SlashCommand {
            id: "default-terminal-setup".to_string(),
            name: "terminal-setup".to_string(),
            full_command: "/terminal-setup".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Install Shift+Enter key binding for newlines".to_string(),
            description: Some("安装Shift+Enter键绑定用于换行".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        // 进入vim模式，交替使用插入和命令模式
        SlashCommand {
            id: "default-vim".to_string(),
            name: "vim".to_string(),
            full_command: "/vim".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Enter vim mode for alternating insert and command modes".to_string(),
            description: Some("进入vim模式，交替使用插入和命令模式".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
    ]
}

/// Discover all custom slash commands
#[tauri::command]
pub async fn slash_commands_list(
    project_path: Option<String>,
) -> Result<Vec<SlashCommand>, String> {
    info!("Discovering slash commands");
    let mut commands = Vec::new();

    // Add default commands
    commands.extend(create_default_commands());

    // Load project commands if project path is provided
    if let Some(proj_path) = project_path {
        let project_commands_dir = PathBuf::from(&proj_path).join(".claude").join("commands");
        if project_commands_dir.exists() {
            debug!("Scanning project commands at: {:?}", project_commands_dir);

            let mut md_files = Vec::new();
            if let Err(e) = find_markdown_files(&project_commands_dir, &mut md_files) {
                error!("Failed to find project command files: {}", e);
            } else {
                for file_path in md_files {
                    match load_command_from_file(&file_path, &project_commands_dir, "project") {
                        Ok(cmd) => {
                            debug!("Loaded project command: {}", cmd.full_command);
                            commands.push(cmd);
                        }
                        Err(e) => {
                            error!("Failed to load command from {:?}: {}", file_path, e);
                        }
                    }
                }
            }
        }
    }

    // Load user commands
    if let Some(home_dir) = dirs::home_dir() {
        let user_commands_dir = home_dir.join(".claude").join("commands");
        if user_commands_dir.exists() {
            debug!("Scanning user commands at: {:?}", user_commands_dir);

            let mut md_files = Vec::new();
            if let Err(e) = find_markdown_files(&user_commands_dir, &mut md_files) {
                error!("Failed to find user command files: {}", e);
            } else {
                for file_path in md_files {
                    match load_command_from_file(&file_path, &user_commands_dir, "user") {
                        Ok(cmd) => {
                            debug!("Loaded user command: {}", cmd.full_command);
                            commands.push(cmd);
                        }
                        Err(e) => {
                            error!("Failed to load command from {:?}: {}", file_path, e);
                        }
                    }
                }
            }
        }
    }

    info!("Found {} slash commands", commands.len());
    Ok(commands)
}

/// Get a single slash command by ID
#[tauri::command]
pub async fn slash_command_get(command_id: String) -> Result<SlashCommand, String> {
    debug!("Getting slash command: {}", command_id);

    // Parse the ID to determine scope and reconstruct file path
    let parts: Vec<&str> = command_id.split('-').collect();
    if parts.len() < 2 {
        return Err("Invalid command ID".to_string());
    }

    // The actual implementation would need to reconstruct the path and reload the command
    // For now, we'll list all commands and find the matching one
    let commands = slash_commands_list(None).await?;

    commands
        .into_iter()
        .find(|cmd| cmd.id == command_id)
        .ok_or_else(|| format!("Command not found: {}", command_id))
}

/// Create or update a slash command
#[tauri::command]
pub async fn slash_command_save(
    scope: String,
    name: String,
    namespace: Option<String>,
    content: String,
    description: Option<String>,
    allowed_tools: Vec<String>,
    project_path: Option<String>,
) -> Result<SlashCommand, String> {
    info!("Saving slash command: {} in scope: {}", name, scope);

    // Validate inputs
    if name.is_empty() {
        return Err("Command name cannot be empty".to_string());
    }

    if !["project", "user"].contains(&scope.as_str()) {
        return Err("Invalid scope. Must be 'project' or 'user'".to_string());
    }

    // Determine base directory
    let base_dir = if scope == "project" {
        if let Some(proj_path) = project_path {
            PathBuf::from(proj_path).join(".claude").join("commands")
        } else {
            return Err("Project path required for project scope".to_string());
        }
    } else {
        dirs::home_dir()
            .ok_or_else(|| "Could not find home directory".to_string())?
            .join(".claude")
            .join("commands")
    };

    // Build file path
    let mut file_path = base_dir.clone();
    if let Some(ns) = &namespace {
        for component in ns.split(':') {
            file_path = file_path.join(component);
        }
    }

    // Create directories if needed
    fs::create_dir_all(&file_path).map_err(|e| format!("Failed to create directories: {}", e))?;

    // Add filename
    file_path = file_path.join(format!("{}.md", name));

    // Build content with frontmatter
    let mut full_content = String::new();

    // Add frontmatter if we have metadata
    if description.is_some() || !allowed_tools.is_empty() {
        full_content.push_str("---\n");

        if let Some(desc) = &description {
            full_content.push_str(&format!("description: {}\n", desc));
        }

        if !allowed_tools.is_empty() {
            full_content.push_str("allowed-tools:\n");
            for tool in &allowed_tools {
                full_content.push_str(&format!("  - {}\n", tool));
            }
        }

        full_content.push_str("---\n\n");
    }

    full_content.push_str(&content);

    // Write file
    fs::write(&file_path, &full_content)
        .map_err(|e| format!("Failed to write command file: {}", e))?;

    // Load and return the saved command
    load_command_from_file(&file_path, &base_dir, &scope)
        .map_err(|e| format!("Failed to load saved command: {}", e))
}

/// Delete a slash command
#[tauri::command]
pub async fn slash_command_delete(
    command_id: String,
    project_path: Option<String>,
) -> Result<String, String> {
    info!("Deleting slash command: {}", command_id);

    // First, we need to determine if this is a project command by parsing the ID
    let is_project_command = command_id.starts_with("project-");

    // If it's a project command and we don't have a project path, error out
    if is_project_command && project_path.is_none() {
        return Err("Project path required to delete project commands".to_string());
    }

    // List all commands (including project commands if applicable)
    let commands = slash_commands_list(project_path).await?;

    // Find the command by ID
    let command = commands
        .into_iter()
        .find(|cmd| cmd.id == command_id)
        .ok_or_else(|| format!("Command not found: {}", command_id))?;

    // Delete the file
    fs::remove_file(&command.file_path)
        .map_err(|e| format!("Failed to delete command file: {}", e))?;

    // Clean up empty directories
    if let Some(parent) = Path::new(&command.file_path).parent() {
        let _ = remove_empty_dirs(parent);
    }

    Ok(format!("Deleted command: {}", command.full_command))
}

/// Remove empty directories recursively
fn remove_empty_dirs(dir: &Path) -> Result<()> {
    if !dir.exists() {
        return Ok(());
    }

    // Check if directory is empty
    let is_empty = fs::read_dir(dir)?.next().is_none();

    if is_empty {
        fs::remove_dir(dir)?;

        // Try to remove parent if it's also empty
        if let Some(parent) = dir.parent() {
            let _ = remove_empty_dirs(parent);
        }
    }

    Ok(())
}

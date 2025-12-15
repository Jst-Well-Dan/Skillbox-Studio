use anyhow::Result;
use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// 插件市场元信息（从 marketplace.json 读取）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceInfo {
    pub name: String,
    pub version: String,
    pub description: String,
    pub owner: MarketplaceOwner,
    pub plugins: Vec<MarketplacePlugin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceOwner {
    pub name: String,
    pub email: Option<String>,
}

/// marketplace.json 文件的灵活结构，用于兼容 metadata 包装
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MarketplaceFile {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub metadata: Option<MarketplaceMetadata>,
    pub owner: MarketplaceOwner,
    #[serde(default)]
    pub plugins: Vec<MarketplacePlugin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MarketplaceMetadata {
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
}

/// 插件在 marketplace.json 中的定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplacePlugin {
    pub name: String,
    pub description: String,
    pub source: String,
    pub category: Option<String>,
    pub version: Option<String>,
    pub author: Option<PluginAuthor>,
    #[serde(default)]
    pub skills: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginAuthor {
    pub name: String,
    pub email: Option<String>,
}

/// 完整的插件元信息（结合 marketplace.json 和 plugin.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginMetadata {
    pub name: String,
    pub display_name: String,
    pub version: String,
    pub description: String,
    pub author: Option<PluginAuthor>,
    pub category: String,
    pub marketplace: String,
    pub source_path: String,
    pub components: PluginComponents,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginComponents {
    pub commands: usize,
    pub agents: usize,
    pub skills: usize,
    pub hooks: bool,
    pub mcp: bool,
}

/// Known marketplace 配置（从 known_marketplaces.json 读取）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KnownMarketplace {
    source: MarketplaceSource,
    install_location: String,
    last_updated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
struct MarketplaceSource {
    source: String,  // "github" or "git"
    repo: Option<String>,
    url: Option<String>,
}

/// 获取系统级插件目录
fn get_system_plugins_dir() -> Result<PathBuf, String> {
    let claude_dir = super::claude::get_claude_dir()
        .map_err(|e| format!("Failed to get Claude directory: {}", e))?;

    info!("Claude directory: {:?}", claude_dir);

    let plugins_dir = claude_dir.join("plugins");

    info!("Looking for plugins directory at: {:?}", plugins_dir);

    if !plugins_dir.exists() {
        warn!("Plugins directory not found at: {:?}", plugins_dir);
        return Err(format!("Plugins directory not found at: {:?}", plugins_dir));
    }

    info!("Plugins directory found: {:?}", plugins_dir);
    Ok(plugins_dir)
}

/// 读取 known_marketplaces.json
fn read_known_marketplaces() -> Result<std::collections::HashMap<String, KnownMarketplace>, String> {
    let plugins_dir = get_system_plugins_dir()?;
    let known_marketplaces_file = plugins_dir.join("known_marketplaces.json");

    info!("Looking for known_marketplaces.json at: {:?}", known_marketplaces_file);

    if !known_marketplaces_file.exists() {
        warn!("known_marketplaces.json not found at {:?}", known_marketplaces_file);
        return Ok(std::collections::HashMap::new());
    }

    info!("Reading known_marketplaces.json...");
    let content = fs::read_to_string(&known_marketplaces_file)
        .map_err(|e| format!("Failed to read known_marketplaces.json: {}", e))?;

    debug!("known_marketplaces.json content: {}", content);

    let marketplaces: std::collections::HashMap<String, KnownMarketplace> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse known_marketplaces.json: {}. Content: {}", e, content))?;

    info!("Successfully loaded {} marketplaces", marketplaces.len());
    for (name, config) in &marketplaces {
        info!("  - Marketplace: {}, Location: {}", name, config.install_location);
    }

    Ok(marketplaces)
}

/// 列出所有可用的插件市场
#[tauri::command]
pub async fn list_plugin_marketplaces() -> Result<Vec<MarketplaceInfo>, String> {
    info!("Listing plugin marketplaces from known_marketplaces.json");

    let known_marketplaces = read_known_marketplaces()?;
    let mut marketplaces = Vec::new();

    for (marketplace_name, marketplace_config) in known_marketplaces {
        let install_path = PathBuf::from(&marketplace_config.install_location);

        if !install_path.exists() {
            warn!("Marketplace {} install location does not exist: {:?}", marketplace_name, install_path);
            continue;
        }

        // 查找 .claude-plugin/marketplace.json
        let marketplace_file = install_path.join(".claude-plugin").join("marketplace.json");

        if marketplace_file.exists() {
            match read_marketplace_info(&marketplace_file) {
                Ok(marketplace) => {
                    info!("Found marketplace: {} with {} plugins", marketplace.name, marketplace.plugins.len());
                    marketplaces.push(marketplace);
                }
                Err(e) => {
                    warn!("Failed to read marketplace {:?}: {}", marketplace_file, e);
                }
            }
        } else {
            warn!("Marketplace {} does not have marketplace.json at {:?}", marketplace_name, marketplace_file);
        }
    }

    if marketplaces.is_empty() {
        info!("No marketplaces found in known_marketplaces.json");
    }

    Ok(marketplaces)
}

/// 读取 marketplace.json
fn read_marketplace_info(path: &Path) -> Result<MarketplaceInfo, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read marketplace.json: {}", e))?;

    let raw_marketplace: MarketplaceFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse marketplace.json: {}", e))?;

    // 新版 marketplace.json 将 version/description 放在 metadata 下，老版在根上
    let description = raw_marketplace
        .description
        .or_else(|| {
            raw_marketplace
                .metadata
                .as_ref()
                .and_then(|m| m.description.clone())
        })
        .unwrap_or_else(|| "Claude 插件市场".to_string());

    let version = raw_marketplace
        .version
        .or_else(|| {
            raw_marketplace
                .metadata
                .as_ref()
                .and_then(|m| m.version.clone())
        })
        .unwrap_or_else(|| "1.0.0".to_string());

    Ok(MarketplaceInfo {
        name: raw_marketplace.name,
        version,
        description,
        owner: raw_marketplace.owner,
        plugins: raw_marketplace.plugins,
    })
}

/// 列出指定市场中的所有插件
#[tauri::command]
pub async fn list_marketplace_plugins(marketplace_name: String) -> Result<Vec<PluginMetadata>, String> {
    info!("Listing plugins for marketplace: {}", marketplace_name);

    // 从 known_marketplaces.json 获取市场路径
    let known_marketplaces = read_known_marketplaces()?;
    let marketplace_config = known_marketplaces.get(&marketplace_name)
        .ok_or_else(|| format!("Marketplace not found in known_marketplaces.json: {}", marketplace_name))?;

    let marketplace_path = PathBuf::from(&marketplace_config.install_location);
    info!("[list_marketplace_plugins] Marketplace '{}' path: {:?}", marketplace_name, marketplace_path);

    if !marketplace_path.exists() {
        return Err(format!("Marketplace install location does not exist: {:?}", marketplace_path));
    }

    let marketplace_file = marketplace_path.join(".claude-plugin").join("marketplace.json");
    info!("[list_marketplace_plugins] Reading marketplace.json from: {:?}", marketplace_file);
    let marketplace_info = read_marketplace_info(&marketplace_file)?;
    info!("[list_marketplace_plugins] Marketplace '{}' contains {} plugins", marketplace_info.name, marketplace_info.plugins.len());

    let mut plugins = Vec::new();

    for marketplace_plugin in marketplace_info.plugins {
        // 解析插件路径
        let plugin_source = if marketplace_plugin.source.starts_with("./") {
            marketplace_path.join(marketplace_plugin.source.trim_start_matches("./"))
        } else {
            marketplace_path.join(&marketplace_plugin.source)
        };

        // 如果是 skills 列表，处理方式不同
        if !marketplace_plugin.skills.is_empty() {
            // 这是一个 skills 集合插件（如 anthropic-agent-skills）
            let components = PluginComponents {
                commands: 0,
                agents: 0,
                skills: marketplace_plugin.skills.len(),
                hooks: false,
                mcp: false,
            };

            plugins.push(PluginMetadata {
                name: marketplace_plugin.name.clone(),
                display_name: marketplace_plugin.name.clone(),
                version: marketplace_plugin.version.unwrap_or_else(|| marketplace_info.version.clone()),
                description: marketplace_plugin.description.clone(),
                author: marketplace_plugin.author.clone(),
                category: marketplace_plugin.category.unwrap_or_else(|| "general".to_string()),
                marketplace: marketplace_name.clone(),
                source_path: plugin_source.to_string_lossy().to_string(),
                components,
            });
        } else {
            // 标准插件结构（有 .claude-plugin/plugin.json）
            if plugin_source.exists() {
                match build_plugin_metadata(&plugin_source, &marketplace_plugin, &marketplace_name, &marketplace_info.version) {
                    Ok(metadata) => plugins.push(metadata),
                    Err(e) => {
                        warn!("Failed to build metadata for plugin {}: {}", marketplace_plugin.name, e);
                    }
                }
            } else {
                warn!("Plugin source not found: {:?}", plugin_source);
            }
        }
    }

    Ok(plugins)
}

/// 构建插件元信息
fn build_plugin_metadata(
    plugin_path: &Path,
    marketplace_plugin: &MarketplacePlugin,
    marketplace_name: &str,
    marketplace_version: &str,
) -> Result<PluginMetadata, String> {
    // 尝试读取 plugin.json
    let plugin_json_path = plugin_path.join(".claude-plugin").join("plugin.json");

    let (version, author) = if plugin_json_path.exists() {
        let content = fs::read_to_string(&plugin_json_path)
            .map_err(|e| format!("Failed to read plugin.json: {}", e))?;

        let plugin_json: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse plugin.json: {}", e))?;

        let version = plugin_json.get("version")
            .and_then(|v| v.as_str())
            .unwrap_or(marketplace_version)
            .to_string();

        let author = plugin_json.get("author")
            .and_then(|v| serde_json::from_value::<PluginAuthor>(v.clone()).ok());

        (version, author)
    } else {
        (
            marketplace_plugin.version.clone().unwrap_or_else(|| marketplace_version.to_string()),
            marketplace_plugin.author.clone()
        )
    };

    // 统计组件
    let components = count_plugin_components(plugin_path);

    Ok(PluginMetadata {
        name: marketplace_plugin.name.clone(),
        display_name: marketplace_plugin.name.clone(),
        version,
        description: marketplace_plugin.description.clone(),
        author,
        category: marketplace_plugin.category.clone().unwrap_or_else(|| "general".to_string()),
        marketplace: marketplace_name.to_string(),
        source_path: plugin_path.to_string_lossy().to_string(),
        components,
    })
}

/// 统计插件组件数量
fn count_plugin_components(plugin_path: &Path) -> PluginComponents {
    let mut components = PluginComponents {
        commands: 0,
        agents: 0,
        skills: 0,
        hooks: false,
        mcp: false,
    };

    // 统计 commands
    let commands_dir = plugin_path.join("commands");
    if commands_dir.exists() {
        components.commands = WalkDir::new(&commands_dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("md"))
            .count();
    }

    // 统计 agents
    let agents_dir = plugin_path.join("agents");
    if agents_dir.exists() {
        components.agents = WalkDir::new(&agents_dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("md"))
            .count();
    }

    // 统计 skills
    let skills_dir = plugin_path.join("skills");
    if skills_dir.exists() {
        components.skills = WalkDir::new(&skills_dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .file_name()
                    .and_then(|s| s.to_str())
                    .map(|s| s.ends_with("SKILL.md"))
                    .unwrap_or(false)
            })
            .count();
    }

    // 检查 hooks
    let hooks_file = plugin_path.join("hooks").join("hooks.json");
    components.hooks = hooks_file.exists();

    // 检查 MCP
    let mcp_file = plugin_path.join(".mcp.json");
    components.mcp = mcp_file.exists();

    components
}

/// 安装插件到项目级或系统级（通过修改 settings.json）
#[tauri::command]
pub async fn install_plugin_to_project(
    project_path: String,
    marketplace_name: String,
    plugin_name: String,
) -> Result<String, String> {
    info!("Installing plugin {} from {} to project {}", plugin_name, marketplace_name, project_path);

    // 构建插件标识符：plugin-name@marketplace-name
    let plugin_id = format!("{}@{}", plugin_name, marketplace_name);

    // 获取 settings.json 路径
    let settings_path = if project_path.is_empty() {
        // 系统级：~/.claude/settings.json
        let claude_dir = super::claude::get_claude_dir()
            .map_err(|e| format!("Failed to get Claude directory: {}", e))?;
        claude_dir.join("settings.json")
    } else {
        // 项目级：<project>/.claude/settings.json
        let project_claude_dir = PathBuf::from(&project_path).join(".claude");
        fs::create_dir_all(&project_claude_dir)
            .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
        project_claude_dir.join("settings.json")
    };

    info!("Settings path: {:?}", settings_path);

    // 更新 settings.json 的 enabledPlugins 字段
    update_enabled_plugins(&settings_path, &plugin_id, true)?;

    info!("Successfully installed plugin: {} (added to settings.json)", plugin_name);
    Ok(format!("Successfully installed plugin: {}", plugin_name))
}

/// 卸载项目级或系统级插件（通过修改 settings.json）
#[tauri::command]
pub async fn uninstall_plugin_from_project(
    project_path: String,
    marketplace_name: String,
    plugin_name: String,
) -> Result<String, String> {
    info!("Uninstalling plugin {} from project {}", plugin_name, project_path);

    // 构建插件标识符：plugin-name@marketplace-name
    let plugin_id = format!("{}@{}", plugin_name, marketplace_name);

    // 获取 settings.json 路径
    let settings_path = if project_path.is_empty() {
        // 系统级：~/.claude/settings.json
        let claude_dir = super::claude::get_claude_dir()
            .map_err(|e| format!("Failed to get Claude directory: {}", e))?;
        claude_dir.join("settings.json")
    } else {
        // 项目级：<project>/.claude/settings.json
        let project_claude_dir = PathBuf::from(&project_path).join(".claude");
        project_claude_dir.join("settings.json")
    };

    info!("Settings path: {:?}", settings_path);

    // 从 settings.json 的 enabledPlugins 字段移除插件
    update_enabled_plugins(&settings_path, &plugin_id, false)?;

    info!("Successfully uninstalled plugin: {} (removed from settings.json)", plugin_name);
    Ok(format!("Successfully uninstalled plugin: {}", plugin_name))
}

/// 列出项目已安装的插件
#[tauri::command]
pub async fn list_project_installed_plugins(
    project_path: String,
) -> Result<Vec<PluginMetadata>, String> {
    info!("Listing installed plugins for project: {}", project_path);

    let record_file = PathBuf::from(&project_path)
        .join(".claude")
        .join("installed_plugins.json");

    if !record_file.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&record_file)
        .map_err(|e| format!("Failed to read installed plugins: {}", e))?;
    let installed: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse installed plugins: {}", e))?;

    let mut plugins = Vec::new();

    if let Some(plugins_obj) = installed.get("plugins").and_then(|v| v.as_object()) {
        for (_key, plugin_data) in plugins_obj {
            if let Ok(metadata) = serde_json::from_value::<PluginMetadata>(plugin_data.clone()) {
                plugins.push(metadata);
            }
        }
    }

    // 按名称排序
    plugins.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(plugins)
}

/// 检查插件是否已安装
#[tauri::command]
pub async fn is_plugin_installed(
    project_path: String,
    marketplace_name: String,
    plugin_name: String,
) -> Result<bool, String> {
    let record_file = PathBuf::from(&project_path)
        .join(".claude")
        .join("installed_plugins.json");

    if !record_file.exists() {
        return Ok(false);
    }

    let content = fs::read_to_string(&record_file)
        .map_err(|e| format!("Failed to read installed plugins: {}", e))?;
    let installed: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse installed plugins: {}", e))?;

    if let Some(plugins_obj) = installed.get("plugins").and_then(|v| v.as_object()) {
        let plugin_key = format!("{}:{}", marketplace_name, plugin_name);
        return Ok(plugins_obj.contains_key(&plugin_key));
    }

    Ok(false)
}

// ==================== 能力总览：Commands ====================

/// 命令信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandInfo {
    pub name: String,           // 命令名（不含 /）
    pub file_name: String,      // 文件名
    pub description: String,    // 描述
    pub usage_example: String,  // 使用示例
    pub source: String,         // 来源（系统级/项目级）
    pub file_path: String,      // 完整路径
}

/// 获取项目的所有可用命令
#[tauri::command]
pub fn get_project_commands(project_path: String) -> Result<Vec<CommandInfo>, String> {
    info!("[get_project_commands] Getting commands for project: {}", project_path);

    let mut commands = Vec::new();
    let project_path_buf = PathBuf::from(&project_path);

    // 1. 读取项目级 commands (.claude/commands/)
    let project_commands_dir = project_path_buf.join(".claude").join("commands");
    if project_commands_dir.exists() {
        info!("[get_project_commands] Scanning project commands: {:?}", project_commands_dir);
        match scan_commands_directory(&project_commands_dir, "项目级") {
            Ok(mut cmds) => {
                info!("[get_project_commands] Found {} project commands", cmds.len());
                commands.append(&mut cmds);
            }
            Err(e) => {
                warn!("[get_project_commands] Failed to scan project commands: {}", e);
            }
        }
    } else {
        info!("[get_project_commands] Project commands directory does not exist: {:?}", project_commands_dir);
    }

    // 2. 读取系统级 commands (~/.claude/commands/)
    match super::claude::get_claude_dir() {
        Ok(claude_dir) => {
            let system_commands_dir = claude_dir.join("commands");
            if system_commands_dir.exists() {
                info!("[get_project_commands] Scanning system commands: {:?}", system_commands_dir);
                match scan_commands_directory(&system_commands_dir, "系统级") {
                    Ok(mut cmds) => {
                        info!("[get_project_commands] Found {} system commands", cmds.len());
                        commands.append(&mut cmds);
                    }
                    Err(e) => {
                        warn!("[get_project_commands] Failed to scan system commands: {}", e);
                    }
                }
            } else {
                info!("[get_project_commands] System commands directory does not exist: {:?}", system_commands_dir);
            }
        }
        Err(e) => {
            warn!("[get_project_commands] Failed to get Claude directory: {}", e);
        }
    }

    info!("[get_project_commands] Total commands found: {}", commands.len());
    Ok(commands)
}

/// 扫描指定目录下的所有命令文件
fn scan_commands_directory(dir: &Path, source: &str) -> Result<Vec<CommandInfo>, String> {
    let mut commands = Vec::new();

    if !dir.exists() {
        return Ok(commands);
    }

    for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // 只处理 .md 文件
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                // 命令名就是文件名（去掉 .md 扩展名）
                let command_name = file_name.trim_end_matches(".md").to_string();

                // 读取文件内容提取描述和示例
                let (description, usage_example) = parse_command_file(&path);

                commands.push(CommandInfo {
                    name: command_name,
                    file_name: file_name.to_string(),
                    description,
                    usage_example,
                    source: source.to_string(),
                    file_path: path.display().to_string(),
                });
            }
        }
    }

    Ok(commands)
}

/// 解析命令文件，提取描述和使用示例
fn parse_command_file(path: &Path) -> (String, String) {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return ("无法读取文件".to_string(), "".to_string()),
    };

    let lines: Vec<&str> = content.lines().collect();
    let mut description = String::new();
    let mut usage_example = String::new();

    // 提取前3行作为描述（跳过空行和标题）
    let mut desc_lines = Vec::new();
    for line in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        desc_lines.push(trimmed);
        if desc_lines.len() >= 2 {
            break;
        }
    }

    if !desc_lines.is_empty() {
        description = desc_lines.join(" ");
    }

    description = truncate_with_ellipsis(&description, 150);

    // 尝试提取使用示例（寻找以 `/` 开头的代码块）
    let mut in_code_block = false;
    for line in &lines {
        let trimmed = line.trim();
        if trimmed.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block && trimmed.starts_with('/') {
            usage_example = trimmed.to_string();
            break;
        }
        // 也可能直接在文本中有用法示例
        if trimmed.starts_with("用法:") || trimmed.starts_with("Usage:") {
            // 下一行可能是示例
            if let Some(next_line) = lines.get(lines.iter().position(|&l| l == *line).unwrap() + 1) {
                let next_trimmed = next_line.trim();
                if next_trimmed.starts_with('/') {
                    usage_example = next_trimmed.to_string();
                    break;
                }
            }
        }
    }

    // 如果没有找到用法示例，生成一个默认的
    if usage_example.is_empty() {
        if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
            usage_example = format!("/{}", file_stem);
        }
    }

    (description, usage_example)
}

// ==================== 能力总览：Skills ====================

/// 技能信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    pub name: String,           // 技能名称
    pub display_name: String,   // 显示名称
    pub description: String,    // 描述
    pub trigger: Option<String>, // 触发条件
    pub source: String,          // 来源（系统级/项目级）
    pub file_path: String,       // 完整路径
}

/// 获取项目的所有可用技能
#[tauri::command]
pub fn get_project_skills(project_path: String) -> Result<Vec<SkillInfo>, String> {
    info!("[get_project_skills] Getting skills for project: {}", project_path);

    let mut skills = Vec::new();
    let project_path_buf = PathBuf::from(&project_path);

    // 1. 读取项目级 skills (.claude/skills/)
    let project_skills_dir = project_path_buf.join(".claude").join("skills");
    if project_skills_dir.exists() {
        info!("[get_project_skills] Scanning project skills: {:?}", project_skills_dir);
        match scan_skills_directory(&project_skills_dir, "项目级") {
            Ok(mut skls) => {
                info!("[get_project_skills] Found {} project skills", skls.len());
                skills.append(&mut skls);
            }
            Err(e) => {
                warn!("[get_project_skills] Failed to scan project skills: {}", e);
            }
        }
    } else {
        info!("[get_project_skills] Project skills directory does not exist: {:?}", project_skills_dir);
    }

    // 2. 读取系统级 skills (~/.claude/skills/)
    match super::claude::get_claude_dir() {
        Ok(claude_dir) => {
            let system_skills_dir = claude_dir.join("skills");
            if system_skills_dir.exists() {
                info!("[get_project_skills] Scanning system skills: {:?}", system_skills_dir);
                match scan_skills_directory(&system_skills_dir, "系统级") {
                    Ok(mut skls) => {
                        info!("[get_project_skills] Found {} system skills", skls.len());
                        skills.append(&mut skls);
                    }
                    Err(e) => {
                        warn!("[get_project_skills] Failed to scan system skills: {}", e);
                    }
                }
            } else {
                info!("[get_project_skills] System skills directory does not exist: {:?}", system_skills_dir);
            }
        }
        Err(e) => {
            warn!("[get_project_skills] Failed to get Claude directory: {}", e);
        }
    }

    info!("[get_project_skills] Total skills found: {}", skills.len());
    Ok(skills)
}

/// 扫描指定目录下的所有技能文件
fn scan_skills_directory(dir: &Path, source: &str) -> Result<Vec<SkillInfo>, String> {
    let mut skills = Vec::new();

    if !dir.exists() {
        return Ok(skills);
    }

    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|s| s.to_str()) else {
            continue;
        };

        let lower = file_name.to_ascii_lowercase();
        if !lower.ends_with("skill.md") {
            continue;
        }

        let skill_name = if file_name.ends_with("SKILL.md") {
            file_name
                .trim_end_matches("SKILL.md")
                .trim_end_matches('.')
                .to_string()
        } else {
            file_name
                .trim_end_matches("skill.md")
                .trim_end_matches('.')
                .to_string()
        };

        let (display_name, description, trigger) = parse_skill_file(path);

        skills.push(SkillInfo {
            name: skill_name.clone(),
            display_name: if display_name.is_empty() { skill_name } else { display_name },
            description,
            trigger,
            source: source.to_string(),
            file_path: path.display().to_string(),
        });
    }

    Ok(skills)
}

/// 解析技能文件，提取 YAML frontmatter 和描述
fn parse_skill_file(path: &Path) -> (String, String, Option<String>) {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return ("".to_string(), "无法读取文件".to_string(), None),
    };

    let mut display_name = String::new();
    let mut description = String::new();
    let mut trigger: Option<String> = None;

    // 检查是否有 YAML frontmatter (在 --- 和 --- 之间)
    if content.starts_with("---") {
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() >= 3 {
            let frontmatter = parts[1].trim();
            let body = parts[2].trim();

            // 简单解析 YAML (不使用完整的 YAML 解析器，避免依赖)
            for line in frontmatter.lines() {
                let line = line.trim();
                if line.starts_with("name:") {
                    display_name = line.trim_start_matches("name:").trim().trim_matches('"').to_string();
                } else if line.starts_with("description:") {
                    description = line.trim_start_matches("description:").trim().trim_matches('"').to_string();
                } else if line.starts_with("trigger:") {
                    trigger = Some(line.trim_start_matches("trigger:").trim().trim_matches('"').to_string());
                }
            }

            // 如果 frontmatter 中没有描述，从正文提取
            if description.is_empty() {
                description = extract_description_from_body(body);
            }
        }
    } else {
        // 没有 frontmatter，直接从内容提取描述
        description = extract_description_from_body(&content);
    }

    description = truncate_with_ellipsis(&description, 200);

    (display_name, description, trigger)
}

/// 从 Markdown 正文中提取描述（前几行非标题内容）
fn extract_description_from_body(body: &str) -> String {
    let lines: Vec<&str> = body.lines().collect();
    let mut desc_lines = Vec::new();

    for line in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        desc_lines.push(trimmed);
        if desc_lines.len() >= 3 {
            break;
        }
    }

    if desc_lines.is_empty() {
        "无描述".to_string()
    } else {
        desc_lines.join(" ")
    }
}

// ==================== Marketplace 管理 ====================

use std::process::Command;

/// Marketplace 详细信息（用于前端显示）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceDetail {
    pub name: String,
    pub source: String,          // GitHub URL 或本地路径
    pub install_location: String,
    pub last_updated: String,
    pub status: String,          // "active" or "error"
}

/// 列出所有已知的 marketplace
#[tauri::command]
pub fn list_known_marketplaces() -> Result<Vec<MarketplaceDetail>, String> {
    info!("[list_known_marketplaces] Listing known marketplaces");

    let marketplaces_map = read_known_marketplaces()?;
    let mut result = Vec::new();

    for (name, config) in marketplaces_map {
        let source_str = match config.source.source.as_str() {
            "github" => {
                if let Some(repo) = &config.source.repo {
                    format!("github:{}", repo)
                } else {
                    "github".to_string()
                }
            }
            "git" => {
                if let Some(url) = &config.source.url {
                    url.clone()
                } else {
                    "git".to_string()
                }
            }
            other => other.to_string(),
        };

        let install_path = PathBuf::from(&config.install_location);
        let status = if install_path.exists() {
            "active".to_string()
        } else {
            "error".to_string()
        };

        result.push(MarketplaceDetail {
            name,
            source: source_str,
            install_location: config.install_location,
            last_updated: config.last_updated,
            status,
        });
    }

    info!("[list_known_marketplaces] Found {} marketplaces", result.len());
    Ok(result)
}

/// 添加新的 marketplace（调用 Claude CLI）
#[tauri::command]
pub async fn add_marketplace(app_handle: tauri::AppHandle, source: String) -> Result<String, String> {
    info!("[add_marketplace] Adding marketplace: {}", source);

    // 查找 Claude CLI
    let claude_path = crate::claude_binary::find_claude_binary(&app_handle)
        .map_err(|e| format!("Failed to find Claude CLI: {}", e))?;

    info!("[add_marketplace] Using Claude CLI: {}", claude_path);

    // 调用 claude-code plugin marketplace add <source>
    let output = Command::new(&claude_path)
        .args(&["plugin", "marketplace", "add", &source])
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        info!("[add_marketplace] Success: {}", stdout);
        Ok(format!("Successfully added marketplace: {}", source))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        warn!("[add_marketplace] Failed: {}", stderr);
        Err(format!("Failed to add marketplace: {}", stderr))
    }
}

/// 删除 marketplace（调用 Claude CLI）
#[tauri::command]
pub async fn remove_marketplace(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    info!("[remove_marketplace] Removing marketplace: {}", name);

    // 查找 Claude CLI
    let claude_path = crate::claude_binary::find_claude_binary(&app_handle)
        .map_err(|e| format!("Failed to find Claude CLI: {}", e))?;

    info!("[remove_marketplace] Using Claude CLI: {}", claude_path);

    // 调用 claude-code plugin marketplace remove <name>
    let output = Command::new(&claude_path)
        .args(&["plugin", "marketplace", "remove", &name])
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        info!("[remove_marketplace] Success: {}", stdout);
        Ok(format!("Successfully removed marketplace: {}", name))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        warn!("[remove_marketplace] Failed: {}", stderr);
        Err(format!("Failed to remove marketplace: {}", stderr))
    }
}

/// 刷新 marketplace（调用 Claude CLI）
#[tauri::command]
pub async fn refresh_marketplace(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    info!("[refresh_marketplace] Refreshing marketplace: {}", name);

    // 查找 Claude CLI
    let claude_path = crate::claude_binary::find_claude_binary(&app_handle)
        .map_err(|e| format!("Failed to find Claude CLI: {}", e))?;

    info!("[refresh_marketplace] Using Claude CLI: {}", claude_path);

    // 调用 claude-code plugin marketplace update <name>
    let output = Command::new(&claude_path)
        .args(&["plugin", "marketplace", "update", &name])
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        info!("[refresh_marketplace] Success: {}", stdout);
        Ok(format!("Successfully refreshed marketplace: {}", name))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        warn!("[refresh_marketplace] Failed: {}", stderr);
        Err(format!("Failed to refresh marketplace: {}", stderr))
    }
}

// ==================== 能力总览：Agents ====================

/// Agent 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    pub name: String,           // Agent 名称
    pub display_name: String,   // 显示名称
    pub description: String,    // 描述
    pub trigger: Option<String>, // 触发场景
    pub source: String,          // 来源（系统级/项目级）
    pub file_path: String,       // 完整路径
}

/// 获取项目的所有可用 agents
#[tauri::command]
pub fn get_project_agents(project_path: String) -> Result<Vec<AgentInfo>, String> {
    info!("[get_project_agents] Getting agents for project: {}", project_path);

    let mut agents = Vec::new();
    let project_path_buf = PathBuf::from(&project_path);

    // 1. 读取项目级 agents (.claude/agents/)
    let project_agents_dir = project_path_buf.join(".claude").join("agents");
    if project_agents_dir.exists() {
        info!("[get_project_agents] Scanning project agents: {:?}", project_agents_dir);
        match scan_agents_directory(&project_agents_dir, "项目级") {
            Ok(mut agts) => {
                info!("[get_project_agents] Found {} project agents", agts.len());
                agents.append(&mut agts);
            }
            Err(e) => {
                warn!("[get_project_agents] Failed to scan project agents: {}", e);
            }
        }
    } else {
        info!("[get_project_agents] Project agents directory does not exist: {:?}", project_agents_dir);
    }

    // 2. 读取系统级 agents (~/.claude/agents/)
    match super::claude::get_claude_dir() {
        Ok(claude_dir) => {
            let system_agents_dir = claude_dir.join("agents");
            if system_agents_dir.exists() {
                info!("[get_project_agents] Scanning system agents: {:?}", system_agents_dir);
                match scan_agents_directory(&system_agents_dir, "系统级") {
                    Ok(mut agts) => {
                        info!("[get_project_agents] Found {} system agents", agts.len());
                        agents.append(&mut agts);
                    }
                    Err(e) => {
                        warn!("[get_project_agents] Failed to scan system agents: {}", e);
                    }
                }
            } else {
                info!("[get_project_agents] System agents directory does not exist: {:?}", system_agents_dir);
            }
        }
        Err(e) => {
            warn!("[get_project_agents] Failed to get Claude directory: {}", e);
        }
    }

    info!("[get_project_agents] Total agents found: {}", agents.len());
    Ok(agents)
}

/// 扫描指定目录下的所有 agent 文件
fn scan_agents_directory(dir: &Path, source: &str) -> Result<Vec<AgentInfo>, String> {
    let mut agents = Vec::new();

    if !dir.exists() {
        return Ok(agents);
    }

    for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // 只处理 .md 文件
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                // Agent 名就是文件名（去掉 .md 扩展名）
                let agent_name = file_name.trim_end_matches(".md").to_string();

                // 读取文件内容提取信息
                let (display_name, description, trigger) = parse_agent_file(&path);

                agents.push(AgentInfo {
                    name: agent_name.clone(),
                    display_name: if display_name.is_empty() { agent_name } else { display_name },
                    description,
                    trigger,
                    source: source.to_string(),
                    file_path: path.display().to_string(),
                });
            }
        }
    }

    Ok(agents)
}

/// 解析 agent 文件，提取 YAML frontmatter 和描述
fn parse_agent_file(path: &Path) -> (String, String, Option<String>) {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return ("".to_string(), "无法读取文件".to_string(), None),
    };

    let mut display_name = String::new();
    let mut description = String::new();
    let mut trigger: Option<String> = None;

    // 检查是否有 YAML frontmatter (在 --- 和 --- 之间)
    if content.starts_with("---") {
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() >= 3 {
            let frontmatter = parts[1].trim();
            let body = parts[2].trim();

            // 简单解析 YAML
            for line in frontmatter.lines() {
                let line = line.trim();
                if line.starts_with("name:") {
                    display_name = line.trim_start_matches("name:").trim().trim_matches('"').to_string();
                } else if line.starts_with("description:") {
                    description = line.trim_start_matches("description:").trim().trim_matches('"').to_string();
                } else if line.starts_with("trigger:") || line.starts_with("trigger_scenario:") {
                    let trigger_line = if line.starts_with("trigger:") {
                        line.trim_start_matches("trigger:")
                    } else {
                        line.trim_start_matches("trigger_scenario:")
                    };
                    trigger = Some(trigger_line.trim().trim_matches('"').to_string());
                }
            }

            // 如果 frontmatter 中没有描述，从正文提取
            if description.is_empty() {
                description = extract_description_from_body(body);
            }
        }
    } else {
        // 没有 frontmatter，直接从内容提取描述
        description = extract_description_from_body(&content);
    }

    description = truncate_with_ellipsis(&description, 200);

    (display_name, description, trigger)
}

fn truncate_with_ellipsis(text: &str, max_chars: usize) -> String {
    const ELLIPSIS: &str = "...";

    if max_chars == 0 {
        return String::new();
    }

    let ellipsis_len = ELLIPSIS.chars().count();

    if text.chars().count() <= max_chars {
        return text.to_string();
    }

    if max_chars <= ellipsis_len {
        return text.chars().take(max_chars).collect();
    }

    let take_chars = max_chars - ellipsis_len;
    let mut truncated: String = text.chars().take(take_chars).collect();
    truncated.push_str(ELLIPSIS);
    truncated
}

/// 确保 settings.json 文件存在，如果不存在则创建默认结构
fn ensure_settings_file(settings_path: &Path) -> Result<(), String> {
    if !settings_path.exists() {
        if let Some(parent) = settings_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        let default_settings = serde_json::json!({
            "enabledPlugins": {}
        });

        let json_string = serde_json::to_string_pretty(&default_settings)
            .map_err(|e| format!("Failed to serialize default settings: {}", e))?;

        fs::write(settings_path, json_string)
            .map_err(|e| format!("Failed to write settings.json: {}", e))?;
    }
    Ok(())
}

/// 更新 settings.json 中的 enabledPlugins 字段
fn update_enabled_plugins(
    settings_path: &Path,
    plugin_id: &str,
    enabled: bool,
) -> Result<(), String> {
    ensure_settings_file(settings_path)?;

    let content = fs::read_to_string(settings_path)
        .map_err(|e| format!("Failed to read settings.json: {}", e))?;

    let mut settings: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings.json: {}", e))?;

    // 确保 enabledPlugins 字段存在
    if settings.get("enabledPlugins").is_none() {
        settings["enabledPlugins"] = serde_json::json!({});
    }

    let plugins = settings["enabledPlugins"].as_object_mut()
        .ok_or("enabledPlugins is not an object")?;

    if enabled {
        plugins.insert(plugin_id.to_string(), serde_json::Value::Bool(true));
    } else {
        plugins.remove(plugin_id);
    }

    let json_string = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings.json: {}", e))?;

    fs::write(settings_path, json_string)
        .map_err(|e| format!("Failed to write settings.json: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::truncate_with_ellipsis;

    #[test]
    fn truncate_with_ellipsis_handles_multibyte() {
        let long_text = "测试能力描述".repeat(40);
        let truncated = truncate_with_ellipsis(&long_text, 200);
        assert_eq!(truncated.chars().count(), 200);
        assert!(truncated.ends_with("..."));
    }

    #[test]
    fn truncate_with_ellipsis_returns_original_when_short() {
        let text = "短描述";
        let truncated = truncate_with_ellipsis(text, 200);
        assert_eq!(truncated, text);
    }

    #[test]
    fn truncate_with_ellipsis_handles_small_limits() {
        let text = "示例文本";
        let truncated = truncate_with_ellipsis(text, 2);
        assert_eq!(truncated.chars().count(), 2);
    }
}

use anyhow::Result;
use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use super::claude::get_claude_dir;

/// Represents a Plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    /// Plugin name
    pub name: String,
    /// Plugin description
    pub description: Option<String>,
    /// Plugin version
    pub version: String,
    /// Author information
    pub author: Option<String>,
    /// Marketplace source
    pub marketplace: Option<String>,
    /// Plugin directory path
    pub path: String,
    /// Whether plugin is enabled
    pub enabled: bool,
    /// Plugin scope: "project" or "user"
    pub scope: String,
    /// Components count
    pub components: PluginComponents,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginComponents {
    pub commands: usize,
    pub agents: usize,
    pub skills: usize,
    pub hooks: usize,
    pub mcp_servers: usize,
}

/// Represents a Subagent file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubagentFile {
    /// Agent name (file name without extension)
    pub name: String,
    /// Full file path
    pub path: String,
    /// Scope: "project" or "user"
    pub scope: String,
    /// Description from frontmatter or first line
    pub description: Option<String>,
    /// File content
    pub content: String,
}

/// Represents an Agent Skill file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSkillFile {
    /// Skill name (file name without SKILL.md)
    pub name: String,
    /// Full file path
    pub path: String,
    /// Scope: "project" or "user"
    pub scope: String,
    /// Description from frontmatter or first line
    pub description: Option<String>,
    /// File content
    pub content: String,
}

/// Load enabled plugins from a single settings.json file (non-recursive, for project-level plugins)
fn load_enabled_plugins_simple(settings_path: &Path) -> Vec<String> {
    let mut result = Vec::new();

    if !settings_path.exists() {
        return result;
    }

    let content = match fs::read_to_string(settings_path) {
        Ok(value) => value,
        Err(err) => {
            warn!("Failed to read settings at {:?}: {}", settings_path, err);
            return result;
        }
    };

    let settings: serde_json::Value = match serde_json::from_str(&content) {
        Ok(value) => value,
        Err(err) => {
            warn!("Failed to parse settings at {:?}: {}", settings_path, err);
            return result;
        }
    };

    if let Some(enabled_obj) = settings.get("enabledPlugins").and_then(|v| v.as_object()) {
        for (plugin_id, enabled) in enabled_obj {
            if enabled.as_bool().unwrap_or(false) {
                result.push(plugin_id.clone());
            }
        }
    }

    result
}

/// Parse YAML frontmatter if present
fn parse_description_from_content(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();

    // Check for YAML frontmatter
    if lines.len() > 2 && lines[0] == "---" {
        for line in lines.iter().skip(1) {
            if *line == "---" {
                // Found end of frontmatter
                break;
            }
            if line.starts_with("description:") {
                return Some(line.trim_start_matches("description:").trim().to_string());
            }
        }
    }

    // Fallback: use first non-empty line as description
    lines
        .iter()
        .find(|line| !line.trim().is_empty() && !line.starts_with('#'))
        .map(|line| line.trim().to_string())
}

/// List all subagents in project and user directories
#[tauri::command]
pub async fn list_subagents(project_path: Option<String>) -> Result<Vec<SubagentFile>, String> {
    info!("Listing subagents");
    let mut agents = Vec::new();

    // User-level agents (~/.claude/agents/)
    if let Ok(claude_dir) = get_claude_dir() {
        let user_agents_dir = claude_dir.join("agents");
        if user_agents_dir.exists() {
            agents.extend(scan_agents_directory(&user_agents_dir, "user")?);
        }
    }

    // Project-level agents (.claude/agents/)
    if let Some(proj_path) = project_path {
        let project_agents_dir = Path::new(&proj_path).join(".claude").join("agents");
        if project_agents_dir.exists() {
            agents.extend(scan_agents_directory(&project_agents_dir, "project")?);
        }
    }

    Ok(agents)
}

/// Scan agents directory for .md files
fn scan_agents_directory(dir: &Path, scope: &str) -> Result<Vec<SubagentFile>, String> {
    let mut agents = Vec::new();

    for entry in WalkDir::new(dir)
        .max_depth(2) // Limit depth
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Only process .md files
        if !path.is_file() || path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }

        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Read file content
        match fs::read_to_string(path) {
            Ok(content) => {
                let description = parse_description_from_content(&content);

                agents.push(SubagentFile {
                    name,
                    path: path.to_string_lossy().to_string(),
                    scope: scope.to_string(),
                    description,
                    content,
                });
            }
            Err(e) => {
                debug!("Failed to read agent file {:?}: {}", path, e);
            }
        }
    }

    Ok(agents)
}

/// List all Agent Skills in project and user directories
#[tauri::command]
pub async fn list_agent_skills(
    project_path: Option<String>,
) -> Result<Vec<AgentSkillFile>, String> {
    info!("Listing agent skills");
    let mut skills = Vec::new();

    // User-level skills (~/.claude/skills/)
    if let Ok(claude_dir) = get_claude_dir() {
        let user_skills_dir = claude_dir.join("skills");
        if user_skills_dir.exists() {
            skills.extend(scan_skills_directory(&user_skills_dir, "user")?);
        }
    }

    // Project-level skills (.claude/skills/)
    if let Some(proj_path) = project_path {
        let project_skills_dir = Path::new(&proj_path).join(".claude").join("skills");
        if project_skills_dir.exists() {
            skills.extend(scan_skills_directory(&project_skills_dir, "project")?);
        }
    }

    Ok(skills)
}

/// Scan skills directory for SKILL.md files
fn scan_skills_directory(dir: &Path, scope: &str) -> Result<Vec<AgentSkillFile>, String> {
    let mut skills = Vec::new();

    for entry in WalkDir::new(dir)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Only process files ending with SKILL.md
        if !path.is_file() {
            continue;
        }

        let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");

        if !file_name.ends_with("SKILL.md") {
            continue;
        }

        // Extract skill name from parent directory or file name
        // Skills can be:
        // 1. {name}/SKILL.md -> use directory name
        // 2. {name}.SKILL.md -> use file prefix
        let name = if file_name == "SKILL.md" {
            // Case 1: skill-name/SKILL.md -> use parent directory name
            path.parent()
                .and_then(|p| p.file_name())
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string()
        } else {
            // Case 2: skill-name.SKILL.md -> remove .SKILL.md suffix
            file_name.trim_end_matches(".SKILL.md").to_string()
        };

        // Read file content
        match fs::read_to_string(path) {
            Ok(content) => {
                let description = parse_description_from_content(&content);

                skills.push(AgentSkillFile {
                    name,
                    path: path.to_string_lossy().to_string(),
                    scope: scope.to_string(),
                    description,
                    content,
                });
            }
            Err(e) => {
                debug!("Failed to read skill file {:?}: {}", path, e);
            }
        }
    }

    Ok(skills)
}

/// Read a specific subagent file
#[tauri::command]
pub async fn read_subagent(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read subagent file: {}", e))
}

/// Read a specific skill file
#[tauri::command]
pub async fn read_skill(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read skill file: {}", e))
}

/// Open agents directory in file explorer
#[tauri::command]
pub async fn open_agents_directory(project_path: Option<String>) -> Result<String, String> {
    let agents_dir = if let Some(proj_path) = project_path {
        Path::new(&proj_path).join(".claude").join("agents")
    } else {
        get_claude_dir().map_err(|e| e.to_string())?.join("agents")
    };

    // Create directory if it doesn't exist
    fs::create_dir_all(&agents_dir)
        .map_err(|e| format!("Failed to create agents directory: {}", e))?;

    Ok(agents_dir.to_string_lossy().to_string())
}

/// Open skills directory in file explorer
#[tauri::command]
pub async fn open_skills_directory(project_path: Option<String>) -> Result<String, String> {
    let skills_dir = if let Some(proj_path) = project_path {
        Path::new(&proj_path).join(".claude").join("skills")
    } else {
        get_claude_dir().map_err(|e| e.to_string())?.join("skills")
    };

    // Create directory if it doesn't exist
    fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create skills directory: {}", e))?;

    Ok(skills_dir.to_string_lossy().to_string())
}

/// List all installed plugins
#[tauri::command]
pub async fn list_plugins(project_path: Option<String>) -> Result<Vec<PluginInfo>, String> {
    info!("Listing installed plugins with project_path: {:?}", project_path);
    let mut plugins = Vec::new();

    // Load system-level enabled plugins from ~/.claude/settings.json
    let system_enabled_plugins: HashSet<String> = if let Ok(claude_dir) = get_claude_dir() {
        let system_settings = claude_dir.join("settings.json");
        info!("Loading system-level enabled plugins from: {:?}", system_settings);
        if system_settings.exists() {
            load_enabled_plugins_simple(&system_settings).into_iter().collect()
        } else {
            info!("System settings.json does not exist");
            HashSet::new()
        }
    } else {
        info!("Could not get Claude directory");
        HashSet::new()
    };
    info!("System-level enabled plugins: {:?}", system_enabled_plugins);

    // Load project-level enabled plugins from .claude/settings.json
    let project_enabled_plugins: HashSet<String> = if let Some(ref proj_path) = project_path {
        let project_settings = Path::new(proj_path).join(".claude").join("settings.json");
        info!("Loading project-level enabled plugins from: {:?}", project_settings);
        if project_settings.exists() {
            load_enabled_plugins_simple(&project_settings).into_iter().collect()
        } else {
            info!("Project settings.json does not exist");
            HashSet::new()
        }
    } else {
        HashSet::new()
    };
    info!("Project-level enabled plugins: {:?}", project_enabled_plugins);

    // Collect all enabled plugin IDs (system + project)
    let all_enabled_plugins: Vec<String> = system_enabled_plugins
        .iter()
        .chain(project_enabled_plugins.iter())
        .cloned()
        .collect();

    // Scan plugins from ~/.claude/plugins/ and determine scope based on which settings.json they're in
    if let Ok(claude_dir) = get_claude_dir() {
        let plugins_dir = claude_dir.join("plugins");
        if plugins_dir.exists() {
            info!("Scanning plugins from: {:?}", plugins_dir);

            for plugin_id in &all_enabled_plugins {
                // Determine scope: if in project_enabled_plugins, it's "project", otherwise "system"
                let scope = if project_enabled_plugins.contains(plugin_id) {
                    info!("Plugin '{}' is project-level", plugin_id);
                    "project"
                } else if system_enabled_plugins.contains(plugin_id) {
                    info!("Plugin '{}' is system-level", plugin_id);
                    "user" // Backend uses "user" for system-level plugins
                } else {
                    "user"
                };

                // Try to find the plugin in the plugins directory
                let plugin_path = resolve_plugin_path(&plugins_dir, plugin_id);
                if let Some(path) = plugin_path {
                    if let Some(mut plugin_info) = build_plugin_info(plugin_id, &path, None, None) {
                        plugin_info.scope = scope.to_string();
                        plugin_info.enabled = true;
                        plugins.push(plugin_info);
                    }
                } else {
                    warn!("Could not find plugin '{}' in plugins directory", plugin_id);
                }
            }
        }
    }

    info!("Total plugins found: {}", plugins.len());
    Ok(plugins)
}

/// Resolve plugin path in the plugins directory
fn resolve_plugin_path(plugins_dir: &Path, plugin_id: &str) -> Option<PathBuf> {
    // Try to read from installed_plugins.json first
    let installed_json = plugins_dir.join("installed_plugins.json");
    if installed_json.exists() {
        if let Ok(content) = fs::read_to_string(&installed_json) {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(plugins_obj) = data.get("plugins").and_then(|v| v.as_object()) {
                    if let Some(plugin_entry) = plugins_obj.get(plugin_id) {
                        if let Some(install_path) = plugin_entry.get("installPath").and_then(|v| v.as_str()) {
                            let path = PathBuf::from(install_path);
                            if path.exists() {
                                info!("Found plugin '{}' in installed_plugins.json at: {:?}", plugin_id, path);
                                return Some(path);
                            }
                        }
                    }
                }
            }
        }
    }

    // Parse plugin_id format: plugin-name@marketplace-name
    if let Some(at_pos) = plugin_id.rfind('@') {
        let plugin_name = &plugin_id[..at_pos];
        let marketplace_name = &plugin_id[at_pos + 1..];

        // Try to find in cache directory structure: cache/marketplace-name/plugin-name/
        let cache_dir = plugins_dir.join("cache").join(marketplace_name).join(plugin_name);
        if cache_dir.exists() {
            info!("Found plugin '{}' in cache at: {:?}", plugin_id, cache_dir);

            // Try to find the latest version directory
            if let Ok(entries) = fs::read_dir(&cache_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        info!("Using version directory: {:?}", path);
                        return Some(path);
                    }
                }
            }

            // If no version subdirectory, use the cache directory itself
            return Some(cache_dir);
        }
    }

    // Fallback: try direct subdirectory
    let direct_path = plugins_dir.join(plugin_id);
    if direct_path.exists() {
        info!("Found plugin '{}' at direct path: {:?}", plugin_id, direct_path);
        return Some(direct_path);
    }

    warn!("Could not resolve path for plugin '{}'", plugin_id);
    None
}

fn build_plugin_info(
    plugin_identifier: &str,
    install_path: &Path,
    plugin_entry: Option<&serde_json::Value>,
    marketplace: Option<String>,
) -> Option<PluginInfo> {
    if !install_path.exists() {
        return None;
    }

    let plugin_json_path = install_path.join(".claude-plugin").join("plugin.json");

    let (name, description, version, author) = if plugin_json_path.exists() {
        if let Ok(content) = fs::read_to_string(&plugin_json_path) {
            if let Ok(manifest) = serde_json::from_str::<serde_json::Value>(&content) {
                let name = manifest
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or(plugin_identifier)
                    .to_string();

                let description = manifest
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                let version = manifest
                    .get("version")
                    .and_then(|v| v.as_str())
                    .or_else(|| {
                        plugin_entry
                            .and_then(|entry| entry.get("version").and_then(|v| v.as_str()))
                    })
                    .unwrap_or("unknown")
                    .to_string();

                let author = manifest
                    .get("author")
                    .and_then(|v| v.get("name"))
                    .and_then(|v| v.as_str())
                    .or_else(|| manifest.get("author").and_then(|v| v.as_str()))
                    .map(|s| s.to_string());

                (name, description, version, author)
            } else {
                (
                    plugin_identifier.to_string(),
                    None,
                    plugin_entry
                        .and_then(|entry| entry.get("version").and_then(|v| v.as_str()))
                        .unwrap_or("unknown")
                        .to_string(),
                    None,
                )
            }
        } else {
            (
                plugin_identifier.to_string(),
                None,
                plugin_entry
                    .and_then(|entry| entry.get("version").and_then(|v| v.as_str()))
                    .unwrap_or("unknown")
                    .to_string(),
                None,
            )
        }
    } else {
        (
            plugin_identifier.to_string(),
            None,
            plugin_entry
                .and_then(|entry| entry.get("version").and_then(|v| v.as_str()))
                .unwrap_or("unknown")
                .to_string(),
            None,
        )
    };

    let components = count_plugin_components(install_path);

    Some(PluginInfo {
        name,
        description,
        version,
        author,
        marketplace,
        path: install_path.to_string_lossy().to_string(),
        enabled: true,
        scope: "user".to_string(), // Default scope, will be overwritten by caller
        components,
    })
}

/// Count plugin components
fn count_plugin_components(plugin_dir: &Path) -> PluginComponents {
    let mut components = PluginComponents {
        commands: 0,
        agents: 0,
        skills: 0,
        hooks: 0,
        mcp_servers: 0,
    };

    // Count commands
    let commands_dir = plugin_dir.join("commands");
    if commands_dir.exists() {
        components.commands = WalkDir::new(&commands_dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("md"))
            .count();
    }

    // Count agents
    let agents_dir = plugin_dir.join("agents");
    if agents_dir.exists() {
        components.agents = WalkDir::new(&agents_dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("md"))
            .count();
    }

    // Count skills
    let skills_dir = plugin_dir.join("skills");
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

    // Check for hooks
    let hooks_file = plugin_dir.join("hooks").join("hooks.json");
    if hooks_file.exists() {
        components.hooks = 1;
    }

    // Check for MCP servers
    let mcp_file = plugin_dir.join(".mcp.json");
    if mcp_file.exists() {
        components.mcp_servers = 1;
    }

    components
}

/// Open plugins directory
#[tauri::command]
pub async fn open_plugins_directory(project_path: Option<String>) -> Result<String, String> {
    let plugins_dir = if let Some(proj_path) = project_path {
        Path::new(&proj_path).join(".claude").join("plugins")
    } else {
        get_claude_dir().map_err(|e| e.to_string())?.join("plugins")
    };

    // Create directory if it doesn't exist
    fs::create_dir_all(&plugins_dir)
        .map_err(|e| format!("Failed to create plugins directory: {}", e))?;

    Ok(plugins_dir.to_string_lossy().to_string())
}

/// Workspace project information
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceProject {
    /// Project name (directory name)
    pub name: String,
    /// Full project path
    pub path: String,
    /// Whether project has .claude directory
    pub has_claude_config: bool,
    /// Last modified time
    pub last_modified: Option<String>,
}

/// Get project plugins summary (lightweight API for displaying in project list)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPluginsSummary {
    /// Project-level plugin IDs
    pub project_plugins: Vec<String>,
    /// System-level plugin IDs
    pub system_plugins: Vec<String>,
}

#[tauri::command]
pub async fn get_project_plugins_summary(
    project_path: String,
) -> Result<ProjectPluginsSummary, String> {
    info!("Getting plugins summary for project: {}", project_path);

    // 1. Read system-level plugins
    let system_plugins = if let Ok(claude_dir) = get_claude_dir() {
        let system_settings = claude_dir.join("settings.json");
        if system_settings.exists() {
            load_enabled_plugins_simple(&system_settings)
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    // 2. Read project-level plugins
    let project_settings = Path::new(&project_path).join(".claude").join("settings.json");
    let project_plugins = if project_settings.exists() {
        load_enabled_plugins_simple(&project_settings)
    } else {
        Vec::new()
    };

    info!(
        "Project '{}' has {} project plugins, {} system plugins",
        project_path,
        project_plugins.len(),
        system_plugins.len()
    );

    Ok(ProjectPluginsSummary {
        project_plugins,
        system_plugins,
    })
}

/// List all workspace projects
/// Scans a directory for projects that have .claude configuration
#[tauri::command]
pub async fn list_workspace_projects(
    workspace_path: Option<String>,
) -> Result<Vec<WorkspaceProject>, String> {
    // Default workspace path: ~/Documents/Claude-Workspaces
    let workspace_dir = if let Some(path) = workspace_path {
        PathBuf::from(path)
    } else {
        dirs::document_dir()
            .ok_or("Could not find Documents directory")?
            .join("Claude-Workspaces")
    };

    info!("Scanning workspace directory: {:?}", workspace_dir);

    if !workspace_dir.exists() {
        info!("Workspace directory does not exist, creating it");
        fs::create_dir_all(&workspace_dir)
            .map_err(|e| format!("Failed to create workspace directory: {}", e))?;
        return Ok(Vec::new());
    }

    let mut projects = Vec::new();

    // Scan for project directories
    let entries = fs::read_dir(&workspace_dir)
        .map_err(|e| format!("Failed to read workspace directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Check if project has .claude directory
        let claude_dir = path.join(".claude");
        let has_claude_config = claude_dir.exists();

        // Get last modified time
        let last_modified = path
            .metadata()
            .ok()
            .and_then(|meta| meta.modified().ok())
            .and_then(|time| {
                let datetime: chrono::DateTime<chrono::Utc> = time.into();
                Some(datetime.format("%Y-%m-%d %H:%M:%S").to_string())
            });

        projects.push(WorkspaceProject {
            name,
            path: path.to_string_lossy().to_string(),
            has_claude_config,
            last_modified,
        });
    }

    // Sort by last modified (most recent first)
    projects.sort_by(|a, b| {
        b.last_modified
            .as_ref()
            .cmp(&a.last_modified.as_ref())
    });

    info!("Found {} projects in workspace", projects.len());

    Ok(projects)
}

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
    pub email: String,
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

    if !marketplace_path.exists() {
        return Err(format!("Marketplace install location does not exist: {:?}", marketplace_path));
    }

    let marketplace_file = marketplace_path.join(".claude-plugin").join("marketplace.json");
    let marketplace_info = read_marketplace_info(&marketplace_file)?;

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

/// 安装插件到项目级目录
#[tauri::command]
pub async fn install_plugin_to_project(
    project_path: String,
    marketplace_name: String,
    plugin_name: String,
) -> Result<String, String> {
    info!("Installing plugin {} from {} to project {}", plugin_name, marketplace_name, project_path);

    // 从 known_marketplaces.json 获取市场路径
    let known_marketplaces = read_known_marketplaces()?;
    let marketplace_config = known_marketplaces.get(&marketplace_name)
        .ok_or_else(|| format!("Marketplace not found: {}", marketplace_name))?;

    let marketplace_path = PathBuf::from(&marketplace_config.install_location);

    // 读取 marketplace 信息
    let marketplace_file = marketplace_path.join(".claude-plugin").join("marketplace.json");
    let marketplace_info = read_marketplace_info(&marketplace_file)?;

    // 找到对应的插件
    let marketplace_plugin = marketplace_info.plugins
        .iter()
        .find(|p| p.name == plugin_name)
        .ok_or_else(|| format!("Plugin not found: {}", plugin_name))?;

    // 解析插件源路径
    let plugin_source = if marketplace_plugin.source.starts_with("./") {
        marketplace_path.join(marketplace_plugin.source.trim_start_matches("./"))
    } else {
        marketplace_path.join(&marketplace_plugin.source)
    };

    if !plugin_source.exists() {
        return Err(format!("Plugin source not found: {:?}", plugin_source));
    }

    // 目标目录
    let project_claude_dir = PathBuf::from(&project_path).join(".claude");
    fs::create_dir_all(&project_claude_dir)
        .map_err(|e| format!("Failed to create .claude directory: {}", e))?;

    // 如果是 skills 集合插件
    if !marketplace_plugin.skills.is_empty() {
        install_skills_collection(&marketplace_path, &marketplace_plugin.skills, &project_claude_dir, &plugin_name)?;
    } else {
        // 标准插件，安装各个组件
        install_plugin_components(&plugin_source, &project_claude_dir, &plugin_name)?;
    }

    // 记录已安装的插件
    let metadata = build_plugin_metadata(&plugin_source, marketplace_plugin, &marketplace_name, &marketplace_info.version)?;
    record_installed_plugin(&project_path, &metadata)?;

    info!("Successfully installed plugin: {}", plugin_name);
    Ok(format!("Successfully installed plugin: {}", plugin_name))
}

/// 安装 skills 集合
fn install_skills_collection(
    marketplace_path: &Path,
    skills: &[String],
    project_claude_dir: &Path,
    plugin_name: &str,
) -> Result<(), String> {
    let dst_skills = project_claude_dir.join("skills").join(plugin_name);
    fs::create_dir_all(&dst_skills)
        .map_err(|e| format!("Failed to create skills directory: {}", e))?;

    for skill_path_str in skills {
        let skill_path = if skill_path_str.starts_with("./") {
            marketplace_path.join(skill_path_str.trim_start_matches("./"))
        } else {
            marketplace_path.join(skill_path_str)
        };

        if skill_path.exists() {
            // 复制整个 skill 目录
            let skill_name = skill_path.file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown");

            let dst_skill = dst_skills.join(skill_name);
            copy_dir_recursive(&skill_path, &dst_skill)?;
            debug!("Installed skill: {}", skill_name);
        } else {
            warn!("Skill path not found: {:?}", skill_path);
        }
    }

    Ok(())
}

/// 安装标准插件组件
fn install_plugin_components(
    plugin_source: &Path,
    project_claude_dir: &Path,
    plugin_name: &str,
) -> Result<(), String> {
    // 安装 commands
    let src_commands = plugin_source.join("commands");
    if src_commands.exists() {
        let dst_commands = project_claude_dir.join("commands").join(plugin_name);
        copy_dir_recursive(&src_commands, &dst_commands)?;
        info!("Installed commands for plugin: {}", plugin_name);
    }

    // 安装 agents
    let src_agents = plugin_source.join("agents");
    if src_agents.exists() {
        let dst_agents = project_claude_dir.join("agents").join(plugin_name);
        copy_dir_recursive(&src_agents, &dst_agents)?;
        info!("Installed agents for plugin: {}", plugin_name);
    }

    // 安装 skills
    let src_skills = plugin_source.join("skills");
    if src_skills.exists() {
        let dst_skills = project_claude_dir.join("skills").join(plugin_name);
        copy_dir_recursive(&src_skills, &dst_skills)?;
        info!("Installed skills for plugin: {}", plugin_name);
    }

    // 安装 hooks（需要合并）
    let src_hooks = plugin_source.join("hooks").join("hooks.json");
    if src_hooks.exists() {
        let dst_hooks_dir = project_claude_dir.join("hooks");
        fs::create_dir_all(&dst_hooks_dir)
            .map_err(|e| format!("Failed to create hooks directory: {}", e))?;

        merge_hooks_json(&src_hooks, &dst_hooks_dir.join("hooks.json"), plugin_name)?;
        info!("Installed hooks for plugin: {}", plugin_name);
    }

    // 安装 MCP 配置（需要合并）
    let src_mcp = plugin_source.join(".mcp.json");
    if src_mcp.exists() {
        merge_mcp_json(&src_mcp, &project_claude_dir.join(".mcp.json"), plugin_name)?;
        info!("Installed MCP config for plugin: {}", plugin_name);
    }

    Ok(())
}

/// 递归复制目录
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create directory {:?}: {}", dst, e))?;

    for entry in fs::read_dir(src)
        .map_err(|e| format!("Failed to read directory {:?}: {}", src, e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let file_name = path.file_name().unwrap();
        let dst_path = dst.join(file_name);

        if path.is_dir() {
            copy_dir_recursive(&path, &dst_path)?;
        } else {
            fs::copy(&path, &dst_path)
                .map_err(|e| format!("Failed to copy file {:?}: {}", path, e))?;
        }
    }

    Ok(())
}

/// 合并 hooks.json
fn merge_hooks_json(src: &Path, dst: &Path, plugin_name: &str) -> Result<(), String> {
    let src_content = fs::read_to_string(src)
        .map_err(|e| format!("Failed to read source hooks: {}", e))?;
    let src_hooks: serde_json::Value = serde_json::from_str(&src_content)
        .map_err(|e| format!("Failed to parse source hooks: {}", e))?;

    let mut dst_hooks = if dst.exists() {
        let dst_content = fs::read_to_string(dst)
            .map_err(|e| format!("Failed to read destination hooks: {}", e))?;
        serde_json::from_str(&dst_content)
            .map_err(|e| format!("Failed to parse destination hooks: {}", e))?
    } else {
        serde_json::json!({})
    };

    // 合并逻辑：为每个 hook 添加 plugin 前缀，避免冲突
    if let (Some(dst_obj), Some(src_obj)) = (dst_hooks.as_object_mut(), src_hooks.as_object()) {
        for (key, value) in src_obj {
            // 为 hook 名称添加插件前缀
            let prefixed_key = format!("{}:{}", plugin_name, key);
            dst_obj.insert(prefixed_key, value.clone());
        }
    }

    let json_string = serde_json::to_string_pretty(&dst_hooks)
        .map_err(|e| format!("Failed to serialize hooks: {}", e))?;

    fs::write(dst, json_string)
        .map_err(|e| format!("Failed to write hooks: {}", e))?;

    Ok(())
}

/// 合并 .mcp.json
fn merge_mcp_json(src: &Path, dst: &Path, plugin_name: &str) -> Result<(), String> {
    let src_content = fs::read_to_string(src)
        .map_err(|e| format!("Failed to read source MCP: {}", e))?;
    let src_mcp: serde_json::Value = serde_json::from_str(&src_content)
        .map_err(|e| format!("Failed to parse source MCP: {}", e))?;

    let mut dst_mcp = if dst.exists() {
        let dst_content = fs::read_to_string(dst)
            .map_err(|e| format!("Failed to read destination MCP: {}", e))?;
        serde_json::from_str(&dst_content)
            .map_err(|e| format!("Failed to parse destination MCP: {}", e))?
    } else {
        serde_json::json!({ "mcpServers": {} })
    };

    // 合并 MCP 服务器配置
    if let (Some(dst_servers), Some(src_servers)) = (
        dst_mcp.get_mut("mcpServers").and_then(|v| v.as_object_mut()),
        src_mcp.get("mcpServers").and_then(|v| v.as_object())
    ) {
        for (server_name, server_config) in src_servers {
            // 为服务器名称添加插件前缀
            let prefixed_name = format!("{}:{}", plugin_name, server_name);
            dst_servers.insert(prefixed_name, server_config.clone());
        }
    }

    let json_string = serde_json::to_string_pretty(&dst_mcp)
        .map_err(|e| format!("Failed to serialize MCP: {}", e))?;

    fs::write(dst, json_string)
        .map_err(|e| format!("Failed to write MCP: {}", e))?;

    Ok(())
}

/// 记录已安装的插件
fn record_installed_plugin(project_path: &str, metadata: &PluginMetadata) -> Result<(), String> {
    let record_file = PathBuf::from(project_path)
        .join(".claude")
        .join("installed_plugins.json");

    let mut installed = if record_file.exists() {
        let content = fs::read_to_string(&record_file)
            .map_err(|e| format!("Failed to read installed plugins: {}", e))?;
        serde_json::from_str::<serde_json::Value>(&content)
            .map_err(|e| format!("Failed to parse installed plugins: {}", e))?
    } else {
        serde_json::json!({
            "version": 1,
            "plugins": {}
        })
    };

    if let Some(plugins_obj) = installed.get_mut("plugins").and_then(|v| v.as_object_mut()) {
        // 使用 marketplace:plugin-name 作为 key
        let plugin_key = format!("{}:{}", metadata.marketplace, metadata.name);
        plugins_obj.insert(
            plugin_key,
            serde_json::to_value(metadata)
                .map_err(|e| format!("Failed to serialize metadata: {}", e))?,
        );
    }

    let json_string = serde_json::to_string_pretty(&installed)
        .map_err(|e| format!("Failed to serialize installed plugins: {}", e))?;

    fs::write(&record_file, json_string)
        .map_err(|e| format!("Failed to write installed plugins: {}", e))?;

    Ok(())
}

/// 卸载项目级插件
#[tauri::command]
pub async fn uninstall_plugin_from_project(
    project_path: String,
    marketplace_name: String,
    plugin_name: String,
) -> Result<String, String> {
    info!("Uninstalling plugin {} from project {}", plugin_name, project_path);

    let project_claude_dir = PathBuf::from(&project_path).join(".claude");

    // 删除各个组件目录
    let components = [
        project_claude_dir.join("commands").join(&plugin_name),
        project_claude_dir.join("agents").join(&plugin_name),
        project_claude_dir.join("skills").join(&plugin_name),
    ];

    for component_path in &components {
        if component_path.exists() {
            fs::remove_dir_all(component_path)
                .map_err(|e| format!("Failed to remove directory {:?}: {}", component_path, e))?;
            debug!("Removed directory: {:?}", component_path);
        }
    }

    // TODO: 清理 hooks.json 和 .mcp.json 中的条目（需要实现反向操作）

    // 更新 installed_plugins.json
    let record_file = project_claude_dir.join("installed_plugins.json");
    if record_file.exists() {
        let content = fs::read_to_string(&record_file)
            .map_err(|e| format!("Failed to read installed plugins: {}", e))?;
        let mut installed: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse installed plugins: {}", e))?;

        if let Some(plugins_obj) = installed.get_mut("plugins").and_then(|v| v.as_object_mut()) {
            let plugin_key = format!("{}:{}", marketplace_name, plugin_name);
            plugins_obj.remove(&plugin_key);
        }

        let json_string = serde_json::to_string_pretty(&installed)
            .map_err(|e| format!("Failed to serialize installed plugins: {}", e))?;

        fs::write(&record_file, json_string)
            .map_err(|e| format!("Failed to write installed plugins: {}", e))?;
    }

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

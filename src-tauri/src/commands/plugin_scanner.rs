use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::types::{InstalledPlugin, PluginLocation, ScanResult, ScanSummary};
use crate::commands::{agent_config, marketplace, install_history};

#[tauri::command]
pub fn scan_installed_plugins(
    app: tauri::AppHandle,
    scope: Option<String>,
    project_path: Option<String>,
) -> Result<ScanResult, String> {
    let mut result = ScanResult {
        total_count: 0,
        by_scope: ScanSummary {
            global: 0,
            project: 0,
        },
        by_agent: HashMap::new(),
        plugins: Vec::new(),
    };

    // 获取市场数据和所有代理配置
    let marketplace = marketplace::get_marketplace_data(app)?;
    let agents = agent_config::all_agents();

    // 扫描全局作用域
    if scope.is_none() || scope.as_deref() == Some("global") {
        for agent in &agents {
            if let Some(global_path) = agent_config::get_agent_global_path(&agent.id) {
                if global_path.exists() {
                    scan_directory(
                        &global_path,
                        &agent.id,
                        "global",
                        None,
                        &marketplace,
                        &mut result,
                    )?;
                }
            }
        }
    }

    // 扫描项目作用域
    if scope.is_none() || scope.as_deref() == Some("project") {
        let project_paths = if let Some(path) = project_path {
            vec![path]
        } else {
            // 如果没有指定路径，尝试从历史记录中发现所有已安装过的项目路径
            if let Ok(history) = install_history::get_install_history(None, None) {
                history.into_iter()
                    .filter(|r| r.status == "success")
                    .filter_map(|r| r.project_path)
                    .filter(|p| !p.is_empty())
                    .collect::<std::collections::HashSet<_>>()
                    .into_iter()
                    .collect()
            } else {
                Vec::new()
            }
        };

        for proj_path in project_paths {
            for agent in &agents {
                if let Some(project_skill_path) =
                    agent_config::get_agent_project_path(&agent.id, &proj_path)
                {
                    if project_skill_path.exists() {
                        scan_directory(
                            &project_skill_path,
                            &agent.id,
                            "project",
                            Some(proj_path.clone()),
                            &marketplace,
                            &mut result,
                        )?;
                    }
                }
            }
        }
    }

    result.total_count = result.plugins.len();
    Ok(result)
}

#[tauri::command]
pub fn search_installed_plugins(
    app: tauri::AppHandle,
    query: String,
    scope: Option<String>,
    project_path: Option<String>,
) -> Result<Vec<InstalledPlugin>, String> {
    if query.is_empty() {
        let all = scan_installed_plugins(app, scope, project_path)?;
        return Ok(all.plugins);
    }

    let all_plugins_result = scan_installed_plugins(app, scope, project_path)?;
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    for plugin in all_plugins_result.plugins {
        let mut score = 0.0;
        
        if plugin.name.to_lowercase().contains(&query_lower) {
            score += 3.0;
            if plugin.name.to_lowercase() == query_lower {
                score += 2.0;
            }
        }
        
        if let Some(cat) = &plugin.category {
            if cat.to_lowercase().contains(&query_lower) {
                score += 2.0;
            }
        }
        
        if let Some(desc) = &plugin.description {
            if desc.to_lowercase().contains(&query_lower) {
                score += 1.0;
            }
        }

        if score > 0.0 {
            results.push((plugin, score));
        }
    }

    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    Ok(results.into_iter().map(|(p, _)| p).collect())
}

fn scan_directory(
    dir: &PathBuf,
    agent_id: &str,
    scope: &str,
    project_path: Option<String>,
    marketplace: &marketplace::MarketplaceData,
    result: &mut ScanResult,
) -> Result<(), String> {
    // Recursively find all directories that contain SKILL.md
    let skill_dirs = find_skill_dirs(dir, 5); // Max depth 5 should cover most nested structures

    for path in skill_dirs {
        let skill_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // ---------------------------------------------------------
        // Refactored Logic (Skill-Centric for Global)
        // ---------------------------------------------------------

        let found_plugin_marketplace = find_plugin_for_skill(&skill_name, marketplace);
        
        // Project Scope: Match Marketplace OR read Local Metadata
        if scope == "project" {
            if let Some(plugin) = found_plugin_marketplace {
               process_record(
                   plugin.name, 
                   plugin.category, 
                   Some(plugin.description), 
                   skill_name, 
                   path, 
                   scope, 
                   project_path.clone(), 
                   agent_id, 
                   result
               )?;
            } else {
                // If not found in marketplace, still try to identify as a local skill
                let metadata = read_skill_metadata(&path);
                process_record(
                    skill_name.clone(),
                    metadata.category,
                    metadata.description.or_else(|| Some("Project local skill".to_string())),
                    skill_name,
                    path,
                    scope,
                    project_path.clone(),
                    agent_id,
                    result
                )?;
            }
        } 
        // Global Scope: Skill-Centric (Ignore Marketplace Grouping)
        else if scope == "global" {
            // Read metadata directly from skill.json
            let metadata = read_skill_metadata(&path);
            
            // Use skill directory name as the "Plugin Name"
            let display_name = skill_name.to_string(); 
            
            // Use metadata category or default to None (was "Global Skill")
            let category = metadata.category;
            
            // Use metadata description or fallback
            let description = metadata.description.or_else(|| {
                Some("Locally detected skill".to_string())
            });

            process_record(
                display_name,
                category,
                description,
                skill_name,
                path,
                scope,
                None, // Global has no project path
                agent_id,
                result
            )?;
        }
    }

    Ok(())
}

// Helper to recursively find directories containing SKILL.md
fn find_skill_dirs(dir: &PathBuf, depth: u32) -> Vec<PathBuf> {
    let mut skills = Vec::new();

    if depth == 0 {
        return skills;
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    // Check if SKILL.md exists in this directory
                    if path.join("SKILL.md").exists() {
                        skills.push(path.clone());
                        // If found a skill, we assume skills are not nested inside other skills
                        // so we don't recurse further into this directory
                    } else {
                        // If not a skill itself, search inside
                        skills.extend(find_skill_dirs(&path, depth - 1));
                    }
                }
            }
        }
    }

    skills
}

fn process_record(
    plugin_name: String,
    category: Option<String>,
    description: Option<String>,
    skill_name: String,
    path: PathBuf,
    scope: &str,
    project_path: Option<String>,
    agent_id: &str,
    result: &mut ScanResult,
) -> Result<(), String> {
    let meta = read_skill_metadata(&path);
    let version = meta.version;
    let install_time = get_install_time(&path)?;
    let size = calculate_dir_size(&path)?;
    let source_type = meta.source_type;

    // Check if record exists (by Name)
    let existing = result
        .plugins
        .iter_mut()
        .find(|p| p.name == plugin_name);

    if let Some(plugin_record) = existing {
        // Update agent list
        if !plugin_record.agents.contains(&agent_id.to_string()) {
            plugin_record.agents.push(agent_id.to_string());
        }
        // Add skill to list
        if !plugin_record.skills.contains(&skill_name) {
            plugin_record.skills.push(skill_name);
        }
        // Add path
        let path_str = path.to_string_lossy().to_string();
        if !plugin_record.location.paths.contains(&path_str) {
            plugin_record.location.paths.push(path_str.clone());
        }
        // Add to paths_by_agent
        plugin_record.paths_by_agent.insert(agent_id.to_string(), path_str);

    } else {
        // Create new record
        let mut paths_by_agent = HashMap::new();
        paths_by_agent.insert(agent_id.to_string(), path.to_string_lossy().to_string());

        let installed = InstalledPlugin {
            name: plugin_name,
            category,
            description,
            version,
            installed_at: install_time,
            location: PluginLocation {
                scope: scope.to_string(),
                project_path,
                paths: vec![path.to_string_lossy().to_string()],
            },
            agents: vec![agent_id.to_string()],
            skills: vec![skill_name],
            size_bytes: size,
            paths_by_agent,
            source_type,
        };
        result.plugins.push(installed);
    }
    
    // Update stats
    if scope == "global" {
        result.by_scope.global += 1;
    } else {
        result.by_scope.project += 1;
    }
    *result.by_agent.entry(agent_id.to_string()).or_insert(0) += 1;

    Ok(())
}

fn find_plugin_for_skill(
    skill_name: &str,
    marketplace: &marketplace::MarketplaceData,
) -> Option<marketplace::Plugin> {
    marketplace.plugins.iter().find(|plugin| {
        plugin.skills.iter().any(|skill_path| {
            // 检查skill路径是否以该skill_name结尾
            skill_path.ends_with(skill_name) || skill_path.split('/').last().map_or(false, |n| n == skill_name)
        })
    }).cloned()
}

fn get_install_time(dir: &std::path::Path) -> Result<String, String> {
    let metadata = std::fs::metadata(dir).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;

    // 转换为ISO 8601格式
    let datetime: chrono::DateTime<chrono::Utc> = modified.into();
    Ok(datetime.to_rfc3339())
}

struct SkillMetadata {
    version: Option<String>,
    description: Option<String>,
    category: Option<String>,
    source_type: Option<String>,
}

fn read_skill_metadata(dir: &std::path::Path) -> SkillMetadata {
    let mut metadata = SkillMetadata {
        version: None,
        description: None,
        category: None,
        source_type: None,
    };

    // 1. Try to read from SKILL.md (Frontmatter) first for rich description
    let skill_md_path = dir.join("SKILL.md");
    if skill_md_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&skill_md_path) {
            // Simple frontmatter parser
            let lines: Vec<&str> = content.lines().collect();
            if lines.len() > 0 && lines[0].trim() == "---" {
                for line in lines.iter().skip(1) {
                    if line.trim() == "---" {
                        break;
                    }
                    if let Some((key, value)) = line.split_once(':') {
                        let key = key.trim();
                        let value = value.trim().to_string();
                        if key == "description" {
                             metadata.description = Some(value);
                        }
                        // We could also extract name/category here if needed
                    }
                }
            }
        }
    }

    // 2. Fallback / Merge with skill.json
    let skill_json_path = dir.join("skill.json");
    if skill_json_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&skill_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(v) = json.get("version") {
                    metadata.version = v.as_str().map(|s| s.to_string());
                }
                // Only use skill.json description if we haven't found one in SKILL.md
                if metadata.description.is_none() {
                    if let Some(d) = json.get("description") {
                         metadata.description = d.as_str().map(|s| s.to_string());
                    }
                }
                if let Some(c) = json.get("category") {
                    metadata.category = c.as_str().map(|s| s.to_string());
                }
            }
        }
    }

    // 3. Read .metadata.json (Installed Metadata)
    let meta_json_path = dir.join(".metadata.json");
    if meta_json_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&meta_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(st) = json.get("source_type") {
                    metadata.source_type = st.as_str().map(|s| s.to_string());
                }
            }
        }
    }

    metadata
}

fn calculate_dir_size(dir: &std::path::Path) -> Result<u64, String> {
    let mut size = 0u64;
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        if metadata.is_dir() {
            size += calculate_dir_size(&entry.path())?;
        } else {
            size += metadata.len();
        }
    }
    Ok(size)
}

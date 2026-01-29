use crate::commands::agent_config;
use crate::commands::marketplace;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[tauri::command]
pub fn install_plugin(
    app: tauri::AppHandle,
    plugin_name: String,
    agents: Vec<String>,
    scope_type: String, // "global" or "project"
    scope_path: Option<String>,
) -> Result<String, String> {
    // 1. Get marketplace data to find skills
    let data = marketplace::get_marketplace_data(app.clone()).map_err(|e| e)?;
    let plugin = data
        .plugins
        .iter()
        .find(|p| p.name == plugin_name)
        .ok_or_else(|| format!("Plugin {} not found", plugin_name))?;

    // 2. Resolve Source Root (Skill-Box root)
    let mut paths = Vec::new();

    // If plugin has a pre-defined source path (e.g. from a configured repository), use it first
    if let Some(ref sp) = plugin.source_path {
        paths.push(PathBuf::from(sp));
    }

    // Fallback paths for development or packaged resources
    paths.push(PathBuf::from("Skill-Box"));
    paths.push(PathBuf::from("../Skill-Box"));

    // Check for packaged resources
    if let Ok(resource_dir) = app.path().resource_dir() {
        paths.push(resource_dir.join("Skill-Box"));
        paths.push(resource_dir.join("_up_").join("Skill-Box"));
    }
    
    let source_root = paths
        .iter()
        .find(|p| p.join(".claude-plugin/marketplace.json").exists())
        .ok_or_else(|| {
            let current_dir = std::env::current_dir().unwrap_or_default();
            format!(
                "Skill-Box repo not found. Searched in: {:?}. Current Dir: {:?}",
                paths, current_dir
            )
        })?;

    let mut results = Vec::new();

    // 3. For each agent
    for agent_id in &agents {
        // Resolve Target Path
        let target_root = if scope_type == "global" {
            agent_config::get_agent_global_path(&agent_id)
        } else {
            if let Some(ref p) = scope_path {
                agent_config::get_agent_project_path(&agent_id, p)
            } else {
                None
            }
        };

        if let Some(root) = target_root {
            // Create root if not exists
            if !root.exists() {
                if let Err(e) = fs::create_dir_all(&root) {
                    results.push(format!("{}: Failed to create dir ({})", agent_id, e));
                    continue;
                }
            }

            // Copy skills
            for skill_rel_path in &plugin.skills {
                // skill_rel_path: "./category/skill-name"
                let clean_rel = skill_rel_path.trim_start_matches("./");
                let source_path = source_root.join(clean_rel);

                // Target: root / skill_name
                let skill_name = Path::new(clean_rel).file_name().unwrap_or_default();
                let target_path = root.join(skill_name);

                if source_path.exists() {
                    // Start copy
                    if let Err(e) = copy_dir_all(&source_path, &target_path) {
                        results.push(format!(
                            "{}: Copy failed for {} ({})",
                            agent_id,
                            skill_name.to_string_lossy(),
                            e
                        ));
                    }
                } else {
                    results.push(format!(
                        "{}: Source skill not found ({:?})",
                        agent_id, source_path
                    ));
                }
            }
            results.push(format!("{}: Success", agent_id));
        } else {
            results.push(format!("{}: Invalid path config", agent_id));
        }
    }

    // 4. 记录安装历史
    let success = results.iter().all(|r| r.contains("Success"));
    let error_message = if !success {
        Some(results.join("; "))
    } else {
        None
    };

    if let Err(e) = super::install_history::record_install_history(
        &plugin_name,
        &agents,
        &scope_type,
        scope_path,
        success,
        error_message,
        plugin.skills.clone(),
    ) {
        eprintln!("Failed to record install history: {}", e);
    }

    Ok(results.join(", "))
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

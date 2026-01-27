use crate::commands::agent_config;
use crate::commands::install_history;
use std::fs;
use std::path::{Path, PathBuf};

#[tauri::command]
pub fn install_local_skill(
    skill_path: String,
    scope: String, // "global" or "project"
    selected_agents: Vec<String>,
    scope_path: Option<String>,
) -> Result<String, String> {
    let source_path = PathBuf::from(&skill_path);

    // 1. Validate source
    if !source_path.exists() {
        return Err(format!("Skill path does not exist: {}", skill_path));
    }
    if !source_path.join("SKILL.md").exists() {
        return Err(format!("Invalid skill directory (missing SKILL.md): {}", skill_path));
    }

    let skill_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid skill path name")?
        .to_string();

    let mut results = Vec::new();

    // 2. Install for each agent
    for agent_id in &selected_agents {
        // Resolve Target Path
        let target_root = if scope == "global" {
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

            // Target: root / skill_name
            let target_path = root.join(&skill_name);

            // Copy
            if let Err(e) = copy_dir_all(&source_path, &target_path) {
                 results.push(format!(
                    "{}: Copy failed ({})",
                    agent_id,
                    e
                ));
            } else {
                
                // Optional: Create .metadata.json in the installed skill dir
                let _ = create_install_metadata(&target_path, &skill_path, &scope);

                results.push(format!("{}: Success", agent_id));
            }
        } else {
            results.push(format!("{}: Invalid path config", agent_id));
        }
    }

    // 3. Record history
    let success = results.iter().all(|r| r.contains("Success"));
    let error_message = if !success {
        Some(results.join("; "))
    } else {
        None
    };

    if let Err(e) = install_history::record_install_history(
        &skill_name,
        &selected_agents,
        &scope,
        scope_path,
        success,
        error_message,
        vec![skill_name.clone()],
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
        // Skip .git or other ignored files if needed, but for now copy all
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn create_install_metadata(target_dir: &Path, source_path: &str, scope: &str) -> std::io::Result<()> {
    use serde_json::json;
    let metadata_path = target_dir.join(".metadata.json");
    let metadata = json!({
        "installed_from": source_path,
        "installation_scope": scope,
        "installed_date": chrono::Utc::now().to_rfc3339(),
        "source_type": "LocalDirectory"
    });
    fs::write(metadata_path, serde_json::to_string_pretty(&metadata)?)?;
    Ok(())
}

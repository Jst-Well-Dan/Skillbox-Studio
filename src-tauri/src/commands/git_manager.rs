use std::process::Command;
use std::path::{Path, PathBuf};
use crate::types::{RepositoryInfo, UpdateResult, ValidationResult};
use crate::commands::marketplace::MarketplaceData;

pub async fn clone_repository(url: &str, dest: &Path) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let output = Command::new("git")
        .args(&["clone", url, dest.to_str().unwrap()])
        .output()
        .map_err(|e| format!("Failed to execute git clone: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git clone failed: {}", stderr));
    }

    Ok(())
}

pub async fn pull_repository(path: &Path) -> Result<String, String> {
    let output = Command::new("git")
        .args(&["-C", path.to_str().unwrap(), "pull"])
        .output()
        .map_err(|e| format!("Failed to execute git pull: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git pull failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn add_marketplace_repository(
    url: String,
    name: String,
    auth_type: String,
    _auth_token: Option<String> // Token handling to be added later if needed
) -> Result<RepositoryInfo, String> {
    // Determine storage path
    // For now, use a fixed directory under .skillbox-studio/repositories
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let repo_id = uuid::Uuid::new_v4().to_string();
    let repo_dir_name = format!("repo-{}", repo_id);
    let dest_path = home_dir.join(".skillbox-studio").join("repositories").join(&repo_dir_name);

    // Clone repo
    clone_repository(&url, &dest_path).await?;

    // Validate
    match validate_repo_path(&dest_path) {
        Ok(_) => {},
        Err(e) => {
             // Cleanup if validation fails
             let _ = std::fs::remove_dir_all(&dest_path);
             return Err(format!("Invalid marketplace repository: {}", e));
        }
    }
    
    // Create Repo Info
    let info = RepositoryInfo {
        id: repo_id,
        name: if name.is_empty() { "Custom Repository".to_string() } else { name },
        url,
        repo_type: "custom".to_string(),
        enabled: true,
        priority: 10, // Default low priority for new repos
        local_path: dest_path.to_str().unwrap().to_string(),
        last_updated: chrono::Utc::now().to_rfc3339(),
        auth_type,
    };

    // Note: We need to save this to config, but this command just returns the info. 
    // The orchestration should probably happen in a "service" layer, or front end calls add_repo then save_config.
    // However, to be atomic, we should probably inject config manager here. 
    // For simplicity, let's assume the frontend will receive this and then call "update_marketplace_config" or similar,
    // OR this command should be in config_manager or have access to it.
    // Better design: separate "Git Manager" (pure git ops) from "commands" that bind to frontend.
    // But since this is `src/commands/git_manager.rs`, let's make it a tauri command that DOES it all if possible.
    // Ideally we update config here.
    
    // For now, let's just return the info. The frontend can add it to the list and save.
    // actually, to be safe, let's keep it simple.
    
    Ok(info)
}


pub fn validate_repo_path(path: &Path) -> Result<u32, String> {
    let marketplace_json = path.join(".claude-plugin").join("marketplace.json");
    
    if !marketplace_json.exists() {
        return Err("Repository does not contain .claude-plugin/marketplace.json".to_string());
    }

    let content = std::fs::read_to_string(&marketplace_json)
        .map_err(|e| format!("Failed to read marketplace.json: {}", e))?;
    
    let data: MarketplaceData = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid marketplace.json format: {}", e))?;

    Ok(data.plugins.len() as u32)
}

#[tauri::command]
pub async fn validate_marketplace_repository(path: String) -> Result<ValidationResult, String> {
    match validate_repo_path(Path::new(&path)) {
        Ok(count) => Ok(ValidationResult {
            valid: true,
            errors: vec![],
            plugin_count: count,
        }),
        Err(e) => Ok(ValidationResult {
            valid: false,
            errors: vec![e],
            plugin_count: 0,
        })
    }
}

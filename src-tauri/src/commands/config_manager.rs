use std::fs;
use std::path::PathBuf;
use crate::types::{AppConfig, GeneralSettings, RepositoryInfo};
use tauri::Manager;

fn get_config_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_dir = home_dir.join(".skillbox-studio");
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    Ok(config_dir.join("config.json"))
}

pub fn load_config(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let path = get_config_path()?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut config: AppConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Ensure official repository exists and is unique/correctly named
    let official_id = "skillbox-official";
    let official_url = "https://github.com/Jst-Well-Dan/Skill-Box";
    
    // Separate official and others
    let (mut officials, others): (Vec<RepositoryInfo>, Vec<RepositoryInfo>) = config.marketplace.repositories
        .into_iter()
        .partition(|r| r.id == official_id || r.url == official_url || r.name == "Skillbox Official");
        
    // Determine best path for official repo
    let mut official_local_path = "../Skill-Box".to_string();
    if let Ok(resource_dir) = app.path().resource_dir() {
        // Paths to check for the .claude-plugin marker
        let candidates = vec![
            resource_dir.join("Skill-Box"),
            resource_dir.join("_up_").join("Skill-Box"),
            resource_dir.clone(),
            resource_dir.parent().unwrap_or(&resource_dir).join("Skill-Box"),
        ];

        for candidate in candidates {
            if candidate.join(".claude-plugin").exists() {
                official_local_path = candidate.to_string_lossy().to_string();
                break;
            }
        }
    }

    // Take the best official candidate or create one
    let official = if !officials.is_empty() {
        let mut r = officials.remove(0); // Take first
        r.id = official_id.to_string();
        r.name = "Skillbox".to_string(); // Update name
        r.repo_type = "official".to_string();
        // Always update path to match current environment
        r.local_path = official_local_path;
        r
    } else {
        RepositoryInfo {
             id: official_id.to_string(),
             name: "Skillbox".to_string(),
             url: official_url.to_string(),
             repo_type: "official".to_string(),
             enabled: true,
             priority: 0,
             local_path: official_local_path,
             last_updated: chrono::Utc::now().to_rfc3339(),
             auth_type: "public".to_string(),
        }
    };
    
    // Reconstruct
    let mut new_repos = vec![official];
    new_repos.extend(others);
    config.marketplace.repositories = new_repos;

    // Save if changed (Check logic might need refinement to avoid loops, but OK for now)
    let new_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    if new_content != content {
         let path = get_config_path()?;
         fs::write(path, &new_content).map_err(|e| e.to_string())?;
    }

    Ok(config)
}

#[tauri::command]
pub fn get_app_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    load_config(&app)
}

#[tauri::command]
pub fn save_app_config(config: AppConfig) -> Result<(), String> {
    let path = get_config_path()?;
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_general_settings(app: tauri::AppHandle, settings: GeneralSettings) -> Result<(), String> {
    let mut config = load_config(&app)?;
    config.general = settings;
    save_app_config(config)
}

#[tauri::command]
pub fn add_repository_to_config(app: tauri::AppHandle, repo: RepositoryInfo) -> Result<(), String> {
    let mut config = load_config(&app)?;
    // Check if exists
    if config.marketplace.repositories.iter().any(|r| r.id == repo.id) {
        return Err("Repository with this ID already exists".to_string());
    }
    config.marketplace.repositories.push(repo);
    save_app_config(config)
}

#[tauri::command]
pub fn remove_repository_from_config(app: tauri::AppHandle, repo_id: String) -> Result<(), String> {
    let mut config = load_config(&app)?;
    config.marketplace.repositories.retain(|r| r.id != repo_id);
    save_app_config(config)
}

#[tauri::command]
pub fn update_repository_enabled(app: tauri::AppHandle, repo_id: String, enabled: bool) -> Result<(), String> {
    let mut config = load_config(&app)?;
    if let Some(repo) = config.marketplace.repositories.iter_mut().find(|r| r.id == repo_id) {
        repo.enabled = enabled;
        save_app_config(config)
    } else {
        Err("Repository not found".to_string())
    }
}

#[tauri::command]
pub fn update_repository_in_config(app: tauri::AppHandle, repo_id: String, name: String, url: String) -> Result<(), String> {
    let mut config = load_config(&app)?;
    if let Some(repo) = config.marketplace.repositories.iter_mut().find(|r| r.id == repo_id) {
        repo.name = name;
        repo.url = url;
        save_app_config(config)
    } else {
        Err("Repository not found".to_string())
    }
}

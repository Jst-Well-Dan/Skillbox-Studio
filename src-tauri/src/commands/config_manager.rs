use std::fs;
use std::path::PathBuf;
use crate::types::{AppConfig, GeneralSettings, MarketplaceConfig, AgentsConfig, AdvancedSettings, RepositoryInfo};

fn get_config_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_dir = home_dir.join(".skillbox-studio");
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    Ok(config_dir.join("config.json"))
}

#[tauri::command]
pub fn get_app_config() -> Result<AppConfig, String> {
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
        
    // Take the best official candidate or create one
    let mut official = if !officials.is_empty() {
        let mut r = officials.remove(0); // Take first
        r.id = official_id.to_string();
        r.name = "Skillbox".to_string(); // Update name
        r.repo_type = "official".to_string();
        r
    } else {
        RepositoryInfo {
             id: official_id.to_string(),
             name: "Skillbox".to_string(),
             url: official_url.to_string(),
             repo_type: "official".to_string(),
             enabled: true,
             priority: 0,
             local_path: "../Skill-Box".to_string(),
             last_updated: chrono::Utc::now().to_rfc3339(),
             auth_type: "public".to_string(),
        }
    };
    
    // Reconstruct
    let mut new_repos = vec![official];
    new_repos.extend(others);
    config.marketplace.repositories = new_repos;

    // Save if changed
    let new_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    if new_content != content {
         let path = get_config_path()?;
         fs::write(path, &new_content).map_err(|e| e.to_string())?;
    }

    Ok(config)
}

#[tauri::command]
pub fn save_app_config(config: AppConfig) -> Result<(), String> {
    let path = get_config_path()?;
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_general_settings(settings: GeneralSettings) -> Result<(), String> {
    let mut config = get_app_config()?;
    config.general = settings;
    save_app_config(config)
}

#[tauri::command]
pub fn add_repository_to_config(repo: RepositoryInfo) -> Result<(), String> {
    let mut config = get_app_config()?;
    // Check if exists
    if config.marketplace.repositories.iter().any(|r| r.id == repo.id) {
        return Err("Repository with this ID already exists".to_string());
    }
    config.marketplace.repositories.push(repo);
    save_app_config(config)
}

#[tauri::command]
pub fn remove_repository_from_config(repo_id: String) -> Result<(), String> {
    let mut config = get_app_config()?;
    config.marketplace.repositories.retain(|r| r.id != repo_id);
    save_app_config(config)
}

#[tauri::command]
pub fn update_repository_enabled(repo_id: String, enabled: bool) -> Result<(), String> {
    let mut config = get_app_config()?;
    if let Some(repo) = config.marketplace.repositories.iter_mut().find(|r| r.id == repo_id) {
        repo.enabled = enabled;
        save_app_config(config)
    } else {
        Err("Repository not found".to_string())
    }
}

#[tauri::command]
pub fn update_repository_in_config(repo_id: String, name: String, url: String) -> Result<(), String> {
    let mut config = get_app_config()?;
    if let Some(repo) = config.marketplace.repositories.iter_mut().find(|r| r.id == repo_id) {
        repo.name = name;
        repo.url = url;
        save_app_config(config)
    } else {
        Err("Repository not found".to_string())
    }
}

use std::fs;
use std::path::PathBuf;
use crate::types::{LocalSkillsRegistry, LocalDirectory};
use dirs;

pub fn get_registry_path() -> PathBuf {
    dirs::config_dir()
        .expect("Failed to get config directory")
        .join("skillbox-studio")
        .join("local-skills-registry.json")
}

fn ensure_registry_dir() -> Result<(), String> {
    let path = get_registry_path();
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {}", e))?;
        }
    }
    Ok(())
}

fn load_registry() -> Result<LocalSkillsRegistry, String> {
    let path = get_registry_path();
    if !path.exists() {
        return Ok(LocalSkillsRegistry {
            registered_directories: vec![],
            last_updated: chrono::Utc::now().to_rfc3339(),
        });
    }

    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read registry: {}", e))?;
    // Handle migration from Vec<String> to Vec<LocalDirectory>
    match serde_json::from_str::<LocalSkillsRegistry>(&content) {
        Ok(registry) => Ok(registry),
        Err(_) => {
            // Try to parse old format
            #[derive(serde::Deserialize)]
            struct OldRegistry {
                registered_directories: Vec<String>,
                last_updated: String,
            }
            
            if let Ok(old) = serde_json::from_str::<OldRegistry>(&content) {
                let new_dirs = old.registered_directories.into_iter().map(|p| {
                    let name = PathBuf::from(&p)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string();
                    LocalDirectory { path: p, name }
                }).collect();
                
                Ok(LocalSkillsRegistry {
                    registered_directories: new_dirs,
                    last_updated: old.last_updated,
                })
            } else {
                Err("Failed to parse registry even in old format".to_string())
            }
        }
    }
}

fn save_registry(registry: &LocalSkillsRegistry) -> Result<(), String> {
    ensure_registry_dir()?;
    let path = get_registry_path();
    let content = serde_json::to_string_pretty(registry).map_err(|e| format!("Failed to serialize registry: {}", e))?;
    fs::write(path, content).map_err(|e| format!("Failed to write registry: {}", e))
}

#[tauri::command]
pub async fn register_local_directory(path: String, name: Option<String>) -> Result<bool, String> {
    let mut registry = load_registry()?;
    
    // Normalize path just in case, though usually frontend sends absolute path
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() || !path_buf.is_dir() {
        return Err("Directory does not exist".to_string());
    }

    if !registry.registered_directories.iter().any(|r| r.path == path) {
        let name = name.unwrap_or_else(|| {
            let file_name = path_buf.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown");

            if file_name.eq_ignore_ascii_case("skills") {
                if let Some(parent_name) = path_buf.parent().and_then(|p| p.file_name()).and_then(|n| n.to_str()) {
                    return parent_name.to_string();
                }
            }
            file_name.to_string()
        });
        
        registry.registered_directories.push(LocalDirectory { path, name });
        registry.last_updated = chrono::Utc::now().to_rfc3339();
        save_registry(&registry)?;
        Ok(true)
    } else {
        Ok(false) // Already registered
    }
}

#[tauri::command]
pub async fn unregister_local_directory(path: String) -> Result<bool, String> {
    let mut registry = load_registry()?;
    
    if let Some(index) = registry.registered_directories.iter().position(|r| r.path == path) {
        registry.registered_directories.remove(index);
        registry.last_updated = chrono::Utc::now().to_rfc3339();
        save_registry(&registry)?;
        Ok(true)
    } else {
        Ok(false) // Not found
    }
}

#[tauri::command]
pub async fn list_registered_directories() -> Result<Vec<LocalDirectory>, String> {
    let registry = load_registry()?;
    Ok(registry.registered_directories)
}

#[tauri::command]
pub async fn update_local_directory(path: String, name: String) -> Result<bool, String> {
    let mut registry = load_registry()?;
    
    if let Some(dir) = registry.registered_directories.iter_mut().find(|r| r.path == path) {
        dir.name = name;
        registry.last_updated = chrono::Utc::now().to_rfc3339();
        save_registry(&registry)?;
        Ok(true)
    } else {
        Ok(false)
    }
}

use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillMetadata {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginSkillsDetails {
    pub plugin_name: String,
    pub skills: Vec<SkillMetadata>,
}

#[derive(Debug, Deserialize)]
struct MarketplacePluginRaw {
    name: String,
    skills: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct MarketplaceFile {
    plugins: Vec<MarketplacePluginRaw>,
}

#[derive(Debug, Serialize)]
pub struct ExportedSkill {
    pub plugin_name: String,
    pub skill_path: String,
    pub name: String,
    pub description: String,
}

/// Parse SKILL.md frontmatter to extract name and description
fn parse_skill_metadata(content: &str) -> Option<SkillMetadata> {
    // SKILL.md format:
    // ---
    // name: Skill Name
    // description: Skill description here
    // license: ...
    // ---

    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() {
        return None;
    }

    // Allow for some whitespace
    if lines[0].trim() != "---" {
        return None;
    }

    let mut name: Option<String> = None;
    let mut description: Option<String> = None;

    // Parse frontmatter
    for i in 1..lines.len() {
        let line = lines[i].trim();

        if line == "---" {
            // End of frontmatter
            break;
        }

        if let Some(value) = line.strip_prefix("name:") {
            name = Some(value.trim().to_string());
        } else if let Some(value) = line.strip_prefix("description:") {
            description = Some(value.trim().to_string());
        }
    }

    if let (Some(n), Some(d)) = (name, description) {
        Some(SkillMetadata {
            name: n,
            description: d,
        })
    } else {
        None
    }
}

/// Helper to find Skill-Box root dynamically
fn find_skill_box_root() -> Option<std::path::PathBuf> {
    if let Ok(mut current) = std::env::current_dir() {
        // Check up to 5 levels up
        for _ in 0..5 {
            let candidate = current.join("Skill-Box");
            if candidate.exists() && candidate.is_dir() {
                return Some(candidate);
            }
            if !current.pop() { break; }
        }
    }
    None
}

/// Get skill metadata for a specific plugin
#[tauri::command]
pub fn get_plugin_skills_details(
    app: tauri::AppHandle,
    plugin_name: String,
    skill_paths: Vec<String>,
) -> Result<PluginSkillsDetails, String> {
    let mut skills = Vec::new();
    
    // Load config to get all repositories
    let config = crate::commands::config_manager::load_config(&app)
        .map_err(|e| format!("Failed to load config: {}", e))?;
    
    // Collect all unique search roots (repo paths)
    // We prioritize the ones that might contain this plugin, but simpler to just search all enabled repos.
    let mut search_roots: Vec<std::path::PathBuf> = Vec::new();

    // 1. Add all enabled repositories from config
    for repo in &config.marketplace.repositories {
        if repo.enabled {
             search_roots.push(std::path::Path::new(&repo.local_path).to_path_buf());
        }
    }
    
    // 2. Add dynamic Skill-Box root as a fallback (for dev env or unpackaged scenarios)
    if let Some(root) = find_skill_box_root() {
        if !search_roots.contains(&root) {
            search_roots.push(root);
        }
    }

    // Default fallback paths relative to CWD
    let fallback_bases = vec![
        "Skill-Box",
        "../Skill-Box",
        "../../Skill-Box",
        "./Skill-Box",
    ];
    for base in fallback_bases {
         search_roots.push(std::path::Path::new(base).to_path_buf());
    }

    for skill_path in skill_paths {
        // Clean the skill_path (remove leading ./ or /) and normalize separators
        let clean_path_str = skill_path.trim_start_matches("./").trim_start_matches('/');
        let clean_path_str = clean_path_str.replace('\\', "/");
        
        let mut found_metadata = false;

        // Iterate through all search roots to find the SKILL.md
        for root in &search_roots {
            let full_path = root.join(&clean_path_str).join("SKILL.md");
            // println!("Checking path: {:?}", full_path); // Debug log
            
            if full_path.exists() {
                if let Ok(content) = fs::read_to_string(&full_path) {
                    if let Some(metadata) = parse_skill_metadata(&content) {
                        skills.push(metadata);
                        found_metadata = true;
                        break; // Found it, stop searching roots for this skill
                    }
                }
            }
        }
        
        // Strategy: Fallback to relative paths if still not found
        // Use relative path lookup primarily for non-absolute skill paths, but we already covered them in search_roots above.
        // We keep this loop structure simple.

        // Fallback: if we still couldn't parse metadata, use the path as name
        if !found_metadata {
            println!("Failed to find SKILL.md for {} (cleaned: {})", skill_path, clean_path_str);
            let skill_name = clean_path_str
                .split('/')
                .last()
                .unwrap_or(&skill_path)
                .to_string();
            skills.push(SkillMetadata {
                name: skill_name,
                description: format!("Skill from {}", skill_path),
            });
        }
    }

    Ok(PluginSkillsDetails {
        plugin_name,
        skills,
    })
}

/// Export all skills from marketplace.json to a single JSON file
#[tauri::command]
pub fn export_marketplace_catalog(app: AppHandle) -> Result<String, String> {
    let skill_box_root = find_skill_box_root()
        .ok_or_else(|| "Could not find Skill-Box root directory".to_string())?;

    let marketplace_path = skill_box_root.join(".claude-plugin").join("marketplace.json");

    if !marketplace_path.exists() {
        return Err(format!("marketplace.json not found at {:?}", marketplace_path));
    }

    let content = fs::read_to_string(&marketplace_path)
        .map_err(|e| format!("Failed to read marketplace.json: {}", e))?;

    let marketplace: MarketplaceFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse marketplace.json: {}", e))?;

    let mut exported_skills = Vec::new();

    for plugin in marketplace.plugins {
        for skill_path in plugin.skills {
            let clean_path_str = skill_path.trim_start_matches("./").trim_start_matches('/');
            let clean_path_str = clean_path_str.replace('\\', "/");
            
            let skill_dir = skill_box_root.join(&clean_path_str);
            let skill_md_path = skill_dir.join("SKILL.md");

            let (name, description) = if skill_md_path.exists() {
                 match fs::read_to_string(&skill_md_path) {
                    Ok(md_content) => {
                        if let Some(meta) = parse_skill_metadata(&md_content) {
                            (meta.name, meta.description)
                        } else {
                            // Fallback if parsing fails
                             let name = clean_path_str.split('/').last().unwrap_or(&skill_path).to_string();
                             (name, "No description found in SKILL.md (parsing failed)".to_string())
                        }
                    },
                    Err(_) => {
                        let name = clean_path_str.split('/').last().unwrap_or(&skill_path).to_string();
                        (name, "Failed to read SKILL.md".to_string())
                    }
                 }
            } else {
                let name = clean_path_str.split('/').last().unwrap_or(&skill_path).to_string();
                (name, "SKILL.md not found".to_string())
            };

            exported_skills.push(ExportedSkill {
                plugin_name: plugin.name.clone(),
                skill_path: skill_path.clone(),
                name,
                description,
            });
        }
    }

    // Save to AppData directory
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to resolve AppData directory: {}", e))?;
    
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create AppData directory: {}", e))?;
    }

    let output_path = app_data_dir.join("marketplace_skills_catalog.json");
    let json_output = serde_json::to_string_pretty(&exported_skills)
        .map_err(|e| format!("Failed to serialize skills: {}", e))?;

    fs::write(&output_path, json_output)
         .map_err(|e| format!("Failed to write catalog file: {}", e))?;

    Ok(format!("Successfully exported {} skills to {:?}", exported_skills.len(), output_path))
}

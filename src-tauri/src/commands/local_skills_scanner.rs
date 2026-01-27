use std::fs;
use std::path::Path;
use regex::Regex;
use crate::types::{LocalSkill, SkillMetadata, LocalSkillScanResult, SkillSource};

/// 扫描指定目录下的本地 skills
#[tauri::command]
pub async fn scan_local_skills(directory: String) -> Result<LocalSkillScanResult, String> {
    let path = Path::new(&directory);

    // 验证目录存在
    if !path.is_dir() {
        return Ok(LocalSkillScanResult {
            success: false,
            path: directory,
            skills_found: vec![],
            error_message: Some("目录不存在或不是有效路径".to_string()),
            total_skills: 0,
        });
    }

    let mut skills = Vec::new();
    let mut errors = Vec::new();

    // 遍历目录下的每个子目录（每个可能是一个skill）
    match fs::read_dir(path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();

                    // 跳过非目录项
                    if !path.is_dir() {
                        continue;
                    }

                    // 查找 SKILL.md
                    let skill_md_path = path.join("SKILL.md");
                    if skill_md_path.exists() {
                        match parse_skill_metadata(&skill_md_path) {
                            Ok(metadata) => {
                                let size = calculate_dir_size(&path);
                                
                                let has_scripts = path.join("scripts").exists();
                                let has_references = path.join("references").exists();
                                let has_assets = path.join("assets").exists();

                                skills.push(LocalSkill {
                                    name: metadata.name,
                                    description: metadata.description,
                                    path: path.to_string_lossy().to_string(),
                                    source: SkillSource::LocalDirectory,
                                    has_scripts,
                                    has_references,
                                    has_assets,
                                    size_bytes: size,
                                });
                            }
                            Err(e) => {
                                errors.push(format!(
                                    "Failed to parse {}: {}",
                                    path.display(),
                                    e
                                ));
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Ok(LocalSkillScanResult {
                success: false,
                path: directory,
                skills_found: vec![],
                error_message: Some(format!("读取目录失败: {}", e)),
                total_skills: 0,
            });
        }
    }

    let total = skills.len();
    Ok(LocalSkillScanResult {
        success: total > 0,
        path: directory,
        skills_found: skills,
        error_message: if errors.is_empty() { None } else { Some(errors.join("; ")) },
        total_skills: total,
    })
}

/// 从 SKILL.md 解析元数据
fn parse_skill_metadata(file_path: &Path) -> Result<SkillMetadata, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("读取文件失败: {}", e))?;

    // 提取 YAML frontmatter (---\n...metadata...\n---)
    let frontmatter_pattern = Regex::new(r"(?m)^---\s*\r?\n([\s\S]*?)\r?\n---")
        .map_err(|e| format!("Regex错误: {}", e))?;

    if let Some(caps) = frontmatter_pattern.captures(&content) {
        let yaml_str = &caps[1];

        // 简单的 YAML 解析（对 name 和 description 字段）
        let mut name = String::new();
        let mut description = String::new();

        for line in yaml_str.lines() {
            let line = line.trim();
            if line.starts_with("name:") {
                name = line.strip_prefix("name:")
                    .unwrap_or("")
                    .trim()
                    .trim_matches('"')
                    .to_string();
            }
            if line.starts_with("description:") {
                description = line.strip_prefix("description:")
                    .unwrap_or("")
                    .trim()
                    .trim_matches('"')
                    .to_string();
            }
        }

        if name.is_empty() || description.is_empty() {
            return Err("缺少 name 或 description 字段".to_string());
        }

        Ok(SkillMetadata { name, description })
    } else {
        Err("未找到YAML frontmatter".to_string())
    }
}

/// 计算目录大小（递归）
fn calculate_dir_size(path: &Path) -> u64 {
    let mut total = 0;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    total += calculate_dir_size(&path);
                } else if let Ok(metadata) = fs::metadata(&path) {
                    total += metadata.len();
                }
            }
        }
    }

    total
}

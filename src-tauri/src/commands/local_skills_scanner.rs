use std::fs;
use std::path::Path;
use regex::Regex;
use crate::types::{LocalSkill, SkillMetadata, LocalSkillScanResult, SkillSource};

/// 扫描指定目录下的本地 skills (递归)
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

    // 开始递归扫描，最大深度 5
    scan_dir_recursive(path, &mut skills, &mut errors, 0, 5);

    let total = skills.len();
    Ok(LocalSkillScanResult {
        success: total > 0,
        path: directory,
        skills_found: skills,
        error_message: if errors.is_empty() { None } else { Some(errors.join("; ")) },
        total_skills: total,
    })
}

fn scan_dir_recursive(
    dir: &Path,
    skills: &mut Vec<LocalSkill>,
    errors: &mut Vec<String>,
    depth: u32,
    max_depth: u32
) {
    if depth > max_depth {
        return;
    }

    // 定义需要忽略的目录
    let ignore_dirs = [
        "node_modules", ".git", "target", "dist", "build", 
        ".vscode", ".idea", "__pycache__", "pkg", "bin", "obj"
    ];

    // 1. 检查当前目录是否是 Skill (存在 SKILL.md)
    let skill_md_path = dir.join("SKILL.md");
    if skill_md_path.exists() {
        match parse_skill_metadata(&skill_md_path) {
            Ok(metadata) => {
                let size = calculate_dir_size(dir);
                let has_scripts = dir.join("scripts").exists();
                let has_references = dir.join("references").exists();
                let has_assets = dir.join("assets").exists();

                skills.push(LocalSkill {
                    name: metadata.name,
                    description: metadata.description,
                    path: dir.to_string_lossy().to_string(),
                    source: SkillSource::LocalDirectory,
                    has_scripts,
                    has_references,
                    has_assets,
                    size_bytes: size,
                });
            }
            Err(e) => {
                errors.push(format!("Failed to parse {}: {}", dir.display(), e));
            }
        }
    }

    // 2. 遍历子目录
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // 检查是否在忽略列表中
                if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                    if ignore_dirs.contains(&dir_name) {
                        continue;
                    }
                    if dir_name.starts_with('.') && dir_name != ".agent" { // 忽略大多数隐藏目录，除了 .agent
                         continue;
                    }
                }
                
                scan_dir_recursive(&path, skills, errors, depth + 1, max_depth);
            }
        }
    }
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

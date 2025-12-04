// 🚀 使用统计增量缓存系统
// 性能优化：避免每次都重新扫描和解析所有JSONL文件
//
// 核心思路：
// 1. 维护一个持久化缓存文件 (~/.claude/usage_cache.json)
// 2. 记录每个已处理文件的元数据（路径、修改时间、最后一条记录哈希）
// 3. 只处理新文件和修改过的文件
// 4. 增量合并新数据到缓存中
//
// 预期性能提升：
// - 首次加载：6-10秒（需要全量处理）
// - 后续加载：<100ms（只读缓存）
// - 有新会话时：<500ms（增量更新）

use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use tauri::command;

use super::usage::{UsageStats, UsageEntry, ModelUsage, DailyUsage, ProjectUsage};

/// 缓存元数据结构
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageCache {
    /// 缓存版本号，用于缓存格式升级时自动失效
    pub version: String,

    /// 最后更新时间
    pub last_updated: String,

    /// 所有已处理的usage entries（按时间排序）
    pub all_entries: Vec<UsageEntry>,

    /// 已处理文件的元数据（路径 -> 元数据）
    pub processed_files: HashMap<String, FileMetadata>,

    /// 去重哈希集合（避免重复处理同一条记录）
    pub processed_hashes: HashSet<String>,
}

/// 单个文件的元数据
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    /// 文件完整路径
    pub file_path: String,

    /// 文件最后修改时间（Unix timestamp）
    pub last_modified: u64,

    /// 文件中记录数量
    pub entry_count: usize,

    /// 文件最后一条记录的时间戳（用于检测增量）
    pub last_entry_timestamp: Option<String>,
}

impl Default for UsageCache {
    fn default() -> Self {
        UsageCache {
            version: "1.0.0".to_string(),
            last_updated: Local::now().to_rfc3339(),
            all_entries: Vec::new(),
            processed_files: HashMap::new(),
            processed_hashes: HashSet::new(),
        }
    }
}

impl UsageCache {
    /// 从磁盘加载缓存文件
    pub fn load(cache_path: &PathBuf) -> Result<Self, String> {
        if !cache_path.exists() {
            log::info!("No cache file found, creating new cache");
            return Ok(UsageCache::default());
        }

        match fs::read_to_string(cache_path) {
            Ok(content) => {
                match serde_json::from_str::<UsageCache>(&content) {
                    Ok(cache) => {
                        // 检查版本号，如果不匹配则重新创建
                        if cache.version != "1.0.0" {
                            log::warn!("Cache version mismatch, rebuilding cache");
                            return Ok(UsageCache::default());
                        }
                        log::info!("Loaded cache with {} entries from {} files",
                                   cache.all_entries.len(),
                                   cache.processed_files.len());
                        Ok(cache)
                    }
                    Err(e) => {
                        log::error!("Failed to parse cache file: {}", e);
                        // 缓存文件损坏，重新创建
                        Ok(UsageCache::default())
                    }
                }
            }
            Err(e) => {
                log::error!("Failed to read cache file: {}", e);
                Ok(UsageCache::default())
            }
        }
    }

    /// 保存缓存到磁盘
    pub fn save(&self, cache_path: &PathBuf) -> Result<(), String> {
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize cache: {}", e))?;

        fs::write(cache_path, content)
            .map_err(|e| format!("Failed to write cache file: {}", e))?;

        log::info!("Saved cache with {} entries to disk", self.all_entries.len());
        Ok(())
    }

    /// 检测需要处理的文件（新文件 + 修改过的文件）
    pub fn detect_changed_files(&self, claude_path: &PathBuf) -> Result<Vec<PathBuf>, String> {
        let mut changed_files = Vec::new();
        let projects_dir = claude_path.join("projects");

        if !projects_dir.exists() {
            return Ok(changed_files);
        }

        // 遍历所有项目目录
        let projects = fs::read_dir(&projects_dir)
            .map_err(|e| format!("Failed to read projects directory: {}", e))?;

        for project in projects.flatten() {
            if !project.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }

            let project_path = project.path();

            // 使用 walkdir 遍历项目目录下的所有 .jsonl 文件
            for entry in walkdir::WalkDir::new(&project_path)
                .into_iter()
                .filter_map(Result::ok)
                .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
            {
                let file_path = entry.path().to_path_buf();
                let file_path_str = file_path.to_string_lossy().to_string();

                // 获取文件修改时间
                if let Ok(metadata) = fs::metadata(&file_path) {
                    if let Ok(modified_time) = metadata.modified() {
                        let modified_timestamp = modified_time
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs();

                        // 检查是否是新文件或修改过的文件
                        let should_process = match self.processed_files.get(&file_path_str) {
                            Some(file_meta) => {
                                // 文件修改时间变化，需要重新处理
                                file_meta.last_modified < modified_timestamp
                            }
                            None => {
                                // 新文件，需要处理
                                true
                            }
                        };

                        if should_process {
                            changed_files.push(file_path);
                        }
                    }
                }
            }
        }

        log::info!("Detected {} changed files", changed_files.len());
        Ok(changed_files)
    }

    /// 合并新的 usage entries 到缓存中
    pub fn merge_entries(&mut self, new_entries: Vec<UsageEntry>, file_metadatas: Vec<FileMetadata>) {
        // 添加新条目
        self.all_entries.extend(new_entries);

        // 按时间戳排序（保持时间顺序）
        self.all_entries.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

        // 更新文件元数据
        for file_meta in file_metadatas {
            self.processed_files.insert(file_meta.file_path.clone(), file_meta);
        }

        // 更新最后更新时间
        self.last_updated = Local::now().to_rfc3339();

        log::info!("Merged entries, total: {}", self.all_entries.len());
    }

    /// 从缓存数据生成统计结果
    pub fn compute_stats(&self, days: Option<u32>) -> UsageStats {
        // 如果没有数据，返回空统计
        if self.all_entries.is_empty() {
            return UsageStats {
                total_cost: 0.0,
                total_tokens: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_cache_creation_tokens: 0,
                total_cache_read_tokens: 0,
                total_sessions: 0,
                by_model: vec![],
                by_date: vec![],
                by_project: vec![],
            };
        }

        // 过滤指定天数的数据
        let filtered_entries: Vec<&UsageEntry> = if let Some(days) = days {
            let cutoff = Local::now().date_naive() - chrono::Duration::days(days as i64);
            self.all_entries
                .iter()
                .filter(|e| {
                    if let Ok(dt) = DateTime::parse_from_rfc3339(&e.timestamp) {
                        dt.with_timezone(&Local).date_naive() >= cutoff
                    } else {
                        false
                    }
                })
                .collect()
        } else {
            self.all_entries.iter().collect()
        };

        // 计算总计
        let mut total_cost = 0.0;
        let mut total_input_tokens = 0u64;
        let mut total_output_tokens = 0u64;
        let mut total_cache_creation_tokens = 0u64;
        let mut total_cache_read_tokens = 0u64;

        let mut model_stats: HashMap<String, ModelUsage> = HashMap::new();
        let mut daily_stats: HashMap<String, DailyUsage> = HashMap::new();
        let mut project_stats: HashMap<String, ProjectUsage> = HashMap::new();

        for entry in &filtered_entries {
            // 更新总计
            total_cost += entry.cost;
            total_input_tokens += entry.input_tokens;
            total_output_tokens += entry.output_tokens;
            total_cache_creation_tokens += entry.cache_creation_tokens;
            total_cache_read_tokens += entry.cache_read_tokens;

            // 更新模型统计
            let model_stat = model_stats
                .entry(entry.model.clone())
                .or_insert(ModelUsage {
                    model: entry.model.clone(),
                    total_cost: 0.0,
                    total_tokens: 0,
                    input_tokens: 0,
                    output_tokens: 0,
                    cache_creation_tokens: 0,
                    cache_read_tokens: 0,
                    session_count: 0,
                });
            model_stat.total_cost += entry.cost;
            model_stat.input_tokens += entry.input_tokens;
            model_stat.output_tokens += entry.output_tokens;
            model_stat.cache_creation_tokens += entry.cache_creation_tokens;
            model_stat.cache_read_tokens += entry.cache_read_tokens;
            model_stat.total_tokens = model_stat.input_tokens + model_stat.output_tokens;
            model_stat.session_count += 1;

            // 更新每日统计（使用本地时区）
            let date = if let Ok(dt) = DateTime::parse_from_rfc3339(&entry.timestamp) {
                dt.with_timezone(&Local).format("%Y-%m-%d").to_string()
            } else {
                entry.timestamp
                    .split('T')
                    .next()
                    .unwrap_or(&entry.timestamp)
                    .to_string()
            };
            let daily_stat = daily_stats.entry(date.clone()).or_insert(DailyUsage {
                date,
                total_cost: 0.0,
                total_tokens: 0,
                models_used: vec![],
            });
            daily_stat.total_cost += entry.cost;
            daily_stat.total_tokens += entry.input_tokens
                + entry.output_tokens
                + entry.cache_creation_tokens
                + entry.cache_read_tokens;
            if !daily_stat.models_used.contains(&entry.model) {
                daily_stat.models_used.push(entry.model.clone());
            }

            // 更新项目统计
            let project_stat =
                project_stats
                    .entry(entry.project_path.clone())
                    .or_insert(ProjectUsage {
                        project_path: entry.project_path.clone(),
                        project_name: entry
                            .project_path
                            .split('/')
                            .last()
                            .unwrap_or(&entry.project_path)
                            .to_string(),
                        total_cost: 0.0,
                        total_tokens: 0,
                        session_count: 0,
                        last_used: entry.timestamp.clone(),
                    });
            project_stat.total_cost += entry.cost;
            project_stat.total_tokens += entry.input_tokens
                + entry.output_tokens
                + entry.cache_creation_tokens
                + entry.cache_read_tokens;
            project_stat.session_count += 1;
            if entry.timestamp > project_stat.last_used {
                project_stat.last_used = entry.timestamp.clone();
            }
        }

        let total_tokens = total_input_tokens
            + total_output_tokens
            + total_cache_creation_tokens
            + total_cache_read_tokens;

        // 转换为排序的向量
        let mut by_model: Vec<ModelUsage> = model_stats.into_values().collect();
        by_model.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

        let mut by_date: Vec<DailyUsage> = daily_stats.into_values().collect();
        by_date.sort_by(|a, b| b.date.cmp(&a.date));

        let mut by_project: Vec<ProjectUsage> = project_stats.into_values().collect();
        by_project.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());

        UsageStats {
            total_cost,
            total_tokens,
            total_input_tokens,
            total_output_tokens,
            total_cache_creation_tokens,
            total_cache_read_tokens,
            total_sessions: filtered_entries.len() as u64,
            by_model,
            by_date,
            by_project,
        }
    }
}

/// 🚀 增量缓存API：获取使用统计（带缓存）
///
/// 此函数是性能优化的核心：
/// 1. 首次调用：扫描所有JSONL文件，建立缓存（6-10秒）
/// 2. 后续调用：只读缓存，瞬时返回（<100ms）
/// 3. 有新会话：增量更新缓存（<500ms）
#[command]
pub async fn get_usage_stats_cached(days: Option<u32>) -> Result<UsageStats, String> {
    let claude_path = dirs::home_dir()
        .ok_or("Failed to get home directory".to_string())?
        .join(".claude");

    let cache_path = claude_path.join("usage_cache.json");

    // 1. 加载现有缓存
    let mut cache = UsageCache::load(&cache_path)?;

    // 2. 检测变化的文件
    let changed_files = cache.detect_changed_files(&claude_path)?;

    // 3. 如果有变化的文件，进行增量更新
    if !changed_files.is_empty() {
        log::info!("Processing {} changed files for incremental update", changed_files.len());

        // 重用 usage.rs 中的解析逻辑
        let (new_entries, file_metadatas) = process_changed_files(changed_files, &mut cache.processed_hashes)?;

        // 合并到缓存
        cache.merge_entries(new_entries, file_metadatas);

        // 保存缓存
        cache.save(&cache_path)?;
    } else {
        log::info!("No changes detected, using cached data");
    }

    // 4. 计算并返回统计结果
    Ok(cache.compute_stats(days))
}

/// 处理变化的文件，返回新的 entries 和文件元数据
fn process_changed_files(
    files: Vec<PathBuf>,
    processed_hashes: &mut HashSet<String>,
) -> Result<(Vec<UsageEntry>, Vec<FileMetadata>), String> {
    let mut all_entries = Vec::new();
    let mut file_metadatas = Vec::new();

    for file_path in files {
        // 提取项目名称（从路径中获取）
        let encoded_project_name = file_path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // 使用 usage.rs 中的解析函数
        let entries = super::usage::parse_jsonl_file(
            &file_path,
            &encoded_project_name,
            processed_hashes,
        );

        // 记录文件元数据
        if let Ok(metadata) = fs::metadata(&file_path) {
            if let Ok(modified_time) = metadata.modified() {
                let modified_timestamp = modified_time
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                let last_entry_timestamp = entries.last().map(|e| e.timestamp.clone());

                file_metadatas.push(FileMetadata {
                    file_path: file_path.to_string_lossy().to_string(),
                    last_modified: modified_timestamp,
                    entry_count: entries.len(),
                    last_entry_timestamp,
                });
            }
        }

        all_entries.extend(entries);
    }

    Ok((all_entries, file_metadatas))
}

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;
use crate::types::{HistoryRecord, HistoryFile};

// Structs moved to crate::types to avoid duplication

/// 获取安装历史记录
#[tauri::command]
pub fn get_install_history(
    limit: Option<usize>,
    plugin_name: Option<String>,
) -> Result<Vec<HistoryRecord>, String> {
    let history = load_history_file()?;

    let mut records = history.records;

    // 按 plugin_name 过滤
    if let Some(name) = plugin_name {
        records.retain(|r| r.plugin_name == name);
    }

    // 按时间降序排序（最新的在前）
    records.sort_by(|a, b| b.installed_at.cmp(&a.installed_at));

    // 限制返回数量
    if let Some(max) = limit {
        records.truncate(max);
    }

    Ok(records)
}

/// 记录安装历史
pub fn record_install_history(
    plugin_name: &str,
    agents: &[String],
    scope: &str,
    project_path: Option<String>,
    success: bool,
    error_message: Option<String>,
    skills_installed: Vec<String>,
) -> Result<(), String> {
    record_history(
        plugin_name,
        agents,
        scope,
        project_path,
        "install",
        success,
        error_message,
        skills_installed,
    )
}

/// 记录卸载历史
#[allow(dead_code)]
pub fn record_uninstall_history(
    plugin_name: &str,
    agents: &[String],
    scope: &str,
    project_path: Option<String>,
    success: bool,
    error_message: Option<String>,
) -> Result<(), String> {
    record_history(
        plugin_name,
        agents,
        scope,
        project_path,
        "uninstall",
        success,
        error_message,
        Vec::new(),
    )
}

/// 记录历史（通用）
fn record_history(
    plugin_name: &str,
    agents: &[String],
    scope: &str,
    project_path: Option<String>,
    operation: &str,
    success: bool,
    error_message: Option<String>,
    skills_installed: Vec<String>,
) -> Result<(), String> {
    let mut history = load_history_file().unwrap_or_else(|_| HistoryFile {
        version: "1.0".to_string(),
        records: Vec::new(),
        last_updated: Utc::now().to_rfc3339(),
    });

    let record = HistoryRecord {
        id: Uuid::new_v4().to_string(),
        plugin_name: plugin_name.to_string(),
        agents: agents.to_vec(),
        scope: scope.to_string(),
        project_path,
        operation: operation.to_string(),
        installed_at: Utc::now().to_rfc3339(),
        status: if success { "success" } else { "failed" }.to_string(),
        error_message,
        skills_installed,
    };

    history.records.push(record);
    history.last_updated = Utc::now().to_rfc3339();

    save_history_file(&history)?;

    Ok(())
}

/// 清除历史记录
#[tauri::command]
pub fn clear_install_history(before_date: Option<String>) -> Result<usize, String> {
    let mut history = load_history_file()?;
    let original_count = history.records.len();

    if let Some(date) = before_date {
        history.records.retain(|r| r.installed_at > date);
    } else {
        history.records.clear();
    }

    let removed_count = original_count - history.records.len();
    history.last_updated = Utc::now().to_rfc3339();

    save_history_file(&history)?;

    Ok(removed_count)
}

/// 获取历史文件路径
fn get_history_file_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
    let claude_dir = home_dir.join(".claude");

    // 确保目录存在
    if !claude_dir.exists() {
        fs::create_dir_all(&claude_dir)
            .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
    }

    Ok(claude_dir.join("plugin-history.json"))
}

/// 加载历史文件
fn load_history_file() -> Result<HistoryFile, String> {
    let path = get_history_file_path()?;

    if !path.exists() {
        return Ok(HistoryFile {
            version: "1.0".to_string(),
            records: Vec::new(),
            last_updated: Utc::now().to_rfc3339(),
        });
    }

    let contents =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read history file: {}", e))?;

    let history: HistoryFile = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse history file: {}", e))?;

    Ok(history)
}

/// 保存历史文件
fn save_history_file(history: &HistoryFile) -> Result<(), String> {
    let path = get_history_file_path()?;

    let contents = serde_json::to_string_pretty(history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    fs::write(&path, contents).map_err(|e| format!("Failed to write history file: {}", e))?;

    Ok(())
}

/// 获取统计信息
#[tauri::command]
pub fn get_history_stats() -> Result<HistoryStats, String> {
    let history = load_history_file()?;

    let total_installs = history
        .records
        .iter()
        .filter(|r| r.operation == "install")
        .count();

    let total_uninstalls = history
        .records
        .iter()
        .filter(|r| r.operation == "uninstall")
        .count();

    let successful_installs = history
        .records
        .iter()
        .filter(|r| r.operation == "install" && r.status == "success")
        .count();

    let failed_installs = history
        .records
        .iter()
        .filter(|r| r.operation == "install" && r.status == "failed")
        .count();

    Ok(HistoryStats {
        total_records: history.records.len(),
        total_installs,
        total_uninstalls,
        successful_installs,
        failed_installs,
        last_updated: history.last_updated,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryStats {
    pub total_records: usize,
    pub total_installs: usize,
    pub total_uninstalls: usize,
    pub successful_installs: usize,
    pub failed_installs: usize,
    pub last_updated: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_history_record_creation() {
        let record = HistoryRecord {
            id: Uuid::new_v4().to_string(),
            plugin_name: "test-plugin".to_string(),
            agents: vec!["claude".to_string()],
            scope: "global".to_string(),
            project_path: None,
            operation: "install".to_string(),
            installed_at: Utc::now().to_rfc3339(),
            status: "success".to_string(),
            error_message: None,
            skills_installed: Vec::new(),
        };

        assert_eq!(record.plugin_name, "test-plugin");
        assert_eq!(record.status, "success");
    }

    #[test]
    fn test_history_file_creation() {
        let history = HistoryFile {
            version: "1.0".to_string(),
            records: Vec::new(),
            last_updated: Utc::now().to_rfc3339(),
        };

        assert_eq!(history.version, "1.0");
        assert_eq!(history.records.len(), 0);
    }
}

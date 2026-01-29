use anyhow::{Context, Result};
use log::{debug, info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256}; // 🎯 SHA256 哈希支持
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;
use futures::prelude::*;
use futures::stream;

/// 翻译配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationConfig {
    /// 是否启用翻译功能
    pub enabled: bool,
    /// API基础URL
    pub api_base_url: String,
    /// API密钥
    pub api_key: String,
    /// 模型名称
    pub model: String,
    /// 请求超时时间（秒）
    pub timeout_seconds: u64,
    /// 缓存有效期（秒）
    pub cache_ttl_seconds: u64,
    /// 是否启用对话翻译
    pub enable_response_translation: bool,
}

impl Default for TranslationConfig {
    fn default() -> Self {
        Self {
            enabled: false, // 🔧 修复：默认禁用翻译功能，需用户配置API密钥后启用
            api_base_url: "https://open.bigmodel.cn/api/paas/v4".to_string(), // 🎯 Zhipu AI API
            api_key: String::new(), // 🔧 修复：要求用户自定义输入API密钥
            model: "GLM-4-Flash".to_string(), // 🎯 使用 GLM-4-Flash 模型
            timeout_seconds: 30,
            cache_ttl_seconds: u32::MAX as u64, // 🎯 永久缓存（兼容 JS Number 安全范围）
            enable_response_translation: true, // 默认启用对话翻译
        }
    }
}

/// 翻译缓存条目（持久化版本）
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistentCacheEntry {
    translated_text: String,
    created_timestamp: u64, // Unix timestamp for persistence
    ttl_seconds: u64,
}

impl PersistentCacheEntry {
    fn new(translated_text: String, _ttl_seconds: u64) -> Self {
        let created_timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            translated_text,
            created_timestamp,
            ttl_seconds: u32::MAX as u64, // 🎯 永久缓存
        }
    }

    fn is_expired(&self) -> bool {
        // 🎯 永久缓存，永不过期（除非用户手动清空）
        false
    }
}

/// 内存缓存条目（用于运行时）
#[derive(Debug, Clone)]
struct CacheEntry {
    translated_text: String,
    #[allow(dead_code)]
    created_at: Instant,
}

impl CacheEntry {
    fn new(translated_text: String, _ttl: Duration) -> Self {
        Self {
            translated_text,
            created_at: Instant::now(),
        }
    }

    fn is_expired(&self) -> bool {
        // 🎯 永久缓存，永不过期（除非用户手动清空）
        false
    }
}

/// 翻译服务
pub struct TranslationService {
    config: TranslationConfig,
    client: Client,
    cache: Arc<Mutex<HashMap<String, CacheEntry>>>, // 内存缓存（运行时）
    persistent_cache: Arc<Mutex<HashMap<String, PersistentCacheEntry>>>, // 持久化缓存
}

impl TranslationService {
    /// 创建新的翻译服务实例
    pub fn new(config: TranslationConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");

        // 🎯 加载持久化缓存
        let persistent_cache = load_persistent_cache_from_file();
        info!("Initialized translation service with {} cached entries", persistent_cache.len());

        Self {
            config,
            client,
            cache: Arc::new(Mutex::new(HashMap::new())),
            persistent_cache: Arc::new(Mutex::new(persistent_cache)),
        }
    }

    /// 改进的文本语言检测：基于英文字符数量判断
    fn detect_language(&self, text: &str) -> String {
        if text.trim().is_empty() {
            return "zh".to_string();
        }

        // 计算英文字符数量 (a-z, A-Z)
        let english_char_count = text
            .chars()
            .filter(|c| c.is_ascii_alphabetic())
            .count();

        debug!(
            "Language detection: english_chars={}, text_len={}",
            english_char_count,
            text.len()
        );

        // 如果包含5个及以上英文字符，认为是英文需要翻译
        if english_char_count >= 5 {
            return "en".to_string();
        }

        // 默认认为是中文（不需要翻译）
        "zh".to_string()
    }

    /// 生成缓存键（使用SHA256哈希）
    fn cache_key(&self, text: &str, from_lang: &str, to_lang: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(format!("{}:{}:{}", from_lang, to_lang, text));
        let result = hasher.finalize();
        format!("{:x}", result)
    }

    /// 从缓存获取翻译结果（内存缓存 + 持久化缓存）
    async fn get_cached_translation(&self, cache_key: &str) -> Option<String> {
        // 1. 先检查内存缓存
        {
            let mut cache = self.cache.lock().await;

            if let Some(entry) = cache.get(cache_key) {
                if !entry.is_expired() {
                    debug!("Memory cache hit for key: {}", cache_key);
                    return Some(entry.translated_text.clone());
                } else {
                    debug!("Memory cache expired for key: {}", cache_key);
                    cache.remove(cache_key);
                }
            }
        }

        // 2. 检查持久化缓存
        {
            let mut persistent_cache = self.persistent_cache.lock().await;

            if let Some(entry) = persistent_cache.get(cache_key) {
                if !entry.is_expired() {
                    debug!("Persistent cache hit for key: {}", cache_key);

                    // 加载到内存缓存
                    let mut cache = self.cache.lock().await;
                    let ttl = Duration::from_secs(self.config.cache_ttl_seconds);
                    cache.insert(
                        cache_key.to_string(),
                        CacheEntry::new(entry.translated_text.clone(), ttl),
                    );

                    return Some(entry.translated_text.clone());
                } else {
                    debug!("Persistent cache expired for key: {}", cache_key);
                    persistent_cache.remove(cache_key);
                }
            }
        }

        None
    }

    /// 缓存翻译结果（同时保存到内存和持久化缓存）
    async fn cache_translation(&self, cache_key: String, translated_text: String) {
        let ttl_seconds = self.config.cache_ttl_seconds;

        // 1. 保存到内存缓存
        {
            let mut cache = self.cache.lock().await;
            let ttl = Duration::from_secs(ttl_seconds);
            cache.insert(cache_key.clone(), CacheEntry::new(translated_text.clone(), ttl));
        }

        // 2. 保存到持久化缓存
        {
            let mut persistent_cache = self.persistent_cache.lock().await;
            persistent_cache.insert(
                cache_key,
                PersistentCacheEntry::new(translated_text, ttl_seconds),
            );

            // 3. 异步写入磁盘（不阻塞翻译流程）
            if let Err(e) = save_persistent_cache_to_file(&persistent_cache) {
                warn!("Failed to save persistent cache: {}", e);
            }
        }
    }

    /// 清理过期缓存
    #[allow(dead_code)]
    pub async fn cleanup_expired_cache(&self) {
        let mut cache = self.cache.lock().await;
        cache.retain(|_, entry| !entry.is_expired());
        debug!("Cleaned up expired cache entries");
    }

    /// 翻译API请求（Zhipu AI GLM-4-Flash格式）
    async fn call_translation_api(
        &self,
        text: &str,
        from_lang: &str,
        to_lang: &str,
    ) -> Result<String> {
        // 检查API密钥是否已配置
        if self.config.api_key.is_empty() {
            return Err(anyhow::anyhow!(
                "API密钥未配置，请在设置中填写您的智谱 API 密钥"
            ));
        }

        // 🎯 根据Zhipu AI格式构建提示（简化版，只用user消息）
        let prompt = match (from_lang, to_lang) {
            ("zh", "en") => format!("请将以下中文翻译成英文，只返回翻译结果，不要添加任何解释：\n\n{}", text),
            ("en", "zh") => format!("请将以下英文翻译成中文，只返回翻译结果，不要添加任何解释：\n\n{}", text),
            _ => format!("请将以下文本翻译成{}，只返回翻译结果，不要添加任何解释：\n\n{}", to_lang, text),
        };

        let request_body = serde_json::json!({
            "model": self.config.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3 // 🎯 使用 Zhipu 推荐的 0.3 temperature
        });

        debug!("Sending translation request for text: {}", text);

        let response = self
            .client
            .post(&format!("{}/chat/completions", self.config.api_base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .context("Failed to send translation request")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow::anyhow!(
                "Translation API error: {} - {}",
                status,
                error_text
            ));
        }

        let response_json: serde_json::Value = response
            .json()
            .await
            .context("Failed to parse API response")?;

        // 提取翻译结果
        let translated_text = response_json
            .get("choices")
            .and_then(|choices| choices.get(0))
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content| content.as_str())
            .ok_or_else(|| anyhow::anyhow!("Invalid API response format"))?
            .trim()
            .to_string();

        debug!("Translation successful: {} -> {}", text, translated_text);

        Ok(translated_text)
    }

    /// 智能翻译文本
    pub async fn translate(&self, text: &str, target_lang: Option<&str>) -> Result<String> {
        if !self.config.enabled {
            return Err(anyhow::anyhow!(
                "翻译功能未启用，请在设置中开启并配置 API Key。"
            ));
        }

        if text.trim().is_empty() {
            return Ok(text.to_string());
        }

        // 检测源语言
        let from_lang = self.detect_language(text);

        // 确定目标语言
        let to_lang = target_lang.unwrap_or_else(|| {
            // 默认翻译目标为中文（用户指定：不需要中文转英文）
            "zh"
        });

        // 如果源语言和目标语言相同，直接返回
        if from_lang == to_lang {
            debug!("Source and target languages are the same, skipping translation");
            return Ok(text.to_string());
        }

        // 生成缓存键
        let cache_key = self.cache_key(text, &from_lang, to_lang);

        // 尝试从缓存获取
        if let Some(cached_result) = self.get_cached_translation(&cache_key).await {
            info!("Using cached translation");
            return Ok(cached_result);
        }

        // 调用翻译API
        let translated_text = self.call_translation_api(text, &from_lang, to_lang).await?;
        self.cache_translation(cache_key, translated_text.clone())
            .await;
        info!("Translation completed: {} -> {}", from_lang, to_lang);
        Ok(translated_text)
    }

    /// 批量翻译
    /// 批量翻译（并发处理，限制并发量为10）
    pub async fn translate_batch(
        &self,
        texts: &[String],
        target_lang: Option<&str>,
    ) -> Result<Vec<String>> {

        // 设置并发量
        const CONCURRENCY_LIMIT: usize = 20;

        // Create owned data for the stream to avoid lifetime issues
        let inputs: Vec<(usize, String)> = texts.iter().enumerate().map(|(i, s)| (i, s.clone())).collect();
        
        // 创建异步任务流
        let mut results_with_index: Vec<(usize, Result<String>)> = stream::iter(inputs)
            .map(|(i, text)| async move {
                // 对每个文本调用翻译
                let result = self.translate(&text, target_lang).await;
                (i, result)
            })
            // Use buffer_unordered which is available, and we sort manually
            .buffer_unordered(CONCURRENCY_LIMIT)
            .collect()
            .await;

        // Sort by index to restore original order
        results_with_index.sort_by_key(|(i, _)| *i);

        // Extract results
        let final_results: Vec<String> = results_with_index
            .into_iter()
            .map(|(i, res)| match res {
                Ok(s) => s,
                Err(e) => {
                    warn!("Batch translation failed for item {}: {}", i, e);
                    texts[i].clone() // 降级：返回原文
                }
            })
            .collect();

        Ok(final_results)
    }

    /// 更新配置
    #[allow(dead_code)]
    pub fn update_config(&mut self, new_config: TranslationConfig) {
        self.config = new_config;
    }

    /// 清空缓存（内存 + 持久化）
    pub async fn clear_cache(&self) {
        // 清空内存缓存
        {
            let mut cache = self.cache.lock().await;
            cache.clear();
        }

        // 清空持久化缓存
        {
            let mut persistent_cache = self.persistent_cache.lock().await;
            persistent_cache.clear();

            // 清空磁盘文件
            if let Err(e) = save_persistent_cache_to_file(&persistent_cache) {
                warn!("Failed to clear persistent cache file: {}", e);
            }
        }

        info!("Translation cache cleared (memory + persistent)");
    }

    /// 获取缓存统计信息（包括持久化缓存）
    pub async fn get_cache_stats(&self) -> CacheStats {
        let cache = self.cache.lock().await;
        let persistent_cache = self.persistent_cache.lock().await;

        let memory_entries = cache.len();
        let persistent_entries = persistent_cache.len();

        let expired_entries = cache.values().filter(|entry| entry.is_expired()).count()
            + persistent_cache
                .values()
                .filter(|entry| entry.is_expired())
                .count();

        CacheStats {
            total_entries: memory_entries + persistent_entries,
            expired_entries,
            active_entries: (memory_entries + persistent_entries) - expired_entries,
        }
    }
}

/// 缓存统计信息
#[derive(Debug, Serialize)]
pub struct CacheStats {
    pub total_entries: usize,
    pub expired_entries: usize,
    pub active_entries: usize,
}

/// 全局翻译服务实例
static TRANSLATION_SERVICE: once_cell::sync::Lazy<Arc<Mutex<TranslationService>>> =
    once_cell::sync::Lazy::new(|| {
        Arc::new(Mutex::new(TranslationService::new(
            TranslationConfig::default(),
        )))
    });

/// 初始化翻译服务
pub async fn init_translation_service(config: TranslationConfig) {
    let mut service = TRANSLATION_SERVICE.lock().await;
    *service = TranslationService::new(config);
    info!("Translation service initialized");
}

/// 使用保存的配置初始化翻译服务
pub async fn init_translation_service_with_saved_config() {
    match load_translation_config_from_file() {
        Ok(config) => {
            info!("Initializing translation service with saved config");
            init_translation_service(config).await;
        }
        Err(e) => {
            warn!(
                "Failed to load saved translation config: {}, using default",
                e
            );
            init_translation_service(TranslationConfig::default()).await;
        }
    }
}

/// 获取全局翻译服务
fn get_translation_service() -> Arc<Mutex<TranslationService>> {
    TRANSLATION_SERVICE.clone()
}

/// 翻译文本（公共接口）
pub async fn translate_text(text: &str, target_lang: Option<&str>) -> Result<String> {
    let service_arc = get_translation_service();
    let service = service_arc.lock().await;
    service.translate(text, target_lang).await
}

/// Tauri命令：翻译文本
#[tauri::command]
pub async fn translate(text: String, target_lang: Option<String>) -> Result<String, String> {
    let target = target_lang.as_deref();

    translate_text(&text, target)
        .await
        .map_err(|e| e.to_string())
}

/// Tauri命令：批量翻译
#[tauri::command]
pub async fn translate_batch(
    texts: Vec<String>,
    target_lang: Option<String>,
) -> Result<Vec<String>, String> {
    let service_arc = get_translation_service();
    let service = service_arc.lock().await;
    let target = target_lang.as_deref();

    service
        .translate_batch(&texts, target)
        .await
        .map_err(|e| e.to_string())
}

/// Tauri命令：获取翻译配置
#[tauri::command]
pub async fn get_translation_config() -> Result<TranslationConfig, String> {
    // 优先从文件加载最新配置
    match load_translation_config_from_file() {
        Ok(mut config) => {
            // 🔧 修复：确保 cache_ttl_seconds 在 JS 安全范围内 (避免 u64::MAX 导致的精度丢失)
            if config.cache_ttl_seconds > u32::MAX as u64 {
                config.cache_ttl_seconds = u32::MAX as u64;
            }

            // 同时更新内存中的配置
            let mut service = TRANSLATION_SERVICE.lock().await;
            *service = TranslationService::new(config.clone());
            Ok(config)
        }
        Err(_) => {
            // 文件加载失败，返回内存中的配置
            let service_arc = get_translation_service();
            let service = service_arc.lock().await;
            Ok(service.config.clone())
        }
    }
}

/// Tauri命令：更新翻译配置
#[tauri::command]
pub async fn update_translation_config(config: TranslationConfig) -> Result<String, String> {
    // 保存配置到文件
    save_translation_config_to_file(&config)
        .map_err(|e| format!("Failed to save translation config: {}", e))?;

    // 重新初始化翻译服务
    init_translation_service(config).await;

    info!("Translation configuration updated and saved successfully");
    Ok("Translation configuration updated successfully".to_string())
}

/// Tauri命令：清空翻译缓存
#[tauri::command]
pub async fn clear_translation_cache() -> Result<String, String> {
    let service_arc = get_translation_service();
    let service = service_arc.lock().await;
    service.clear_cache().await;
    Ok("Translation cache cleared successfully".to_string())
}

/// Tauri命令：获取缓存统计
#[tauri::command]
pub async fn get_translation_cache_stats() -> Result<CacheStats, String> {
    let service_arc = get_translation_service();
    let service = service_arc.lock().await;
    Ok(service.get_cache_stats().await)
}

/// Tauri命令：检测文本语言
#[tauri::command]
pub async fn detect_text_language(text: String) -> Result<String, String> {
    let service_arc = get_translation_service();
    let service = service_arc.lock().await;
    Ok(service.detect_language(&text))
}

/// 获取翻译配置文件路径
fn get_translation_config_path() -> Result<PathBuf, String> {
    let config_dir = get_config_dir().map_err(|e| e.to_string())?;
    Ok(config_dir.join("translation_config.json"))
}

/// 获取持久化缓存文件路径
fn get_translation_cache_path() -> Result<PathBuf, String> {
    let config_dir = get_config_dir().map_err(|e| e.to_string())?;
    Ok(config_dir.join("translation_cache.json"))
}

/// 获取配置目录路径
fn get_config_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    let config_dir = home_dir.join(".skillbox-studio");

    // 确保目录存在
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir)
}

/// 从文件加载翻译配置
fn load_translation_config_from_file() -> Result<TranslationConfig, String> {
    let config_path = get_translation_config_path()?;

    if !config_path.exists() {
        info!("Translation config file not found, using default config");
        return Ok(TranslationConfig::default());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read translation config: {}", e))?;

    let config: TranslationConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse translation config: {}", e))?;

    info!("Loaded translation config from file");
    Ok(config)
}

/// 保存翻译配置到文件
fn save_translation_config_to_file(config: &TranslationConfig) -> Result<(), String> {
    let config_path = get_translation_config_path()?;

    let json_string = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize translation config: {}", e))?;

    fs::write(&config_path, json_string)
        .map_err(|e| format!("Failed to write translation config: {}", e))?;

    info!("Saved translation config to file: {:?}", config_path);
    Ok(())
}

/// 从文件加载持久化缓存
fn load_persistent_cache_from_file() -> HashMap<String, PersistentCacheEntry> {
    let cache_path = match get_translation_cache_path() {
        Ok(path) => path,
        Err(e) => {
            warn!("Failed to get cache path: {}", e);
            return HashMap::new();
        }
    };

    if !cache_path.exists() {
        debug!("Persistent cache file not found, starting with empty cache");
        return HashMap::new();
    }

    match fs::read_to_string(&cache_path) {
        Ok(content) => {
            match serde_json::from_str::<HashMap<String, PersistentCacheEntry>>(&content) {
                Ok(mut cache) => {
                    // 清理过期条目
                    cache.retain(|_, entry| !entry.is_expired());
                    let valid_count = cache.len();
                    info!(
                        "Loaded persistent cache from file: {} valid entries",
                        valid_count
                    );
                    cache
                }
                Err(e) => {
                    warn!("Failed to parse persistent cache: {}", e);
                    HashMap::new()
                }
            }
        }
        Err(e) => {
            warn!("Failed to read persistent cache file: {}", e);
            HashMap::new()
        }
    }
}

/// 保存持久化缓存到文件
fn save_persistent_cache_to_file(cache: &HashMap<String, PersistentCacheEntry>) -> Result<(), String> {
    let cache_path = get_translation_cache_path()?;

    // 清理过期条目再保存
    let valid_cache: HashMap<_, _> = cache
        .iter()
        .filter(|(_, entry)| !entry.is_expired())
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();

    let json_string = serde_json::to_string_pretty(&valid_cache)
        .map_err(|e| format!("Failed to serialize persistent cache: {}", e))?;

    fs::write(&cache_path, json_string)
        .map_err(|e| format!("Failed to write persistent cache: {}", e))?;

    debug!("Saved {} cache entries to file", valid_cache.len());
    Ok(())
}

/// Tauri命令：初始化翻译服务
#[tauri::command]
pub async fn init_translation_service_command(
    config: Option<TranslationConfig>,
) -> Result<String, String> {
    let final_config = if let Some(provided_config) = config {
        provided_config
    } else {
        // 尝试从文件加载配置，失败则使用默认配置
        load_translation_config_from_file().unwrap_or_default()
    };

    init_translation_service(final_config).await;
    Ok("Translation service initialized successfully".to_string())
}

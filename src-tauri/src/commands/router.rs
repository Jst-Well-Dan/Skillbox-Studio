use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{command, AppHandle, Manager};
use tokio::process::{Child, Command};

/// Node.js 环境信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NodeInfo {
    pub version: String,
    pub path: String,
}

/// CCR (claude-code-router) 安装信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CcrInfo {
    pub version: String,
    pub installed: bool,
}

/// 依赖检测状态
#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub node_installed: bool,
    pub node_version: Option<String>,
    pub node_path: Option<String>,
    pub ccr_installed: bool,
    pub ccr_version: Option<String>,
    pub install_instructions: String,
}

/// Router 运行状态
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RouterStatus {
    pub running: bool,
    pub port: u16,
    pub session_id: String,
    pub health: bool,
}

/// Router 配置中的单个路由
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RouterRoute {
    pub provider: String,
    pub base_url: String,
    pub api_key_env: String,
    pub model_mapping: HashMap<String, String>,
    pub transformers: Vec<String>,
}

/// Router 完整配置
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RouterConfig {
    pub port: u16,
    pub host: String,
    pub routes: HashMap<String, RouterRoute>,
}

/// Router 进程管理器
#[allow(dead_code)]
pub struct RouterManager {
    pub process_handle: Arc<Mutex<Option<Child>>>,
    pub config_path: PathBuf,
    pub port: u16,
    pub session_id: String,
    pub run_id: i64,
}

/// Router 管理器全局状态
pub struct RouterManagerState(pub Arc<tokio::sync::Mutex<Option<RouterManager>>>);

impl Default for RouterManagerState {
    fn default() -> Self {
        Self(Arc::new(tokio::sync::Mutex::new(None)))
    }
}

// ============================================================================
// 辅助函数
// ============================================================================

/// 获取 Claude 配置目录路径
fn get_claude_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "无法获取用户主目录".to_string())?;
    let config_dir = home_dir.join(".claude");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("无法创建配置目录: {}", e))?;
    }

    Ok(config_dir)
}

/// 更新 Claude API Base URL 环境变量
/// 修改 ~/.claude/settings.json 中的 env.ANTHROPIC_BASE_URL
fn update_claude_api_base_url(base_url: &str) -> Result<(), String> {
    let claude_dir = get_claude_dir()?;
    let settings_path = claude_dir.join("settings.json");

    // 读取现有配置
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取 settings.json 失败: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("解析 settings.json 失败: {}", e))?
    } else {
        serde_json::json!({})
    };

    // 更新 env.ANTHROPIC_BASE_URL
    if let Some(obj) = settings.as_object_mut() {
        if !obj.contains_key("env") {
            obj.insert("env".to_string(), serde_json::json!({}));
        }

        if let Some(env_obj) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
            env_obj.insert("ANTHROPIC_BASE_URL".to_string(), serde_json::json!(base_url));
            log::info!("设置 ANTHROPIC_BASE_URL = {}", base_url);
        }
    }

    // 写回文件
    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化 settings.json 失败: {}", e))?;
    fs::write(&settings_path, json_str)
        .map_err(|e| format!("写入 settings.json 失败: {}", e))?;

    Ok(())
}

/// 移除 Claude API Base URL 环境变量
fn remove_claude_api_base_url() -> Result<(), String> {
    let claude_dir = get_claude_dir()?;
    let settings_path = claude_dir.join("settings.json");

    if !settings_path.exists() {
        return Ok(()); // 文件不存在，无需处理
    }

    // 读取现有配置
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("读取 settings.json 失败: {}", e))?;
    let mut settings: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 settings.json 失败: {}", e))?;

    // 移除 env.ANTHROPIC_BASE_URL
    if let Some(obj) = settings.as_object_mut() {
        if let Some(env_obj) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
            env_obj.remove("ANTHROPIC_BASE_URL");
            log::info!("已移除 ANTHROPIC_BASE_URL 环境变量");
        }
    }

    // 写回文件
    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化 settings.json 失败: {}", e))?;
    fs::write(&settings_path, json_str)
        .map_err(|e| format!("写入 settings.json 失败: {}", e))?;

    Ok(())
}

/// 获取 router.json 配置文件路径
fn get_router_config_path() -> Result<PathBuf, String> {
    let claude_dir = get_claude_dir()?;
    Ok(claude_dir.join("router.json"))
}

// ============================================================================
// Node.js 环境检测
// ============================================================================

/// 检测 Node.js 环境
fn detect_nodejs() -> Option<NodeInfo> {
    let output = std::process::Command::new("node")
        .arg("-v")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            log::info!("检测到 Node.js: {}", version);
            Some(NodeInfo {
                version,
                path: "node".to_string()
            })
        }
        _ => {
            log::warn!("未检测到 Node.js");
            None
        }
    }
}

/// 检测 ccr 安装
fn detect_ccr() -> Option<CcrInfo> {
    #[cfg(target_os = "windows")]
    let output = std::process::Command::new("cmd")
        .args(["/c", "ccr", "-v"])
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("ccr")
        .arg("-v")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            log::info!("检测到 CCR: {}", version);
            Some(CcrInfo {
                version,
                installed: true,
            })
        }
        _ => {
            log::warn!("未检测到 CCR");
            None
        }
    }
}

/// 生成平台特定的安装说明
fn generate_install_instructions(
    node: &Option<NodeInfo>,
    ccr: &Option<CcrInfo>,
) -> String {
    #[cfg(target_os = "windows")]
    {
        if node.is_none() {
            "步骤 1: 下载并安装 Node.js\n\
             访问: https://nodejs.org/zh-cn/download/\n\
             下载 Windows 安装包并运行安装程序\n\n\
             步骤 2: 重启 Xiya Claude Studio\n\n\
             步骤 3: 安装 Claude Code Router\n\
             在命令提示符中运行: npm install -g claude-code-router"
                .to_string()
        } else if ccr.is_none() {
            "在命令提示符 (CMD) 中运行以下命令:\n\
             npm install -g claude-code-router\n\n\
             安装完成后点击\"重新检测\"按钮"
                .to_string()
        } else {
            "✅ 所有依赖已安装完成！\n\
             您现在可以配置和启动 Router 了。"
                .to_string()
        }
    }

    #[cfg(target_os = "macos")]
    {
        if node.is_none() {
            "步骤 1: 安装 Homebrew (如果尚未安装)\n\
             在终端中运行:\n\
             /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"\n\n\
             步骤 2: 安装 Node.js\n\
             brew install node\n\n\
             步骤 3: 安装 Claude Code Router\n\
             npm install -g claude-code-router"
                .to_string()
        } else if ccr.is_none() {
            "在终端中运行以下命令:\n\
             npm install -g claude-code-router\n\n\
             安装完成后点击\"重新检测\"按钮"
                .to_string()
        } else {
            "✅ 所有依赖已安装完成！\n\
             您现在可以配置和启动 Router 了。"
                .to_string()
        }
    }

    #[cfg(target_os = "linux")]
    {
        if node.is_none() {
            "步骤 1: 安装 Node.js\n\
             Ubuntu/Debian:\n\
             sudo apt update && sudo apt install nodejs npm\n\n\
             CentOS/RHEL/Fedora:\n\
             sudo yum install nodejs npm\n\n\
             Arch Linux:\n\
             sudo pacman -S nodejs npm\n\n\
             步骤 2: 安装 Claude Code Router\n\
             npm install -g claude-code-router"
                .to_string()
        } else if ccr.is_none() {
            "在终端中运行以下命令:\n\
             npm install -g claude-code-router\n\n\
             安装完成后点击\"重新检测\"按钮"
                .to_string()
        } else {
            "✅ 所有依赖已安装完成！\n\
             您现在可以配置和启动 Router 了。"
                .to_string()
        }
    }
}

// ============================================================================
// Tauri Commands - 依赖检测
// ============================================================================

/// 检测 Router 依赖状态
#[command]
pub fn check_router_dependencies() -> Result<DependencyStatus, String> {
    log::info!("开始检测 Router 依赖...");

    let node_info = detect_nodejs();
    let ccr_info = detect_ccr();

    let instructions = generate_install_instructions(&node_info, &ccr_info);

    let status = DependencyStatus {
        node_installed: node_info.is_some(),
        node_version: node_info.as_ref().map(|i| i.version.clone()),
        node_path: node_info.as_ref().map(|i| i.path.clone()),
        ccr_installed: ccr_info.is_some(),
        ccr_version: ccr_info.as_ref().map(|i| i.version.clone()),
        install_instructions: instructions,
    };

    log::info!(
        "依赖检测完成: node={}, ccr={}",
        status.node_installed,
        status.ccr_installed
    );

    Ok(status)
}

// ============================================================================
// 配置文件生成
// ============================================================================

/// 生成 Router 配置文件
#[command]
pub fn generate_router_config(
    provider: String,
    base_url: String,
    _api_key: String,
    model: String,
) -> Result<String, String> {
    log::info!("生成 Router 配置: provider={}, model={}", provider, model);

    // 创建默认配置
    let mut routes = HashMap::new();

    // 创建模型映射
    let mut model_mapping = HashMap::new();
    model_mapping.insert("claude-3-5-sonnet-20241022".to_string(), model.clone());
    model_mapping.insert("claude-3-5-haiku-20241022".to_string(), model.clone());
    model_mapping.insert("claude-3-opus-20240229".to_string(), model.clone());

    // 创建路由配置
    let route = RouterRoute {
        provider: provider.clone(),
        base_url,
        api_key_env: format!("${{{}_API_KEY}}", provider.to_uppercase()),
        model_mapping,
        transformers: vec!["tooluse".to_string()],
    };

    routes.insert("default".to_string(), route);

    // 创建完整配置
    let config = RouterConfig {
        port: 3456,
        host: "127.0.0.1".to_string(),
        routes,
    };

    // 序列化为 JSON
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;

    // 写入配置文件
    let config_path = get_router_config_path()?;
    fs::write(&config_path, json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    log::info!("配置文件已生成: {:?}", config_path);

    Ok(config_path.to_string_lossy().to_string())
}

/// 保存 Router 配置
#[command]
pub fn save_router_config(config: RouterConfig) -> Result<String, String> {
    log::info!("保存 Router 配置");

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;

    let config_path = get_router_config_path()?;
    fs::write(&config_path, json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    log::info!("配置已保存: {:?}", config_path);

    Ok(config_path.to_string_lossy().to_string())
}

/// 加载 Router 配置
#[command]
pub fn load_router_config() -> Result<RouterConfig, String> {
    let config_path = get_router_config_path()?;

    if !config_path.exists() {
        return Err("配置文件不存在".to_string());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;

    let config: RouterConfig = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;

    Ok(config)
}

// ============================================================================
// 端口管理
// ============================================================================

/// 检测端口是否可用
async fn is_port_available(port: u16) -> bool {
    use tokio::net::TcpListener;

    match TcpListener::bind(format!("127.0.0.1:{}", port)).await {
        Ok(_) => true,
        Err(_) => false,
    }
}

/// 查找可用端口
async fn find_available_port(start: u16) -> Result<u16, String> {
    for port in start..(start + 100) {
        if is_port_available(port).await {
            log::info!("找到可用端口: {}", port);
            return Ok(port);
        }
    }

    Err(format!("在 {}-{} 范围内未找到可用端口", start, start + 100))
}

// ============================================================================
// 健康检查
// ============================================================================

/// 执行健康检查（短超时，用于快速检测）
async fn health_check(port: u16) -> Result<bool, String> {
    let url = format!("http://127.0.0.1:{}/health", port);

    match reqwest::Client::new()
        .get(&url)
        .timeout(Duration::from_millis(500)) // 500ms 超时，快速检测
        .send()
        .await
    {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(e) => {
            log::debug!("健康检查失败 (port {}): {}", port, e);
            Err(format!("健康检查失败: {}", e))
        }
    }
}

/// 等待 Router 就绪
async fn wait_for_router_ready(port: u16, timeout: Duration) -> Result<(), String> {
    let start = std::time::Instant::now();

    loop {
        if start.elapsed() > timeout {
            return Err("Router 启动超时".to_string());
        }

        if health_check(port).await.unwrap_or(false) {
            log::info!("Router 健康检查通过");
            return Ok(());
        }

        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

// ============================================================================
// Tauri Commands - Router 进程管理
// ============================================================================

/// 启动 Router 进程
#[command]
pub async fn start_router(app: AppHandle) -> Result<RouterStatus, String> {
    log::info!("启动 Router...");

    // 1. 检查依赖
    let deps = check_router_dependencies()?;
    if !deps.node_installed {
        return Err("Node.js 未安装。请先安装 Node.js。".to_string());
    }
    if !deps.ccr_installed {
        return Err("claude-code-router 未安装。请运行: npm install -g claude-code-router".to_string());
    }

    // 2. 检查配置文件
    let config_path = get_router_config_path()?;
    if !config_path.exists() {
        return Err("Router 配置文件不存在。请先配置 Router。".to_string());
    }

    // 3. 查找可用端口
    let port = find_available_port(3456).await?;
    log::info!("使用端口: {}", port);

    // 4. 创建启动命令
    // Windows 下需要通过 cmd /c 执行
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = Command::new("cmd");
        c.args([
            "/c",
            "ccr",
            "start",
            "--config",
            config_path.to_str().unwrap(),
            "--port",
            &port.to_string(),
        ]);
        c.creation_flags(0x08000000); // CREATE_NO_WINDOW
        c.stdin(std::process::Stdio::null());
        c.stdout(std::process::Stdio::piped());
        c.stderr(std::process::Stdio::piped());
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = Command::new("ccr");
        c.args([
            "start",
            "--config",
            config_path.to_str().unwrap(),
            "--port",
            &port.to_string(),
        ]);
        c.stdin(std::process::Stdio::null());
        c.stdout(std::process::Stdio::piped());
        c.stderr(std::process::Stdio::piped());
        c
    };

    // 5. 启动进程
    let child = cmd
        .spawn()
        .map_err(|e| format!("启动 Router 失败: {}", e))?;

    let pid = child.id().unwrap_or(0);
    log::info!("Router 进程已启动: pid={}", pid);

    // 6. 注册到 ProcessRegistry
    let registry_state = app.state::<crate::process::ProcessRegistryState>();
    let session_id = format!("router-{}", uuid::Uuid::new_v4());

    let run_id = registry_state.0.register_claude_session(
        session_id.clone(),
        pid,
        config_path.to_string_lossy().to_string(),
        "API Router Service".to_string(),
        "router".to_string(),
    )?;

    log::info!("Router 已注册到 ProcessRegistry: session_id={}, run_id={}", session_id, run_id);

    // 7. 存储进程句柄
    let router_state = app.state::<RouterManagerState>();
    let mut manager_opt = router_state.0.lock().await;

    let manager = RouterManager {
        process_handle: Arc::new(Mutex::new(Some(child))),
        config_path,
        port,
        session_id: session_id.clone(),
        run_id,
    };

    *manager_opt = Some(manager);

    // 8. 等待服务就绪
    log::info!("等待 Router 就绪...");
    wait_for_router_ready(port, Duration::from_secs(10)).await?;

    // 9. 配置 Claude CLI 使用 Router
    log::info!("配置 Claude CLI 环境变量...");
    update_claude_api_base_url(&format!("http://127.0.0.1:{}", port))?;

    log::info!("✅ Router 启动成功");

    Ok(RouterStatus {
        running: true,
        port,
        session_id,
        health: true,
    })
}

/// 停止 Router 进程
/// 支持停止内部管理的进程和外部启动的 CCR
#[command]
pub async fn stop_router(app: AppHandle) -> Result<(), String> {
    log::info!("停止 Router...");

    let router_state = app.state::<RouterManagerState>();
    let mut manager_opt = router_state.0.lock().await;

    if let Some(manager) = manager_opt.take() {
        // 停止内部管理的进程
        let child_opt = {
            let mut handle_opt = manager.process_handle.lock().unwrap();
            handle_opt.take()
        };

        if let Some(mut child) = child_opt {
            log::info!("发送终止信号到 Router 进程");

            if let Err(e) = child.kill().await {
                log::warn!("终止 Router 进程失败: {}", e);
            }

            match tokio::time::timeout(Duration::from_secs(5), child.wait()).await {
                Ok(Ok(status)) => {
                    log::info!("Router 进程已退出: {:?}", status);
                }
                _ => {
                    log::warn!("Router 未在超时时间内退出，强制终止");
                    let _ = child.start_kill();
                }
            }
        }

        // 恢复 Claude CLI 配置
        log::info!("恢复 Claude CLI 环境变量...");
        if let Err(e) = remove_claude_api_base_url() {
            log::warn!("恢复环境变量失败: {}", e);
        }

        log::info!("✅ Router 已停止: session_id={}", manager.session_id);
    } else {
        // 尝试停止外部启动的 CCR
        log::info!("尝试停止外部启动的 CCR...");

        #[cfg(target_os = "windows")]
        let (shell, shell_arg) = ("cmd", "/c");

        #[cfg(not(target_os = "windows"))]
        let (shell, shell_arg) = ("sh", "-c");

        let output = std::process::Command::new(shell)
            .args([shell_arg, "ccr stop"])
            .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    log::info!("✅ 外部 CCR 已停止");
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::warn!("停止外部 CCR 可能失败: {}", stderr);
                }
            }
            Err(e) => {
                log::warn!("执行 ccr stop 失败: {}", e);
            }
        }

        // 恢复 Claude CLI 配置
        if let Err(e) = remove_claude_api_base_url() {
            log::warn!("恢复环境变量失败: {}", e);
        }
    }

    Ok(())
}

/// 获取 Router 状态
/// 检查 CCR 是否在默认端口 3456 运行
#[command]
pub async fn get_router_status(app: AppHandle) -> Result<RouterStatus, String> {
    let router_state = app.state::<RouterManagerState>();
    let manager_opt = router_state.0.lock().await;

    // 如果有内部管理的进程
    if let Some(manager) = manager_opt.as_ref() {
        let health = health_check(manager.port).await.unwrap_or(false);

        return Ok(RouterStatus {
            running: true,
            port: manager.port,
            session_id: manager.session_id.clone(),
            health,
        });
    }

    // 检查默认端口 3456
    if health_check(3456).await.unwrap_or(false) {
        log::info!("检测到 CCR 在端口 3456 运行");
        return Ok(RouterStatus {
            running: true,
            port: 3456,
            session_id: "external".to_string(),
            health: true,
        });
    }

    Ok(RouterStatus {
        running: false,
        port: 0,
        session_id: String::new(),
        health: false,
    })
}

/// 重启 Router 进程
#[command]
pub async fn restart_router(app: AppHandle) -> Result<RouterStatus, String> {
    log::info!("重启 Router...");

    // 先停止
    stop_router(app.clone()).await?;

    // 等待一小段时间确保端口释放
    tokio::time::sleep(Duration::from_millis(500)).await;

    // 再启动
    start_router(app).await
}

/// 打开 CCR Web UI
#[command]
pub async fn open_ccr_ui() -> Result<String, String> {
    log::info!("打开 CCR Web UI...");

    #[cfg(target_os = "windows")]
    let (shell, shell_arg) = ("cmd", "/c");

    #[cfg(not(target_os = "windows"))]
    let (shell, shell_arg) = ("sh", "-c");

    // 启动 ccr ui 命令（在后台运行）
    let output = std::process::Command::new(shell)
        .args([shell_arg, "ccr ui"])
        .spawn();

    match output {
        Ok(_) => {
            log::info!("CCR UI 已启动");
            Ok("CCR UI 已启动，请在浏览器中查看".to_string())
        }
        Err(e) => {
            log::error!("启动 CCR UI 失败: {}", e);
            Err(format!("启动 CCR UI 失败: {}", e))
        }
    }
}

/// 安装或更新 CCR (claude-code-router)
#[command]
pub async fn install_ccr(force: bool) -> Result<String, String> {
    log::info!("安装/更新 CCR, force={}", force);

    #[cfg(target_os = "windows")]
    let (shell, shell_arg) = ("cmd", "/c");

    #[cfg(not(target_os = "windows"))]
    let (shell, shell_arg) = ("sh", "-c");

    // 构建安装命令
    let install_cmd = if force {
        "npm install -g claude-code-router --force"
    } else {
        "npm install -g claude-code-router"
    };

    log::info!("执行命令: {}", install_cmd);

    let output = std::process::Command::new(shell)
        .args([shell_arg, install_cmd])
        .output()
        .map_err(|e| format!("执行安装命令失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    log::info!("安装输出 stdout: {}", stdout);
    log::info!("安装输出 stderr: {}", stderr);

    if output.status.success() {
        // 重新检测版本
        if let Some(ccr_info) = detect_ccr() {
            Ok(format!("✅ CCR 安装成功！版本: {}", ccr_info.version))
        } else {
            Ok("✅ CCR 安装命令执行成功，请重新检测".to_string())
        }
    } else {
        Err(format!("安装失败: {}\n{}", stdout, stderr))
    }
}

/// 获取 CCR 配置目录路径
#[command]
pub fn get_ccr_config_dir() -> Result<String, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "无法获取用户主目录".to_string())?;
    let ccr_dir = home_dir.join(".claude-code-router");

    if !ccr_dir.exists() {
        // 如果目录不存在，创建它
        fs::create_dir_all(&ccr_dir)
            .map_err(|e| format!("创建配置目录失败: {}", e))?;
    }

    Ok(ccr_dir.to_string_lossy().to_string())
}

/// 打开 CCR 配置目录
#[command]
pub fn open_ccr_config_dir() -> Result<(), String> {
    let config_dir = get_ccr_config_dir()?;

    log::info!("打开 CCR 配置目录: {}", config_dir);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }

    Ok(())
}

/// 使用 CCR 原生启动（读取 ~/.claude-code-router/config.json）
/// 使用 ccr restart 命令，因为 ccr start 在 Windows 上会挂起
#[command]
pub async fn start_ccr_native(_app: AppHandle) -> Result<RouterStatus, String> {
    log::info!("使用 ccr restart 启动...");

    // 1. 检查依赖
    let deps = check_router_dependencies()?;
    if !deps.node_installed {
        return Err("Node.js 未安装。请先安装 Node.js。".to_string());
    }
    if !deps.ccr_installed {
        return Err("claude-code-router 未安装。请点击「安装/更新 CCR」按钮。".to_string());
    }

    // 2. 检查 CCR 配置文件是否存在
    let home_dir = dirs::home_dir().ok_or_else(|| "无法获取用户主目录".to_string())?;
    let ccr_config_path = home_dir.join(".claude-code-router").join("config.json");

    if !ccr_config_path.exists() {
        return Err("CCR 配置文件不存在。请先点击「配置 (ccr ui)」进行配置。".to_string());
    }

    // 3. 使用 ccr restart 启动（同步执行，ccr 会自动后台运行）
    #[cfg(target_os = "windows")]
    let output = std::process::Command::new("cmd")
        .args(["/c", "ccr", "restart"])
        .output()
        .map_err(|e| format!("执行 ccr restart 失败: {}", e))?;

    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("sh")
        .args(["-c", "ccr restart"])
        .output()
        .map_err(|e| format!("执行 ccr restart 失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    log::info!("ccr restart stdout: {}", stdout);
    log::info!("ccr restart stderr: {}", stderr);

    // 4. 等待服务就绪
    log::info!("等待 CCR 就绪...");
    tokio::time::sleep(Duration::from_secs(2)).await;

    // 5. 通过健康检查获取端口
    for port in [3456, 3457, 3458, 3459, 3460] {
        if health_check(port).await.unwrap_or(false) {
            log::info!("CCR 服务已在端口 {} 上运行", port);

            // 6. 配置 Claude CLI 环境变量
            update_claude_api_base_url(&format!("http://127.0.0.1:{}", port))?;

            log::info!("✅ CCR 启动成功");

            return Ok(RouterStatus {
                running: true,
                port,
                session_id: "ccr-managed".to_string(),
                health: true,
            });
        }
    }

    Err("CCR 启动失败。请先点击「配置 (ccr ui)」完成 API Provider 配置。".to_string())
}

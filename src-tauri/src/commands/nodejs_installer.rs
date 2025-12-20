/// Node.js 自动安装模块
/// 支持 Windows (MSI) 和 macOS (PKG) 平台的全自动安装
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{command, AppHandle, Emitter};

// ============================================================================
// 数据结构定义
// ============================================================================

/// Node.js 版本信息（从 nodejs.org API 获取）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeVersion {
    pub version: String,
    pub date: String,
    pub lts: serde_json::Value, // 可能是 false 或 LTS 名称字符串
}

/// 安装进度信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub stage: String,
    pub percentage: f64,
    pub message: String,
}

/// 下载进度信息（预留给将来的下载进度功能）
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f64,
}

// ============================================================================
// Tauri 命令
// ============================================================================

/// 获取最新的 Node.js LTS 版本
#[command]
pub async fn get_latest_nodejs_lts() -> Result<NodeVersion, String> {
    log::info!("正在获取最新 Node.js LTS 版本...");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let versions: Vec<NodeVersion> = client
        .get("https://nodejs.org/dist/index.json")
        .send()
        .await
        .map_err(|e| format!("获取版本列表失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析版本列表失败: {}", e))?;

    // 查找第一个 LTS 版本（版本列表按日期降序排列）
    let lts_version = versions
        .into_iter()
        .find(|v| !v.lts.is_boolean() || v.lts.as_bool() != Some(false))
        .ok_or_else(|| "未找到 LTS 版本".to_string())?;

    log::info!("找到 LTS 版本: {}", lts_version.version);
    Ok(lts_version)
}

/// 检测当前平台并返回下载 URL
fn get_download_url(version: &str) -> Result<(String, String), String> {
    let version_num = version.trim_start_matches('v');

    #[cfg(target_os = "windows")]
    {
        let filename = format!("node-v{}-x64.msi", version_num);
        let url = format!(
            "https://nodejs.org/dist/v{}/{}",
            version_num, filename
        );
        Ok((url, filename))
    }

    #[cfg(target_os = "macos")]
    {
        // macOS 检测架构
        let arch = if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            "x64"
        };
        let filename = format!("node-v{}-darwin-{}.pkg", version_num, arch);
        let url = format!(
            "https://nodejs.org/dist/v{}/{}",
            version_num, filename
        );
        Ok((url, filename))
    }

    #[cfg(target_os = "linux")]
    {
        Err("Linux 平台暂不支持自动安装，请使用系统包管理器安装 Node.js".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("不支持的操作系统平台".to_string())
    }
}

/// 下载 Node.js 安装包
#[command]
pub async fn download_nodejs(
    app: AppHandle,
    version: String,
) -> Result<String, String> {
    log::info!("开始下载 Node.js {}...", version);

    // 发送进度：正在准备下载
    let _ = app.emit("nodejs-install-progress", InstallProgress {
        stage: "Downloading".to_string(),
        percentage: 0.0,
        message: "正在准备下载...".to_string(),
    });

    let (url, filename) = get_download_url(&version)?;
    log::info!("下载 URL: {}", url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600)) // 10 分钟超时
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("下载失败，HTTP 状态码: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    log::info!("文件大小: {} bytes", total_size);

    // 创建临时目录
    let temp_dir = std::env::temp_dir();
    let installer_path = temp_dir.join(&filename);
    log::info!("保存路径: {:?}", installer_path);

    // 下载文件
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("下载内容失败: {}", e))?;

    // 写入文件
    std::fs::write(&installer_path, &bytes)
        .map_err(|e| format!("保存文件失败: {}", e))?;

    // 发送进度：下载完成
    let _ = app.emit("nodejs-install-progress", InstallProgress {
        stage: "Downloading".to_string(),
        percentage: 100.0,
        message: format!("下载完成 ({:.2} MB)", bytes.len() as f64 / 1024.0 / 1024.0),
    });

    log::info!("下载完成: {:?}", installer_path);
    Ok(installer_path.to_string_lossy().to_string())
}

/// 验证下载文件的校验和
async fn verify_checksum(file_path: &PathBuf, version: &str) -> Result<bool, String> {
    use sha2::{Sha256, Digest};

    log::info!("正在验证文件校验和...");

    let version_num = version.trim_start_matches('v');

    // 获取官方校验和文件
    let shasums_url = format!(
        "https://nodejs.org/dist/v{}/SHASUMS256.txt",
        version_num
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let shasums_content = client
        .get(&shasums_url)
        .send()
        .await
        .map_err(|e| format!("获取校验和文件失败: {}", e))?
        .text()
        .await
        .map_err(|e| format!("读取校验和内容失败: {}", e))?;

    // 获取文件名
    let filename = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "无法获取文件名".to_string())?;

    // 查找对应的校验和
    let expected_hash = shasums_content
        .lines()
        .find(|line| line.ends_with(filename))
        .and_then(|line| line.split_whitespace().next())
        .ok_or_else(|| format!("未找到文件 {} 的校验和", filename))?;

    // 计算本地文件的 SHA256
    let file_content = std::fs::read(file_path)
        .map_err(|e| format!("读取本地文件失败: {}", e))?;

    let mut hasher = Sha256::new();
    hasher.update(&file_content);
    let actual_hash = format!("{:x}", hasher.finalize());

    if actual_hash == expected_hash {
        log::info!("校验和验证通过");
        Ok(true)
    } else {
        log::error!("校验和不匹配: 期望 {}, 实际 {}", expected_hash, actual_hash);
        Err(format!(
            "文件校验失败，可能已损坏。请重新下载。\n期望: {}\n实际: {}",
            expected_hash, actual_hash
        ))
    }
}

/// Windows 平台安装
#[cfg(target_os = "windows")]
async fn install_nodejs_platform(installer_path: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    log::info!("开始 Windows 安装: {}", installer_path);

    // 使用 PowerShell 提升权限安装
    // -Verb RunAs 会触发 UAC 提示
    let script = format!(
        "Start-Process msiexec -ArgumentList '/i','\"{}\",'/quiet','/norestart' -Verb RunAs -Wait",
        installer_path.replace("'", "''")
    );

    log::info!("执行 PowerShell 脚本: {}", script);

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("执行安装命令失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    log::info!("安装输出 stdout: {}", stdout);
    log::info!("安装输出 stderr: {}", stderr);

    if !output.status.success() {
        // 检查是否是用户取消 UAC
        if stderr.contains("canceled") || stderr.contains("取消") {
            return Err("用户取消了安装。需要管理员权限才能安装 Node.js。".to_string());
        }
        return Err(format!(
            "安装失败，错误码: {:?}\n{}",
            output.status.code(),
            stderr
        ));
    }

    Ok("Windows 安装完成".to_string())
}

/// macOS 平台安装
#[cfg(target_os = "macos")]
async fn install_nodejs_platform(installer_path: &str) -> Result<String, String> {
    log::info!("开始 macOS 安装: {}", installer_path);

    // 使用 osascript 触发原生密码提示
    let script = format!(
        r#"do shell script "installer -pkg '{}' -target /" with administrator privileges"#,
        installer_path.replace("'", "'\\''")
    );

    log::info!("执行 AppleScript: {}", script);

    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("执行安装命令失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    log::info!("安装输出 stdout: {}", stdout);
    log::info!("安装输出 stderr: {}", stderr);

    if !output.status.success() {
        // 检查是否是用户取消
        if stderr.contains("User canceled") || stderr.contains("(-128)") {
            return Err("用户取消了安装。需要管理员密码才能安装 Node.js。".to_string());
        }
        return Err(format!(
            "安装失败，错误码: {:?}\n{}",
            output.status.code(),
            stderr
        ));
    }

    Ok("macOS 安装完成".to_string())
}

/// Linux 平台安装（提供指导）
#[cfg(target_os = "linux")]
async fn install_nodejs_platform(_installer_path: &str) -> Result<String, String> {
    Err("Linux 平台请使用系统包管理器安装 Node.js:\n\
         Ubuntu/Debian: sudo apt install nodejs npm\n\
         Fedora: sudo dnf install nodejs\n\
         Arch: sudo pacman -S nodejs npm".to_string())
}

/// 不支持的平台
#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
async fn install_nodejs_platform(_installer_path: &str) -> Result<String, String> {
    Err("不支持的操作系统平台".to_string())
}

/// 验证 Node.js 安装
async fn verify_installation() -> Result<String, String> {
    log::info!("正在验证 Node.js 安装...");

    // 等待系统更新 PATH（Windows 可能需要几秒）
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;

    // 尝试运行 node --version
    #[cfg(target_os = "windows")]
    let output = std::process::Command::new("cmd")
        .args(["/c", "node", "--version"])
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("node")
        .arg("--version")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            log::info!("Node.js 安装验证成功: {}", version);
            Ok(version)
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            log::warn!("Node.js 验证失败: {}", stderr);
            // 尝试直接检查安装路径
            #[cfg(target_os = "windows")]
            {
                let program_files = std::env::var("ProgramFiles")
                    .unwrap_or_else(|_| "C:\\Program Files".to_string());
                let node_path = PathBuf::from(&program_files).join("nodejs").join("node.exe");
                if node_path.exists() {
                    return Ok("Node.js 已安装（可能需要重启终端以更新 PATH）".to_string());
                }
            }
            Err("Node.js 安装验证失败，可能需要重启应用程序".to_string())
        }
        Err(e) => {
            log::warn!("无法执行 node 命令: {}", e);
            // 同样检查安装路径
            #[cfg(target_os = "windows")]
            {
                let program_files = std::env::var("ProgramFiles")
                    .unwrap_or_else(|_| "C:\\Program Files".to_string());
                let node_path = PathBuf::from(&program_files).join("nodejs").join("node.exe");
                if node_path.exists() {
                    return Ok("Node.js 已安装（可能需要重启终端以更新 PATH）".to_string());
                }
            }
            Err(format!("无法验证 Node.js 安装: {}", e))
        }
    }
}

/// 完整的 Node.js 自动安装流程
#[command]
pub async fn install_nodejs_complete(app: AppHandle) -> Result<String, String> {
    log::info!("开始完整 Node.js 安装流程...");

    // 阶段 1: 获取版本信息
    let _ = app.emit("nodejs-install-progress", InstallProgress {
        stage: "FetchingVersion".to_string(),
        percentage: 5.0,
        message: "正在获取 Node.js 最新 LTS 版本...".to_string(),
    });

    let version = get_latest_nodejs_lts().await?;
    let version_str = version.version.clone();
    let lts_name = match &version.lts {
        serde_json::Value::String(s) => format!(" ({})", s),
        _ => String::new(),
    };

    let _ = app.emit("nodejs-install-progress", InstallProgress {
        stage: "FetchingVersion".to_string(),
        percentage: 10.0,
        message: format!("找到版本: {}{}", version_str, lts_name),
    });

    // 阶段 2: 下载安装包
    let _ = app.emit("nodejs-install-progress", InstallProgress {
        stage: "Downloading".to_string(),
        percentage: 15.0,
        message: "正在下载 Node.js 安装包...".to_string(),
    });

    let installer_path = download_nodejs(app.clone(), version_str.clone()).await?;
    let installer_path_buf = PathBuf::from(&installer_path);

    // 阶段 3: 验证校验和
    let _ = app.emit("nodejs-install-progress", InstallProgress {
        stage: "Verifying".to_string(),
        percentage: 60.0,
        message: "正在验证安装包完整性...".to_string(),
    });

    match verify_checksum(&installer_path_buf, &version_str).await {
        Ok(_) => {
            let _ = app.emit("nodejs-install-progress", InstallProgress {
                stage: "Verifying".to_string(),
                percentage: 70.0,
                message: "校验和验证通过".to_string(),
            });
        }
        Err(e) => {
            // 清理下载的文件
            let _ = std::fs::remove_file(&installer_path);
            return Err(e);
        }
    }

    // 阶段 4: 执行安装
    let _ = app.emit("nodejs-install-progress", InstallProgress {
        stage: "Installing".to_string(),
        percentage: 75.0,
        message: "正在安装 Node.js（可能需要授权）...".to_string(),
    });

    match install_nodejs_platform(&installer_path).await {
        Ok(_) => {
            let _ = app.emit("nodejs-install-progress", InstallProgress {
                stage: "Installing".to_string(),
                percentage: 90.0,
                message: "安装程序已完成".to_string(),
            });
        }
        Err(e) => {
            // 清理下载的文件
            let _ = std::fs::remove_file(&installer_path);
            return Err(e);
        }
    }

    // 阶段 5: 验证安装
    let _ = app.emit("nodejs-install-progress", InstallProgress {
        stage: "Installing".to_string(),
        percentage: 95.0,
        message: "正在验证安装...".to_string(),
    });

    let verify_result = verify_installation().await;

    // 清理临时文件
    let _ = std::fs::remove_file(&installer_path);
    log::info!("已清理临时安装文件");

    // 阶段 6: 完成
    match verify_result {
        Ok(installed_version) => {
            let _ = app.emit("nodejs-install-progress", InstallProgress {
                stage: "Completed".to_string(),
                percentage: 100.0,
                message: format!("Node.js {} 安装成功！", installed_version),
            });

            // 发送安装完成事件，通知其他组件刷新
            let _ = app.emit("nodejs-installed", ());

            Ok(format!("Node.js {} 安装成功", version_str))
        }
        Err(e) => {
            // 即使验证失败，安装可能已成功，只是 PATH 尚未更新
            if e.contains("重启") {
                let _ = app.emit("nodejs-install-progress", InstallProgress {
                    stage: "Completed".to_string(),
                    percentage: 100.0,
                    message: "Node.js 安装完成，请重启应用程序以使环境变量生效".to_string(),
                });
                let _ = app.emit("nodejs-installed", ());
                Ok("Node.js 安装完成，请重启应用程序以使环境变量生效".to_string())
            } else {
                let _ = app.emit("nodejs-install-progress", InstallProgress {
                    stage: "Failed".to_string(),
                    percentage: 0.0,
                    message: e.clone(),
                });
                Err(e)
            }
        }
    }
}

/// 检查 Node.js 是否已安装
#[command]
pub fn check_nodejs_installed() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    let output = std::process::Command::new("cmd")
        .args(["/c", "node", "--version"])
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("node")
        .arg("--version")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(Some(version))
        }
        _ => Ok(None),
    }
}

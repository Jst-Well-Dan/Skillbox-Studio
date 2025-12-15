use tauri::Emitter;
use crate::claude_binary::find_claude_binary;
use std::process::{Command, Stdio};

/// Diagnostic command to test Claude CLI availability
#[tauri::command]
pub async fn diagnostic_claude_cli(app: tauri::AppHandle) -> Result<String, String> {
    let mut report = String::new();

    // 1. Check if Claude CLI can be found
    report.push_str("=== Claude CLI Diagnostic Report ===\n\n");
    report.push_str("1. Searching for Claude CLI...\n");

    match find_claude_binary(&app) {
        Ok(path) => {
            report.push_str(&format!("   ✅ Found Claude CLI at: {}\n\n", path));

            // 2. Test if Claude CLI can be executed
            report.push_str("2. Testing Claude CLI execution...\n");

            let mut cmd = Command::new(&path);
            cmd.arg("--version");
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());

            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }

            match cmd.output() {
                Ok(output) => {
                    if output.status.success() {
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        report.push_str(&format!("   ✅ Claude CLI is executable\n"));
                        report.push_str(&format!("   Version: {}\n\n", stdout.trim()));
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        report.push_str(&format!("   ❌ Claude CLI execution failed\n"));
                        report.push_str(&format!("   Error: {}\n\n", stderr.trim()));
                    }
                }
                Err(e) => {
                    report.push_str(&format!("   ❌ Failed to execute Claude CLI: {}\n\n", e));
                }
            }

            // 3. Test simple prompt execution
            report.push_str("3. Testing simple prompt execution...\n");
            report.push_str("   Running: claude --help\n");

            let mut help_cmd = Command::new(&path);
            help_cmd.arg("--help");
            help_cmd.stdout(Stdio::piped());
            help_cmd.stderr(Stdio::piped());

            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                help_cmd.creation_flags(0x08000000);
            }

            match help_cmd.output() {
                Ok(output) => {
                    if output.status.success() {
                        report.push_str("   ✅ Claude CLI help command succeeded\n\n");
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        report.push_str(&format!("   ❌ Help command failed: {}\n\n", stderr.trim()));
                    }
                }
                Err(e) => {
                    report.push_str(&format!("   ❌ Failed to run help command: {}\n\n", e));
                }
            }
        }
        Err(e) => {
            report.push_str(&format!("   ❌ Claude CLI not found: {}\n\n", e));
            report.push_str("Troubleshooting steps:\n");
            report.push_str("   1. Install Claude Code: npm install -g @anthropic-ai/claude-code\n");
            report.push_str("   2. Verify installation: claude --version\n");
            report.push_str("   3. Restart the application\n\n");
        }
    }

    // 4. Check environment variables
    report.push_str("4. Checking environment variables...\n");

    if let Ok(api_key) = std::env::var("ANTHROPIC_API_KEY") {
        let masked = if api_key.len() > 8 {
            format!("{}...{}", &api_key[..4], &api_key[api_key.len()-4..])
        } else {
            "****".to_string()
        };
        report.push_str(&format!("   ✅ ANTHROPIC_API_KEY: {}\n", masked));
    } else {
        report.push_str("   ⚠️  ANTHROPIC_API_KEY not set\n");
    }

    if let Ok(model) = std::env::var("ANTHROPIC_MODEL") {
        report.push_str(&format!("   ℹ️  ANTHROPIC_MODEL: {}\n", model));
    }

    report.push_str("\n=== End of Diagnostic Report ===\n");

    Ok(report)
}

/// Install or update Claude Code CLI via npm
#[tauri::command]
pub async fn install_claude_code() -> Result<String, String> {
    log::info!("安装/更新 Claude Code CLI...");

    #[cfg(target_os = "windows")]
    let (shell, shell_arg) = ("cmd", "/c");

    #[cfg(not(target_os = "windows"))]
    let (shell, shell_arg) = ("sh", "-c");

    // 构建安装命令
    let install_cmd = "npm install -g @anthropic-ai/claude-code";

    log::info!("执行命令: {}", install_cmd);

    let mut cmd = std::process::Command::new(shell);
    cmd.args([shell_arg, install_cmd]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("执行安装命令失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    log::info!("安装输出 stdout: {}", stdout);
    log::info!("安装输出 stderr: {}", stderr);

    if output.status.success() {
        // 检测安装后的版本
        let version_output = std::process::Command::new(shell)
            .args([shell_arg, "claude --version"])
            .output();

        let version_info = if let Ok(v_output) = version_output {
            if v_output.status.success() {
                let version = String::from_utf8_lossy(&v_output.stdout);
                format!("版本: {}", version.trim())
            } else {
                "已安装".to_string()
            }
        } else {
            "已安装".to_string()
        };

        Ok(format!("✅ Claude Code CLI 安装成功！{}", version_info))
    } else {
        // npm 安装有时会在 stderr 输出信息但仍然成功
        // 检查是否真的失败
        if stderr.contains("added") || stderr.contains("up to date") || stdout.contains("added") {
            Ok("✅ Claude Code CLI 安装成功！".to_string())
        } else {
            Err(format!(
                "安装失败:\n{}\n{}",
                stdout.trim(),
                stderr.trim()
            ))
        }
    }
}

/// Test event emission to verify Tauri event system
#[tauri::command]
pub async fn diagnostic_test_event(app: tauri::AppHandle) -> Result<(), String> {
    log::info!("Testing event emission...");

    // Emit a test event
    app.emit("diagnostic-test", "Test message from backend")
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    log::info!("Test event emitted successfully");
    Ok(())
}

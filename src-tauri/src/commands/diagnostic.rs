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
            report.push_str("   1. Install Claude CLI: npm install -g @anthropic/claude\n");
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

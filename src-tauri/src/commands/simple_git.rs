use log;
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Check if a directory is a Git repository
pub fn is_git_repo(project_path: &str) -> bool {
    Path::new(project_path).join(".git").exists()
}

/// Ensure Git repository exists, initialize if needed
pub fn ensure_git_repo(project_path: &str) -> Result<(), String> {
    // Check if .git exists
    let has_git_dir = is_git_repo(project_path);

    // Check if has commits (HEAD exists)
    let has_commits = has_git_dir && git_current_commit(project_path).is_ok();

    if has_commits {
        log::debug!("Git repository ready at: {}", project_path);
        return Ok(());
    }

    // Need to initialize or create first commit
    if !has_git_dir {
        log::info!("Initializing Git repository at: {}", project_path);

        let mut cmd = Command::new("git");
        cmd.args(["init"]);
        cmd.current_dir(project_path);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let init_output = cmd
            .output()
            .map_err(|e| format!("Failed to init git: {}", e))?;

        if !init_output.status.success() {
            return Err(format!(
                "Git init failed: {}",
                String::from_utf8_lossy(&init_output.stderr)
            ));
        }
    } else {
        log::info!("Git repository exists but has no commits, creating initial commit");
    }

    // Configure Git user if not set (needed for commits)
    let mut config_name = Command::new("git");
    config_name.args(["config", "user.name", "Claude Workbench"]);
    config_name.current_dir(project_path);
    #[cfg(target_os = "windows")]
    config_name.creation_flags(0x08000000);
    let _ = config_name.output();

    let mut config_email = Command::new("git");
    config_email.args(["config", "user.email", "ai@claude.workbench"]);
    config_email.current_dir(project_path);
    #[cfg(target_os = "windows")]
    config_email.creation_flags(0x08000000);
    let _ = config_email.output();

    // CRITICAL: Add all existing files first to preserve user code!
    log::info!("Adding all existing files to git staging area...");
    let mut add_cmd = Command::new("git");
    add_cmd.args(["add", "-A"]);
    add_cmd.current_dir(project_path);
    #[cfg(target_os = "windows")]
    add_cmd.creation_flags(0x08000000);

    let add_output = add_cmd
        .output()
        .map_err(|e| format!("Failed to add files: {}", e))?;

    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr);
        log::warn!("Git add warning: {}", stderr);
        // Continue anyway, might just be no files to add
    }

    // Create initial commit with all current files
    // Use --allow-empty as fallback in case there are no files
    let mut commit_cmd = Command::new("git");
    commit_cmd.args([
        "commit",
        "--allow-empty",
        "-m",
        "[Claude Workbench] Initial commit - preserving existing code",
    ]);
    commit_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    commit_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let commit_output = commit_cmd
        .output()
        .map_err(|e| format!("Failed to create initial commit: {}", e))?;

    if !commit_output.status.success() {
        let stderr = String::from_utf8_lossy(&commit_output.stderr);
        log::error!("Git commit failed: {}", stderr);
        return Err(format!("Failed to create initial commit: {}", stderr));
    }

    log::info!("Git repository initialized successfully with initial commit (all existing files preserved)");
    Ok(())
}

/// Get current HEAD commit hash
pub fn git_current_commit(project_path: &str) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(["rev-parse", "HEAD"]);
    cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to get current commit: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git rev-parse failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let commit = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in commit hash: {}", e))?
        .trim()
        .to_string();

    Ok(commit)
}

/// Commit all changes with a message
/// Returns: Ok(true) if committed, Ok(false) if no changes, Err if failed
pub fn git_commit_changes(project_path: &str, message: &str) -> Result<bool, String> {
    // Check if there are any changes
    let mut status_cmd = Command::new("git");
    status_cmd.args(["status", "--porcelain"]);
    status_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    status_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let status_output = status_cmd
        .output()
        .map_err(|e| format!("Failed to check git status: {}", e))?;

    if !status_output.status.success() {
        return Err(format!(
            "Git status failed: {}",
            String::from_utf8_lossy(&status_output.stderr)
        ));
    }

    let status_str = String::from_utf8_lossy(&status_output.stdout);
    if status_str.trim().is_empty() {
        // No changes to commit
        return Ok(false);
    }

    // Stage all changes
    let mut add_cmd = Command::new("git");
    add_cmd.args(["add", "-A"]);
    add_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    add_cmd.creation_flags(0x08000000);

    let add_output = add_cmd
        .output()
        .map_err(|e| format!("Failed to git add: {}", e))?;

    if !add_output.status.success() {
        return Err(format!(
            "Git add failed: {}",
            String::from_utf8_lossy(&add_output.stderr)
        ));
    }

    // Commit changes
    let mut commit_cmd = Command::new("git");
    commit_cmd.args(["commit", "-m", message]);
    commit_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    commit_cmd.creation_flags(0x08000000);

    let commit_output = commit_cmd
        .output()
        .map_err(|e| format!("Failed to git commit: {}", e))?;

    if !commit_output.status.success() {
        return Err(format!(
            "Git commit failed: {}",
            String::from_utf8_lossy(&commit_output.stderr)
        ));
    }

    log::info!("Committed changes: {}", message);
    Ok(true)
}

/// Reset repository to a specific commit
pub fn git_reset_hard(project_path: &str, commit: &str) -> Result<(), String> {
    log::info!("Resetting repository to commit: {}", commit);

    let mut cmd = Command::new("git");
    cmd.args(["reset", "--hard", commit]);
    cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to reset: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git reset failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    log::info!("Successfully reset to commit: {}", commit);
    Ok(())
}

/// Save uncommitted changes to stash
pub fn git_stash_save(project_path: &str, message: &str) -> Result<(), String> {
    // Check if there are uncommitted changes
    let mut status_cmd = Command::new("git");
    status_cmd.args(["status", "--porcelain"]);
    status_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    status_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let status_output = status_cmd
        .output()
        .map_err(|e| format!("Failed to check status: {}", e))?;

    if status_output.stdout.is_empty() {
        log::debug!("No uncommitted changes to stash");
        return Ok(()); // No changes to stash
    }

    log::info!("Stashing uncommitted changes: {}", message);

    let mut stash_cmd = Command::new("git");
    stash_cmd.args(["stash", "save", "-u", message]);
    stash_cmd.current_dir(project_path);

    #[cfg(target_os = "windows")]
    stash_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = stash_cmd
        .output()
        .map_err(|e| format!("Failed to stash: {}", e))?;

    if !output.status.success() {
        log::warn!(
            "Git stash warning: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    Ok(())
}

/// Tauri command: Check and initialize Git repository
#[tauri::command]
pub fn check_and_init_git(project_path: String) -> Result<bool, String> {
    let was_not_initialized = !is_git_repo(&project_path);

    // Always call ensure_git_repo - it will check for commits too
    ensure_git_repo(&project_path)?;

    Ok(was_not_initialized)
}

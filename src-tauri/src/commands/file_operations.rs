use std::process::Command as StdCommand;
use std::fs;
use std::path::Path;

/// Read file content as string
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

/// Check if a path exists
#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// Create a directory (including parent directories)
#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory {}: {}", path, e))
}

/// Create a symbolic link (cross-platform)
/// On Windows, uses Junction Point which doesn't require admin privileges
#[tauri::command]
pub fn create_symlink(source: String, target: String) -> Result<(), String> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&source, &target)
            .map_err(|e| format!("Failed to create symlink from {} to {}: {}", source, target, e))
    }

    #[cfg(windows)]
    {
        // On Windows, use Junction Point for directories (doesn't require admin privileges)
        junction::create(&source, &target)
            .map_err(|e| format!("Failed to create junction from {} to {}: {}", source, target, e))
    }
}

/// Open a directory in the system file explorer (cross-platform)
#[tauri::command]
pub async fn open_directory_in_explorer(directory_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = StdCommand::new("explorer");
        cmd.arg(&directory_path);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        StdCommand::new("open")
            .arg(&directory_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        StdCommand::new("xdg-open")
            .arg(&directory_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    Ok(())
}

/// Open a file with the system's default application (cross-platform)
#[tauri::command]
pub async fn open_file_with_default_app(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // Use 'start' command through cmd to open file with default app
        let mut cmd = StdCommand::new("cmd");
        cmd.args(&["/C", "start", "", &file_path]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        StdCommand::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        StdCommand::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

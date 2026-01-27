use std::process::Command;

#[tauri::command]
pub fn open_project_folder(path: String) -> Result<(), String> {
    println!("Opening folder: {}", path);
    
    // Normalize path for Windows: Replace / with \
    let path_normalized = if cfg!(target_os = "windows") {
        path.replace('/', "\\")
    } else {
        path.clone()
    };

    println!("Normalized path: {}", path_normalized);

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path_normalized)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path_normalized)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path_normalized)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

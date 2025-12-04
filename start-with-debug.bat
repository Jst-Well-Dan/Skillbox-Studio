@echo off
echo Starting Claude Workbench with debug logging...
echo.
echo Backend logs will show:
echo - [INFO] Recording prompt sent
echo - [INFO] Auto-committed changes
echo - [INFO] Reverting to prompt
echo - [DEBUG] Line scanning details
echo.
set RUST_LOG=debug
npm run tauri dev


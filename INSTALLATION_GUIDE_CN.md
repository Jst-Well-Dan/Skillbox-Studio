# Claude Workbench 安装与部署速查

> 本文概括 `E:\Python_Doc\AI Learning\claude-workbench\claude-workbench` 项目的搭建流程，方便在 Windows 环境下快速完成安装、开发与打包。

## 1. 终端环境准备

1. **避免 PowerShell Profile 造成的阻塞**  
   `C:\Users\A\Documents\PowerShell\profile.ps1` 中的 `conda.exe shell.powershell` 钩子会在执行任何命令时报错（`StandardOutputEncoding is only supported when standard output is redirected`）。  
   - 暂时方案：使用 `pwsh -NoProfile` 或 `cmd` 执行后续命令。  
   - 长期方案：`notepad $PROFILE` 注释掉相关 `conda` 代码，或在 Conda 设置里禁用自动激活。

2. **必须安装的软件**  
   - Node.js ≥ 18（当前 `node -v` 为 `v22.17.0`，已满足）。  
   - Rust 工具链（`cargo -V` 已通过）。  
   - WebView2 Runtime：从微软官网下载，用于 Tauri UI。  
   - Visual Studio Build Tools：安装 `Desktop development with C++` 工作负载，确保包含 MSVC、Windows SDK。  
   - Claude Code CLI：从官方文档安装，并准备好 `ANTHROPIC_API_KEY` 或代理所需的环境变量。

## 2. 安装 Bun 与项目依赖

`src-tauri/tauri.conf.json` 的 `beforeDevCommand` 固定调用 `bun run dev`，因此需要先安装 Bun：

```powershell
pwsh -NoProfile
irm https://bun.sh/install.ps1 | iex
setx PATH "$env:USERPROFILE\.bun\bin;$env:PATH"
# 重新打开无 profile 的终端，使 PATH 生效
```

进入项目目录安装依赖（优先使用 `bun install`，可重用 `bun.lock`）：

```powershell
cd "E:\Python_Doc\AI Learning\claude-workbench\claude-workbench"
bun install
```

> 若坚持使用 npm/pnpm，需要同步修改 `src-tauri/tauri.conf.json` 的 `beforeDevCommand`，或设置 `TAURI_BEFORE_DEV_COMMAND="npm run dev"`，否则 Tauri 仍会尝试调用 Bun。

## 3. 开发调试

- 标准开发模式：
  ```powershell
  bun run tauri:dev   # 触发 Vite + Tauri Dev
  ```
- 若需要后端日志，运行仓库根目录的 `start-with-debug.bat`，它会设置 `RUST_LOG=debug` 并启动 `npm run tauri dev`，可根据使用的包管理器调整脚本末行。
- 启动后在应用的「设置 → 代理商/环境变量」中填入 Claude CLI 目录、API Key、代理信息，才能正常调用 Claude。

## 4. 构建与部署

```powershell
# 生成正式安装包（NSIS/MSI 等）
bun run tauri:build

# 快速打包调试版
bun run tauri:build-fast
```

生成的安装文件位于 `src-tauri\target\release\bundle\` 目录下，其中 Windows 环境默认会有 `nsis` 与 `msi` 两套安装器（`tauri.conf.json` 中的 `bundle.targets: "all"`）。

## 5. 常见问题排查

- **`Could not determine Node.js install directory`**：通常是 profile 中的 `conda` 钩子导致，换用 `pwsh -NoProfile` 或清理 profile。
- **`bun` 命令不存在**：确认 `%USERPROFILE%\.bun\bin` 已写入 PATH，并重新打开终端。
- **链接器/SDK 缺失**：若构建时提示找不到 `link.exe`、`rc.exe`、`Windows SDK`，需要复查 Visual Studio Build Tools 是否安装完整。
- **WebView2 白屏**：安装微软 WebView2 Runtime。
- **自动更新地址**：`src-tauri/tauri.conf.json` 中 `plugins.updater.endpoints` 默认指向 GitHub，如在内网部署可按需修改或禁用。

完成以上步骤后即可在本机完成开发调试，并通过 `src-tauri\target\release\bundle` 里的安装包进行部署。

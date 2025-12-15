# Xiya Claude Studio 发布指南

本文档说明如何为 Xiya Claude Studio 创建新版本发布，包括自动更新所需的 `latest.json` 文件。

## 目录

- [概述](#概述)
- [前置准备](#前置准备)
- [手动发布流程](#手动发布流程)
- [latest.json 文件格式](#latestjson-文件格式)
- [GitHub Actions 自动化](#github-actions-自动化)
- [常见问题](#常见问题)

---

## 概述

Tauri 的自动更新系统通过检查远程 `latest.json` 文件来判断是否有新版本。当用户的应用检测到新版本时，会下载并安装更新包。

**更新流程**:
```
应用启动 → 请求 latest.json → 比较版本号 → 下载更新包 → 验证签名 → 安装更新
```

---

## 前置准备

### 1. 安装 Tauri CLI

```bash
# 使用 cargo 安装
cargo install tauri-cli

# 或使用 npm
npm install -g @tauri-apps/cli
```

### 2. 生成签名密钥对（首次发布前）

Tauri 使用 Ed25519 签名来验证更新包的完整性，防止恶意篡改。

```bash
# 生成密钥对
cargo tauri signer generate -w ~/.tauri/xiya-claude-studio.key
```

执行后会输出：
- **私钥文件**: `~/.tauri/xiya-claude-studio.key` (保密，用于签名)
- **公钥字符串**: 一串 Base64 编码的文本 (公开，配置到 tauri.conf.json)

### 3. 配置公钥

将生成的公钥更新到 `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/Jst-Well-Dan/Xiya-Claude-Studio/releases/latest/download/latest.json"
      ],
      "pubkey": "你的公钥字符串"
    }
  }
}
```

### 4. 设置环境变量（构建时需要）

```bash
# Windows PowerShell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content ~/.tauri/xiya-claude-studio.key
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""  # 如果设置了密码

# Linux/macOS
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/xiya-claude-studio.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

---

## 手动发布流程

### 步骤 1: 更新版本号

编辑以下文件中的版本号：

**`src-tauri/tauri.conf.json`**:
```json
{
  "version": "1.1.0"
}
```

**`src-tauri/Cargo.toml`**:
```toml
[package]
version = "1.1.0"
```

**`package.json`**:
```json
{
  "version": "1.1.0"
}
```

### 步骤 2: 构建发布版本

```bash
# 设置签名密钥环境变量
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content ~/.tauri/xiya-claude-studio.key -Raw

# 构建生产版本
npm run tauri:build
```

构建完成后，在 `src-tauri/target/release/bundle/` 目录下会生成：
- `nsis/Xiya Claude Studio_1.1.0_x64-setup.exe` - Windows 安装程序
- `nsis/Xiya Claude Studio_1.1.0_x64-setup.nsis.zip` - 更新包
- `nsis/Xiya Claude Studio_1.1.0_x64-setup.nsis.zip.sig` - 签名文件

### 步骤 3: 创建 latest.json

读取 `.sig` 文件内容作为签名：

```powershell
# PowerShell
Get-Content "src-tauri/target/release/bundle/nsis/Xiya Claude Studio_1.1.0_x64-setup.nsis.zip.sig"
```

创建 `latest.json` 文件：

```json
{
  "version": "1.1.0",
  "notes": "### 更新内容\n\n- 新增功能 A\n- 修复问题 B\n- 优化性能 C",
  "pub_date": "2025-01-15T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "签名文件的内容（.sig 文件内容）",
      "url": "https://github.com/Jst-Well-Dan/Xiya-Claude-Studio/releases/download/v1.1.0/Xiya.Claude.Studio_1.1.0_x64-setup.nsis.zip"
    }
  }
}
```

### 步骤 4: 创建 GitHub Release

1. 访问 https://github.com/Jst-Well-Dan/Xiya-Claude-Studio/releases/new
2. 创建新 Tag: `v1.1.0`
3. 填写 Release 标题和说明
4. 上传以下文件：
   - `Xiya Claude Studio_1.1.0_x64-setup.exe` (安装程序)
   - `Xiya Claude Studio_1.1.0_x64-setup.nsis.zip` (更新包)
   - `latest.json` (版本信息文件)
5. 发布 Release

---

## latest.json 文件格式

### 完整示例

```json
{
  "version": "1.1.0",
  "notes": "### 新功能\n\n- 添加深色主题支持\n- 新增快捷键设置\n\n### 修复\n\n- 修复会话同步问题\n- 修复内存泄漏",
  "pub_date": "2025-01-15T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUWUF...",
      "url": "https://github.com/Jst-Well-Dan/Xiya-Claude-Studio/releases/download/v1.1.0/Xiya.Claude.Studio_1.1.0_x64-setup.nsis.zip"
    },
    "darwin-x86_64": {
      "signature": "签名内容...",
      "url": "https://github.com/Jst-Well-Dan/Xiya-Claude-Studio/releases/download/v1.1.0/Xiya.Claude.Studio_1.1.0_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "签名内容...",
      "url": "https://github.com/Jst-Well-Dan/Xiya-Claude-Studio/releases/download/v1.1.0/Xiya.Claude.Studio_1.1.0_aarch64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "签名内容...",
      "url": "https://github.com/Jst-Well-Dan/Xiya-Claude-Studio/releases/download/v1.1.0/Xiya.Claude.Studio_1.1.0_amd64.AppImage.tar.gz"
    }
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `version` | string | ✅ | 版本号，不带 `v` 前缀 |
| `notes` | string | ❌ | 更新说明，支持 Markdown |
| `pub_date` | string | ❌ | 发布时间，ISO 8601 格式 |
| `platforms` | object | ✅ | 各平台的更新信息 |

### 平台标识符

| 标识符 | 平台 |
|--------|------|
| `windows-x86_64` | Windows 64位 |
| `windows-i686` | Windows 32位 |
| `darwin-x86_64` | macOS Intel |
| `darwin-aarch64` | macOS Apple Silicon |
| `linux-x86_64` | Linux 64位 |

---

## GitHub Actions 自动化

创建 `.github/workflows/release.yml` 实现自动构建和发布：

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'windows-latest'
            args: ''
          # - platform: 'macos-latest'
          #   args: '--target universal-apple-darwin'
          # - platform: 'ubuntu-22.04'
          #   args: ''

    runs-on: ${{ matrix.platform }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install Rust stable
        uses: dtolnay/rust-action@stable

      - name: Install dependencies (Ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install frontend dependencies
        run: bun install

      - name: Build the app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Xiya Claude Studio v__VERSION__'
          releaseBody: '查看更新内容请访问 [CHANGELOG](https://github.com/Jst-Well-Dan/Xiya-Claude-Studio/blob/main/CHANGELOG.md)'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
          updaterJsonKeepUniversal: true
```

### 配置 GitHub Secrets

在仓库设置中添加以下 Secrets:

1. `TAURI_SIGNING_PRIVATE_KEY`: 私钥文件内容
2. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: 私钥密码（如果有）

路径: 仓库 → Settings → Secrets and variables → Actions → New repository secret

### 发布流程

1. 更新版本号
2. 提交更改
3. 创建并推送 Tag:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
4. GitHub Actions 自动构建并创建 Draft Release
5. 在 GitHub 上编辑 Release 说明后发布

---

## 常见问题

### Q: 更新检查失败，提示 404

**原因**: `latest.json` 文件不存在或 URL 不正确

**解决**:
1. 确认 Release 中已上传 `latest.json`
2. 检查 `tauri.conf.json` 中的 endpoints URL 是否正确

### Q: 签名验证失败

**原因**: 公钥与私钥不匹配，或签名文件损坏

**解决**:
1. 确认 `tauri.conf.json` 中的 `pubkey` 与生成签名时使用的私钥匹配
2. 重新生成密钥对并更新配置

### Q: 下载更新失败

**原因**: 更新包 URL 不正确或文件不存在

**解决**:
1. 检查 `latest.json` 中的 `url` 是否指向正确的文件
2. 确认文件名中的空格已正确编码（空格 → `%20` 或 `.`）

### Q: 如何测试更新功能

1. 构建一个较低版本的应用（如 0.9.0）
2. 发布一个较高版本（如 1.0.0）
3. 运行低版本应用，检查是否能检测到更新

---

## 参考链接

- [Tauri Updater 文档](https://v2.tauri.app/plugin/updater/)
- [Tauri Signer 文档](https://v2.tauri.app/reference/cli/#signer)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)

# GitHub Actions 自动构建指南

本项目已配置 GitHub Actions，支持自动构建 Windows、macOS 和 Linux 多平台应用。

---

## 支持的平台

| 平台 | 架构 | 输出文件 |
|------|------|----------|
| **Windows** | x64 | `.msi`, `-setup.exe`, `-portable.exe` |
| **macOS** | Apple Silicon (M1/M2/M3) | `.dmg`, `.app.tar.gz` |
| **macOS** | Intel | `.dmg`, `.app.tar.gz` |
| **Linux** | x64 | `.AppImage`, `.deb` |

---

## 使用方法

### 1. 推送代码到 GitHub

```bash
# 首次推送
git remote add origin https://github.com/你的用户名/xiya-claude-studio.git
git push -u origin main

# 后续推送
git push origin main
```

### 2. 触发构建

| 触发方式 | 行为 |
|----------|------|
| 推送到 `main` 分支 | 构建测试（不发布） |
| Pull Request 到 `main` | 构建测试（不发布） |
| 创建版本标签 `v*` | 构建 + 创建 Release 草稿 |

### 3. 创建正式发布

```bash
# 创建版本标签
git tag v4.3.6

# 推送标签触发构建
git push origin v4.3.6
```

### 4. 发布流程

1. GitHub Actions 自动构建所有平台（约 15-30 分钟）
2. 构建完成后，在仓库的 **Releases** 页面会出现一个草稿
3. 审核草稿内容，确认无误后点击 **Publish release** 发布

---

## 构建产物说明

### Windows

| 文件类型 | 说明 | 自动更新 |
|----------|------|----------|
| `*-setup.exe` | NSIS 安装包 | ✅ 支持 |
| `*.msi` | MSI 安装包 | ✅ 支持 |
| `*-portable.exe` | 免安装版 | ❌ 需手动更新 |

### macOS

| 文件类型 | 说明 |
|----------|------|
| `*.dmg` | 磁盘映像，双击挂载后拖入应用程序文件夹 |
| `*.app.tar.gz` | 压缩包，解压后直接使用 |

### Linux

| 文件类型 | 说明 |
|----------|------|
| `*.AppImage` | 通用格式，添加执行权限后直接运行 |
| `*.deb` | Debian/Ubuntu 安装包 |

---

## 可选配置：应用签名

应用签名用于支持自动更新功能。如果不需要自动更新，可以跳过此步骤。

### 生成签名密钥

```bash
# 生成密钥对
npx tauri signer generate -w ~/.tauri/xiya-claude-studio.key

# 输出示例：
# Your public key was generated:
# dW50cnVzdGVkIGNvbW1lbnQ6IG1pbml...
#
# Your secret key was saved to ~/.tauri/xiya-claude-studio.key
```

### 配置 GitHub Secrets

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称 | 值 |
|-------------|-----|
| `TAURI_SIGNING_PRIVATE_KEY` | 密钥文件的全部内容 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 生成密钥时设置的密码 |

### 配置公钥

将公钥添加到 `src-tauri/tauri.conf.json` 的 updater 配置中：

```json
{
  "plugins": {
    "updater": {
      "pubkey": "你的公钥内容",
      "endpoints": [
        "https://github.com/你的用户名/xiya-claude-studio/releases/latest/download/latest.json"
      ]
    }
  }
}
```

---

## 注意事项

### macOS Gatekeeper

未签名的 macOS 应用会被 Gatekeeper 阻止。用户需要：

1. 右键点击应用
2. 选择「打开」
3. 在弹出的对话框中点击「打开」

或者在终端执行：
```bash
xattr -cr /Applications/Xiya\ Claude\ Studio.app
```

### Windows SmartScreen

未签名的 Windows 应用首次运行时会显示 SmartScreen 警告：

1. 点击「更多信息」
2. 点击「仍要运行」

### 构建时间

| 场景 | 预计时间 |
|------|----------|
| 首次构建 | 20-30 分钟 |
| 有缓存的构建 | 10-15 分钟 |
| 单平台构建 | 5-10 分钟 |

### 构建失败排查

1. 检查 **Actions** 页面的构建日志
2. 常见问题：
   - 依赖安装失败：检查 `package.json` 和 `Cargo.toml`
   - Rust 编译错误：检查代码语法
   - 前端构建失败：检查 TypeScript 类型错误

---

## 相关文件

- `.github/workflows/build.yml` - GitHub Actions 工作流配置
- `src-tauri/tauri.conf.json` - Tauri 应用配置
- `src-tauri/Cargo.toml` - Rust 依赖配置
- `package.json` - 前端依赖和脚本配置

---

## 快速参考

```bash
# 推送代码（触发测试构建）
git push origin main

# 创建发布（触发正式构建）
git tag v4.3.6
git push origin v4.3.6

# 查看构建状态
# 访问: https://github.com/你的用户名/xiya-claude-studio/actions
```

# Skillbox Studio

<div align="center">

<img src="public/Skillbox-with-words.svg" alt="Skillbox Studio Logo" width="400" />

**AI Agent 技能的一站式管理中心 | The Ultimate Skill Manager for Your AI Agents**

[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat&logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey)](https://github.com/Jst-Well-Dan/Skillbox-Studio/releases)

[下载最新版 (Download)](https://github.com/Jst-Well-Dan/Skillbox-Studio/releases) • [功能特性 (Features)](#-核心功能-features) • [使用指南 (Usage)](#-快速开始-getting-started) • [开发指南 (Development)](#-开发指南-development)

</div>

---

## 📖 简介 Introduction

**Skillbox Studio** 是一款现代化的桌面应用程序，专为统一管理多种 AI Agent 的扩展技能（Skills / MCP Tools）而设计。

在 AI 辅助编程日益普及的今天，我们经常需要在不同的 Agent（如 **Claude**、**Cursor**、**Windsurf**）之间切换。Skillbox Studio 致力于解决技能碎片化的问题，让您通过一个精美的可视化界面，轻松发现、安装、同步和管理所有强大的 AI 技能包。

**Skillbox Studio** brings order to the chaos of AI agent skills. Whether you're coding with **Claude**, building with **Cursor** or **Windsurf**, manage all your extensions in one premium, unified interface.

## ✨ 核心功能 Features

- **🌐 统一技能市场 (Unified Marketplace)**
  内置精选技能库（Business, Coding, Writing, Automation 等），提供类似 App Store 的浏览和安装体验。
  
- **🤖 多 Agent 支持 (Multi-Agent Support)**
  一次下载，到处运行。支持一键将技能安装到 Claude, Cursor, Trae 等十余种主流 AI 助手。
  
- **📂 本地技能管理 (Local Skills Management)**
  扫描并识别您本地已有的技能目录，轻松将其注册到不同的 Agent 中，无需手动复制粘贴配置文件。

- **🎨 现代化极简设计 (Premium Modern UI)**
  采用最新的 Fluent/Glassmorphism 设计语言，完美适配深色模式（Dark Mode），提供丝滑的交互动画。

- **🔗 自定义源 (Custom Repositories)**
  支持添加第三方的 GitHub 仓库作为技能源，灵活扩展您的技能库边界。

## 🤝 支持的 Agents Supported Agents

Skillbox Studio 目前支持以下 AI 助手和环境：

| Category | Agents |
|----------|--------|
| **Core AI** | Claude Code, Gemini CLI |
| **IDE / Editors** | Cursor, Windsurf, Trae, GitHub Copilot |
| **Open Source** | Roo Code, Goose, OpenCode, Kilo Code, Kiro CLI |
| **Others** | Clawdbot, Amp, Droid |

## 🚀 快速开始 Getting Started

### 安装 Installation

请前往 [Releases 页面](https://github.com/Jst-Well-Dan/Skillbox-Studio/releases) 下载适用于您系统的最新安装包。
- **Windows**: 下载 `.msi` 或 `.exe` 安装包。
- **macOS / Linux**: (即将推出 / Coming Soon)

### 使用 Usage

1. **浏览市场 (Marketplace)**: 
   打开应用，在 "Marketplace" 标签页浏览官方推荐的技能。
2. **安装技能 (Install)**: 
   点击技能卡片，选择您想要安装的目标 Agent（例如 Claude 或 Cursor）。Skillbox Studio 会自动处理配置文件。
3. **管理已安装 (Usage)**: 
   在 "Usage" 页面查看各 Agent 已安装的技能，支持一键卸载或更新。
4. **导入本地库 (Local Skills)**: 
   如果您在本地有自己编写的技能，可在 "Local" 页面将其导入，并快速分发给多个 Agent。

## 🛠️ 开发指南 Development

如果您想参与 Skillbox Studio 的开发，请按照以下步骤配置环境。

### 前置要求 Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/) (v1.75+)
- [pnpm](https://pnpm.io/) or npm

### 启动项目 Run Locally

```bash
# 1. 克隆项目
git clone https://github.com/Jst-Well-Dan/Skillbox-Studio.git

# 2. 安装前端依赖
npm install

# 3. 启动开发服务器 (同时启动 Frontend 和 Tauri Backend)
npm run tauri dev
```

### 构建 Release

```bash
npm run tauri build
```

## 🤝 贡献 Contribution

欢迎提交 Pull Request 或 Issue！
- 对于**应用本身**的改进，请直接提交 PR 到本仓库。
- 对于**技能库**的扩充，请参考 `Skill-Box/添加技能指南.md`。

## 📄 许可证 License

本项目采用 MIT 许可证开源。

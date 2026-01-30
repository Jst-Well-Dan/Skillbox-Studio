# Skillbox Studio

<div align="center">

<img src="public/Skillbox-with-words.svg" alt="Skillbox Studio Logo" width="400" />

**Unified Skill Management Center for AI Agents**

[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat&logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey)](https://github.com/Jst-Well-Dan/Skillbox-Studio/releases)

[Download](https://github.com/Jst-Well-Dan/Skillbox-Studio/releases) • [Features](#-features) • [Screenshots](#-screenshots) • [Usage](#-usage) • [Development](#-development) • [中文版](./README.zh.md)

</div>

---

## 📖 Introduction

**Skillbox Studio** is a modern desktop application designed to unify the management of extended skills (Skills / MCP Tools) for various AI Agents.

In today's AI-assisted programming landscape, we often switch between different Agents like **Claude**, **Cursor**, and **Windsurf**. Skillbox Studio is dedicated to solving the problem of skill fragmentation, allowing you to easily discover, install, synchronize, and manage all powerful AI skill packages through a beautiful visual interface.

## ✨ Features

- **🌐 Unified Marketplace**
  Built-in curated skill library (Business, Coding, Writing, Automation, etc.), providing an App Store-like browsing and installation experience.
  
- **🤖 Multi-Agent Support**
  Download once, run everywhere. Supports one-click installation of skills to over ten mainstream AI assistants including Claude, Cursor, and Trae.
  
- **📂 Local Skills Management**
  Scans and recognizes your existing local skill directories, easily registering them to different Agents without manual copy-pasting of configuration files.

- **🎨 Premium Modern UI**
  Adopts the latest Fluent/Glassmorphism design language, perfectly fits Dark Mode, and provides smooth interaction animations.

- **🔗 Custom Repositories**
  Supports adding third-party GitHub repositories as skill sources, flexibly expanding the boundaries of your skill library.

## 📸 Screenshots

<details>
<summary><b>Click to expand screenshots / 点击展开界面预览</b></summary>

### 1. Discovery & Installation
Follow the intuitive workflow from browsing the marketplace to completing skill installation.

#### 🌐 Browse Marketplace
<img src="public/screenshot/en/1. marketplace.png" width="100%" style="border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" />

#### 🤖 Select Target Agent
<img src="public/screenshot/en/2.select agents.png" width="100%" style="border-radius: 8px;" />

#### 📂 Confirm Installation Scope
<img src="public/screenshot/en/3.select scope.png" width="100%" style="border-radius: 8px;" />

### 2. Details & AI Assistance
Deep dive into skill features with comprehensive descriptions

#### 📖 Skill Details
<img src="public/screenshot/en/5.skills description.png" width="100%" style="border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" />

---

### 3. Advanced Management & Extensibility
Advanced features for custom repositories, local imports, and global management.

#### 🔗 Custom Repos & Local Skills

<img src="public/screenshot/en/4.add repository.png" width="100%" style="border-radius: 8px;" />
<img src="public/screenshot/en/6.local skills.png" width="100%" style="border-radius: 8px; margin-top: 10px;" />

#### 📊 Global Status Monitoring
<img src="public/screenshot/en/7.installed skillls.png" width="100%" style="border-radius: 8px;" />

</details>

## 🤝 Supported Agents

Skillbox Studio currently supports the following AI assistants and environments:

| Category | Agents |
|----------|--------|
| **Core AI** | Claude Code, Gemini CLI |
| **IDE / Editors** | Cursor, Windsurf, Trae, GitHub Copilot |
| **Open Source** | Roo Code, Goose, OpenCode, Kilo Code, Kiro CLI |
| **Others** | Clawdbot, Amp, Droid |

## 🚀 Usage

1. **Installation**: Download the latest installer for your system from the [Releases page](https://github.com/Jst-Well-Dan/Skillbox-Studio/releases).
2. **Browse Marketplace**: Open the app and browse recommended skills in the "Marketplace" tab.
3. **Install Skill**: Click on a skill card, select your target Agent (e.g., Claude or Cursor), and confirm the installation scope.
4. **Manage Installed**: View installed skills for each Agent in the "Usage" page, where you can uninstall or update them with one click.
5. **Import Local**: If you have your own skills, import them in the "Local" page for quick distribution to multiple Agents.

## 🛠️ Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/) (v1.75+)
- [pnpm](https://pnpm.io/) or npm

### Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/Jst-Well-Dan/Skillbox-Studio.git

# 2. Install dependencies
npm install

# 3. Start development server
npm run tauri dev
```

### Build Release

```bash
npm run tauri build
```

## 🤝 Contribution

Contributions are welcome!
- For **app improvements**, please submit a PR to this repo.
- For **skill library** expansion, please refer to `Skill-Box/Adding Skills Guide.md`.

## 📄 License

This project is open-source under the MIT License.

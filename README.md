# Xiya Claude Studio

> AI 赋能工作学习空间 - 让智能助手解决各类问题

[![Release](https://img.shields.io/github/v/release/anyme123/claude-workbench)](https://github.com/anyme123/claude-workbench/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/anyme123/claude-workbench)

---

## ✨ 核心特性

### 🎯 会话管理
- **可视化项目管理**: 直观的 Claude 项目和会话管理界面
- **会话历史记录**: 完整的对话历史，支持恢复和撤回
- **实时流式输出**: 流畅的 Claude 响应显示
- **提示词撤回**: 撤回到任意消息，恢复代码状态

### 📦 Claude 扩展管理器 (v4.0.1 新增)
- **Plugins 查看器**: 查看已安装的插件及其组件
- **Subagents 管理**: 浏览和编辑子代理
- **Agent Skills 查看**: 查看和管理 AI 技能
- **一键打开文件**: 点击卡片直接编辑 .md 文件

### 💰 智能成本追踪
- **准确计费**: 支持多模型定价（Opus 4.1、Sonnet 4.5、Sonnet 3.5）
- **详细统计**: Token 分类、会话时长、API 执行时间
- **悬停查看**: 鼠标悬停即可查看完整成本分析
- **实时更新**: 会话成本实时计算和显示

### 🔧 开发者工具
- **代理商管理**: 一键切换 API 提供商，静默切换无打扰
- **MCP 集成**: 完整的 Model Context Protocol 服务器管理
- **Hooks 系统**: 自定义钩子和事件处理
- **Slash Commands**: 自定义命令管理器

### 🎨 现代化 UI
- **主题切换**: 顶栏快速切换明暗主题（默认浅色）
- **紧凑设计**: 优化的空间利用，清晰的视觉层次
- **响应式布局**: 适配不同屏幕尺寸
- **流畅动画**: Framer Motion 驱动的交互效果

---

## 🚀 快速开始

### 系统要求

- **操作系统**: Windows 10/11、macOS、Linux
- **Node.js**: 18.0+ (推荐 LTS 版本)
- **Claude Code**: 需要安装 [Claude Code CLI](https://docs.claude.com/en/docs/claude-code/overview)

### 安装方式

#### 预构建版本（推荐）

从 [Releases](https://github.com/anyme123/claude-workbench/releases) 下载对应平台的安装包：

**Windows**:
- MSI 安装包
- NSIS 安装包

**macOS**:
- DMG 安装包 (ARM + Intel)
- APP 应用包

> **⚠️ macOS 安装注意事项**
>
> 如果安装后提示"应用已损坏，无法打开"，这是因为应用未经过 Apple 公证。请在终端执行以下命令解决：
>
> ```bash
> # 方法 1：移除隔离属性（推荐，最简单）
> sudo xattr -r -d com.apple.quarantine /Applications/Xiya\ Claude\ Studio.app
>
> # 方法 2：清除所有扩展属性
> xattr -cr /Applications/Xiya\ Claude\ Studio.app
>
> # 方法 3：重新签名应用
> sudo codesign --force --deep --sign - /Applications/Xiya\ Claude\ Studio.app
> ```
>
> **原因说明**：macOS Gatekeeper 默认会阻止未公证的应用运行。执行上述命令后即可正常使用。

**Linux**:
- AppImage
- DEB 包

#### 源码构建

```bash
# 克隆仓库
git clone https://github.com/anyme123/claude-workbench.git
cd claude-workbench

# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建应用
npm run tauri build
```

---

## 📖 主要功能

### 扩展管理器

点击顶栏"扩展"按钮，查看和管理：
- **Plugins**: 已安装插件及组件统计
- **Subagents**: 专用子代理列表
- **Agent Skills**: AI 技能配置

**官方资源**:
- [Plugins 文档](https://docs.claude.com/en/docs/claude-code/plugins)
- [Anthropic Skills 仓库](https://github.com/anthropics/skills) (13.7k ⭐)

### 成本追踪

**基础显示**: 输入框底部显示会话总成本  
**详细统计**: 鼠标悬停查看：
- 总成本和 Token 统计
- Token 分类（输入/输出/Cache 读写）
- 会话时长和 API 时长

**多模型支持**: 自动识别并使用正确的定价：
- Opus 4.1: $15/$75 (input/output)
- Sonnet 4.5: $3/$15
- Sonnet 3.5: $3/$15

### 撤回功能

- 点击用户消息右侧的圆形撤回按钮
- 删除该消息及之后的所有对话
- 代码自动回滚到发送前状态
- 提示词恢复到输入框可修改

### Plan Mode

按 `Shift+Tab` 切换 Plan Mode：
- 只读分析和规划
- 不能修改文件或执行命令
- 适合代码探索和方案设计

---

## 🔧 技术架构

### 前端技术栈
- **React 18** + **TypeScript** - 类型安全的现代前端
- **Tailwind CSS 4** - 实用优先的样式框架
- **Framer Motion** - 流畅的动画系统
- **i18next** - 完整的国际化支持

### 后端技术栈
- **Tauri 2** - 安全高效的桌面应用框架
- **Rust** - 高性能系统编程语言
- **SQLite** - 嵌入式数据库
- **跨平台支持** - Windows、macOS、Linux

### 核心架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React 前端    │◄──►│   Tauri 桥接    │◄──►│   Rust 后端     │
│                 │    │                 │    │                 │
│ • UI 组件       │    │ • IPC 通信      │    │ • Claude Code   │
│ • 状态管理      │    │ • 安全调用      │    │ • 进程管理      │
│ • 国际化        │    │ • 类型安全      │    │ • Git 集成      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🌟 v4.0.1 更新亮点

### 🆕 新功能
- ✅ Claude 扩展管理器（Plugins/Subagents/Skills）
- ✅ 多模型成本计算（准确定价）
- ✅ 成本详情悬停显示
- ✅ Git 代码变更统计 API
- ✅ 点击打开 .md 文件

### 🎨 UI 改进
- ✅ 默认浅色主题
- ✅ 顶栏紧凑设计（图标文字 0px 间距）
- ✅ 按钮阴影和边框
- ✅ 文件预览优化（.md 10K 字符）

### ⚡ 性能优化
- ✅ 会话历史加载速度提升
- ✅ 翻译检查优化
- ✅ Plan Mode 对齐官方规范

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发环境

```bash
# 克隆仓库
git clone https://github.com/anyme123/claude-workbench.git
cd claude-workbench

# 安装依赖
npm install

# 启动开发服务器
npm run tauri dev
```

### 代码规范
- 遵循 TypeScript 和 Rust 最佳实践
- 使用清晰的提交信息
- 添加必要的注释和文档

---

## 📄 许可证

本项目基于 [AGPL-3.0](LICENSE) 开源协议发布。

---

## 🔗 相关资源

- [Claude Code 官方文档](https://docs.claude.com/en/docs/claude-code/overview)
- [Tauri 框架](https://tauri.app/)
- [React 文档](https://react.dev/)
- [Rust 官网](https://rust-lang.org/)

---

## 💬 社区

- **Issues**: [GitHub Issues](https://github.com/anyme123/claude-workbench/issues)
- **Discussions**: [GitHub Discussions](https://github.com/anyme123/claude-workbench/discussions)

---

**如果这个项目对您有帮助，请给我们一个 ⭐ Star！**

🔗 **项目地址**: https://github.com/anyme123/claude-workbench

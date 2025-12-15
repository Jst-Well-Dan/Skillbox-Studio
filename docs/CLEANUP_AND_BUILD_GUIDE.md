# Xiya Claude Studio - 清理与构建指南

本文档提供项目文件清理建议和构建流程说明。

---

## 1. 文件清理指南

### 1.1 可安全删除的文件

以下文件已被识别为无用或过时，可以安全删除：


#### 临时文件和脚本
| 文件 | 说明 |
|------|------|
| `bun.lock` | Bun 包管理器锁定文件（已改用 npm） |
| `bun_parse.py` | 临时 Python 脚本 |
| `immersive_translate.py` | 临时翻译脚本 |
| `tmp_integrity.py` | 临时完整性检查脚本 |
| `start-with-debug.bat` | 调试启动脚本 |
| `nul` | Windows 系统产物（0字节） |

#### 过时的文档目录
| 目录 | 说明 |
|------|------|
| `docs/first/` | 早期开发文档 |
| `docs/plugins/` | 旧插件设计文档 |
| `docs/todos/` | 旧待办事项 |
| `docs/translation/` | 翻译功能文档 |
| `IMPLEMENTATION_SUMMARY.md` | 过时的实现总结 |

#### 旧资源目录
| 目录 | 说明 |
|------|------|
| `UX图片/` | 旧 UI 截图（已被 `UX界面/` 替代） |
| `plugins/anthropic-agent-skills` | 旧插件目录（已被 Skill-Box 替代） |
| `plugins/claude-code-plugins` | 旧插件目录（已被 Skill-Box 替代） |

---

### 1.2 必须保留的文件

以下是项目核心文件，**不可删除**：

#### 源代码
| 目录 | 说明 | 代码量 |
|------|------|--------|
| `src/` | React 前端源码 | 40,000+ 行 |
| `src-tauri/` | Rust 后端源码 | 14,000+ 行 |
| `public/` | 静态资源 | SVG 图标等 |

#### 配置文件
| 文件 | 说明 |
|------|------|
| `package.json` | npm 项目配置 |
| `package-lock.json` | 依赖版本锁定 |
| `tsconfig.json` | TypeScript 配置 |
| `tsconfig.node.json` | Node.js TypeScript 配置 |
| `vite.config.ts` | Vite 构建配置 |
| `src-tauri/Cargo.toml` | Rust 项目配置 |
| `src-tauri/tauri.conf.json` | Tauri 应用配置 |
| `.gitignore` | Git 忽略规则 |

#### 应用资源
| 目录/文件 | 说明 |
|----------|------|
| `Skill-Box/` | 预装技能库（7类） |
| `scripts/` | 构建辅助脚本 |
| `.github/workflows/` | CI/CD 流程配置 |

#### 文档
| 文件 | 说明 |
|------|------|
| `README.md` | 项目说明 |
| `CLAUDE.md` | 开发指南 |
| `INSTALLATION_GUIDE_CN.md` | 中文安装指南 |

---

### 1.3 可选清理（节省空间）

以下目录可以删除以节省磁盘空间，需要时可重新生成：

| 目录 | 预估大小 | 重建方式 |
|------|---------|---------|
| `node_modules/` | 500MB+ | `npm install` |
| `src-tauri/target/` | 1-3GB | 运行 `npm run tauri:build` 时自动生成 |
| `dist/` | 较小 | `npm run build` |

**清理命令示例：**
```bash
# Windows PowerShell
Remove-Item -Recurse -Force node_modules, dist, src-tauri/target

# 恢复依赖
npm install
```

---

## 2. 构建指南

### 2.1 环境要求

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | 18.x 或更高 | 前端构建 |
| npm | 9.x 或更高 | 依赖管理 |
| Rust | stable | 后端编译 |
| Bun | 最新版 | 开发服务器（可选） |

#### Windows 额外要求
- **Visual Studio Build Tools** - C++ 编译工具链
- **WebView2** - Windows 10/11 通常已预装

#### 安装依赖
```bash
# 安装前端依赖
npm install
```

---

### 2.2 开发构建

#### 前端开发服务器（仅前端）
```bash
npm run dev
```
- 启动 Vite 开发服务器
- 端口：1420
- 支持热模块替换（HMR）

#### 完整应用开发（推荐）
```bash
npm run tauri:dev
```
- 同时启动前端和 Tauri 后端
- 支持热重载
- 实时预览完整应用

---

### 2.3 生产构建

#### 快速测试构建
```bash
npm run tauri:build-fast
```
- 使用 `dev-release` 配置
- 构建时间：3-5 分钟
- 保留调试信息
- 适合开发测试

#### 正式发布构建
```bash
npm run tauri:build
```
- 使用 `release` 配置
- 构建时间：30+ 分钟
- 完整优化（LTO、代码精简）
- 适合正式发布

**构建产物位置：**
```
src-tauri/target/release/
├── xiya-claude-studio.exe      # Windows 可执行文件
└── bundle/
    ├── msi/                     # MSI 安装包
    └── nsis/                    # NSIS 安装包
```

---

### 2.4 构建 Profile 说明

| 配置项 | dev-release（快速） | release（生产） |
|--------|-------------------|-----------------|
| 优化级别 | opt-level = 2 | opt-level = "z"（体积优化） |
| LTO | thin（瘦 LTO） | true（完整 LTO） |
| 编译单元 | 16（并行） | 1（最佳优化） |
| 增量编译 | 启用 | 禁用 |
| 调试信息 | 保留 | 移除（strip） |
| 构建时间 | 3-5 分钟 | 30+ 分钟 |
| 二进制大小 | 较大 | 最小化 |

---

## 3. 注意事项

### 3.1 端口和环境配置

#### 开发端口
- **Vite 开发服务器**: 1420（固定，不可更改）
- **HMR WebSocket**: 1421

如果端口被占用，开发服务器将无法启动。解决方法：
```bash
# Windows - 查找占用端口的进程
netstat -ano | findstr :1420

# 终止进程（替换 PID）
taskkill /PID <PID> /F
```

#### 环境变量
- `TAURI_DEV_HOST`: 远程开发时设置此变量以启用外部访问

---

### 3.2 Windows 特定注意事项

#### 长路径支持
如果遇到路径过长的错误，启用 Windows 长路径支持：
```powershell
# 以管理员身份运行
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
    -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

#### 杀毒软件
某些杀毒软件可能会干扰构建过程。建议将以下目录添加到排除列表：
- `node_modules/`
- `src-tauri/target/`
- 项目根目录

---

### 3.3 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 端口 1420 被占用 | 另一个开发实例运行中 | 关闭其他实例或终止占用进程 |
| Cargo 构建失败 | Rust 工具链未安装 | 运行 `rustup update` |
| 前端依赖错误 | node_modules 损坏 | 删除 node_modules 后重新 `npm install` |
| Tauri 命令找不到 | @tauri-apps/cli 未安装 | 运行 `npm install` |
| WebView2 缺失 | Windows 组件缺失 | 从 Microsoft 下载安装 WebView2 |
| 构建超时 | 生产构建 LTO 耗时 | 使用 `tauri:build-fast` 测试 |
| 技能包加载失败 | Skill-Box 目录缺失 | 确保 Skill-Box 存在于项目根目录 |

---

## 4. 附录

### 4.1 项目目录结构

```
Xiya Claude Studio/
├── src/                          # React 前端源码
│   ├── components/               # React 组件
│   ├── hooks/                    # 自定义 Hooks
│   ├── lib/                      # 工具函数库
│   ├── i18n/                     # 国际化（中英文）
│   ├── contexts/                 # React Context
│   └── types/                    # TypeScript 类型定义
├── src-tauri/                    # Rust 后端源码
│   ├── src/
│   │   ├── commands/             # IPC 命令处理
│   │   ├── process/              # 进程管理
│   │   └── main.rs               # 应用入口
│   ├── Cargo.toml                # Rust 依赖配置
│   └── tauri.conf.json           # Tauri 配置
├── Skill-Box/                    # 预装技能库
│   ├── brand-marketing/          # 品牌营销
│   ├── business-analyst/         # 商业分析
│   ├── content-pipeline/         # 内容创作
│   ├── immersive-reading/        # 沉浸阅读
│   ├── no-code-builder/          # 无代码开发
│   ├── office-automation/        # 办公自动化
│   └── visual-creative/          # 视觉创意
├── public/                       # 静态资源
├── scripts/                      # 构建脚本
├── .github/workflows/            # CI/CD 配置
├── docs/                         # 文档
├── package.json                  # npm 配置
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
└── README.md                     # 项目说明
```

---

### 4.2 技术栈版本

| 组件 | 版本 |
|------|------|
| Tauri | 2.9 |
| React | 18.3.1 |
| TypeScript | 5.9.3 |
| Vite | 6.0.3 |
| Rust | stable |

---

*最后更新：2025-12-15*

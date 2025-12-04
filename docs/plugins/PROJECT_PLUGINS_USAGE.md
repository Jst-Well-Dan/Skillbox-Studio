# 项目级插件管理 - 使用指南

## ✅ 已修正：从系统级读取，复制到项目级

### 工作原理

```
系统级插件市场                     项目级插件
~/.claude/plugins/          →      project/.claude/
├── known_marketplaces.json        ├── commands/
├── marketplaces/                  ├── agents/
│   ├── anthropic-agent-skills/    ├── skills/
│   │   ├── document-skills/       └── installed_plugins.json
│   │   ├── skill-creator/
│   │   └── ...
│   └── claude-code-plugins/
│       └── plugins/
│           ├── pr-review-toolkit/
│           └── ...
```

**核心流程：**
1. **读取系统级插件市场** - 从 `~/.claude/plugins/known_marketplaces.json` 获取已安装的插件市场列表
2. **浏览插件** - 从 `~/.claude/plugins/marketplaces/{marketplace-name}/` 读取插件内容
3. **安装到项目** - 将选中插件的组件（commands、agents、skills）复制到项目的 `.claude/` 目录

## 前提条件

### 1. 使用 Claude CLI 安装插件市场

在使用项目级插件管理之前，需要先通过 Claude CLI 安装插件市场：

```bash
# 安装 Anthropic 官方 skills
claude plugin marketplace add anthropic-agent-skills

# 安装 Claude Code 官方插件
claude plugin marketplace add claude-code-plugins
```

安装后，会在 `~/.claude/plugins/` 目录生成：
- `known_marketplaces.json` - 记录已安装的插件市场
- `marketplaces/{marketplace-name}/` - 插件市场的内容

### 2. 验证插件市场已安装

检查文件是否存在：

**Windows:**
```bash
dir C:\Users\{你的用户名}\.claude\plugins\known_marketplaces.json
dir C:\Users\{你的用户名}\.claude\plugins\marketplaces
```

**macOS/Linux:**
```bash
ls ~/.claude/plugins/known_marketplaces.json
ls ~/.claude/plugins/marketplaces
```

你的 `known_marketplaces.json` 应该类似：

```json
{
  "anthropic-agent-skills": {
    "source": {
      "source": "github",
      "repo": "anthropics/skills"
    },
    "installLocation": "C:\\Users\\A\\.claude\\plugins\\marketplaces\\anthropic-agent-skills",
    "lastUpdated": "2025-11-24T07:29:19.380Z"
  },
  "claude-code-plugins": {
    "source": {
      "source": "github",
      "repo": "anthropics/claude-code"
    },
    "installLocation": "C:\\Users\\A\\.claude\\plugins\\marketplaces\\claude-code-plugins",
    "lastUpdated": "2025-11-24T08:34:52.103Z"
  }
}
```

## 使用步骤

### 1. 启动 Claude Workbench

```bash
cd claude-workbench
npm run tauri:dev
```

### 2. 进入项目

- 从主页选择或创建一个项目
- 进入项目的会话列表页面

### 3. 打开插件管理器

点击右上角的红色按钮：**"新功能：添加插件/技能"**

### 4. 选择插件市场

在弹出的对话框中：
- 顶部下拉菜单选择插件市场（anthropic-agent-skills 或 claude-code-plugins）
- 系统会自动从 `~/.claude/plugins/marketplaces/` 读取插件列表

### 5. 浏览和搜索插件

- **搜索框** - 输入关键词搜索插件
- **分类过滤** - 按插件分类筛选
- **查看组件** - 每个插件显示包含的 commands、agents、skills 数量

### 6. 安装插件

- 点击插件卡片上的"安装"按钮
- 系统会：
  1. 从系统级读取插件文件
  2. 复制到项目的 `.claude/` 目录
  3. 记录到 `.claude/installed_plugins.json`

安装后的目录结构：

```
your-project/
└── .claude/
    ├── installed_plugins.json         # 记录已安装插件
    ├── commands/
    │   └── pr-review-toolkit/         # 从系统级复制
    │       └── review-pr.md
    ├── agents/
    │   └── pr-review-toolkit/
    │       ├── code-reviewer.md
    │       └── comment-analyzer.md
    └── skills/
        └── document-skills/
            ├── xlsx/
            │   └── SKILL.md
            └── docx/
                └── SKILL.md
```

### 7. 使用插件

插件安装后，Claude CLI 会自动发现项目级组件：

**Commands（斜杠命令）：**
```
在 Claude Code 中输入 /
可以看到项目级命令（标记为 (project)）
```

**Agents（子代理）：**
```
使用 /agents 命令查看活动的 subagents
项目级 agents 优先级最高
```

**Skills（技能）：**
```
Skills 自动被 Claude 发现和使用
无需手动激活
```

### 8. 查看已安装插件

切换到"已安装"标签页：
- 查看当前项目已安装的所有插件
- 显示每个插件的来源市场和版本
- 可以一键卸载

### 9. 卸载插件

- 找到要卸载的插件
- 点击"卸载"按钮
- 系统会删除项目 `.claude/` 目录下的对应文件

## 系统级 vs 项目级对比

| 特性 | 系统级（~/.claude/） | 项目级（project/.claude/） |
|-----|---------------------|---------------------------|
| **插件市场** | ✅ 通过 CLI 安装 | ❌ 不安装，仅读取 |
| **插件内容** | ✅ 完整保存 | ✅ 按需复制 |
| **作用范围** | 全局所有项目 | 仅当前项目 |
| **优先级** | 低 | **高**（项目级优先） |
| **管理方式** | CLI 命令 | 图形界面 |
| **适用场景** | 个人常用插件 | 项目特定插件 |

## 优势

### 1. ✅ 无需重复下载
- 利用 Claude CLI 已下载的系统级插件
- 节省网络带宽和存储空间
- 避免重复的 Git clone 操作

### 2. ✅ 项目完全隔离
- 每个项目有独立的插件配置
- 不同项目可以使用不同版本的插件
- 删除项目时插件配置一并清除

### 3. ✅ 图形化管理
- 学员无需学习 CLI 命令
- 可视化浏览插件市场
- 一键安装/卸载

### 4. ✅ 团队协作友好
- 提交 `.claude/installed_plugins.json` 到 git
- 团队成员可以看到推荐的插件
- 快速复制项目配置

## 常见问题

### Q: 为什么插件市场列表为空？

**A:** 需要先通过 Claude CLI 安装插件市场：

```bash
# 检查是否已安装
claude plugin marketplace list

# 如果为空，安装市场
claude plugin marketplace add anthropic-agent-skills
claude plugin marketplace add claude-code-plugins
```

### Q: 如何更新系统级插件市场？

**A:** 使用 Claude CLI：

```bash
# 更新所有市场
claude plugin marketplace update

# 或更新特定市场
claude plugin marketplace update anthropic-agent-skills
```

更新后，项目级插件管理器会自动看到新的插件。

### Q: 已安装的项目级插件会自动更新吗？

**A:** 不会。需要手动卸载旧版本，重新安装新版本。未来版本会添加一键更新功能。

### Q: 项目级插件占用多少空间？

**A:** 通常每个插件只有几KB到几MB：
- Commands: 每个 .md 文件约 1-5KB
- Agents: 每个 .md 文件约 2-10KB
- Skills: 每个 SKILL.md 约 5-50KB

安装 10 个插件通常不超过 5MB。

### Q: 如何备份项目插件配置？

**A:** 只需备份项目的 `.claude/` 目录，或将其提交到 git：

```bash
# 将插件配置提交到 git
git add .claude/installed_plugins.json
git commit -m "Add project plugins config"
```

团队其他成员 clone 后可以看到推荐的插件列表。

### Q: 能否同时在系统级和项目级安装同一插件？

**A:** 可以，但**项目级优先级更高**：
- Agents: 项目级完全覆盖系统级
- Commands: 可以共存，项目级标记为 (project)
- Skills: 都会被发现，Claude 智能选择

建议只在项目级安装，避免混淆。

## 故障排查

### 问题：找不到插件市场

**症状：** 插件管理器打开后，市场下拉菜单为空

**排查步骤：**

1. 检查 `known_marketplaces.json` 是否存在：
   ```bash
   # Windows
   type C:\Users\{你的用户名}\.claude\plugins\known_marketplaces.json

   # macOS/Linux
   cat ~/.claude/plugins/known_marketplaces.json
   ```

2. 检查 marketplaces 目录：
   ```bash
   # Windows
   dir C:\Users\{你的用户名}\.claude\plugins\marketplaces

   # macOS/Linux
   ls ~/.claude/plugins/marketplaces
   ```

3. 如果文件不存在，安装插件市场：
   ```bash
   claude plugin marketplace add anthropic-agent-skills
   ```

### 问题：插件安装失败

**症状：** 点击安装后报错

**可能原因：**
1. 插件市场路径不存在
2. 项目 `.claude/` 目录权限问题
3. 磁盘空间不足

**解决方法：**

1. 查看应用日志（Tauri DevTools Console）
2. 手动创建 `.claude/` 目录：
   ```bash
   mkdir -p your-project/.claude
   ```
3. 检查磁盘空间

### 问题：Claude 没有识别已安装的插件

**症状：** 插件显示已安装，但 Claude 中看不到

**排查步骤：**

1. 确认文件已复制到项目：
   ```bash
   ls your-project/.claude/commands/
   ls your-project/.claude/agents/
   ls your-project/.claude/skills/
   ```

2. 重启 Claude Code 会话

3. 使用命令确认：
   ```bash
   # 在 Claude Code 中
   /agents      # 查看 agents
   /            # 查看 commands
   ```

## 技术架构

### 数据流

```
用户操作 → UI (React)
    ↓
API 调用 (TypeScript)
    ↓
Tauri IPC
    ↓
Rust 后端 (project_plugins.rs)
    ↓
读取 ~/.claude/plugins/known_marketplaces.json
    ↓
访问 ~/.claude/plugins/marketplaces/{name}/
    ↓
复制到 project/.claude/
    ↓
Claude CLI 自动发现 ✅
```

### 核心函数

**后端（Rust）：**
- `read_known_marketplaces()` - 读取系统级插件市场配置
- `list_plugin_marketplaces()` - 返回可用的插件市场列表
- `list_marketplace_plugins()` - 列出市场中的所有插件
- `install_plugin_to_project()` - 复制插件到项目级
- `uninstall_plugin_from_project()` - 删除项目级插件

**前端（React）：**
- `ProjectPluginManager` - 插件管理 UI 组件
- `api.listPluginMarketplaces()` - 获取插件市场
- `api.installPluginToProject()` - 安装插件

### 文件位置

```
claude-workbench/
├── src-tauri/src/commands/
│   └── project_plugins.rs          # 后端核心逻辑
├── src/
│   ├── lib/api.ts                  # API 封装
│   └── components/
│       ├── ProjectPluginManager.tsx # UI 组件
│       └── SessionList.tsx          # 集成入口
└── PROJECT_PLUGINS_*.md             # 文档
```

## 下一步

### 现在可以：
- ✅ 浏览系统级已安装的插件市场
- ✅ 搜索和过滤插件
- ✅ 安装插件到项目级
- ✅ 卸载项目级插件
- ✅ 查看已安装插件列表

### 即将支持：
- ⏳ 插件版本检测和更新
- ⏳ 批量安装/卸载
- ⏳ 插件依赖管理
- ⏳ 安装前预览插件内容

## 相关资源

- [Claude Code 插件文档](https://code.claude.com/docs/en/plugins)
- [插件市场文档](https://code.claude.com/docs/en/plugin-marketplaces)
- [技术设计方案](./PROJECT_LEVEL_PLUGINS_DESIGN.md)

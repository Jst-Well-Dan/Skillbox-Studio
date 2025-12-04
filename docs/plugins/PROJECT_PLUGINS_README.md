# 项目级插件管理系统 - 使用说明

## 概述

项目级插件管理系统已成功集成到 Claude Workbench 中，允许学员在项目级别安装和管理插件，实现完全的插件隔离。

## 核心特性

✅ **项目级隔离** - 每个项目拥有独立的插件配置
✅ **零配置** - Claude CLI 自动发现项目级组件
✅ **本地插件仓库** - 支持从本地 `plugins/` 目录加载上千个插件
✅ **图形化管理** - 简洁的 UI 界面，一键安装/卸载
✅ **组件解构** - 自动将插件分解为 commands、agents、skills

## 系统架构

### 1. 插件存储位置

```
claude-workbench/
├── plugins/                           # 应用根目录的插件仓库
│   ├── anthropic-agent-skills/        # Anthropic 官方 skills
│   │   ├── .claude-plugin/
│   │   │   └── marketplace.json       # 市场配置文件
│   │   ├── document-skills/
│   │   ├── skill-creator/
│   │   └── ...
│   └── claude-code-plugins/           # Claude Code 官方插件
│       ├── .claude-plugin/
│       │   └── marketplace.json
│       ├── plugins/
│       │   ├── pr-review-toolkit/
│       │   │   ├── .claude-plugin/
│       │   │   │   └── plugin.json    # 插件元信息
│       │   │   ├── agents/            # 子代理
│       │   │   └── commands/          # 斜杠命令
│       │   └── ...
│       └── ...
```

### 2. 项目级安装目录

安装插件后，项目的 `.claude/` 目录结构：

```
project-root/
└── .claude/
    ├── installed_plugins.json         # 已安装插件记录
    ├── commands/
    │   ├── pr-review-toolkit/         # 插件1的命令
    │   │   └── review-pr.md
    │   └── commit-commands/           # 插件2的命令
    │       ├── commit.md
    │       └── pr.md
    ├── agents/
    │   ├── pr-review-toolkit/
    │   │   ├── code-reviewer.md
    │   │   └── comment-analyzer.md
    │   └── feature-dev/
    │       └── architect.md
    ├── skills/
    │   ├── document-skills/
    │   │   ├── xlsx/
    │   │   │   └── SKILL.md
    │   │   ├── docx/
    │   │   │   └── SKILL.md
    │   │   └── pdf/
    │   │       └── SKILL.md
    │   └── ...
    ├── hooks/
    │   └── hooks.json                 # 合并所有插件的 hooks
    └── .mcp.json                      # 合并所有插件的 MCP 配置
```

## 使用指南

### 准备插件仓库

1. **已有插件仓库**（当前情况）

   项目已包含两个插件仓库：
   - `plugins/anthropic-agent-skills` - Anthropic 官方 skills
   - `plugins/claude-code-plugins` - Claude Code 官方插件

2. **添加更多插件仓库**

   在 `plugins/` 目录下创建新的 marketplace：

   ```
   plugins/
   └── your-marketplace-name/
       ├── .claude-plugin/
       │   └── marketplace.json
       └── plugins/
           ├── plugin1/
           └── plugin2/
   ```

   `marketplace.json` 格式：

   ```json
   {
     "name": "your-marketplace-name",
     "version": "1.0.0",
     "description": "Your plugin collection",
     "owner": {
       "name": "Your Name",
       "email": "email@example.com"
     },
     "plugins": [
       {
         "name": "plugin1",
         "description": "Plugin description",
         "source": "./plugins/plugin1",
         "category": "development"
       }
     ]
   }
   ```

### 在项目中使用插件管理器

1. **打开插件管理器**
   - 进入任意项目的会话列表页面
   - 点击右上角红色按钮"新功能：添加插件/技能"

2. **浏览插件市场**
   - 选择插件市场（顶部下拉菜单）
   - 使用搜索框搜索插件
   - 通过分类过滤插件

3. **安装插件**
   - 找到需要的插件
   - 查看插件包含的组件数量（commands、agents、skills）
   - 点击"安装"按钮
   - 等待安装完成（通常几秒钟）

4. **查看已安装插件**
   - 切换到"已安装"标签页
   - 查看当前项目已安装的所有插件
   - 每个插件显示来源市场和版本信息

5. **卸载插件**
   - 在已安装列表或市场列表中找到插件
   - 点击"卸载"按钮
   - 确认卸载操作

### 验证插件是否生效

安装插件后，Claude CLI 会自动发现项目级组件：

1. **Commands（斜杠命令）**
   ```
   在 Claude Code 中输入 / 查看所有可用命令
   项目级命令会显示 (project) 标记
   ```

2. **Agents（子代理）**
   ```
   使用 /agents 命令查看活动的 subagents
   项目级 agents 优先级最高
   ```

3. **Skills（技能）**
   ```
   Skills 会自动被 Claude 发现和使用
   无需手动激活
   ```

## 技术实现细节

### 后端 API（Rust）

文件：`src-tauri/src/commands/project_plugins.rs`

核心函数：
- `list_plugin_marketplaces()` - 扫描 `plugins/` 目录
- `list_marketplace_plugins()` - 读取 marketplace.json 并解析插件列表
- `install_plugin_to_project()` - 复制插件组件到项目级 `.claude/`
- `uninstall_plugin_from_project()` - 删除项目级插件文件
- `list_project_installed_plugins()` - 读取 `installed_plugins.json`

### 前端 UI（React）

文件：`src/components/ProjectPluginManager.tsx`

特性：
- 响应式设计，支持搜索和分类过滤
- 实时显示安装状态（loading spinner）
- 双标签页：插件市场 + 已安装插件
- 组件统计显示（commands、agents、skills 数量）

### API 封装（TypeScript）

文件：`src/lib/api.ts`

类型定义：
```typescript
interface PluginMetadata {
  name: string;
  displayName: string;
  version: string;
  description: string;
  category: string;
  marketplace: string;
  components: PluginComponents;
}
```

## 插件开发指南

### 创建标准插件

1. **目录结构**

   ```
   my-plugin/
   ├── .claude-plugin/
   │   └── plugin.json
   ├── commands/
   │   └── my-command.md
   ├── agents/
   │   └── my-agent.md
   ├── skills/
   │   └── my-skill.SKILL.md
   ├── hooks/
   │   └── hooks.json
   └── README.md
   ```

2. **plugin.json**

   ```json
   {
     "name": "my-plugin",
     "version": "1.0.0",
     "description": "My awesome plugin",
     "author": {
       "name": "Your Name",
       "email": "you@example.com"
     }
   }
   ```

3. **添加到 marketplace**

   在 `marketplace.json` 中添加：

   ```json
   {
     "name": "my-plugin",
     "description": "My awesome plugin",
     "source": "./plugins/my-plugin",
     "category": "productivity",
     "version": "1.0.0"
   }
   ```

### 创建 Skills 集合插件

如果只包含 skills（如 anthropic-agent-skills），在 marketplace.json 中使用：

```json
{
  "name": "my-skills",
  "description": "Collection of skills",
  "source": "./",
  "skills": [
    "./skill1",
    "./skill2",
    "./skill3"
  ]
}
```

## 常见问题

### Q: 插件安装后 Claude 没有识别？

A: 检查以下几点：
1. 确认插件已成功安装（查看已安装列表）
2. 重启 Claude Code 会话
3. 使用 `/agents` 和 `/` 命令确认组件是否可见
4. 检查 `.claude/` 目录是否有对应的文件

### Q: 如何更新插件？

A: 当前版本需要先卸载再重新安装。未来版本会添加一键更新功能。

### Q: 能否在系统级和项目级同时安装同一插件？

A: 可以，但项目级优先级更高（特别是 agents）。建议只在项目级安装以避免混淆。

### Q: 插件占用多少磁盘空间？

A: 大部分插件只有几KB到几MB，1000个插件通常不超过100MB。

### Q: 如何备份插件配置？

A: 只需备份项目的 `.claude/` 目录。团队可以将 `.claude/installed_plugins.json` 提交到 git，其他成员 clone 后可以看到推荐安装的插件。

## 未来优化方向

- [ ] 插件版本更新检测
- [ ] 批量安装/卸载
- [ ] 插件依赖管理
- [ ] 插件预览（安装前查看组件内容）
- [ ] 自定义插件市场 URL
- [ ] 插件评分和评论系统

## 技术参考

- [Claude Code Plugins 文档](https://code.claude.com/docs/en/plugins)
- [Plugin Marketplaces 文档](https://code.claude.com/docs/en/plugin-marketplaces)
- [Sub-agents 文档](https://code.claude.com/docs/en/sub-agents)
- [Skills 文档](https://code.claude.com/docs/en/skills)

## 联系支持

如有问题或建议，请查看：
- 技术方案文档：`PROJECT_LEVEL_PLUGINS_DESIGN.md`
- 代码实现：
  - 后端：`src-tauri/src/commands/project_plugins.rs`
  - 前端：`src/components/ProjectPluginManager.tsx`
  - API：`src/lib/api.ts`

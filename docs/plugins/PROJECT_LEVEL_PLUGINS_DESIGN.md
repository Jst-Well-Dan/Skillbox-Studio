# 项目级插件管理系统设计方案

## 背景与目标

### 问题
- Claude Code 的 `/plugin install` 命令只会将插件安装到系统级目录（`~/.claude/plugins/`）
- 需要为学员提供简单的方式在项目级安装和使用上千个预设插件
- 每个项目需要独立的插件配置，不影响系统级或其他项目

### 目标
1. 实现项目级插件隔离安装
2. 提供简洁的 UI 界面供学员选择和安装插件
3. 支持上千个插件的分类浏览和搜索
4. 完全兼容 Claude CLI 的自动发现机制

## 核心方案：插件解构安装

### 方案原理

根据 Claude Code 官方文档（https://code.claude.com/docs/en/），以下组件**明确支持项目级目录**：

| 组件类型 | 项目级路径 | 优先级 |
|---------|-----------|--------|
| Slash Commands | `.claude/commands/` | 与用户级并存 |
| Subagents | `.claude/agents/` | **最高优先级**（覆盖用户级）|
| Skills | `.claude/skills/` | 与用户级一起被发现 |
| Settings | `.claude/settings.json` | 与用户级合并 |

**关键发现**：
- 插件的本质是 commands + agents + skills + hooks + MCP 的组合
- 这些组件都**原生支持**项目级目录
- 我们可以**绕过完整插件安装**，直接将组件提取到项目级目录

### 实现流程

```
[插件仓库] → [选择插件] → [下载并解构] → [安装到项目] → [Claude CLI 自动发现]
    ↓              ↓              ↓              ↓                ↓
GitHub/本地    插件市场UI      解析结构     复制到.claude/      无需配置
```

## 技术架构设计

### 1. 插件仓库结构

#### 单个插件的标准结构

```
plugin-name/
├── plugin.json          # 插件元信息（必需）
├── README.md            # 插件说明（可选）
├── commands/            # Slash Commands
│   ├── command1.md
│   └── command2.md
├── agents/              # Subagents
│   ├── agent1.md
│   └── agent2.md
├── skills/              # Skills（必须以 SKILL.md 结尾）
│   ├── skill1.SKILL.md
│   └── skill2.SKILL.md
├── hooks/               # Hooks（可选）
│   └── hooks.json
└── .mcp.json            # MCP 服务器（可选）
```

#### plugin.json 格式

```json
{
  "name": "web-scraper",
  "displayName": "网页爬虫工具",
  "version": "1.0.0",
  "description": "提供网页抓取和数据提取能力",
  "author": {
    "name": "Your Name",
    "email": "email@example.com"
  },
  "category": "data-processing",
  "tags": ["web", "scraping", "data"],
  "components": {
    "commands": 2,
    "agents": 1,
    "skills": 3,
    "hooks": false,
    "mcp": false
  },
  "requirements": {
    "claudeVersion": ">=1.0.0",
    "dependencies": []
  }
}
```

### 2. 后端实现（Rust）

#### 新增 Tauri Command

在 `src-tauri/src/commands/project_plugins.rs` 中实现：

```rust
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// 插件市场配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMarketplace {
    pub name: String,
    pub source_type: MarketplaceSourceType,
    pub url: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MarketplaceSourceType {
    Github,
    Git,
    Local,
}

/// 插件元信息（从 plugin.json 读取）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginMetadata {
    pub name: String,
    pub display_name: String,
    pub version: String,
    pub description: String,
    pub author: Option<PluginAuthor>,
    pub category: String,
    pub tags: Vec<String>,
    pub components: PluginComponents,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginAuthor {
    pub name: String,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginComponents {
    pub commands: usize,
    pub agents: usize,
    pub skills: usize,
    pub hooks: bool,
    pub mcp: bool,
}

/// 获取插件市场列表
#[tauri::command]
pub async fn get_plugin_marketplaces() -> Result<Vec<PluginMarketplace>, String> {
    // 从配置读取或返回默认市场
    Ok(vec![
        PluginMarketplace {
            name: "official".to_string(),
            source_type: MarketplaceSourceType::Github,
            url: "https://github.com/your-org/claude-plugins".to_string(),
            description: Some("官方插件市场".to_string()),
        }
    ])
}

/// 列出市场中的所有可用插件
#[tauri::command]
pub async fn list_marketplace_plugins(
    marketplace_name: String,
) -> Result<Vec<PluginMetadata>, String> {
    // 从 marketplace 拉取插件列表
    // 实现方式：
    // 1. GitHub: 通过 GitHub API 获取仓库中的 plugins/ 目录
    // 2. Git: clone 仓库到临时目录
    // 3. Local: 直接读取本地目录

    unimplemented!("待实现")
}

/// 安装插件到项目级目录
#[tauri::command]
pub async fn install_plugin_to_project(
    project_path: String,
    marketplace_name: String,
    plugin_name: String,
) -> Result<String, String> {
    log::info!("Installing plugin {} to project {}", plugin_name, project_path);

    // 1. 从 marketplace 下载插件
    let plugin_source_path = download_plugin(&marketplace_name, &plugin_name)?;

    // 2. 解析 plugin.json
    let metadata = read_plugin_metadata(&plugin_source_path)?;

    // 3. 安装各个组件到项目级目录
    let project_claude_dir = PathBuf::from(&project_path).join(".claude");

    install_plugin_components(&plugin_source_path, &project_claude_dir, &metadata)?;

    // 4. 记录已安装插件（用于后续管理）
    record_installed_plugin(&project_path, &metadata)?;

    Ok(format!("Successfully installed plugin: {}", metadata.display_name))
}

/// 下载插件到临时目录
fn download_plugin(marketplace_name: &str, plugin_name: &str) -> Result<PathBuf, String> {
    // 根据 marketplace 类型下载插件
    // - GitHub: 使用 GitHub API 下载 tar.gz
    // - Git: git clone
    // - Local: 直接返回本地路径

    unimplemented!("待实现")
}

/// 读取 plugin.json
fn read_plugin_metadata(plugin_path: &Path) -> Result<PluginMetadata, String> {
    let metadata_path = plugin_path.join("plugin.json");

    let content = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Failed to read plugin.json: {}", e))?;

    let metadata: PluginMetadata = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse plugin.json: {}", e))?;

    Ok(metadata)
}

/// 安装插件组件到项目级目录
fn install_plugin_components(
    plugin_source: &Path,
    project_claude_dir: &Path,
    metadata: &PluginMetadata,
) -> Result<(), String> {
    log::info!("Installing components for plugin: {}", metadata.name);

    // 1. 安装 Commands
    if metadata.components.commands > 0 {
        let src_commands = plugin_source.join("commands");
        if src_commands.exists() {
            let dst_commands = project_claude_dir.join("commands").join(&metadata.name);
            copy_dir_recursive(&src_commands, &dst_commands)?;
            log::info!("Installed {} commands", metadata.components.commands);
        }
    }

    // 2. 安装 Agents
    if metadata.components.agents > 0 {
        let src_agents = plugin_source.join("agents");
        if src_agents.exists() {
            let dst_agents = project_claude_dir.join("agents").join(&metadata.name);
            copy_dir_recursive(&src_agents, &dst_agents)?;
            log::info!("Installed {} agents", metadata.components.agents);
        }
    }

    // 3. 安装 Skills
    if metadata.components.skills > 0 {
        let src_skills = plugin_source.join("skills");
        if src_skills.exists() {
            let dst_skills = project_claude_dir.join("skills").join(&metadata.name);
            copy_dir_recursive(&src_skills, &dst_skills)?;
            log::info!("Installed {} skills", metadata.components.skills);
        }
    }

    // 4. 安装 Hooks（可选）
    if metadata.components.hooks {
        let src_hooks = plugin_source.join("hooks").join("hooks.json");
        if src_hooks.exists() {
            let dst_hooks = project_claude_dir.join("hooks");
            fs::create_dir_all(&dst_hooks)
                .map_err(|e| format!("Failed to create hooks dir: {}", e))?;

            // 需要合并已有的 hooks.json
            merge_hooks_json(&src_hooks, &dst_hooks.join("hooks.json"))?;
            log::info!("Installed hooks");
        }
    }

    // 5. 安装 MCP 配置（可选）
    if metadata.components.mcp {
        let src_mcp = plugin_source.join(".mcp.json");
        if src_mcp.exists() {
            let dst_mcp = project_claude_dir.join(".mcp.json");

            // 需要合并已有的 .mcp.json
            merge_mcp_json(&src_mcp, &dst_mcp)?;
            log::info!("Installed MCP config");
        }
    }

    Ok(())
}

/// 递归复制目录
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    for entry in fs::read_dir(src)
        .map_err(|e| format!("Failed to read directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let file_name = path.file_name().unwrap();
        let dst_path = dst.join(file_name);

        if path.is_dir() {
            copy_dir_recursive(&path, &dst_path)?;
        } else {
            fs::copy(&path, &dst_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}

/// 合并 hooks.json
fn merge_hooks_json(src: &Path, dst: &Path) -> Result<(), String> {
    // 读取源 hooks
    let src_content = fs::read_to_string(src)
        .map_err(|e| format!("Failed to read source hooks: {}", e))?;
    let src_hooks: serde_json::Value = serde_json::from_str(&src_content)
        .map_err(|e| format!("Failed to parse source hooks: {}", e))?;

    // 读取目标 hooks（如果存在）
    let mut dst_hooks = if dst.exists() {
        let dst_content = fs::read_to_string(dst)
            .map_err(|e| format!("Failed to read destination hooks: {}", e))?;
        serde_json::from_str(&dst_content)
            .map_err(|e| format!("Failed to parse destination hooks: {}", e))?
    } else {
        serde_json::json!({})
    };

    // 合并逻辑：将 src_hooks 的所有 hook 添加到 dst_hooks
    if let (Some(dst_obj), Some(src_obj)) = (dst_hooks.as_object_mut(), src_hooks.as_object()) {
        for (key, value) in src_obj {
            // 如果 key 已存在，可以选择覆盖或合并数组
            if dst_obj.contains_key(key) {
                // 如果都是数组，则合并
                if let (Some(dst_arr), Some(src_arr)) = (dst_obj[key].as_array_mut(), value.as_array()) {
                    dst_arr.extend(src_arr.clone());
                } else {
                    // 否则覆盖
                    dst_obj.insert(key.clone(), value.clone());
                }
            } else {
                dst_obj.insert(key.clone(), value.clone());
            }
        }
    }

    // 写回文件
    let json_string = serde_json::to_string_pretty(&dst_hooks)
        .map_err(|e| format!("Failed to serialize hooks: {}", e))?;

    fs::write(dst, json_string)
        .map_err(|e| format!("Failed to write hooks: {}", e))?;

    Ok(())
}

/// 合并 .mcp.json
fn merge_mcp_json(src: &Path, dst: &Path) -> Result<(), String> {
    // 类似 merge_hooks_json 的实现
    unimplemented!("待实现")
}

/// 记录已安装的插件
fn record_installed_plugin(project_path: &str, metadata: &PluginMetadata) -> Result<(), String> {
    let record_file = PathBuf::from(project_path)
        .join(".claude")
        .join("installed_plugins.json");

    // 读取现有记录
    let mut installed = if record_file.exists() {
        let content = fs::read_to_string(&record_file)
            .map_err(|e| format!("Failed to read installed plugins: {}", e))?;
        serde_json::from_str::<serde_json::Value>(&content)
            .map_err(|e| format!("Failed to parse installed plugins: {}", e))?
    } else {
        serde_json::json!({
            "version": 1,
            "plugins": {}
        })
    };

    // 添加新插件记录
    if let Some(plugins_obj) = installed.get_mut("plugins").and_then(|v| v.as_object_mut()) {
        plugins_obj.insert(
            metadata.name.clone(),
            serde_json::to_value(metadata).unwrap(),
        );
    }

    // 写回文件
    let json_string = serde_json::to_string_pretty(&installed)
        .map_err(|e| format!("Failed to serialize installed plugins: {}", e))?;

    fs::write(&record_file, json_string)
        .map_err(|e| format!("Failed to write installed plugins: {}", e))?;

    Ok(())
}

/// 卸载项目级插件
#[tauri::command]
pub async fn uninstall_plugin_from_project(
    project_path: String,
    plugin_name: String,
) -> Result<String, String> {
    log::info!("Uninstalling plugin {} from project {}", plugin_name, project_path);

    let project_claude_dir = PathBuf::from(&project_path).join(".claude");

    // 删除各个组件目录
    let components = [
        ("commands", project_claude_dir.join("commands").join(&plugin_name)),
        ("agents", project_claude_dir.join("agents").join(&plugin_name)),
        ("skills", project_claude_dir.join("skills").join(&plugin_name)),
    ];

    for (component_type, component_path) in &components {
        if component_path.exists() {
            fs::remove_dir_all(component_path)
                .map_err(|e| format!("Failed to remove {} directory: {}", component_type, e))?;
            log::info!("Removed {} directory", component_type);
        }
    }

    // 更新 installed_plugins.json
    let record_file = project_claude_dir.join("installed_plugins.json");
    if record_file.exists() {
        let content = fs::read_to_string(&record_file)
            .map_err(|e| format!("Failed to read installed plugins: {}", e))?;
        let mut installed: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse installed plugins: {}", e))?;

        if let Some(plugins_obj) = installed.get_mut("plugins").and_then(|v| v.as_object_mut()) {
            plugins_obj.remove(&plugin_name);
        }

        let json_string = serde_json::to_string_pretty(&installed)
            .map_err(|e| format!("Failed to serialize installed plugins: {}", e))?;

        fs::write(&record_file, json_string)
            .map_err(|e| format!("Failed to write installed plugins: {}", e))?;
    }

    Ok(format!("Successfully uninstalled plugin: {}", plugin_name))
}

/// 列出项目已安装的插件
#[tauri::command]
pub async fn list_project_installed_plugins(
    project_path: String,
) -> Result<Vec<PluginMetadata>, String> {
    let record_file = PathBuf::from(&project_path)
        .join(".claude")
        .join("installed_plugins.json");

    if !record_file.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&record_file)
        .map_err(|e| format!("Failed to read installed plugins: {}", e))?;
    let installed: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse installed plugins: {}", e))?;

    let mut plugins = Vec::new();

    if let Some(plugins_obj) = installed.get("plugins").and_then(|v| v.as_object()) {
        for (_name, plugin_data) in plugins_obj {
            if let Ok(metadata) = serde_json::from_value::<PluginMetadata>(plugin_data.clone()) {
                plugins.push(metadata);
            }
        }
    }

    Ok(plugins)
}
```

### 3. 前端实现（React + TypeScript）

#### 插件市场组件

在 `src/components/PluginMarketplace.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface PluginMetadata {
  name: string;
  displayName: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  components: {
    commands: number;
    agents: number;
    skills: number;
    hooks: boolean;
    mcp: boolean;
  };
}

interface PluginMarketplaceProps {
  projectPath: string;
}

export const PluginMarketplace: React.FC<PluginMarketplaceProps> = ({ projectPath }) => {
  const [availablePlugins, setAvailablePlugins] = useState<PluginMetadata[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadPlugins();
  }, [projectPath]);

  const loadPlugins = async () => {
    setLoading(true);
    try {
      // 加载可用插件
      const available = await api.listMarketplacePlugins('official');
      setAvailablePlugins(available);

      // 加载已安装插件
      const installed = await api.listProjectInstalledPlugins(projectPath);
      setInstalledPlugins(new Set(installed.map(p => p.name)));
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (pluginName: string) => {
    try {
      await api.installPluginToProject(projectPath, 'official', pluginName);
      await loadPlugins(); // 刷新列表
    } catch (error) {
      console.error('Failed to install plugin:', error);
    }
  };

  const handleUninstall = async (pluginName: string) => {
    try {
      await api.uninstallPluginFromProject(projectPath, pluginName);
      await loadPlugins(); // 刷新列表
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
    }
  };

  const filteredPlugins = availablePlugins.filter(plugin => {
    const matchesSearch = plugin.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="plugin-marketplace">
      <h2>插件市场</h2>

      {/* 搜索和过滤 */}
      <div className="filters">
        <input
          type="text"
          placeholder="搜索插件..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          <option value="all">所有分类</option>
          <option value="data-processing">数据处理</option>
          <option value="web">网页工具</option>
          <option value="ai">AI 助手</option>
          {/* 更多分类... */}
        </select>
      </div>

      {/* 插件列表 */}
      <div className="plugin-grid">
        {filteredPlugins.map(plugin => {
          const isInstalled = installedPlugins.has(plugin.name);

          return (
            <div key={plugin.name} className="plugin-card">
              <h3>{plugin.displayName}</h3>
              <p>{plugin.description}</p>

              <div className="plugin-meta">
                <span>版本: {plugin.version}</span>
                <div className="tags">
                  {plugin.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="plugin-components">
                {plugin.components.commands > 0 && (
                  <span>🔧 {plugin.components.commands} 命令</span>
                )}
                {plugin.components.agents > 0 && (
                  <span>🤖 {plugin.components.agents} 代理</span>
                )}
                {plugin.components.skills > 0 && (
                  <span>⚡ {plugin.components.skills} 技能</span>
                )}
              </div>

              <button
                onClick={() => isInstalled ? handleUninstall(plugin.name) : handleInstall(plugin.name)}
                disabled={loading}
              >
                {isInstalled ? '卸载' : '安装'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

### 4. 目录结构变化

安装插件后，项目的 `.claude/` 目录结构：

```
project-root/
└── .claude/
    ├── installed_plugins.json    # 记录已安装插件
    ├── commands/
    │   ├── web-scraper/          # 插件1的命令
    │   │   ├── scrape.md
    │   │   └── parse.md
    │   └── data-analyzer/        # 插件2的命令
    │       └── analyze.md
    ├── agents/
    │   ├── web-scraper/
    │   │   └── web-analyzer.md
    │   └── data-analyzer/
    │       └── data-scientist.md
    ├── skills/
    │   ├── web-scraper/
    │   │   └── html-parser.SKILL.md
    │   └── data-analyzer/
    │       └── pandas-helper.SKILL.md
    ├── hooks/
    │   └── hooks.json            # 合并所有插件的 hooks
    └── .mcp.json                 # 合并所有插件的 MCP 配置
```

## 优势分析

### 1. 完全项目级隔离
- 每个项目的插件完全独立
- 不污染系统级 Claude 配置
- 学员可以在不同项目使用不同插件组合

### 2. 自动发现机制
- 利用 Claude CLI 的原生项目级支持
- 无需修改 `settings.json`
- 无需手动配置 marketplace

### 3. 简单易用
- 学员只需点击"安装"按钮
- UI 界面直观展示插件功能
- 支持搜索和分类过滤

### 4. 可扩展性
- 支持多个插件市场（GitHub、本地等）
- 易于添加新插件（只需遵循标准结构）
- 可以实现版本管理和更新机制

## 实施步骤

1. **创建插件仓库**
   - 在 GitHub 创建插件仓库
   - 按标准结构组织 1000+ 插件
   - 添加分类和标签

2. **实现后端 API**
   - 完成 `project_plugins.rs` 中的函数
   - 实现 GitHub API 集成（拉取插件列表）
   - 实现插件下载和解构逻辑

3. **实现前端 UI**
   - 创建插件市场组件
   - 添加搜索和过滤功能
   - 集成到项目设置页面

4. **测试验证**
   - 测试插件安装和卸载
   - 验证 Claude CLI 能否正确发现组件
   - 测试多个插件的共存

5. **文档和培训**
   - 编写插件开发规范
   - 创建学员使用指南
   - 录制操作演示视频

## 后续优化方向

1. **插件依赖管理**：插件 A 依赖插件 B 时自动安装
2. **版本更新**：检测插件更新并提示升级
3. **插件预览**：安装前预览插件的组件内容
4. **自定义市场**：允许学员添加私有插件市场
5. **批量操作**：一键安装推荐插件组合

## 参考资料

- [Claude Code Plugins 文档](https://code.claude.com/docs/en/plugins)
- [Plugin Marketplaces 文档](https://code.claude.com/docs/en/plugin-marketplaces)
- [Sub-agents 文档](https://code.claude.com/docs/en/sub-agents)
- [Skills 文档](https://code.claude.com/docs/en/skills)

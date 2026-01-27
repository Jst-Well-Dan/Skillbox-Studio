# 已安装插件页面 - 后端逻辑文档

本文档说明了 Skillbox Studio 中“Installed (已安装)”页面如何获取并显示已安装插件的信息。

## 概述

“Installed”页面显示当前用户环境中已安装的插件列表。它区分了 **Global (全局)** 插件（适用于所有项目）和 **Project (项目)** 插件（仅适用于当前项目）。

数据获取过程包含以下步骤：
1.  **前端请求**：React 组件调用 Tauri 命令发起扫描。
2.  **加载市场数据**：后端从 `marketplace.json` 加载所有已知插件的主列表。
3.  **文件系统扫描**：后端遍历所有已配置 Agent 的技能目录。
4.  **匹配与聚合**：将扫描到的目录与市场数据进行匹配以识别插件，并聚合结果。

我希望将此处的后端逻辑修改为：
对于全局插件，查看全局那些 skill 文件夹里面的 skill，不管是不是与 marketplace.json 相同的插件，都列出来。
对于项目插件，只列出基于使用本应用进行安装的插件。
---

## 详细数据流

### 1. 前端：发起扫描

**文件**: `src/components/InstalledPluginsPage.tsx`

*   页面加载时调用 `loadData()`。
*   `loadData()` 调用从 `src/lib/api.ts` 导入的 `scanInstalledPlugins` API 函数。
*   这触发了 Tauri 命令：`scan_installed_plugins`。

```typescript
// src/lib/api.ts
export async function scanInstalledPlugins(
    scope?: "global" | "project",
    projectPath?: string
): Promise<ScanResult> {
    return invoke("scan_installed_plugins", { scope, project_path: projectPath });
}
```

### 2. 后端：`scan_installed_plugins` 命令

**文件**: `src-tauri/src/commands/plugin_scanner.rs`

这是核心逻辑函数。它执行以下操作：

#### A. 加载市场数据
首先调用 `marketplace::get_marketplace_data()`，从 `Skill-Box` 子模块读取 `marketplace.json` 文件。
*   **来源**: `Skill-Box/.claude-plugin/marketplace.json`
*   **目的**: 此文件包含所有有效插件的元数据（描述、作者、包含的技能）。扫描器需要它将目录名称（例如 "web-scraper"）映射回用户友好的插件名称和描述。

#### B. 识别扫描目标（Agent 和 作用域）
遍历系统中定义的所有 Agent（例如 "claude", "chatgpt", "antigravity"）。
对于每个 Agent，根据请求的 `scope` 确定扫描路径：
*   **全局作用域 (Global)**：获取 Agent 的全局技能目录（例如 `~/.gemini/antigravity/skills`）。
*   **项目作用域 (Project)**：获取 Agent 的项目专用技能目录（例如项目文件夹内的 `./.gemini/agents/antigravity/skills`）。

#### C. 目录扫描 (`scan_directory`)
对于找到的每个有效目录，调用 `scan_directory` 辅助函数。
1.  **读取目录**：遍历子目录。每个子目录被视为一个潜在的“技能 (skill)”。
2.  **与市场匹配**：
    *   获取目录名称（即技能名称）。
    *   **全局作用域**：如果在市场中找不到匹配的插件，则将其视为“本地插件 (Local Plugin)”，名称为文件夹名，类别为 "Local"。
    *   **项目作用域**：严格匹配。如果市场中找不到，则忽略该目录（仅显示官方/市场认可的插件）。
3.  **收集元数据**：
    *   **版本**：读取技能目录内的 `skill.json` 获取安装版本。
    *   **安装时间**：使用目录的最后修改时间。
    *   **大小**：递归计算目录的总大小。
4.  **聚合结果**：
    *   如果多次发现同一个插件（例如多个 Agent 都安装了），则合并结果。
    *   更新该插件的 `agents` 列表，包含当前 Agent。
    *   更新 `skills` 列表，确保跟踪该插件所有已安装的组件。

### 3. 数据结构返回

命令向前端返回一个 `ScanResult` 对象：

```rust
pub struct ScanResult {
    pub total_count: usize,
    pub by_scope: ScanSummary, // 全局 vs 项目 的计数
    pub by_agent: HashMap<String, usize>, // 每个 Agent 的计数
    pub plugins: Vec<InstalledPlugin>,
}

pub struct InstalledPlugin {
    pub name: String,
    pub category: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub installed_at: String, // ISO 8601
    pub location: PluginLocation, // 作用域和路径
    pub agents: Vec<String>, // 安装了此插件的 Agent
    pub skills: Vec<String>, // 此插件中存在的技能
    pub size_bytes: u64,
}
```

### 4. 搜索功能

**命令**: `search_installed_plugins`

搜索功能复用了扫描逻辑：
1.  内部调用 `scan_installed_plugins` 获取完整列表。
2.  对结果集执行加权关键词搜索（匹配名称、类别和描述）。
3.  返回排序后的匹配列表。

---

## 文件依赖总结

| 组件 | 文件路径 | 职责 |
|Data Source| `Skill-Box/.claude-plugin/marketplace.json` | 所有可用插件及其元数据的 JSON 数据库。 |
|Frontend UI| `src/components/InstalledPluginsPage.tsx` | 显示列表，处理筛选和卸载操作。 |
|Frontend API| `src/lib/api.ts` | TypeScript 定义和 Tauri invoke 调用封装。 |
|Backend Logic| `src-tauri/src/commands/plugin_scanner.rs` | 实现扫描、匹配和聚合算法。 |
|Backend Marketplace| `src-tauri/src/commands/marketplace.rs` | 处理 `marketplace.json` 文件的读取和解析。 |


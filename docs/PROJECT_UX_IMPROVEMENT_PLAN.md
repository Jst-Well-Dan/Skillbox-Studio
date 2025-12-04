# Claude Workbench UX 改进计划

## 项目概述

本文档记录了 Claude Workbench 的用户体验改进计划，重点解决系统级与项目级功能的概念混淆、缺少能力可视化、以及 Marketplace 管理等问题。

**最后更新**: 2025-11-25

---

## 问题分类

### 问题1：概念混淆与术语不一致

**当前问题**：
- 系统级扩展管理器标题："Claude 扩展管理器" - 未明确标识系统级
- 术语混用：Plugins（插件）、Subagents（子代理）、Agent Skills（技能）、Extensions（扩展）
- 项目插件管理器说明："为当前项目安装插件，添加 Commands、Agents 和 Skills"
- 用户困惑：不清楚系统级和项目级的区别和关系

**改进方案**：

**系统级扩展管理器**：
- 标题改为："系统扩展管理器（全局）"
- 副标题改为："管理所有项目共用的扩展能力"
- 增加提示："💡 这里的配置会影响所有项目。若需为单个项目定制能力，请在项目页面使用'项目插件管理'。"
- 统一术语：
  - Plugins → 插件包（可包含多种组件）
  - Subagents → 专用代理
  - Skills → 技能
  - Commands → 斜杠命令（/命令）
  - MCP Servers → MCP 服务

**项目插件管理器**：
- 标题改为："项目能力管理"
- 副标题改为："为当前项目添加插件，获得专属能力"
- 增加说明："📌 这些插件仅在当前项目生效，不影响其他项目"

---

### 问题2：缺少"能力总览"功能

**当前问题**：
- 用户安装插件后，不知道项目获得了什么能力
- 看不到可用的 Commands、Agents、Skills、MCP 列表
- 无法验证插件是否正确安装
- 聊天界面显示"Unknown slash command: plugin"表明Commands未被识别

**改进方案**（核心新功能）：

```
项目能力管理对话框
├── 插件市场（现有）
├── 已安装（现有）
└── ✨能力总览（新增）⭐
    ├── 📜 斜杠命令（Commands）
    │   ├── 显示所有可用命令
    │   ├── 每个命令显示：名称、描述、用法示例
    │   └── 提供"复制命令"按钮
    ├── 🤖 专用代理（Agents）
    │   ├── 显示所有可用代理
    │   ├── 每个代理显示：名称、触发场景、描述
    │   └── 来源标记（来自哪个插件）
    ├── ⚡ 技能（Skills）
    │   ├── 显示所有可用技能
    │   ├── 每个技能显示：名称、功能描述、激活方式
    │   └── 来源标记
    └── 🔌 MCP 服务（可选）
        ├── 显示 MCP 服务器列表
        ├── 状态监控（运行中/已停止）
        └── 配置查看
```

**实现优先级**：
- **P0（必需）**：Commands 列表 + 使用示例
- **P1（重要）**：Skills 列表 + 功能描述
- **P2（推荐）**：Agents 列表
- **P3（可选）**：MCP 状态监控

---

### 问题3：缺少 Marketplace 源管理功能 ⚠️

**当前问题**：
- ✅ 已有 "Marketplaces" 标签页，但**缺少"添加 Marketplace 源"的按钮**
- 无法通过 GUI 添加新的 marketplace 源
- 必须通过 Claude CLI 的 `/plugin marketplace` 命令手动添加
- 对小白用户极不友好，阻碍了用户发现和安装自定义插件

**改进方案**：

**在现有 "Marketplaces" 标签页添加管理功能**

```
系统扩展管理器（全局）
[ Marketplaces ] [ Plugins ] [ Subagents ] [ Skills ] [ MCP ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Marketplace 源管理             [+ 添加源] [刷新所有]
从不同的来源发现和安装插件

┌─────────────────────────────────────────────────┐
│ 📍 已配置的 Marketplace 源                        │
│                                                 │
│ ✅ Anthropic 官方仓库                             │
│    https://github.com/anthropics/...           │
│    13.7k ⭐ · 包含 4 个官方 Skills                │
│    最后更新: 2025-11-28                          │
│    [浏览插件] [更新] [移除]                        │
│                                                 │
│ ✅ 社区插件市场                                   │
│    https://claude-plugins.dev                  │
│    1.2k+ 插件                                   │
│    最后更新: 2025-11-27                          │
│    [浏览插件] [更新] [移除]                        │
└─────────────────────────────────────────────────┘

💡 官方文档和资源:
• Plugins 文档
• Subagents 文档
• Agent Skills 文档

🌟 官方推荐:
• Anthropic Skills 仓库 (13.7k ⭐)
```

**添加源对话框**：
```
┌─────────────────────────────────┐
│  添加 Marketplace 源             │
├─────────────────────────────────┤
│                                 │
│  源类型:                        │
│  ○ GitHub 仓库                  │
│  ○ 自定义 URL                   │
│  ○ 本地路径                     │
│                                 │
│  仓库地址:                      │
│  ┌─────────────────────────┐   │
│  │ https://github.com/...  │   │
│  └─────────────────────────┘   │
│                                 │
│  显示名称 (可选):               │
│  ┌─────────────────────────┐   │
│  │ 我的自定义插件市场       │   │
│  └─────────────────────────┘   │
│                                 │
│        [取消]      [添加]       │
└─────────────────────────────────┘
```

**技术实现**：
```rust
// 新增 Tauri 命令
#[tauri::command]
async fn add_marketplace(source: String, name: Option<String>) -> Result<String, String> {
    // 调用 Claude CLI: claude-code plugin marketplace add <source>
    // 或直接修改 known_marketplaces.json
}

#[tauri::command]
async fn remove_marketplace(name: String) -> Result<String, String> {
    // 调用 Claude CLI: claude-code plugin marketplace remove <name>
}

#[tauri::command]
async fn refresh_marketplace(name: String) -> Result<String, String> {
    // 调用 Claude CLI: claude-code plugin marketplace update <name>
}

#[tauri::command]
async fn list_marketplaces() -> Result<Vec<MarketplaceInfo>, String> {
    // 读取 known_marketplaces.json
    // 返回所有已配置的 marketplace 源
}
```

---

### 问题4：红色按钮设计问题

**当前问题**：
- "新功能：添加插件/技能"是临时标签，不应永久显示
- 红色过于醒目，分散注意力
- 按钮文字表意不清（是添加插件还是管理插件？）

**改进方案**：
```typescript
// SessionList.tsx 修改
<Button
  variant="outline"  // 改为常规样式
  size="default"
  onClick={() => setPluginManagerOpen(true)}
>
  <Package className="h-4 w-4 mr-2" />
  <span>项目能力</span>  // 简化文字
</Button>

// 如果需要突出新功能，使用 Badge
<Button variant="outline">
  <Package className="h-4 w-4 mr-2" />
  <span>项目能力</span>
  <Badge className="ml-2">NEW</Badge>  // 徽章形式，不太刺眼
</Button>
```

---

### 问题5：信息架构不清晰

**当前问题**：
- 顶部菜单：主题、使用统计、扩展、设置 - 未区分系统级/项目级
- 用户可能在系统级安装插件后，期望在项目中直接使用（实际需要项目级安装）
- 缺少引导流程

**改进方案**：

**新增：首次使用引导（仅小白用户）**

```
当用户第一次打开"项目能力管理"时：
┌─────────────────────────────────────┐
│  欢迎使用项目能力管理！              │
│                                     │
│  这里可以为当前项目添加专属能力：    │
│  • 📜 斜杠命令 - 快捷操作           │
│  • 🤖 专用代理 - 自动化工作流       │
│  • ⚡ 技能 - 扩展 Claude 能力       │
│                                     │
│  💡 提示：                          │
│  1. 这些能力仅在当前项目生效         │
│  2. 不同项目可以有不同的能力组合     │
│  3. 安装后在"能力总览"查看详情      │
│                                     │
│  [开始探索]  [不再显示]             │
└─────────────────────────────────────┘
```

**推荐的用户流程**：
```
1. 系统级：添加 Marketplace（一次性）
   ↓
2. 项目级：从 Marketplace 安装插件
   ↓
3. 项目级：在"能力总览"查看获得的能力
   ↓
4. 聊天界面：使用斜杠命令或技能
```

---

### 问题6：使用统计界面性能问题 🔴 严重

**当前问题**：
- **打开统计界面时严重卡顿**，用户体验极差
- 数据加载缓慢，特别是对于拥有大量项目和会话的用户
- 每次切换日期范围都需要重新计算，无法利用之前的计算结果

**根本原因分析**：

#### 后端性能瓶颈 (`src-tauri/src/commands/usage.rs`)

1. **全量文件扫描** (Line 412-449)
   ```rust
   fn get_all_usage_entries(claude_path: &PathBuf) -> Vec<UsageEntry> {
       // ❌ 使用 walkdir 递归遍历 ~/.claude/projects 下所有文件
       walkdir::WalkDir::new(&project_path)
           .into_iter()
           .filter(|e| e.path().extension() == Some("jsonl"))
       // ❌ 每次都要扫描所有项目目录
   }
   ```
   - **问题**：每次请求都要遍历整个 `~/.claude/projects` 目录树
   - **影响**：用户项目越多，扫描时间越长（O(n) 复杂度）

2. **逐行JSON解析** (Line 300-389)
   ```rust
   fn parse_jsonl_file(...) {
       for line in content.lines() {
           // ❌ 每行都要解析 JSON
           let json_value = serde_json::from_str::<serde_json::Value>(line)?;
       }
   }
   ```
   - **问题**：每个 `.jsonl` 文件逐行读取和解析，无缓存
   - **影响**：会话越多，解析时间越长（数千行JSON）

3. **多维度数据聚合** (Line 493-587)
   ```rust
   // ❌ 遍历所有条目，构建多个 HashMap
   for entry in &filtered_entries {
       model_stats.entry(entry.model.clone())...  // 按模型聚合
       daily_stats.entry(date.clone())...          // 按日期聚合
       project_stats.entry(entry.project_path.clone())...  // 按项目聚合
   }
   ```
   - **问题**：每次请求都要重新计算所有维度的统计
   - **影响**：数据越多，计算时间呈线性增长

4. **重复排序操作** (Line 438, 446, 597, 600, 603)
   ```rust
   files_to_process.sort_by_cached_key(|(path, _)| get_earliest_timestamp(path));
   all_entries.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
   by_model.sort_by(...);
   by_date.sort_by(...);
   by_project.sort_by(...);
   ```
   - **问题**：多次排序操作，时间复杂度 O(n log n)
   - **影响**：数据量大时排序成本高

#### 前端性能瓶颈 (`src/components/UsageDashboard.tsx`)

1. **并发API调用但无增量加载** (Line 127-170)
   ```typescript
   const [statsResult, sessionResult] = await Promise.all([
       api.getUsageByDateRange(...),
       api.getSessionStats(...)
   ]);
   ```
   - **问题**：虽然并发请求，但仍需等待后端完成全部计算
   - **影响**：首次打开时长时间白屏或 loading 状态

2. **缓存时间过短** (Line 26)
   ```typescript
   const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
   ```
   - **问题**：对于历史数据（不常变化），10分钟缓存太短
   - **影响**：用户频繁操作时仍会触发重新计算

3. **复杂的 useMemo 计算** (Line 223-331)
   - **问题**：虽然使用了 memoization，但数据量大时初始计算仍然卡顿
   - **影响**：首次渲染时的计算压力

#### 性能数据估算

**假设场景**：用户有 50 个项目，每个项目 20 个会话，每个会话平均 500 行 JSONL

- 文件数量：50 × 20 = 1,000 个 `.jsonl` 文件
- 总行数：1,000 × 500 = 500,000 行 JSON
- 扫描时间：~2-3秒（文件系统遍历）
- 解析时间：~3-5秒（JSON解析 + 去重）
- 聚合时间：~1-2秒（HashMap 操作）
- **总计：6-10秒** ⚠️

这种延迟对用户来说是**不可接受的**。

---

**改进方案**：

#### 方案 1：增量缓存系统 ⭐ 推荐

**核心思路**：维护一个持久化的统计缓存，只在有新数据时增量更新

```rust
// 新增文件：src-tauri/src/commands/usage_cache.rs

#[derive(Serialize, Deserialize)]
struct UsageCache {
    last_updated: String,
    total_stats: UsageStats,
    processed_files: HashMap<String, FileMetadata>,  // 文件路径 -> 元数据
}

#[derive(Serialize, Deserialize)]
struct FileMetadata {
    last_modified: SystemTime,
    entry_count: usize,
    last_entry_hash: String,  // 最后一条记录的哈希，用于检测增量
}

#[tauri::command]
pub fn get_usage_stats_cached(days: Option<u32>) -> Result<UsageStats, String> {
    let cache_path = dirs::home_dir()?.join(".claude/usage_cache.json");

    // 1. 读取缓存
    let mut cache = load_cache(&cache_path)?;

    // 2. 检测新文件和修改的文件
    let changed_files = detect_changed_files(&cache.processed_files)?;

    // 3. 只处理变化的文件
    if !changed_files.is_empty() {
        let new_entries = process_files(changed_files)?;
        cache.total_stats = merge_stats(cache.total_stats, new_entries)?;
        save_cache(&cache_path, &cache)?;
    }

    // 4. 根据 days 过滤返回
    Ok(filter_by_days(cache.total_stats, days))
}

fn detect_changed_files(processed_files: &HashMap<String, FileMetadata>) -> Vec<PathBuf> {
    // 只扫描新文件和修改时间变化的文件
    // 时间复杂度从 O(n) 降低到 O(k)，k 是变化的文件数
}
```

**优点**：
- ✅ 首次加载后，后续请求**几乎瞬时**（<100ms）
- ✅ 只在有新会话时才增量计算
- ✅ 大幅减少文件系统I/O和JSON解析

**缺点**：
- 需要维护缓存一致性
- 首次构建缓存仍需时间（可后台进行）

**实现优先级**：P0（立即实施）

---

#### 方案 2：SQLite 数据库索引

**核心思路**：使用嵌入式数据库存储使用数据，利用索引加速查询

```rust
// 使用 rusqlite
CREATE TABLE usage_entries (
    id INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL,
    model TEXT NOT NULL,
    project_path TEXT NOT NULL,
    session_id TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost REAL,
    INDEX idx_timestamp (timestamp),
    INDEX idx_model (model),
    INDEX idx_project (project_path)
);

#[tauri::command]
pub fn get_usage_stats_db(days: Option<u32>) -> Result<UsageStats, String> {
    let conn = open_db()?;

    // SQL 查询，利用索引加速
    let query = "
        SELECT model, SUM(input_tokens), SUM(output_tokens), SUM(cost)
        FROM usage_entries
        WHERE timestamp >= ?
        GROUP BY model
    ";

    // 执行查询，时间复杂度 O(log n)
}
```

**优点**：
- ✅ 查询速度极快（索引支持）
- ✅ 支持复杂聚合查询
- ✅ 数据持久化，重启后无需重新计算

**缺点**：
- 需要迁移现有数据
- 增加了 SQLite 依赖
- 需要处理数据库同步问题

**实现优先级**：P1（中期考虑）

---

#### 方案 3：渐进式加载和虚拟化 ⚡

**前端优化**：分阶段加载数据，避免一次性计算所有内容

```typescript
// src/components/UsageDashboard.tsx

// 第一阶段：只加载概览数据（总成本、总会话数）
const loadSummary = async () => {
    const summary = await api.getUsageSummary(selectedDateRange);  // 新增轻量级 API
    setStats({ ...summary, by_model: [], by_date: [], by_project: [] });
    setLoading(false);  // 立即显示摘要
};

// 第二阶段：懒加载各个维度数据
useEffect(() => {
    if (activeTab === "models") {
        loadModelStats();  // 只在切换到 Models tab 时加载
    }
}, [activeTab]);

// 第三阶段：虚拟化长列表
import { useVirtualizer } from '@tanstack/react-virtual';

const projectVirtualizer = useVirtualizer({
    count: stats.by_project.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 60,  // 每个项目卡片高度
});
```

**优点**：
- ✅ 首屏加载快（只加载摘要）
- ✅ 减少初始渲染压力
- ✅ 虚拟化提升长列表性能

**缺点**：
- 用户体验略有延迟（需切换tab才加载）
- 前端实现复杂度增加

**实现优先级**：P0（立即实施，配合方案1）

---

#### 方案 4：Web Worker 后台计算

**核心思路**：使用 Web Worker 在后台线程进行数据处理，避免阻塞UI

```typescript
// src/workers/usage-processor.ts
self.onmessage = (e) => {
    const { stats, dateRange } = e.data;

    // 在 worker 中进行复杂计算
    const processedStats = processUsageData(stats, dateRange);

    self.postMessage(processedStats);
};

// src/components/UsageDashboard.tsx
const worker = new Worker(new URL('../workers/usage-processor.ts', import.meta.url));

worker.onmessage = (e) => {
    setStats(e.data);
    setLoading(false);
};

worker.postMessage({ stats: rawData, dateRange });
```

**优点**：
- ✅ UI 线程不阻塞，界面保持响应
- ✅ 充分利用多核CPU

**缺点**：
- 治标不治本，后端计算仍然慢
- 增加前端复杂度

**实现优先级**：P2（可选）

---

#### 推荐实施路线

**短期（1-2周）**：
1. ✅ **方案 3 - 渐进式加载**：先优化前端，立即改善用户体验
   - 实现概览数据快速加载
   - 各 tab 懒加载
   - 延长缓存时间到 30 分钟（历史数据不变）

2. ✅ **方案 1 - 增量缓存**：优化后端，根本性提升性能
   - 实现缓存文件系统
   - 增量更新逻辑
   - 后台定期刷新缓存

**中期（1-2月）**：
3. ✅ **方案 2 - SQLite 数据库**（可选）：
   - 如果缓存方案仍无法满足性能要求
   - 考虑迁移到 SQLite

**长期优化**：
4. ✅ 定期后台任务自动更新统计
5. ✅ 支持导出统计报表（CSV/PDF）
6. ✅ 添加更多可视化图表（趋势分析、预测）

---

**预期性能提升**：

| 方案 | 首次加载 | 后续加载 | 切换日期范围 | 实现难度 |
|------|---------|---------|-------------|---------|
| 当前 | 6-10秒 | 6-10秒 | 6-10秒 | - |
| 方案1（缓存） | 6-10秒 | <100ms | <500ms | 中 |
| 方案1+3（缓存+渐进） | 1-2秒 | <100ms | <500ms | 中 |
| 方案2（SQLite） | <500ms | <100ms | <200ms | 高 |

---

## 实现计划

### 第一阶段：澄清概念（P0）

#### 任务 1.1：修改系统级扩展管理器
- [ ] 修改标题为"系统扩展管理器（全局）"
- [ ] 修改副标题为"管理所有项目共用的扩展能力"
- [ ] 增加说明提示框
- 文件：`src/components/Settings.tsx` 或专门的扩展管理组件

#### 任务 1.2：修改项目插件管理器
- [ ] 修改对话框标题为"项目能力管理"
- [ ] 修改副标题为"为当前项目添加插件，获得专属能力"
- [ ] 增加项目级说明提示
- 文件：`src/components/ProjectPluginManager.tsx`

#### 任务 1.3：统一术语
- [ ] 全局搜索替换术语
- [ ] 更新所有相关界面的文字描述
- 文件：多个组件文件

---

### 第二阶段：能力可视化（P0-P1）

#### 任务 2.1：实现"能力总览"标签框架
- [ ] 在 ProjectPluginManager 增加第三个标签"能力总览"
- [ ] 创建子标签：Commands、Skills、Agents（可选）
- 文件：`src/components/ProjectPluginManager.tsx`

#### 任务 2.2：实现 Commands 列表后端（P0）
- [ ] 新增 Tauri 命令：`get_project_commands(project_path)`
- [ ] 读取 `.claude/commands/*.md` 文件
- [ ] 解析命令名称、描述、用法示例
- [ ] 返回 `Vec<CommandInfo>` 结构
- 文件：`src-tauri/src/commands/project_plugins.rs`

**数据结构**：
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandInfo {
    pub name: String,           // 命令名（不含 /）
    pub file_name: String,      // 文件名
    pub description: String,    // 从文件内容提取
    pub usage_example: String,  // 使用示例
    pub source: String,         // 来源（系统级/项目级/插件名）
    pub file_path: String,      // 完整路径
}
```

#### 任务 2.3：实现 Commands 列表前端（P0）
- [ ] 创建 Commands 列表组件
- [ ] 显示命令卡片（名称、描述、用法）
- [ ] 实现"复制命令"按钮
- [ ] 区分来源（系统级/项目级/插件）
- 文件：`src/components/ProjectPluginManager.tsx`

#### 任务 2.4：实现 Skills 列表后端（P1）
- [ ] 新增 Tauri 命令：`get_project_skills(project_path)`
- [ ] 读取 `.claude/skills/*SKILL.md` 文件
- [ ] 解析 YAML frontmatter（名称、描述、触发条件）
- [ ] 返回 `Vec<SkillInfo>` 结构
- 文件：`src-tauri/src/commands/project_plugins.rs`

**数据结构**：
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub trigger: Option<String>,    // 触发条件
    pub source: String,             // 来源
    pub file_path: String,
}
```

#### 任务 2.5：实现 Skills 列表前端（P1）
- [ ] 创建 Skills 列表组件
- [ ] 显示技能卡片（名称、描述、激活方式）
- [ ] 区分来源
- 文件：`src/components/ProjectPluginManager.tsx`

---

### 第三阶段：Marketplace 源管理（P1）

#### 任务 3.1：实现 Marketplace 管理后端
- [ ] `add_marketplace(source: String, name: Option<String>)`
- [ ] `remove_marketplace(name: String)`
- [ ] `refresh_marketplace(name: String)`
- [ ] `list_marketplaces() -> Vec<MarketplaceInfo>`
- 文件：`src-tauri/src/commands/extensions.rs` 或新建 `marketplace.rs`

**数据结构**：
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceInfo {
    pub name: String,
    pub source: String,          // GitHub URL 或本地路径
    pub source_type: SourceType, // GitHub, URL, Local
    pub last_updated: Option<String>,
    pub plugin_count: Option<usize>,
    pub status: Status,          // Active, Error
}
```

#### 任务 3.2：更新 Marketplaces 标签页 UI
- [ ] 在现有 Marketplaces tab 添加 "[+ 添加源]" 按钮
- [ ] 设计 Marketplace 源列表卡片
- [ ] 设计"添加源"对话框（支持 GitHub/URL/本地路径）
- [ ] 添加"刷新所有"、"更新"、"移除"按钮
- 文件：系统扩展管理组件

#### 任务 3.3：集成前后端
- [ ] 连接后端 API
- [ ] 实现添加/删除/刷新交互
- [ ] 错误处理和提示
- [ ] 更新后自动刷新列表

---

### 第四阶段：体验优化（P2-P3）

#### 任务 4.1：首次使用引导
- [ ] 检测用户是否首次打开项目能力管理
- [ ] 显示引导对话框
- [ ] 保存用户偏好（不再显示）

#### 任务 4.2：红色按钮优化
- [ ] 修改按钮样式为 `variant="outline"`
- [ ] 修改文字为"项目能力"
- [ ] 可选：添加 NEW 徽章

#### 任务 4.3：实现 Agents 列表（P2）
- [ ] 后端：读取 `.claude/agents/*.md`
- [ ] 前端：显示 Agents 列表

#### 任务 4.4：MCP 服务器监控（P3）
- [ ] 后端：读取 `.mcp.json` 配置
- [ ] 前端：显示 MCP 服务器列表和状态

---

### 第五阶段：性能优化 - 使用统计界面 🔴 P0 关键

#### 任务 5.1：前端渐进式加载优化（立即实施）
- [ ] 实现概览数据优先加载 API
  - 新增轻量级后端命令：`get_usage_summary(days: Option<u32>)`
  - 只返回总计数据，不包含详细列表
- [ ] 实现 tab 懒加载机制
  - Models tab: 切换时才加载模型详情
  - Projects tab: 切换时才加载项目列表
  - Timeline tab: 切换时才加载图表数据
- [ ] 延长缓存时间
  - 历史数据缓存从 10 分钟延长到 30 分钟
  - 当前日期数据保持 10 分钟
- 文件：`src/components/UsageDashboard.tsx`

#### 任务 5.2：后端增量缓存系统（立即实施）
- [ ] 创建缓存数据结构
  ```rust
  // src-tauri/src/commands/usage_cache.rs
  struct UsageCache {
      last_updated: String,
      total_stats: UsageStats,
      processed_files: HashMap<String, FileMetadata>,
  }
  ```
- [ ] 实现缓存读取/保存
  - 缓存文件路径：`~/.claude/usage_cache.json`
  - 自动检测缓存过期（基于文件修改时间）
- [ ] 实现增量更新逻辑
  - `detect_changed_files()`: 只扫描新文件和修改的文件
  - `merge_stats()`: 合并新旧统计数据
- [ ] 实现新的缓存 API
  - `get_usage_stats_cached(days: Option<u32>)`
  - 替换现有的 `get_usage_stats()`
- 文件：`src-tauri/src/commands/usage_cache.rs`

#### 任务 5.3：虚拟化长列表（可选 P1）
- [ ] 在 Projects tab 实现虚拟滚动
  - 使用 `@tanstack/react-virtual`
  - 只渲染可见范围内的项目
- [ ] 在 Sessions tab 实现虚拟滚动
- 文件：`src/components/UsageDashboard.tsx`

#### 任务 5.4：后台更新机制（可选 P2）
- [ ] 实现定期后台缓存刷新
  - 应用空闲时自动更新缓存
  - 使用 Tauri 的后台任务
- [ ] 提供手动刷新按钮
  - 在统计界面添加"刷新数据"按钮
  - 显示最后更新时间
- 文件：`src-tauri/src/main.rs`, `src/components/UsageDashboard.tsx`

#### 性能优化验收标准

| 指标 | 当前状态 | 目标 | 验收方法 |
|------|---------|-----|---------|
| 首次加载时间 | 6-10秒 | <2秒 | 50个项目，1000个会话测试 |
| 后续加载时间 | 6-10秒 | <100ms | 缓存命中测试 |
| 切换日期范围 | 6-10秒 | <500ms | 在 7d/30d/all 之间切换 |
| Tab切换延迟 | - | <200ms | 各tab之间切换 |
| UI 响应性 | 阻塞 | 不阻塞 | 加载时仍可滚动/切换 |

---

## 优先级总结

### P0（立即实现） 🔴

1. ✅ 修改系统级扩展管理器标题和说明
2. ✅ 修改项目插件管理器标题和说明
3. ✅ 实现"能力总览"标签框架
4. ✅ 实现 Commands 列表功能（后端 + 前端）
5. 🚀 **使用统计界面性能优化** - 严重影响用户体验
   - 前端渐进式加载（任务 5.1）
   - 后端增量缓存系统（任务 5.2）

### P1（短期实现）

6. 实现 Skills 列表功能（后端 + 前端）
7. 实现 Marketplace 源管理功能
   - 后端 API（任务 3.1）
   - 前端 UI（任务 3.2）
   - 集成测试（任务 3.3）
8. 虚拟化长列表（任务 5.3）

### P2（中期实现）

9. 实现 Agents 列表功能
10. 首次使用引导
11. 红色按钮优化
12. 后台统计更新机制（任务 5.4）

### P3（可选）

13. MCP 服务器状态监控
14. 能力使用统计
15. 统计数据导出（CSV/PDF）

---

## 技术细节

### 文件结构

```
src-tauri/src/commands/
├── project_plugins.rs          # 现有：项目插件管理
│   ├── get_project_commands()  # 新增：获取命令列表
│   ├── get_project_skills()    # 新增：获取技能列表
│   └── get_project_agents()    # 新增：获取代理列表
├── extensions.rs               # 现有：系统级扩展管理
│   ├── add_marketplace()       # 新增：添加 marketplace
│   ├── remove_marketplace()    # 新增：删除 marketplace
│   └── refresh_marketplace()   # 新增：刷新 marketplace
└── mod.rs                      # 注册新命令

src/components/
├── ProjectPluginManager.tsx    # 修改：增加能力总览标签
├── Settings.tsx                # 修改：系统级扩展管理器标题
└── SessionList.tsx             # 修改：按钮样式和文字
```

### API 类型定义

```typescript
// src/lib/api.ts

export interface CommandInfo {
  name: string;
  fileName: string;
  description: string;
  usageExample: string;
  source: string;
  filePath: string;
}

export interface SkillInfo {
  name: string;
  displayName: string;
  description: string;
  trigger?: string;
  source: string;
  filePath: string;
}

export interface AgentInfo {
  name: string;
  displayName: string;
  description: string;
  triggerScenario?: string;
  source: string;
  filePath: string;
}

export interface MarketplaceInfo {
  name: string;
  source: MarketplaceSource;
  installLocation: string;
  lastUpdated: string;
  pluginCount?: number;
  status: 'active' | 'error';
}
```

---

## 测试计划

### 功能测试

1. **能力总览 - Commands**
   - [ ] 显示所有项目级 commands
   - [ ] 显示所有系统级 commands
   - [ ] 正确区分来源
   - [ ] 复制命令功能正常
   - [ ] 空状态显示正确

2. **能力总览 - Skills**
   - [ ] 显示所有项目级 skills
   - [ ] 显示所有系统级 skills
   - [ ] 正确解析 YAML frontmatter
   - [ ] 显示触发条件

3. **Marketplace 管理**
   - [ ] 添加 GitHub marketplace
   - [ ] 添加本地 marketplace
   - [ ] 删除 marketplace
   - [ ] 刷新 marketplace
   - [ ] 错误处理（无效 URL、网络错误）

### 用户体验测试

1. **小白用户测试**
   - [ ] 能否理解系统级 vs 项目级的区别
   - [ ] 能否找到并使用能力总览
   - [ ] 能否成功安装和使用插件

2. **流程测试**
   - [ ] 添加 marketplace → 安装插件 → 查看能力 → 使用命令
   - [ ] 完整流程无障碍

---

## 版本历史

- **v1.0 (2025-11-25)**: 初始版本，定义改进计划和实现路线图
- **v1.1 (2025-11-28)**:
  - 新增：问题6 - 使用统计界面性能问题分析和优化方案
  - 更新：问题3 - Marketplace 源管理功能详细设计
  - 新增：第五阶段实施计划 - 性能优化任务清单
  - 更新：优先级总结，将性能优化提升为 P0 关键任务

---

## 附录：相关文件

- `PROJECT_LEVEL_PLUGINS_DESIGN.md` - 项目级插件系统技术设计
- `PROJECT_PLUGINS_USAGE.md` - 项目插件使用指南
- `CLAUDE.md` - 项目架构文档

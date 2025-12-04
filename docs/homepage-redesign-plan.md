# Plugin即Agent - 简化首页设计方案

## 设计理念

基于"Plugin即Agent"的核心理念，将首页重新设计为双入口模式。**Agent是一个概念**，指的是配置了特定Plugin的Claude Code工作环境，而不是新的数据模型。用户可以通过两种方式开始对话：

1. **选择Plugin（CC Agents）** - 选择一个插件，系统自动在固定工作区启动对话
2. **选择目录（CC Projects）** - 手动选择项目目录，保持现有工作流

**核心原则**：最小化后端改动，充分利用现有Plugin系统，通过UI重构实现新的用户体验。

## 用户需求总结

1. **双入口首页**：参考欢迎页面设计，提供"CC Agents"和"CC Projects"两个入口
2. **Plugin即Agent（概念）**：选择Plugin后，工作区即具备该Plugin能力，成为一个"Agent"
3. **固定工作区映射**：每个Plugin对应一个固定工作区（~/Documents/Claude-Workspaces/{plugin-name}/）
4. **简化架构**：不引入新的数据模型，直接使用现有Plugin系统
5. **保留传统方式**：通过"CC Projects"保持现有的项目选择工作流

## 核心架构变更

### 1. 数据来源：直接使用现有Plugin数据

**无需新建数据模型**，直接读取现有文件：

1. **已安装Plugin列表**：`~/.claude/plugins/installed_plugins.json`
   ```json
   {
     "plugins": {
       "document-skills@anthropic-agent-skills": {
         "version": "unknown",
         "installedAt": "2025-11-24T07:52:17.048Z",
         "installPath": "C:\\Users\\A\\.claude\\plugins\\marketplaces\\anthropic-agent-skills\\"
       }
     }
   }
   ```

2. **Plugin详细信息**：`{installPath}/.claude-plugin/marketplace.json`
   ```json
   {
     "plugins": [
       {
         "name": "document-skills",
         "description": "Collection of document processing suite...",
         "skills": ["./document-skills/xlsx", ...]
       }
     ]
   }
   ```

**新建文件**: `src/lib/pluginReader.ts` (~100行)

简单的Plugin数据读取工具：

```typescript
export interface PluginCard {
  id: string;                    // 例如: "document-skills@anthropic-agent-skills"
  name: string;                  // 例如: "document-skills"
  description: string;           // 从marketplace.json读取
  installPath: string;           // 安装路径
  workspacePath: string;         // 固定映射的工作区路径
}

export async function loadInstalledPlugins(): Promise<PluginCard[]> {
  // 1. 读取 installed_plugins.json
  const installed = await api.readInstalledPlugins();

  // 2. 为每个plugin读取marketplace.json获取描述
  const cards: PluginCard[] = [];
  for (const [id, info] of Object.entries(installed.plugins)) {
    const marketplace = await api.readMarketplaceJson(info.installPath);
    const pluginInfo = marketplace.plugins.find(p => id.startsWith(p.name));

    cards.push({
      id,
      name: pluginInfo?.name || id.split('@')[0],
      description: pluginInfo?.description || '暂无描述',
      installPath: info.installPath,
      workspacePath: getPluginWorkspacePath(id), // ~/Documents/Claude-Workspaces/{plugin-name}/
    });
  }

  return cards;
}

function getPluginWorkspacePath(pluginId: string): string {
  const pluginName = pluginId.split('@')[0]; // "document-skills@anthropic-agent-skills" → "document-skills"
  return path.join(os.homedir(), 'Documents', 'Claude-Workspaces', pluginName);
}
```

### 2. 后端层：最小化改动

**无需新建Rust模块**，充分利用现有功能：

**修改文件**: `src/lib/api.ts` (添加约50行)

添加简单的辅助方法：

```typescript
// 在api对象中添加

/**
 * 读取已安装的plugins列表
 */
async readInstalledPlugins(): Promise<any> {
  const pluginsJsonPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
  const content = await invoke<string>("read_file", { path: pluginsJsonPath });
  return JSON.parse(content);
},

/**
 * 读取marketplace.json获取plugin描述
 */
async readMarketplaceJson(installPath: string): Promise<any> {
  const marketplacePath = path.join(installPath, '.claude-plugin', 'marketplace.json');
  const content = await invoke<string>("read_file", { path: marketplacePath });
  return JSON.parse(content);
},

/**
 * 确保Plugin工作区存在（不存在则创建）
 * @param pluginName - 例如 "document-skills"
 * @returns 工作区完整路径
 */
async ensurePluginWorkspace(pluginName: string): Promise<string> {
  const workspacePath = path.join(
    os.homedir(),
    'Documents',
    'Claude-Workspaces',
    pluginName
  );

  // 检查目录是否存在
  const exists = await invoke<boolean>("path_exists", { path: workspacePath });

  if (!exists) {
    // 创建目录
    await invoke("create_directory", { path: workspacePath });
  }

  return workspacePath;
},

/**
 * 在Plugin工作区中创建.claude符号链接
 * @param pluginInstallPath - Plugin安装路径
 * @param workspacePath - 工作区路径
 */
async setupPluginInWorkspace(pluginInstallPath: string, workspacePath: string): Promise<void> {
  const claudeDir = path.join(workspacePath, '.claude');
  const pluginsDir = path.join(claudeDir, 'plugins');

  // 创建.claude/plugins目录
  await invoke("create_directory", { path: pluginsDir });

  // 创建符号链接（或复制）
  const pluginName = path.basename(pluginInstallPath);
  const linkTarget = path.join(pluginsDir, pluginName);

  await invoke("create_symlink", {
    source: pluginInstallPath,
    target: linkTarget
  });
},
```

**后端需要的简单命令**（可能已经存在，或很容易添加）：

```rust
// 在现有commands中添加（如果不存在）

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_symlink(source: String, target: String) -> Result<(), String> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&source, &target).map_err(|e| e.to_string())
    }
    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_dir(&source, &target).map_err(|e| e.to_string())
    }
}
```

### 3. 前端组件：UI重构

**新建文件**: `src/components/WelcomeHome.tsx` (~200行)

双入口欢迎页（参考截图设计）：

```typescript
export const WelcomeHome: React.FC<{
  onNavigateTo: (view: 'agents' | 'projects') => void;
}> = ({ onNavigateTo }) => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-12">
        {/* 标题 */}
        <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
          <span className="text-primary">●</span>
          Welcome to Claude Workbench
        </h1>

        {/* 两个入口卡片 */}
        <div className="grid grid-cols-2 gap-8 max-w-4xl">
          {/* CC Agents */}
          <div
            className="welcome-card group cursor-pointer p-12 rounded-2xl border-2 border-border hover:border-primary transition-all"
            onClick={() => onNavigateTo('agents')}
          >
            <div className="flex flex-col items-center gap-6">
              <div className="text-6xl">🤖</div>
              <h2 className="text-2xl font-semibold">CC Agents</h2>
              <p className="text-muted-foreground text-center">
                选择一个插件，开启专属Agent对话
              </p>
            </div>
          </div>

          {/* CC Projects */}
          <div
            className="welcome-card group cursor-pointer p-12 rounded-2xl border-2 border-border hover:border-primary transition-all"
            onClick={() => onNavigateTo('projects')}
          >
            <div className="flex flex-col items-center gap-6">
              <div className="text-6xl">📁</div>
              <h2 className="text-2xl font-semibold">CC Projects</h2>
              <p className="text-muted-foreground text-center">
                选择项目目录，继续现有工作
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**新建文件**: `src/components/PluginCard.tsx` (~100行)

Plugin卡片组件：

```typescript
interface PluginCardProps {
  plugin: PluginCard;
  onClick: () => void;
}

export const PluginCard: React.FC<PluginCardProps> = ({ plugin, onClick }) => {
  return (
    <div
      className="group relative rounded-xl border border-border/60 bg-card/60 p-6 hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Plugin图标 */}
      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/10 mb-4">
        <Package className="h-6 w-6 text-blue-600" />
      </div>

      {/* Plugin名称 */}
      <h3 className="font-semibold text-lg mb-2 truncate" title={plugin.name}>
        {plugin.name}
      </h3>

      {/* 描述 */}
      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 min-h-[3.6rem]">
        {plugin.description}
      </p>

      {/* 开始按钮 */}
      <Button
        size="sm"
        className="w-full group-hover:bg-primary group-hover:text-primary-foreground"
        variant="outline"
      >
        开始对话
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};
```

**新建文件**: `src/components/PluginLibrary.tsx` (~200行)

Plugin库视图：

```typescript
export const PluginLibrary: React.FC<{
  onBack: () => void;
  onPluginSelect: (plugin: PluginCard) => void;
}> = ({ onBack, onPluginSelect }) => {
  const [plugins, setPlugins] = useState<PluginCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const cards = await loadInstalledPlugins();
      setPlugins(cards);
    } catch (err) {
      console.error("Failed to load plugins:", err);
    } finally {
      setLoading(false);
    }
  };

  // 搜索过滤
  const filteredPlugins = useMemo(() => {
    if (!searchQuery.trim()) return plugins;
    const query = searchQuery.toLowerCase();
    return plugins.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    );
  }, [plugins, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* 返回按钮 + 标题 */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Agent 库</h1>
            <p className="text-sm text-muted-foreground mt-1">
              选择一个插件，自动创建专属工作空间
            </p>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索插件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Plugin网格 */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(6)].map((_, i) => <PluginCardSkeleton key={i} />)}
          </div>
        ) : filteredPlugins.length === 0 ? (
          <EmptyPluginState searchQuery={searchQuery} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPlugins.map(plugin => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onClick={() => onPluginSelect(plugin)}
              />
            ))}
          </div>
        )}

        {/* 统计 */}
        <div className="mt-6 text-sm text-muted-foreground">
          {filteredPlugins.length} 个可用插件
        </div>
      </div>
    </div>
  );
};
```

### 4. App.tsx集成

**修改文件**: `src/App.tsx`

添加新的View类型和状态：

```typescript
// 修改View类型，添加'welcome'和'plugin-library'
type View = "welcome" | "plugin-library" | "projects" | "editor" | "claude-code-session" | ...;

// 在AppContent组件中添加状态
const [homeView, setHomeView] = useState<'welcome' | 'plugin-library' | 'projects'>('welcome');
```

重写首页case（简化版）：

```typescript
case "welcome":
  return (
    <WelcomeHome
      onNavigateTo={(target) => {
        if (target === 'agents') {
          setView('plugin-library');
        } else {
          setHomeView('projects');
          setView('projects');
        }
      }}
    />
  );

case "plugin-library":
  return (
    <PluginLibrary
      onBack={() => setView('welcome')}
      onPluginSelect={handlePluginSelect}
    />
  );

case "projects":
  // 保持现有的项目列表视图
  // ... 现有代码不变
```

实现Plugin选择处理（极简版）：

```typescript
const handlePluginSelect = async (plugin: PluginCard) => {
  try {
    // 1. 确保工作区存在
    const workspacePath = await api.ensurePluginWorkspace(plugin.name);

    // 2. 在工作区中设置plugin链接
    await api.setupPluginInWorkspace(plugin.installPath, workspacePath);

    // 3. 启动会话
    setSelectedSession(null);
    setNewSessionProjectPath(workspacePath);
    handleViewChange("claude-tab-manager");

    setToast({
      message: `已进入 ${plugin.name} 工作空间`,
      type: "success",
    });
  } catch (err) {
    console.error("Failed to setup plugin workspace:", err);
    setToast({
      message: "工作空间设置失败",
      type: "error",
    });
  }
};
```

**就这么简单！** 无需复杂的状态管理，无需工作空间选择对话框，无需配置页面。

### 5. 工作区结构

Plugin选择后，自动在固定路径创建工作区：

```
~/Documents/Claude-Workspaces/
├── document-skills/          # document-skills@anthropic-agent-skills 的工作区
│   ├── .claude/
│   │   └── plugins/
│   │       └── anthropic-agent-skills/  -> 符号链接到 ~/.claude/plugins/marketplaces/anthropic-agent-skills/
│   └── (用户创建的文件和会话)
├── example-skills/           # example-skills@anthropic-agent-skills 的工作区
│   ├── .claude/
│   │   └── plugins/
│   │       └── anthropic-agent-skills/  -> 符号链接
│   └── (用户创建的文件和会话)
└── ... (其他plugin的工作区)
```

**优势**：
1. 每个Plugin一个固定工作区，简单直观
2. 工作区间相互独立，不会混淆
3. 通过符号链接复用Plugin，节省空间
4. Claude CLI自动识别工作区中的Plugin配置

## 实施步骤（简化版）

### Phase 1: 后端基础命令 (优先级: 高)

**目标**: 添加文件读取和目录操作的基础命令

1. 在 `src-tauri/src/main.rs` 中添加/注册命令：
   - `read_file` - 读取文件内容
   - `path_exists` - 检查路径是否存在
   - `create_directory` - 创建目录
   - `create_symlink` - 创建符号链接

2. 测试这些命令的跨平台兼容性（Windows/macOS/Linux）

**预计时间**: 0.5天

### Phase 2: 数据读取层 (优先级: 高)

**目标**: 从现有Plugin文件中读取数据

1. 创建 `src/lib/pluginReader.ts`
2. 实现 `loadInstalledPlugins()` 函数
3. 在 `src/lib/api.ts` 中添加辅助方法（约50行）：
   - `readInstalledPlugins()`
   - `readMarketplaceJson()`
   - `ensurePluginWorkspace()`
   - `setupPluginInWorkspace()`

**预计时间**: 0.5天

### Phase 3: UI组件开发 (优先级: 中)

**目标**: 创建三个核心组件

1. 创建 `src/components/WelcomeHome.tsx` (~200行)
   - 双入口欢迎页
2. 创建 `src/components/PluginCard.tsx` (~100行)
   - Plugin卡片
3. 创建 `src/components/PluginLibrary.tsx` (~200行)
   - Plugin库视图
4. 添加骨架加载和空状态组件

**预计时间**: 1天

### Phase 4: App集成 (优先级: 中)

**目标**: 整合新组件到App.tsx

1. 修改 `src/App.tsx`：
   - 添加 `'welcome'` 和 `'plugin-library'` 到View类型
   - 添加对应的case处理
   - 实现 `handlePluginSelect` 函数（~20行）
2. 修改默认视图为 `'welcome'`
3. 保持现有 `'projects'` case不变

**预计时间**: 0.5天

### Phase 5: 测试和优化 (优先级: 低)

**目标**: 确保功能正常，用户体验流畅

1. 功能测试：
   - Plugin列表正确加载
   - 工作区自动创建
   - 符号链接正确建立
   - 会话正常启动
2. 跨平台测试（Windows/macOS/Linux）
3. 错误处理和用户反馈优化
4. 性能优化（如果Plugin很多）

**预计时间**: 0.5天

**总预计时间**: 3天

## 关键文件清单（简化版）

### 需要新建的文件（共4个）

1. **`src/lib/pluginReader.ts`** (~100行)
   - 读取installed_plugins.json
   - 读取marketplace.json
   - 组装PluginCard数据

2. **`src/components/WelcomeHome.tsx`** (~200行)
   - 双入口欢迎页
   - "CC Agents" 和 "CC Projects" 卡片

3. **`src/components/PluginCard.tsx`** (~100行)
   - Plugin卡片UI组件

4. **`src/components/PluginLibrary.tsx`** (~200行)
   - Plugin列表和搜索
   - 调用pluginReader加载数据

### 需要修改的文件（共2个）

1. **`src/App.tsx`** (添加~80行)
   - 添加 `'welcome'` 和 `'plugin-library'` 视图
   - 添加 `handlePluginSelect` 函数
   - 修改默认视图

2. **`src/lib/api.ts`** (添加~50行)
   - `readInstalledPlugins()`
   - `readMarketplaceJson()`
   - `ensurePluginWorkspace()`
   - `setupPluginInWorkspace()`

### 可能需要添加的后端命令（如果不存在）

在 `src-tauri/src/main.rs` 中添加4个简单命令（约30行Rust代码）：
- `read_file`
- `path_exists`
- `create_directory`
- `create_symlink`

## UI/UX流程（简化版）

### 方式一：通过Plugin（CC Agents）开始对话

```
1. 用户启动应用
   ↓
2. 显示欢迎页（Welcome to Claude Workbench）
   - 左侧：CC Agents（🤖）
   - 右侧：CC Projects（📁）
   ↓
3. 用户点击"CC Agents"
   ↓
4. 进入Plugin库页面
   - 显示所有已安装的Plugin卡片
   - 每个卡片显示：名称、描述、"开始对话"按钮
   - 提供搜索框
   ↓
5. 用户点击某个Plugin（如"document-skills"）
   ↓
6. 系统后台操作（用户无感）：
   - 检查 ~/Documents/Claude-Workspaces/document-skills/ 是否存在
   - 不存在则创建该目录
   - 在该目录下创建 .claude/plugins/ 并创建符号链接
   ↓
7. 启动会话
   - 自动切换到claude-tab-manager视图
   - 工作目录：~/Documents/Claude-Workspaces/document-skills/
   - Plugin能力自动可用（Excel、Word、PDF等）
   ↓
8. 用户开始对话，享受document-skills的所有能力
```

### 方式二：通过项目目录（CC Projects）开始对话

```
1. 用户启动应用 → 显示欢迎页
   ↓
2. 用户点击"CC Projects"
   ↓
3. 进入现有的项目列表页面（保持不变）
   - 显示所有已有项目
   - 显示运行中的会话
   - "新建项目会话"按钮
   ↓
4. 用户选择项目或新建项目
   ↓
5. 启动会话（与现在完全相同）
```

### Plugin搜索流程

```
1. 在Plugin库页面输入搜索关键词（如"document"）
   ↓
2. 实时过滤，只显示名称或描述包含"document"的Plugin
   ↓
3. 显示搜索结果统计（如"找到2个插件"）
   ↓
4. 点击搜索结果中的Plugin，继续上述工作流
```

## 技术挑战与解决方案（简化版）

### 挑战1: 符号链接的跨平台兼容性

**问题**: Windows、macOS、Linux创建符号链接的方式不同

**解决方案**:
```rust
#[tauri::command]
pub fn create_symlink(source: String, target: String) -> Result<(), String> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&source, &target)
            .map_err(|e| e.to_string())
    }
    #[cfg(windows)]
    {
        // Windows使用Junction Point（不需要管理员权限）
        std::os::windows::fs::symlink_dir(&source, &target)
            .map_err(|e| e.to_string())
    }
}
```

### 挑战2: 读取marketplace.json可能失败

**问题**: 某些Plugin可能没有marketplace.json文件

**解决方案**:
- 使用try-catch处理，失败时使用降级方案
- 降级方案：从Plugin ID中提取名称，使用"暂无描述"
```typescript
const pluginInfo = marketplace?.plugins.find(p => id.startsWith(p.name));
const description = pluginInfo?.description || '暂无描述';
```

### 挑战3: 向后兼容性

**问题**: 现有项目不受影响，新旧工作流并存

**解决方案**:
- "CC Projects" 入口保持现有逻辑完全不变
- 新的Plugin工作区只是另一种创建项目的方式
- 两种方式创建的项目在系统中无差别
- 用户可以自由选择使用哪种方式

## 视觉设计规范（基于参考截图）

### 欢迎页布局

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                                                        │
│              ● Welcome to Claude Workbench             │
│                                                        │
│                                                        │
│         ┌────────────────┐    ┌────────────────┐      │
│         │                │    │                │      │
│         │      🤖        │    │      📁        │      │
│         │                │    │                │      │
│         │   CC Agents    │    │  CC Projects   │      │
│         │                │    │                │      │
│         │  选择一个插件   │    │  选择项目目录   │      │
│         │  开启专属Agent  │    │  继续现有工作   │      │
│         │                │    │                │      │
│         └────────────────┘    └────────────────┘      │
│                                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**设计要点**：
- 居中布局，大标题
- 两个大卡片，等宽，hover有边框高亮效果
- 卡片内：大图标 + 标题 + 简短说明
- 简洁优雅，符合欢迎页气质

### Plugin库页面布局

```
┌────────────────────────────────────────────────────────┐
│  [←]  Agent 库                                         │
│       选择一个插件，自动创建专属工作空间                    │
│                                                        │
│  [🔍 搜索插件...]                                       │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  📦      │  │  📦      │  │  📦      │  │  📦    │ │
│  │document- │  │example-  │  │web-fetch │  │skill-  │ │
│  │skills    │  │skills    │  │          │  │creator │ │
│  │          │  │          │  │          │  │        │ │
│  │文档处理套  │  │示例技能集 │  │网页抓取   │  │技能创建│ │
│  │件...     │  │合...     │  │工具...   │  │工具... │ │
│  │          │  │          │  │          │  │        │ │
│  │[开始对话] │  │[开始对话] │  │[开始对话] │  │[开始对话]│ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│                                                        │
│  4 个可用插件                                           │
└────────────────────────────────────────────────────────┘
```

**设计要点**：
- 返回按钮 + 标题 + 说明
- 搜索框
- 网格布局（4列，响应式）
- 每个Plugin卡片：图标 + 名称 + 描述 + 按钮
- 底部显示统计信息

### Plugin卡片设计

- **尺寸**: 响应式，建议260-300px宽
- **边框**: `border border-border/60`，hover时 `border-primary/40`
- **背景**: `bg-card/60`，hover时 `bg-card/80`
- **图标**: 蓝色Package图标，`bg-blue-500/10`背景
- **排版**:
  - 名称: `font-semibold text-lg`
  - 描述: `text-sm text-muted-foreground line-clamp-3`
  - 按钮: 全宽，`variant="outline"`
- **Hover效果**: 平滑过渡，边框颜色变化

## 测试清单（简化版）

### 功能测试

- [ ] 欢迎页正确显示，两个入口卡片可点击
- [ ] 点击"CC Agents"进入Plugin库页面
- [ ] 点击"CC Projects"进入现有项目列表页面
- [ ] Plugin列表正确加载（从installed_plugins.json和marketplace.json）
- [ ] Plugin搜索功能正常工作
- [ ] 点击Plugin卡片后：
  - [ ] 工作区目录正确创建（如果不存在）
  - [ ] .claude/plugins符号链接正确创建
  - [ ] 会话成功启动
  - [ ] Plugin能力在会话中可用
- [ ] 向后兼容：通过"CC Projects"创建的项目正常工作
- [ ] 返回按钮正常工作（Plugin库 → 欢迎页）

### 跨平台测试

- [ ] **Windows**:
  - [ ] Junction Point正确创建
  - [ ] 工作区路径格式正确（C:\Users\...\Documents\Claude-Workspaces\）
- [ ] **macOS**:
  - [ ] 符号链接正确创建
  - [ ] 工作区路径格式正确（~/Documents/Claude-Workspaces/）
- [ ] **Linux**:
  - [ ] 符号链接正确创建
  - [ ] 工作区路径格式正确（~/Documents/Claude-Workspaces/）

### 边界情况测试

- [ ] 没有安装任何Plugin时的空状态显示
- [ ] marketplace.json不存在或格式错误时的降级处理
- [ ] 工作区已存在时正确复用（不重复创建）
- [ ] 符号链接已存在时的处理

## 总结

本实施计划提供了一个**极简的Plugin即Agent**首页重新设计方案，核心理念：

### 关键特性

1. **Plugin即Agent（概念）**: 不创建新数据模型，Plugin + 工作区 = Agent
2. **双入口设计**: CC Agents（Plugin驱动） + CC Projects（目录驱动）
3. **固定工作区映射**: 每个Plugin对应一个固定目录，简单直观
4. **最小化后端改动**: 只添加4个基础命令，充分利用现有Plugin系统
5. **完全向后兼容**: 现有项目工作流不受任何影响

### 实施规模

- **新建文件**: 4个前端文件（~600行代码）
- **修改文件**: 2个文件（App.tsx + api.ts，~130行代码）
- **后端改动**: 可能需要添加4个简单命令（~30行Rust代码）
- **预计时间**: **3天**

### 技术优势

- 不引入复杂的状态管理
- 不需要数据库或持久化映射
- 不需要工作区选择对话框
- 不需要配置页面
- 充分利用Claude CLI现有的Plugin识别机制

这是一个**轻量、高效、易维护**的解决方案，完美契合"Plugin即Agent"的设计理念。

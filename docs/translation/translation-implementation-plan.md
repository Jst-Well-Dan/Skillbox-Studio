# Claude Workbench 沉浸式翻译功能实现计划

## 📋 需求概述

为 Claude Workbench 添加基于 Zhipu AI GLM-4-Flash 的**按需翻译**功能，支持：

### 核心需求
1. **翻译范围**：
   - Claude 的回复消息（包括思考过程）
   - 插件/技能/代理的英文描述
   - 系统消息和提示
   - 工具调用说明

2. **交互设计**：
   - 默认显示英文原文 + 小徽章"译"
   - 点击"译"徽章 → 翻译整个页面的英文内容为中文
   - 翻译后显示中文 + "原文"徽章
   - 点击"原文"徽章 → 切换回英文原文

3. **配置管理**：
   - 用户在设置中配置 Zhipu API Key
   - 支持测试连接验证配置
   - 缓存机制减少重复翻译成本

## 🎯 技术方案选型

### 方案架构：混合翻译架构

**后端翻译（Rust）：**
- 插件/技能/代理描述（一次性内容）
- API 调用封装和缓存管理
- 性能优化（批量翻译、缓存机制）

**前端翻译（React）：**
- Claude 消息流式内容（实时翻译）
- 双语显示 UI 组件
- 翻译状态管理

### 核心优势
1. **后端翻译**：减少重复翻译，统一缓存，降低成本
2. **前端翻译**：支持流式消息实时翻译，灵活的 UI 控制
3. **智能缓存**：避免重复翻译相同内容，提升性能

---

## 📐 架构设计

### 用户交互流程

```
用户在设置中配置 Zhipu API Key
    ↓
保存到 ~/.claude/settings.json
    {
      "translation": {
        "zhipu_api_key": "xxx",
        "api_base_url": "https://open.bigmodel.cn/api/paas/v4",
        "model": "GLM-4-Flash",
        "cache_ttl_seconds": 86400
      }
    }
    ↓
用户浏览内容（Claude 消息、插件描述等）
    ↓
检测到英文内容 → 显示"译"徽章
    ↓
用户点击"译"徽章
    ↓
【页面级批量翻译流程】
    ↓
收集当前页面所有英文内容
  - Claude 消息内容
  - 插件/技能/代理描述
  - 系统消息
  - 工具说明
    ↓
调用 api.batchTranslate(texts[])
    ↓ [Tauri IPC]
后端处理:
  1. 检查缓存（SHA256 哈希）
  2. 分离已缓存和未缓存内容
  3. 批量调用 Zhipu API（未缓存部分）
  4. 合并结果并更新缓存
  5. 返回所有翻译结果
    ↓ [Tauri IPC]
前端更新:
  - 替换英文为中文
  - 徽章变为"原文"
  - 保存翻译状态到组件 state
    ↓
用户点击"原文"徽章
    ↓
恢复英文原文显示
徽章变回"译"
```

---

## 📅 实施步骤

### 第 1 步：后端翻译服务（1.5-2小时）

**目标**：实现批量翻译 API 和持久化缓存

- [ ] 扩展 `src-tauri/src/commands/translator.rs`
  - [ ] 添加持久化缓存机制（`~/.claude/translation_cache.json`）
  - [ ] 实现 `batch_translate()` 函数（批量翻译）
  - [ ] 添加 SHA256 缓存键生成
  - [ ] 优化 API 调用（减少重复翻译）

- [ ] 添加新的 Tauri commands
  - [ ] `translate_text(text: String)` - 单文本翻译
  - [ ] `batch_translate(texts: Vec<String>)` - 批量翻译
  - [ ] `get_translation_config()` - 获取配置
  - [ ] `update_translation_config(config)` - 更新配置

- [ ] 在 `main.rs` 中注册新 commands

**验收标准**：能够通过前端调用批量翻译 API，结果正确缓存

---

### 第 2 步：设置界面（30分钟）

**目标**：允许用户配置 Zhipu API Key

- [ ] 修改 `src/components/Settings.tsx`
  - [ ] TabsList 改为 4 列
  - [ ] 添加"翻译"标签页（TabsContent）
  - [ ] 添加 API Key 输入框（密码类型）
  - [ ] 添加"测试连接"按钮
  - [ ] 添加缓存时长配置（可折叠）

- [ ] 实现配置保存逻辑
  - [ ] 调用 `api.updateTranslationConfig()`
  - [ ] 显示保存成功提示

**验收标准**：用户可以输入 API Key 并保存，重启后配置保留

---

### 第 3 步：翻译徽章组件（1小时）

**目标**：创建核心交互组件

- [ ] 创建 `src/components/TranslationBadge.tsx`
  - [ ] 三种状态：未翻译、翻译中、已翻译
  - [ ] 点击切换功能
  - [ ] 加载动画

- [ ] 创建 `src/hooks/usePageTranslation.ts`
  - [ ] `registerItem()` - 注册需翻译的内容
  - [ ] `translateAll()` - 批量翻译
  - [ ] `toggleTranslation()` - 切换翻译/原文
  - [ ] `getDisplayText()` - 获取显示文本

- [ ] 修改 `src/lib/api.ts`
  - [ ] 添加 `TranslationConfig` 接口
  - [ ] 添加 `batchTranslate()` 方法

**验收标准**：徽章能正确显示状态，点击后触发翻译

---

### 第 4 步：会话页面集成（1小时）

**目标**：在 Claude 消息页面添加翻译功能

- [ ] 修改 `src/components/ClaudeCodeSession.tsx`
  - [ ] 导入 `TranslationBadge` 和 `usePageTranslation`
  - [ ] 在顶部工具栏添加徽章
  - [ ] 提供翻译上下文（PageTranslationContext）

- [ ] 修改 `src/components/message/MessageContent.tsx`
  - [ ] 添加 `messageId` prop
  - [ ] 使用 `usePageTranslation` 注册内容
  - [ ] 根据翻译状态显示原文/译文

- [ ] 修改 `src/components/message/AIMessage.tsx`
  - [ ] 传递 `messageId` 到 MessageContent
  - [ ] 支持思考块翻译

**验收标准**：点击徽章后，页面所有 Claude 消息翻译为中文，再次点击恢复原文

---

### 第 5 步：插件内容翻译（45分钟）

**目标**：插件、技能、代理描述支持翻译

- [ ] 修改 `src/components/ProjectPluginManager.tsx`
  - [ ] 添加 TranslationBadge 到标题栏
  - [ ] 使用 `usePageTranslation` Hook
  - [ ] 注册命令/技能/代理描述

- [ ] 修改 `src/components/ClaudeExtensionsManager.tsx`
  - [ ] 添加 TranslationBadge
  - [ ] 注册插件/技能/代理描述

- [ ] 修改 `src/components/PluginCard.tsx`
  - [ ] 根据翻译状态显示描述

**验收标准**：插件库和项目能力页面可以一键翻译所有英文描述

---

### 第 6 步：测试和优化（1小时）

**功能测试**
- [ ] API Key 配置测试（有效/无效）
- [ ] 缓存机制测试（刷新页面后使用缓存）
- [ ] 批量翻译测试（多条消息同时翻译）
- [ ] 切换测试（原文<->译文）

**性能测试**
- [ ] 大量消息翻译（50+ 条）
- [ ] API 调用次数验证（应有缓存）
- [ ] 翻译速度（批量 vs 单条）

**错误处理测试**
- [ ] API Key 未配置
- [ ] 网络错误
- [ ] API 限流

**成本优化**
- [ ] 验证缓存命中率
- [ ] 检查重复翻译
- [ ] 调整批量大小（避免超时）

**验收标准**：所有测试通过，无明显性能问题，缓存有效

---

**总计：约 5.5-6 小时开发时间**

---

## 🎨 UI 设计细节

### 翻译徽章位置

**会话页面（ClaudeCodeSession）**
```
┌─────────────────────────────────────────────┐
│  [返回] [模型:Sonnet] [Plan模式] ... [译]  │ ← 右上角
├─────────────────────────────────────────────┤
│                                             │
│  消息列表...                                │
│                                             │
└─────────────────────────────────────────────┘
```

**插件管理页面（ProjectPluginManager / ClaudeExtensionsManager）**
```
┌─────────────────────────────────────────────┐
│  插件库          [刷新] [译]                │ ← 标题栏右侧
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────┐           │
│  │ Plugin Name                 │           │
│  │ Description in English...   │           │
│  └─────────────────────────────┘           │
└─────────────────────────────────────────────┘
```

### 徽章状态变化

**未翻译状态**
```
[译] ← 灰色底，鼠标悬停高亮
```

**翻译中状态**
```
[⏳ 翻译中...] ← 加载动画
```

**已翻译状态**
```
[原文] ← 边框样式，点击可切换
```

---

## 📋 开发检查清单

### 准备工作
- [ ] 获取 Zhipu AI API Key（测试用）
- [ ] 熟悉 Tauri commands 机制
- [ ] 了解 React Context API 用法

### 核心文件清单

#### Rust 后端（2 个文件）
- [ ] `src-tauri/src/commands/translator.rs` - 翻译服务
- [ ] `src-tauri/src/main.rs` - 命令注册

#### React 前端（8 个文件）
- [ ] `src/components/Settings.tsx` - 设置界面
- [ ] `src/components/TranslationBadge.tsx` - 徽章组件（新建）
- [ ] `src/hooks/usePageTranslation.ts` - 翻译 Hook（新建）
- [ ] `src/components/ClaudeCodeSession.tsx` - 会话页面
- [ ] `src/components/message/MessageContent.tsx` - 消息内容
- [ ] `src/components/message/AIMessage.tsx` - AI 消息
- [ ] `src/components/ProjectPluginManager.tsx` - 项目能力
- [ ] `src/components/ClaudeExtensionsManager.tsx` - 扩展管理

### 配置文件
- [ ] `~/.claude/settings.json` - 添加 translation 配置
- [ ] `~/.claude/translation_cache.json` - 翻译缓存（自动生成）

---

## ✅ 验收标准

### 功能完整性
- [x] 用户可以在设置中配置 Zhipu API Key
- [x] 点击"译"徽章后，页面所有英文翻译为中文
- [x] 点击"原文"徽章后，恢复英文原文
- [x] 支持 Claude 消息、插件描述、系统消息翻译
- [x] 翻译结果正确缓存，刷新页面后使用缓存

### 性能要求
- [x] 50 条消息首次翻译 < 10 秒
- [x] 缓存命中时翻译 < 1 秒
- [x] 批量翻译减少 90% API 调用
- [x] 页面无卡顿、无阻塞

### 用户体验
- [x] 徽章状态清晰（未翻译/翻译中/已翻译）
- [x] 翻译失败时显示原文，不影响使用
- [x] API Key 未配置时不影响正常浏览
- [x] 错误提示友好，不打扰用户

---

## 🎯 关键技术决策总结

### 为什么选择"按需翻译"而非"自动翻译"？

1. **成本控制**：避免不必要的 API 调用，用户按需付费
2. **用户掌控**：用户决定何时翻译，避免误翻译
3. **性能优化**：不阻塞初始加载，页面响应更快
4. **错误友好**：未配置 API Key 时不影响正常使用

### 为什么使用"页面级翻译"而非"单条翻译"？

1. **批量优化**：一次 API 调用翻译多条内容，减少请求次数
2. **一致体验**：整个页面统一切换，避免混乱
3. **状态简单**：只需一个全局开关，不需要管理每条状态
4. **缓存友好**：翻译后的内容可以复用

### 为什么 Hook 使用 Map 而非数组？

1. **快速查找**：O(1) 查找性能，适合大量消息
2. **唯一性保证**：messageId 作为 key 避免重复
3. **增量更新**：只更新变化的项，不重新计算整个列表

---

## 📊 预期效果

实施完成后，用户体验将得到显著提升：

### 用户场景 1：浏览 Claude 回复
```
1. 用户提问，Claude 用英文回复
2. 用户点击右上角"译"徽章
3. 3-5 秒后，所有英文消息变为中文
4. 点击"原文"徽章可切换回英文
```

### 用户场景 2：查看插件描述
```
1. 用户打开插件库，看到英文描述
2. 点击"译"徽章
3. 所有插件描述瞬间变为中文（缓存命中）
4. 用户快速理解插件功能
```

### 性能指标
- **首次翻译**：50 条消息约 8-10 秒
- **缓存翻译**：50 条消息约 < 500ms
- **API 调用减少**：90%+（缓存命中率）
- **内存占用**：< 5MB（缓存数据）

---

**方案制定完成！准备进入实施阶段。**

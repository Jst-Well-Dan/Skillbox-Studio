# 交互式提问功能测试指南

本文档提供 AskUserQuestion 功能的测试场景和使用说明。

## 📋 功能概述

AskUserQuestion 是 Claude Code 的交互式提问工具，允许 Claude 在执行过程中向用户提出问题，获取选择后再继续执行。本 GUI 实现了完整的交互式 UI，包括：

- ✅ 单选和多选问题支持
- ✅ 向导式多问题流程
- ✅ 键盘导航（↑↓ 箭头、Enter、Tab、Esc）
- ✅ 进度条和问题计数
- ✅ 流畅的动画效果
- ✅ 内联显示在消息流中

## 🎯 测试场景

### 1. **多方案选择类**

**提示词示例：**
```
帮我优化这个项目的性能
```

**可能触发的问题：**
- 优先优化什么？（前端渲染 / 后端API / 数据库查询）
- 使用什么工具？（Profiler / Lighthouse / Chrome DevTools）

---

### 2. **技术栈选择类**

**提示词示例：**
```
帮我添加一个用户认证系统
```

**可能触发的问题：**
- 认证方式？（JWT / Session / OAuth）
- 存储方案？（Redis / Database / Memory）

---

### 3. **架构决策类**

**提示词示例：**
```
帮我重构这个组件的状态管理
```

**可能触发的问题：**
- 状态管理方案？（Context API / Redux / Zustand / Jotai）
- 复杂度级别？（简单 / 中等 / 复杂）

---

### 4. **功能配置类**

**提示词示例：**
```
添加暗黑模式功能
```

**可能触发的问题：**
- 主题切换方式？（系统跟随 / 手动切换 / 时间自动）
- 主题存储？（LocalStorage / Cookie / 用户设置）

---

## 📝 内置测试命令

项目包含一个专门的测试命令，可直接触发交互式提问：

### 使用方法

在 Claude 会话中输入：
```
/test-question
```

### 测试内容

1. **单选问题**：选择编程语言
   - JavaScript
   - Python
   - Rust
   - Go

2. **多选问题**：选择项目功能
   - 暗黑模式
   - 用户认证
   - 实时更新
   - 导出功能

### 文件位置
`.claude/commands/test-question.md`

---

## 🧪 自定义测试提示词

### 简单测试

```
使用 AskUserQuestion 工具问我两个问题：
1. 我喜欢什么颜色（单选：红色/蓝色/绿色）
2. 我想学什么技能（多选：编程/设计/写作/视频制作）
```

### 实际场景测试 1：数据导出

```
帮我实现一个数据导出功能，先问我：
1. 导出格式（单选：CSV/Excel/JSON/PDF）
2. 包含哪些字段（多选：用户名/邮箱/创建时间/最后登录）
```

### 实际场景测试 2：CI/CD 配置

```
帮我配置 CI/CD 流程，先询问：
1. 使用什么平台（单选：GitHub Actions/GitLab CI/Jenkins/CircleCI）
2. 需要哪些检查（多选：代码检查/单元测试/集成测试/构建/部署）
```

### 实际场景测试 3：组件库选择

```
帮我搭建前端项目，先问我：
1. UI 框架（单选：Ant Design/Material-UI/Chakra UI/Tailwind CSS）
2. 需要哪些组件（多选：表单/表格/图表/弹窗/导航）
```

---

## ⚡ 快速测试步骤

### 1. 启动应用

```bash
npm run tauri:dev
```

### 2. 创建或打开会话

- 点击"新建会话"或
- 从项目列表选择现有会话

### 3. 输入测试提示词

选择以下任一方式：
- `/test-question` （最简单直接）
- 上述任何自定义测试提示词
- 实际工作场景的提示词

### 4. 观察并验证 UI 表现

#### ✅ 应该看到的效果：

**视觉呈现：**
- 蓝色边框的问题卡片
- 问题标题和描述清晰显示
- 进度条显示当前问题进度（例如：问题 1 / 2）
- 问题序号标签（蓝色徽章）

**交互功能：**
- ↑↓ 箭头键：在选项间导航
- Enter 键：选择当前高亮选项
- Tab 键：跳转到下一题（非最后一题时）
- Esc 键：取消问题

**行为验证：**
- 单选模式：选择后自动跳转下一题（延迟 300ms）
- 多选模式：可选择多个选项，需手动点击"下一题"
- 最后一题显示"提交答案"按钮
- 提交后按钮显示"提交中..."状态

---

## 🔍 调试与故障排查

### 开启开发者工具

按 `F12` 打开浏览器开发者工具，切换到 Console 标签。

### 关键日志信息

**正常流程的日志：**

1. **检测到问题：**
   ```
   [AskUserQuestion] Detected interactive question: {toolUseId, questions: [...]}
   ```

2. **提交答案：**
   ```
   [QuestionPicker] Answer submitted successfully: {answers}
   ```

3. **取消问题：**
   ```
   [QuestionPicker] Question cancelled by user
   ```

### 常见问题排查

#### 问题 1: 问题 UI 没有显示

**检查清单：**
- [ ] Console 中是否有 `[AskUserQuestion] Detected...` 日志？
- [ ] 检查 Network 标签，Claude CLI 是否返回了 tool_use
- [ ] 检查 sessionId 是否正确传递到 AIMessage 组件

#### 问题 2: 点击"提交答案"没有反应

**检查清单：**
- [ ] Console 中是否有错误信息？
- [ ] 检查 `respondToQuestion` API 调用是否成功
- [ ] 检查后端日志（Rust 侧）是否接收到请求

#### 问题 3: 键盘导航不工作

**检查清单：**
- [ ] 当前焦点是否在问题卡片区域？
- [ ] 是否有其他键盘事件监听器冲突？
- [ ] Console 中是否有 JavaScript 错误？

---

## 🏗️ 技术实现细节

### 数据流

```
用户提示词
  ↓
Claude CLI 输出 JSONL（包含 AskUserQuestion tool_use）
  ↓
usePromptExecution 检测并解析 (src/hooks/usePromptExecution.ts:308-325)
  ↓
附加 pendingQuestion 到 message 对象
  ↓
AIMessage 组件接收并渲染 QuestionPicker (src/components/message/AIMessage.tsx)
  ↓
用户选择答案并提交
  ↓
调用 api.respondToQuestion() (src/lib/api.ts:903-921)
  ↓
Tauri IPC → respond_to_question 命令 (src-tauri/src/commands/claude/cli_runner.rs:653-708)
  ↓
写入 tool_result JSONL 到 Claude CLI stdin
  ↓
Claude 继续执行
```

### 关键文件

**前端：**
- **QuestionPicker 组件**: `src/components/message/QuestionPicker.tsx`
- **检测逻辑**: `src/hooks/usePromptExecution.ts:308-325`
- **集成位置**: `src/components/message/AIMessage.tsx`
- **类型定义**: `src/types/claude.ts`
- **API 函数**: `src/lib/api.ts:903-921`

**后端：**
- **主命令**: `src-tauri/src/commands/claude/cli_runner.rs:653-708`
- **进程管理**: `src-tauri/src/process/registry.rs` (stdin 管理)
- **命令注册**: `src-tauri/src/main.rs:166`

---

## 📊 测试检查清单

使用以下检查清单验证功能完整性：

### 基础功能
- [ ] `/test-question` 命令能正确触发
- [ ] 问题 UI 正确显示（蓝色边框卡片）
- [ ] 进度条准确显示当前进度
- [ ] 问题文本和选项描述清晰可读

### 单选模式
- [ ] 只能选择一个选项
- [ ] 选择后自动跳转下一题（300ms 延迟）
- [ ] 选中状态有蓝色高亮

### 多选模式
- [ ] 可以选择多个选项
- [ ] 选中项有复选标记
- [ ] 需手动点击"下一题"按钮
- [ ] 可以取消已选择的选项

### 键盘导航
- [ ] ↑ 键向上移动选择
- [ ] ↓ 键向下移动选择
- [ ] Enter 键选择当前高亮项
- [ ] Tab 键跳转到下一题
- [ ] Esc 键取消问题

### 向导流程
- [ ] "上一题"按钮在非首题时显示
- [ ] "下一题"按钮在非末题时显示
- [ ] "提交答案"按钮在最后一题显示
- [ ] 提交时显示加载状态
- [ ] 取消按钮始终可用

### 动画效果
- [ ] 问题卡片淡入动画
- [ ] 选项悬停缩放效果
- [ ] 点击时的缩小反馈
- [ ] 进度条平滑过渡

### 错误处理
- [ ] 缺少 sessionId 时的错误提示
- [ ] 网络错误时的错误提示
- [ ] Console 中有清晰的错误日志

---

## 🎨 UI 参考

### 问题卡片布局

```
┌─────────────────────────────────────────────────────────┐
│  [编程语言]                         问题 1 / 2          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ 进度条
│                                                          │
│  你喜欢哪种编程语言？                                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ✓ JavaScript                                      │  │ 选中
│  │   现代化的脚本语言，前端必备                       │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Python                                          │  │ 未选中
│  │   易学易用，适合数据分析和AI                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  [取消]                              [上一题] [下一题]  │
│                                                          │
│  ↑↓ 导航 • Enter 选择 • Tab 下一题 • Esc 取消          │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 注意事项

1. **Claude CLI 版本要求**: 确保使用的 Claude CLI 版本支持 AskUserQuestion 工具
2. **会话状态**: 问题提交后，Claude 会继续当前会话，无需重启
3. **取消操作**: 当前取消仅记录日志，未来可能实现发送特殊响应
4. **多问题流程**: 答案以 `{"0": "answer1", "1": "answer2"}` 格式提交

---

## 🔗 相关资源

- [Claude Code 官方文档](https://docs.anthropic.com/claude/docs)
- [项目主文档](../CLAUDE.md)
- [测试命令源码](./.claude/commands/test-question.md)

---

**最后更新**: 2025-12-01
**维护者**: Claude Code Team

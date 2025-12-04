# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Xiya Claude Studio is a professional desktop application built with **Tauri 2** (Rust backend) and **React 18** (TypeScript frontend) that provides an AI-powered workspace for solving everyday work and learning challenges. It leverages Claude Code's agent orchestration capabilities through an intuitive GUI interface, managing sessions, projects, intelligent assistance, and advanced features like prompt reverting, cost calculation, and extension management.

## Development Commands

### Frontend Development
```bash
# Install dependencies
npm install

# Start development server (Vite only)
npm run dev

# Build frontend only
npm run build
```

### Full Application (Tauri)
```bash
# Start development mode with hot reload
npm run tauri:dev

# Build production release (optimized, slow)
npm run tauri:build

# Build fast development release (faster build, debug symbols)
npm run tauri:build-fast
```

### Cargo Profiles
- **dev-release**: Fast builds (opt-level=2, thin LTO, incremental compilation)
- **release**: Production builds (opt-level="z", full LTO, size-optimized)

## Architecture Overview

### Frontend (React/TypeScript)

**Main Components:**
- `src/App.tsx` - Main app entry, routing, state management
- `src/components/ClaudeCodeSession.tsx` - Main session manager (~1230 lines)
  - Virtual scrolling with `@tanstack/react-virtual`
  - Message filtering (warmup messages, subagent grouping)
  - Real-time streaming with session-specific event listeners
  - Plan Mode toggle, queued prompts, cost calculation
- `src/components/FloatingPromptInput/` - Modular prompt input system
  - Model selection, thinking mode, file attachments
  - Slash command picker, draft prompt sync
- `src/components/Settings.tsx` - Settings management with tabs
- `src/components/Topbar.tsx` - Main navigation

**Custom Hooks Pattern:**
The codebase extensively uses custom hooks for separation of concerns:
- `useSessionLifecycle` - Load history, check active sessions, reconnect
- `usePromptExecution` - Handle prompt sending, continue/resume modes
- `useKeyboardShortcuts` - Global and session-specific shortcuts
- `useSmartAutoScroll` - Auto-scroll with user scroll detection
- `useSessionCostCalculation` - Real-time cost calculation
- `useDisplayableMessages` - Message filtering
- `useGroupedMessages` - Subagent message grouping

**API Client:**
- `src/lib/api.ts` (~2369 lines) - Tauri IPC wrapper for all backend commands

### Backend (Rust/Tauri)

**Key Modules:**
- `src-tauri/src/main.rs` - App entry, plugin initialization
- `src-tauri/src/claude_binary.rs` - Claude CLI detection and path resolution
- `src-tauri/src/commands/claude/cli_runner.rs` - Process spawning and streaming
  - `execute_claude_code()` - Start new session
  - `continue_claude_code()` - Continue conversation
  - `resume_claude_code()` - Resume by session ID
  - `spawn_claude_process()` - Async process spawning with stdout/stderr streaming
- `src-tauri/src/commands/usage.rs` (~859 lines) - Multi-model cost calculation
- `src-tauri/src/commands/prompt_tracker.rs` - Git-based revert system
- `src-tauri/src/commands/extensions.rs` - Plugin/subagent/skill management

**Platform-Specific:**
- Windows: Job objects for process tree management (`src-tauri/src/process/job_object.rs`)
- Unix: Process groups with SIGTERM
- macOS: Special handling for nvm installations

## Key Data Flows

### Message Flow (User → Claude → UI)
```
User Input → FloatingPromptInput.onSend()
  ↓
api.executeClaudeCode(projectPath, prompt, model, planMode)
  ↓ [Tauri IPC]
cli_runner::execute_claude_code()
  ↓
spawn_claude_process() → tokio::process::Command
  ↓
Claude CLI Process (JSONL stdout)
  ↓
BufReader::lines() → parse JSON
  ↓
app.emit("claude-output:{session_id}", line)
  ↓ [Tauri IPC]
Frontend EventListener → setMessages()
  ↓
StreamMessageV2.tsx (Virtual List) → User sees message
```

### Session Storage
```
~/.claude/
├── projects/
│   └── {encoded_project_path}/
│       ├── sessions/
│       │   ├── {uuid}.jsonl          # Message history
│       │   └── {uuid}.git-records.json  # Git commit tracking
│       └── {uuid}.agent-{name}.jsonl   # Subagent messages
├── settings.json          # Global settings
├── plugins/              # Installed plugins
├── agents/               # Global subagents
└── skills/               # Global skills
```

### Cost Calculation System

**Multi-Model Pricing** (usage.rs):
- Sonnet 4.5: $3 input, $15 output
- Haiku 4.5: $1 input, $5 output
- Opus 4.1: $15 input, $75 output
- Handles cache creation/read tokens separately

**Frontend Display** (useSessionCostCalculation.ts):
```typescript
const stats = useMemo(() => {
  const { totals, events } = aggregateSessionCost(messages);
  return {
    totalCost: totals.totalCost,
    totalTokens: totals.totalTokens,
    cacheReadTokens: totals.cacheReadTokens,
    // ...
  };
}, [messages]);
```

### Git Integration for Code Rollback

**Prompt Tracking** (prompt_tracker.rs):
- Stores `.git-records.json` per session with commit hashes before/after each prompt
- Three revert modes: ConversationOnly, CodeOnly, Both
- Triggered by double-tapping ESC → RevertPromptPicker

**Revert Process:**
1. Load `.git-records.json` → get `commit_before`
2. Truncate `.jsonl` file to prompt #N
3. (Optional) `git reset --hard {commit_before}`
4. Update `.git-records.json`
5. Frontend reloads session history

## Important Patterns

### Virtual Scrolling
Uses `@tanstack/react-virtual` with overscan: 5
- Handles sessions with 1000+ messages
- ~30-40% reduction in DOM nodes
- Dynamic size estimation based on message type

### Message Filtering
- **Warmup Messages**: Filter out "Warmup" and "Launching skill:" messages
- **Subagent Grouping**: Group messages by `parent_tool_use_id`

### IPC Communication
**Session-Specific Events:**
```rust
// Backend emits with session ID
app.emit(&format!("claude-output:{}", session_id), &line);

// Frontend listens with same session ID
const unlisten = await listen(`claude-output:${sessionId}`, (event) => {
  const line = event.payload;
  // Parse JSONL and update UI
});
```

### Permission Modes
```typescript
interface ClaudePermissionConfig {
  permission_mode: 'allow' | 'auto-run' | 'plan';
  enable_dangerous_skip: boolean;
  allowed_tools?: string[];
  denied_tools?: string[];
}
```

**Plan Mode**: Read-only research mode, no file writes or command execution. Uses Claude CLI's native `--permissions plan` flag.

## Extension System

Three categories organized in `~/.claude/`:

**1. Plugins** (`.claude/plugins/{plugin-name}/`)
```
.claude-plugin/plugin.json   # Manifest
commands/*.md                # Slash commands
agents/*.md                  # Subagents
skills/*SKILL.md             # Skills
hooks/hooks.json             # Hook definitions
.mcp.json                    # MCP servers
```

**2. Subagents**
- Markdown files defining specialized AI agents
- Scopes: user (`~/.claude/agents/`) or project (`.claude/agents/`)
- Parsed for YAML frontmatter

**3. Skills**
- Files ending with `SKILL.md`
- Provide reusable capabilities

## Code Conventions

### Frontend
- Use custom hooks for logic separation
- Prefer `useMemo` for expensive computations
- Use virtual scrolling for large lists
- Keep components focused on a single responsibility
- Use Radix UI primitives with Tailwind CSS

### Backend
- Use async/await with Tokio for I/O operations
- Emit session-specific events for IPC isolation
- Parse JSONL line-by-line (streaming, not batch)
- Use `anyhow::Result` for error handling
- Prefer structured logging with `log::info!`

### Process Management
- Register all spawned processes in `ProcessRegistry`
- Use platform-specific cleanup (Job objects on Windows, process groups on Unix)
- Gracefully handle process termination with timeouts

### File References
When referencing specific code locations, use the pattern `file_path:line_number` for easy navigation.

## UI Simplification Notes

Recent development history shows the codebase supports UI simplification for non-technical users:
- Hidden features are commented out (not deleted) for easy restoration
- Settings tabs can be reduced from 9 to 3 by commenting out TabsTrigger/TabsContent
- Topbar menu items can be selectively hidden while preserving functionality
- All underlying code remains intact for potential future use

## Testing

When testing changes:
1. Run `npm run tauri:dev` for full application testing
2. Check session creation, message streaming, and cost calculation
3. Verify virtual scrolling performance with large sessions (1000+ messages)
4. Test prompt revert functionality with Git integration
5. Ensure cross-platform compatibility (Windows, macOS, Linux)

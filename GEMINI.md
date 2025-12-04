# GEMINI.md

This file provides context and guidance for Gemini when working with the **Xiya Claude Studio** codebase.

## 1. Project Overview

**Xiya Claude Studio** is a professional desktop application that wraps the [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) CLI. It provides a rich graphical user interface (GUI) for interacting with Claude's agent capabilities, adding features like project management, visual session history, cost tracking, and extension management.

**Core Technologies:**
*   **Frontend:** React 18, TypeScript, Tailwind CSS 4, Framer Motion, Radix UI.
*   **Backend:** Tauri 2, Rust, SQLite.
*   **Communication:** Tauri IPC (Inter-Process Communication) with event-driven streaming.

## 2. Architecture & Key Components

### Frontend (React/TypeScript)

*   **Entry Point:** `src/App.tsx` handles routing and global state.
*   **Session Management:** `src/components/ClaudeCodeSession.tsx` is the core component (~1200+ lines). It handles:
    *   Message rendering (using `@tanstack/react-virtual` for performance).
    *   Real-time streaming via session-specific event listeners.
    *   Plan Mode toggling and cost calculation.
*   **Input System:** `src/components/FloatingPromptInput/` manages the user input, including model selection, thinking mode, and file attachments.
*   **State & Logic:** Extensive use of custom hooks (e.g., `useSessionLifecycle`, `useSessionCostCalculation`, `useSmartAutoScroll`) to separate logic from UI.
*   **API Layer:** `src/lib/api.ts` wraps Tauri IPC calls to the Rust backend.

### Backend (Rust/Tauri)

*   **Entry Point:** `src-tauri/src/main.rs`.
*   **CLI Runner:** `src-tauri/src/commands/claude/cli_runner.rs` manages the Claude Code CLI process. It spawns the process, streams `stdout`/`stderr`, and parses JSONL output.
*   **Cost Calculation:** `src-tauri/src/commands/usage.rs` handles multi-model pricing (Sonnet, Opus, Haiku) and token counting.
*   **Git Integration:** `src-tauri/src/commands/prompt_tracker.rs` manages the "Prompt Revert" feature, tracking git commits before/after prompts to allow rolling back code changes.
*   **Extensions:** `src-tauri/src/commands/extensions.rs` manages plugins, subagents, and skills found in `~/.claude/`.

## 3. Data Flow

### Message Streaming
1.  User sends a prompt via `FloatingPromptInput`.
2.  Frontend calls `api.executeClaudeCode` (Tauri IPC).
3.  Backend (`cli_runner.rs`) spawns/interacts with the `claude` CLI process.
4.  CLI output (JSONL) is captured by the backend.
5.  Backend emits a specific event: `claude-output:{session_id}`.
6.  Frontend listener updates the state, and `StreamMessageV2` renders the new content.

### Storage
*   **Session Data:** Stored in `~/.claude/projects/{encoded_path}/sessions/` as `.jsonl` files.
*   **Git Records:** Stored alongside sessions as `.git-records.json` for rollback functionality.
*   **Extensions:** Loaded from `~/.claude/plugins/`, `~/.claude/agents/`, and `~/.claude/skills/`.

## 4. Development & Build Commands

### Setup
*   Ensure **Node.js** (v18+) and **Rust** are installed.
*   Install frontend dependencies: `npm install`.

### Common Commands
*   **Development (Full App):** `npm run tauri:dev` (Starts Vite + Tauri with hot reload).
*   **Frontend Only:** `npm run dev` (Starts Vite server, useful for UI work without backend logic).
*   **Build (Production):** `npm run tauri:build` (Optimized, slower build).
*   **Build (Dev-Release):** `npm run tauri:build-fast` (Faster build with debug symbols).

## 5. Coding Conventions

### Frontend
*   **Hooks:** Encapsulate complex logic in custom hooks (`src/hooks/`).
*   **Performance:** Use `useMemo` for expensive calculations (like cost aggregation) and virtual scrolling for lists.
*   **Styling:** Use Tailwind CSS utility classes.
*   **UI Components:** Build upon Radix UI primitives.

### Backend (Rust)
*   **Async/Await:** Use Tokio for all I/O operations.
*   **Error Handling:** Use `anyhow::Result`.
*   **Process Management:** strictly manage spawned processes (Job Objects on Windows, Process Groups on Unix) to ensure cleanup.

### UI Simplification
*   The codebase supports hiding advanced features for non-technical users.
*   Features are often "hidden" by commenting out UI elements rather than deleting code, allowing for easy restoration.

## 6. Key Features to Remember
*   **Plan Mode:** A read-only mode (`--permissions plan`) for analysis without execution.
*   **Cost Tracking:** Real-time estimation based on token usage and model pricing.
*   **Prompt Revert:** Double-tapping `ESC` triggers the revert picker to rollback git state.

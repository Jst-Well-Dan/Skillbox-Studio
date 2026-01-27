# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Skillbox Studio 2** is a cross-platform desktop application built with **Tauri + React + TypeScript** that manages the installation of skills and plugins for multiple AI agents (Claude Code, Cursor, Windsurf, GitHub Copilot, and 12+ others). It provides a visual installer with a 3-step workflow for selecting plugins, installation scope, and target AI agents.

## Common Development Commands

### Setup & Installation
```bash
npm install              # Install dependencies
```

### Development
```bash
npm run dev             # Start Vite dev server (runs on port 1420 with Tauri)
npm run tauri dev       # Run full Tauri app in development mode
```

### Building
```bash
npm run build           # TypeScript check + Vite production build
npm run tauri build     # Build platform-specific installers
npm run preview         # Preview production build locally
```

### Testing
- No dedicated test suite exists yet. Focus on manual testing through the Tauri app.

## Technology Stack

**Frontend:**
- React 19 + TypeScript (~5.8)
- Vite 6.0 (bundler & dev server)
- Tailwind CSS 3.4 + PostCSS
- Framer Motion (animations)
- Radix UI (accessible components)
- Lucide React (icons)

**Backend:**
- Tauri 2.x (desktop framework)
- Rust 2021 Edition
- tauri-plugin-dialog, tauri-plugin-opener (system integrations)

## Architecture

### Core Application Features

The app provides two main pages:

1. **Install Wizard** (`Install` tab) - 3-step workflow for installing skills:
   - Step 1: Browse & select plugins from marketplace
   - Step 2: Choose installation scope (global or project-level)
   - Step 3: Select target AI agents and execute installation

2. **Installed Plugins Manager** (`Installed` tab) - Manage already-installed skills:
   - View all installed plugins with metadata (name, category, agents, install date, size)
   - Search and filter plugins (by name, scope, agent)
   - Uninstall plugins from selected agents
   - View installation statistics (total count, global vs project, by-agent breakdown)
   - Coming soon: Batch operations, installation history

### Directory Structure (Updated)

```
src/
├── App.tsx                 # Main app component, manages page switching
├── components/
│   ├── SkillMarket.tsx     # Plugin selection UI (Install wizard)
│   ├── InstallScope.tsx    # Global/project scope selection
│   ├── InstallResult.tsx   # Installation status display
│   ├── AgentSelector.tsx   # Multi-select AI agent picker
│   ├── InstalledPluginsPage.tsx  # Installed plugins management page (NEW)
│   ├── InstalledPluginCard.tsx   # Plugin card component (NEW)
│   ├── PluginFilters.tsx   # Search/filter controls (NEW)
│   ├── PluginStats.tsx     # Statistics display (NEW)
│   ├── Topbar.tsx          # Navigation header (updated with Install/Installed tabs)
│   └── ui/                 # Radix UI base components
└── lib/
    ├── api.ts             # Tauri IPC command definitions (updated with scan_installed_plugins)
    └── utils.ts           # Helper functions (CSS class merging)

src-tauri/src/
├── commands/
│   ├── agent_config.rs    # 16 AI agents with their config paths
│   ├── marketplace.rs     # Load plugins from Skill-Box/
│   ├── plugin_installer.rs # Handle file copy operations
│   └── plugin_scanner.rs  # Scan installed plugins (NEW)
├── types.rs               # Data structures for installed plugins (NEW)
└── main.rs                # Tauri app initialization
```

### Supported AI Agents (16 Total)

Each agent has distinct project and global installation paths:

- Claude Code: `.claude/skills/` / `~/.claude/skills/`
- Windsurf: `.windsurf/skills/` / `~/.codeium/windsurf/skills/`
- Cursor: `.cursor/skills/` / `~/.cursor/skills/`
- GitHub Copilot: `.github/skills/` / `~/.copilot/skills/`
- Trae, Gemini CLI, Roo Code, Antigravity, Clawdbot, Goose, OpenCode, Kilo Code, Kiro CLI, Amp, Codex, Droid

Agent configuration is hardcoded in `src-tauri/src/commands/agent_config.rs`.

### Data Flow

1. **Frontend** (`App.tsx`) calls Tauri IPC commands via `lib/api.ts`
2. **Backend** (`src-tauri/src/commands/`) handles:
   - `getMarketplaceData()` - Reads from `Skill-Box/.claude-plugin/marketplace.json` (contains 32 plugins, 61 total skills)
   - `getAgents()` - Returns hardcoded agent configurations
   - `installPlugin()` - Copies plugin files to target directories
3. **Skill-Box Directory** - Contains 32 categorized plugins (frontend, office, content, design, business tools, etc.)

### Key Files

| File | Purpose |
|------|---------|
| `src-tauri/src/commands/agent_config.rs` | Defines paths for all 16 supported AI agents |
| `src-tauri/src/commands/marketplace.rs` | Loads plugin metadata from Skill-Box |
| `src-tauri/src/commands/plugin_installer.rs` | Executes plugin installation via file copying |
| `src-tauri/src/commands/plugin_scanner.rs` | **NEW** - Scans and detects already-installed plugins |
| `src-tauri/src/types.rs` | **NEW** - Data structures for InstalledPlugin, ScanResult, etc. |
| `src/lib/api.ts` | TypeScript bindings for Tauri backend commands |
| `src/components/InstalledPluginsPage.tsx` | **NEW** - Main page for managing installed plugins |
| `Skill-Box/.claude-plugin/marketplace.json` | Master list of 32 available plugins |

## Key Configuration Files

- `vite.config.ts` - Tauri-specific Vite config (port 1420, HMR settings)
- `tsconfig.json` - ES2020 target with strict mode
- `tailwind.config.js` - Custom theme extensions
- `src-tauri/tauri.conf.json` - App metadata, window size (800x600), permissions
- `src-tauri/Cargo.toml` - Rust dependencies (added chrono, uuid)

## Installed Plugins Management Feature - Phase 1 (COMPLETED)

### Summary

Successfully implemented a full-featured "Installed Plugins" page that allows users to view and manage already-installed plugins across all supported AI agents. Users can search, filter, and see detailed statistics about installed skills.

### What Was Implemented

**Backend:**
- `src-tauri/src/commands/plugin_scanner.rs` - Scans all agent directories and detects installed plugins
- `src-tauri/src/types.rs` - Data structures: InstalledPlugin, PluginLocation, ScanResult, ScanSummary
- New IPC command: `scan_installed_plugins(scope?, project_path?)`

**Frontend:**
- `src/components/InstalledPluginsPage.tsx` - Main container with state management
- `src/components/InstalledPluginCard.tsx` - Individual plugin cards with metadata
- `src/components/PluginFilters.tsx` - Search and filter UI
- `src/components/PluginStats.tsx` - Statistics cards
- Updated `src/components/Topbar.tsx` - Added Install/Installed navigation tabs
- Updated `src/App.tsx` - Page switching logic

**Data Flow:**
1. User clicks "Installed" tab
2. Frontend calls `scanInstalledPlugins()` IPC command
3. Backend scans ~/.agent/skills/ and .agent/skills/ for all 16 agents
4. Backend maps found skills to plugins via marketplace.json lookup
5. Frontend displays results with search, filter, and statistics

### Key Features

- **View all installed plugins** with name, category, description
- **See installation metadata**: scope (global/project), agents, skills count, size, install date
- **Statistics dashboard**: total count, global vs project breakdown, by-agent counts
- **Search functionality**: filter by plugin name or description
- **Multi-criteria filtering**: by scope, by specific agent
- **Responsive design**: works on mobile, tablet, desktop

### Remaining Work (Phase 2 & 3)

See IMPLEMENTATION_PLAN.md for detailed plans for:
- Phase 2: Uninstall functionality, installation history tracking
- Phase 3: Batch operations, advanced search, performance optimizations

## Important Development Notes

1. **Adding New AI Agents** - Update `src-tauri/src/commands/agent_config.rs` with new agent paths, then add to `AgentSelector.tsx` component list.

2. **Adding New Plugins** - Add plugin data to `Skill-Box/.claude-plugin/marketplace.json` and plugin files to `Skill-Box/` directory.

3. **Rust Backend Changes** - After modifying Rust code, the Tauri backend must be rebuilt via `npm run tauri dev` or `npm run tauri build`.

4. **UI Components** - Uses Radix UI primitives styled with Tailwind. Custom components are in `src/components/ui/`.

5. **Type Safety** - TypeScript strict mode is enabled. IPC commands are typed in `lib/api.ts` to ensure type safety across the Rust/TypeScript boundary.

## Plugin Categories (Skill-Box)

The 32 plugins are organized into 7 categories:
- **No-Code Builder** (7) - Frontend tools, testing, dev automation
- **Office Automation** (3) - Document processing (Word, Excel, PDF)
- **Content Pipeline** (5) - Content harvesting and creation
- **Immersive Reading** (3) - Deep reading and research tools
- **Visual & Creative** (8) - Design, image processing, animation
- **Brand & Marketing** (3) - Brand assets and marketing tools
- **Business Analyst** (3) - Data analysis and financial modeling

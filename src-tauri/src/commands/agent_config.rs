use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentConfig {
    pub id: String,
    pub name: String,
    pub project_path: String,
    pub global_path: String,
    pub icon: String,
    pub category: String, // "Core" | "Community"
}

pub fn all_agents() -> Vec<AgentConfig> {
    vec![
        // --- Core Agents ---
        AgentConfig {
            id: "claude".into(),
            name: "Claude Code".into(),
            project_path: ".claude/skills/".into(),
            global_path: "~/.claude/skills/".into(),
            icon: "claude".into(),
            category: "Core".into(),
        },
        AgentConfig {
            id: "cursor".into(),
            name: "Cursor".into(),
            project_path: ".cursor/skills/".into(),
            global_path: "~/.cursor/skills/".into(),
            icon: "cursor".into(),
            category: "Core".into(),
        },
        AgentConfig {
            id: "windsurf".into(),
            name: "Windsurf".into(),
            project_path: ".windsurf/skills/".into(),
            global_path: "~/.codeium/windsurf/skills/".into(),
            icon: "windsurf".into(),
            category: "Core".into(),
        },
        AgentConfig {
            id: "trae".into(),
            name: "Trae".into(),
            project_path: ".trae/skills/".into(),
            global_path: "~/.trae/skills/".into(),
            icon: "trae".into(),
            category: "Core".into(),
        },
        AgentConfig {
            id: "github_copilot".into(),
            name: "GitHub Copilot".into(),
            project_path: ".agents/skills/".into(), // Changed to Vercel standard
            global_path: "~/.copilot/skills/".into(),
            icon: "github".into(),
            category: "Core".into(),
        },
        AgentConfig {
            id: "antigravity".into(),
            name: "Antigravity".into(),
            project_path: ".agent/skills/".into(),
            global_path: "~/.gemini/antigravity/skills/".into(),
            icon: "antigravity".into(),
            category: "Core".into(),
        },
        AgentConfig {
            id: "cline".into(),
            name: "Cline".into(),
            project_path: ".cline/skills/".into(),
            global_path: "~/.cline/skills/".into(),
            icon: "cline".into(),
            category: "Core".into(),
        },



        AgentConfig {
            id: "gemini".into(),
            name: "Gemini CLI".into(),
            project_path: ".agents/skills/".into(),
            global_path: "~/.gemini/skills/".into(),
            icon: "gemini".into(),
            category: "Core".into(),
        },
        AgentConfig {
            id: "kiro".into(),
            name: "Kiro CLI".into(),
            project_path: ".kiro/skills/".into(),
            global_path: "~/.kiro/skills/".into(),
            icon: "kiro".into(),
            category: "Core".into(),
        },
        AgentConfig {
            id: "kilocode".into(),
            name: "Kilo Code".into(),
            project_path: ".kilocode/skills/".into(),
            global_path: "~/.kilocode/skills/".into(),
            icon: "kilocode".into(),
            category: "Core".into(),
        },
        AgentConfig {
            id: "openclaw".into(),
            name: "OpenClaw".into(),
            project_path: "skills/".into(),
            global_path: "~/.openclaw/skills/".into(),
            icon: "openclaw".into(),
            category: "Core".into(),
        },
        AgentConfig {
            id: "opencode".into(),
            name: "OpenCode".into(),
            project_path: ".agents/skills/".into(),
            global_path: "~/.config/opencode/skills/".into(),
            icon: "opencode".into(),
            category: "Core".into(),
        },


        // --- Community Agents ---

        AgentConfig {
            id: "goose".into(),
            name: "Goose".into(),
            project_path: ".goose/skills/".into(),
            global_path: "~/.config/goose/skills/".into(),
            icon: "goose".into(),
            category: "Community".into(),
        },


        AgentConfig {
            id: "codebuddy".into(),
            name: "CodeBuddy".into(),
            project_path: ".codebuddy/skills/".into(),
            global_path: "~/.codebuddy/skills/".into(),
            icon: "codebuddy".into(),
            category: "Community".into(),
        },
        AgentConfig {
            id: "continue".into(),
            name: "Continue".into(),
            project_path: ".continue/skills/".into(),
            global_path: "~/.continue/skills/".into(),
            icon: "continue".into(),
            category: "Community".into(),
        },
        AgentConfig {
            id: "iflow".into(),
            name: "iFlow CLI".into(),
            project_path: ".iflow/skills/".into(),
            global_path: "~/.iflow/skills/".into(),
            icon: "iflow".into(), // Needs icon support
            category: "Community".into(),
        },

        AgentConfig {
            id: "roo".into(),
            name: "Roo Code".into(),
            project_path: ".roo/skills/".into(),
            global_path: "~/.roo/skills/".into(),
            icon: "roo".into(),
            category: "Community".into(),
        },



        AgentConfig {
            id: "amp".into(),
            name: "Amp".into(),
            project_path: ".agents/skills/".into(),
            global_path: "~/.config/agents/skills/".into(),
            icon: "amp".into(),
            category: "Community".into(),
        },
        AgentConfig {
            id: "droid".into(),
            name: "Droid".into(),
            project_path: ".factory/skills/".into(),
            global_path: "~/.factory/skills/".into(),
            icon: "droid".into(),
            category: "Community".into(),
        },

        AgentConfig {
            id: "augment".into(),
            name: "Augment".into(),
            project_path: ".augment/skills/".into(),
            global_path: "~/.augment/skills/".into(),
            icon: "augment".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "command_code".into(),
            name: "Command Code".into(),
            project_path: ".commandcode/skills/".into(),
            global_path: "~/.commandcode/skills/".into(),
            icon: "command_code".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "junie".into(),
            name: "Junie".into(),
            project_path: ".junie/skills/".into(),
            global_path: "~/.junie/skills/".into(),
            icon: "junie".into(), // Needs icon support
            category: "Community".into(),
        },

        AgentConfig {
            id: "kode".into(),
            name: "Kode".into(),
            project_path: ".kode/skills/".into(),
            global_path: "~/.kode/skills/".into(),
            icon: "kode".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "mcpjam".into(),
            name: "MCPJam".into(),
            project_path: ".mcpjam/skills/".into(),
            global_path: "~/.mcpjam/skills/".into(),
            icon: "mcpjam".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "mistral_vibe".into(),
            name: "Mistral Vibe".into(),
            project_path: ".vibe/skills/".into(),
            global_path: "~/.vibe/skills/".into(),
            icon: "mistral".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "mux".into(),
            name: "Mux".into(),
            project_path: ".mux/skills/".into(),
            global_path: "~/.mux/skills/".into(),
            icon: "mux".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "pi".into(),
            name: "Pi".into(),
            project_path: ".pi/skills/".into(),
            global_path: "~/.pi/agent/skills/".into(),
            icon: "pi".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "qoder".into(),
            name: "Qoder".into(),
            project_path: ".qoder/skills/".into(),
            global_path: "~/.qoder/skills/".into(),
            icon: "qoder".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "qwen_code".into(),
            name: "Qwen Code".into(),
            project_path: ".qwen/skills/".into(),
            global_path: "~/.qwen/skills/".into(),
            icon: "qwen".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "zencoder".into(),
            name: "Zencoder".into(),
            project_path: ".zencoder/skills/".into(),
            global_path: "~/.zencoder/skills/".into(),
            icon: "zencoder".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "neovate".into(),
            name: "Neovate".into(),
            project_path: ".neovate/skills/".into(),
            global_path: "~/.neovate/skills/".into(),
            icon: "neovate".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "pochi".into(),
            name: "Pochi".into(),
            project_path: ".pochi/skills/".into(),
            global_path: "~/.pochi/skills/".into(),
            icon: "pochi".into(), // Needs icon support
            category: "Community".into(),
        },
        AgentConfig {
            id: "adal".into(),
            name: "AdaL".into(),
            project_path: ".adal/skills/".into(),
            global_path: "~/.adal/skills/".into(),
            icon: "adal".into(), // Needs icon support
            category: "Community".into(),
        },
    ]
}

#[tauri::command]
pub fn get_agents() -> Vec<AgentConfig> {
    all_agents()
}

pub fn get_agent_global_path(agent_id: &str) -> Option<PathBuf> {
    let agents = all_agents();
    let agent = agents.iter().find(|a| a.id == agent_id)?;
    Some(resolve_home(&agent.global_path))
}

pub fn get_agent_project_path(agent_id: &str, project_root: &str) -> Option<PathBuf> {
    let agents = all_agents();
    let agent = agents.iter().find(|a| a.id == agent_id)?;
    let mut p = PathBuf::from(project_root);
    p.push(&agent.project_path);
    Some(p)
}

fn resolve_home(path_str: &str) -> PathBuf {
    if path_str.starts_with("~") {
        // Handle Windows and Unix home correctly
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());

        let sub = path_str[1..].trim_start_matches(|c| c == '/' || c == '\\');
        PathBuf::from(home).join(sub)
    } else {
        PathBuf::from(path_str)
    }
}

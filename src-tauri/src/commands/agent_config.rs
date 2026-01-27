use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentConfig {
    pub id: String,
    pub name: String,
    pub project_path: String,
    pub global_path: String,
    pub icon: String,
}

pub fn all_agents() -> Vec<AgentConfig> {
    vec![
        AgentConfig {
            id: "claude".into(),
            name: "Claude Code".into(),
            project_path: ".claude/skills/".into(),
            global_path: "~/.claude/skills/".into(),
            icon: "claude".into(),
        },
        AgentConfig {
            id: "cursor".into(),
            name: "Cursor".into(),
            project_path: ".cursor/skills/".into(),
            global_path: "~/.cursor/skills/".into(),
            icon: "cursor".into(),
        },
        AgentConfig {
            id: "codex".into(),
            name: "Codex".into(),
            project_path: ".codex/skills/".into(),
            global_path: "~/.codex/skills/".into(),
            icon: "codex".into(),
        },
        AgentConfig {
            id: "antigravity".into(),
            name: "Antigravity".into(),
            project_path: ".agent/skills/".into(),
            global_path: "~/.gemini/antigravity/skills/".into(),
            icon: "antigravity".into(),
        },
        AgentConfig {
            id: "trae".into(),
            name: "Trae".into(),
            project_path: ".trae/skills/".into(),
            global_path: "~/.trae/skills/".into(),
            icon: "trae".into(),
        },
        AgentConfig {
            id: "github_copilot".into(),
            name: "GitHub Copilot".into(),
            project_path: ".github/skills/".into(),
            global_path: "~/.copilot/skills/".into(),
            icon: "github".into(),
        },
        AgentConfig {
            id: "windsurf".into(),
            name: "Windsurf".into(),
            project_path: ".windsurf/skills/".into(),
            global_path: "~/.codeium/windsurf/skills/".into(),
            icon: "windsurf".into(),
        },
        AgentConfig {
            id: "gemini".into(),
            name: "Gemini CLI".into(),
            project_path: ".gemini/skills/".into(),
            global_path: "~/.gemini/skills/".into(),
            icon: "gemini".into(),
        },
        AgentConfig {
            id: "roo".into(),
            name: "Roo Code".into(),
            project_path: ".roo/skills/".into(),
            global_path: "~/.roo/skills/".into(),
            icon: "roo".into(),
        },
        AgentConfig {
            id: "clawdbot".into(),
            name: "Clawdbot".into(),
            project_path: "skills/".into(),
            global_path: "~/.clawdbot/skills/".into(),
            icon: "clawdbot".into(),
        },
        AgentConfig {
            id: "goose".into(),
            name: "Goose".into(),
            project_path: ".goose/skills/".into(),
            global_path: "~/.config/goose/skills/".into(),
            icon: "goose".into(),
        },
        AgentConfig {
            id: "opencode".into(),
            name: "OpenCode".into(),
            project_path: ".opencode/skills/".into(),
            global_path: "~/.config/opencode/skills/".into(),
            icon: "opencode".into(),
        },
        AgentConfig {
            id: "kilocode".into(),
            name: "Kilo Code".into(),
            project_path: ".kilocode/skills/".into(),
            global_path: "~/.kilocode/skills/".into(),
            icon: "kilocode".into(),
        },
        AgentConfig {
            id: "kiro".into(),
            name: "Kiro CLI".into(),
            project_path: ".kiro/skills/".into(),
            global_path: "~/.kiro/skills/".into(),
            icon: "kiro".into(),
        },
        AgentConfig {
            id: "amp".into(),
            name: "Amp".into(),
            project_path: ".agents/skills/".into(),
            global_path: "~/.config/agents/skills/".into(),
            icon: "amp".into(),
        },
        AgentConfig {
            id: "droid".into(),
            name: "Droid".into(),
            project_path: ".factory/skills/".into(),
            global_path: "~/.factory/skills/".into(),
            icon: "droid".into(),
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

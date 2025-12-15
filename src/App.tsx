import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Search, X, FolderOpen } from "lucide-react";
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { api, type Project, type Session } from "@/lib/api";
import { OutputCacheProvider } from "@/lib/outputCache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectList } from "@/components/ProjectList";
import { SessionList } from "@/components/SessionList";
import { Topbar } from "@/components/Topbar";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { Settings } from "@/components/Settings";
import { ClaudeCodeSession } from "@/components/ClaudeCodeSession";
import { TabManager } from "@/components/TabManager";
import { TabProvider, useTabs } from "@/hooks/useTabs";
import { UsageDashboard } from "@/components/UsageDashboard";
import { MCPManager } from "@/components/MCPManager";
import { ClaudeBinaryDialog } from "@/components/ClaudeBinaryDialog";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EnhancedHooksManager } from '@/components/EnhancedHooksManager';
import { ClaudeExtensionsManager } from '@/components/ClaudeExtensionsManager';
import { ProjectPluginManager } from '@/components/ProjectPluginManager';
import { useTranslation } from '@/hooks/useTranslation';
import { UpdateProvider } from '@/contexts/UpdateContext';
import { UpdateDialog } from '@/components/UpdateDialog';
import { AboutDialog } from '@/components/AboutDialog';
import { useGlobalKeyboardShortcuts } from '@/hooks/useGlobalKeyboardShortcuts';
import { Breadcrumbs, BreadcrumbItem } from '@/components/ui/breadcrumb';
import { ProjectCardSkeleton, SessionListItemSkeleton } from '@/components/ui/skeleton';
import { WelcomeHome } from '@/components/WelcomeHome';
import { PluginLibrary } from '@/components/PluginLibrary';
import * as SessionHelpers from '@/lib/sessionHelpers';

type View =
  | "welcome"
  | "agents"
  | "projects"
  | "editor"
  | "claude-code-session"
  | "claude-tab-manager"
  | "settings"
  | "mcp"
  | "usage-dashboard"
  | "enhanced-hooks-manager"
  | "claude-extensions";

/**
 * 主应用组件 - 管理 Claude 目录浏览器界面
 * Main App component - Manages the Claude directory browser UI
 */
function App() {
  return (
    <UpdateProvider>
      <TabProvider>
        <AppContent />
      </TabProvider>
    </UpdateProvider>
  );
}

/**
 * 应用内容组件 - 在 TabProvider 内部访问标签页状态
 */
function AppContent() {
  const { t } = useTranslation();
  const { openSessionInBackground, switchToTab, getTabStats } = useTabs();
  const [view, setView] = useState<View>("welcome");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClaudeBinaryDialog, setShowClaudeBinaryDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [activeClaudeSessionId, setActiveClaudeSessionId] = useState<string | null>(null);
  const [isClaudeStreaming, setIsClaudeStreaming] = useState(false);
  const [projectForSettings, setProjectForSettings] = useState<Project | null>(null);
  const [isProjectCapabilityManagerOpen, setIsProjectCapabilityManagerOpen] = useState(false);
  const [_previousView, setPreviousView] = useState<View>("welcome");
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [newSessionProjectPath, setNewSessionProjectPath] = useState<string>("");
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [tabManagerSource, setTabManagerSource] = useState<'session-list' | 'plugin-library' | null>(null);

  // 🔧 NEW: Navigation history stack for smart back functionality
  const [navigationHistory, setNavigationHistory] = useState<View[]>(["welcome"]);

  // 在项目视图中挂载时加载项目（仅在初次进入时加载）
  // Load projects on mount when in projects view (only load once on initial mount)
  const hasLoadedProjectsRef = useRef(false);

  // ⌨️ 全局键盘快捷键配置
  useGlobalKeyboardShortcuts({
    onOpenSettings: () => {
      console.log('[App] Global shortcut: Open Settings');
      handleViewChange('settings');
    },
    // onOpenSearch: () => {
    //   // TODO: 实现全局搜索功能
    //   console.log('[App] Global shortcut: Open Search (not implemented yet)');
    // },
    enabled: view !== 'claude-code-session', // 在会话视图中禁用，让会话自己处理快捷键
  });

  // ⚡ 监听打开提示词API设置的事件，切换到设置页面
  useEffect(() => {
    const handleOpenPromptAPISettings = () => {
      // ⚡ 修复：只在非设置页面时才切换，避免无限循环
      if (view !== "settings") {
        console.log('[App] Switching to settings view for prompt API settings');
        handleViewChange("settings");
        // 延迟触发内部事件，让Settings组件切换标签
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('switch-to-prompt-api-tab'));
        }, 100);
      }
    };

    window.addEventListener('open-prompt-api-settings', handleOpenPromptAPISettings as EventListener);
    return () => window.removeEventListener('open-prompt-api-settings', handleOpenPromptAPISettings as EventListener);
  }, [view]);  // ⚡ 添加 view 依赖

  useEffect(() => {
    console.log('[App] useEffect triggered, view:', view, 'hasLoaded:', hasLoadedProjectsRef.current);
    if (view === "projects" && !hasLoadedProjectsRef.current) {
      console.log('[App] Loading projects...');
      loadProjects();
      hasLoadedProjectsRef.current = true;
    }
  }, [view]);

  // 监听 Claude 会话选择事件
  // Listen for Claude session selection events
  useEffect(() => {
    const handleSessionSelected = (event: CustomEvent) => {
      const { session } = event.detail;
      // 在后台打开会话并自动切换到该标签页
      const result = openSessionInBackground(session);
      switchToTab(result.tabId);
      // 切换到标签管理器视图
      handleViewChange("claude-tab-manager");
      // 根据是否创建新标签页显示不同的通知
      if (result.isNew) {
        setToast({
          message: `会话 ${session.id.slice(-8)} 已打开`,
          type: "success"
        });
      } else {
        setToast({
          message: `已切换到会话 ${session.id.slice(-8)}`,
          type: "info"
        });
      }
    };

    const handleClaudeNotFound = () => {
      setShowClaudeBinaryDialog(true);
    };

    window.addEventListener('claude-session-selected', handleSessionSelected as EventListener);
    window.addEventListener('claude-not-found', handleClaudeNotFound as EventListener);
    return () => {
      window.removeEventListener('claude-session-selected', handleSessionSelected as EventListener);
      window.removeEventListener('claude-not-found', handleClaudeNotFound as EventListener);
    };
  }, []);

  // 监听会话完成事件，自动刷新项目列表和会话列表
  // Listen for session completion events to auto-refresh project and session lists
  useEffect(() => {
    let unlistenComplete: UnlistenFn | null = null;

    const setupListener = async () => {
      try {
        // 监听全局的 claude-complete 事件
        unlistenComplete = await listen<boolean>('claude-complete', async (event) => {
          console.log('[App] Received claude-complete event, success:', event.payload);

          // 只在会话成功完成时刷新
          if (event.payload === true) {
            console.log('[App] Session completed successfully, refreshing lists...');

            // 刷新项目列表（更新会话数量和时间戳）
            try {
              const projectList = await api.listProjects();
              setProjects(projectList);
              console.log('[App] Projects list refreshed');
            } catch (err) {
              console.error('[App] Failed to refresh projects:', err);
            }

            // 如果当前有选中的项目，也刷新会话列表
            if (selectedProject) {
              try {
                const sessionList = await api.getProjectSessions(selectedProject.id);
                setSessions(sessionList);
                console.log('[App] Sessions list refreshed for project:', selectedProject.id);
              } catch (err) {
                console.error('[App] Failed to refresh sessions:', err);
              }
            }
          }
        });
      } catch (err) {
        console.error('[App] Failed to setup claude-complete listener:', err);
      }
    };

    setupListener();

    // 清理监听器
    return () => {
      if (unlistenComplete) {
        unlistenComplete();
      }
    };
  }, [selectedProject]); // 依赖 selectedProject，以便在选中项目变化时重新设置监听器

  /**
   * 提取项目名称的辅助函数
   * Helper function to extract project name from path
   */
  const getProjectName = (path: string): string => {
    if (!path) return 'Unknown Project';
    const normalizedPath = path.replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
  };

  /**
   * 过滤项目列表（根据搜索查询）
   * Filter projects based on search query
   */
  const filteredProjects = useMemo(() => {
    if (!projectSearchQuery.trim()) {
      return projects;
    }

    const query = projectSearchQuery.toLowerCase();
    return projects.filter((project) => {
      const projectName = getProjectName(project.path).toLowerCase();
      const projectPath = project.path.toLowerCase();
      return projectName.includes(query) || projectPath.includes(query);
    });
  }, [projects, projectSearchQuery]);

  /**
   * 从 ~/.claude/projects 目录加载所有项目
   * Loads all projects from the ~/.claude/projects directory
   */
  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await api.listProjects();
      setProjects(projectList);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError(t('common.loadingProjects'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理项目选择并加载其会话
   * Handles project selection and loads its sessions
   */
  const handleProjectClick = async (project: Project) => {
    setProjectSearchQuery(""); // 清除搜索
    try {
      setLoading(true);
      setError(null);
      const sessionList = await api.getProjectSessions(project.id);
      setSessions(sessionList);
      setSelectedProject(project);

      // 🔍 后台预索引项目（静默执行，不阻塞 UI）
      console.log('[App] Triggering background pre-indexing for:', project.path);
      api.preindexProject(project.path);
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError(t('common.loadingSessions'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 在主页打开新项目会话（需要选择项目路径）
   * Opens a new project session from home page (requires project path selection)
   */
    const handleNewProject = async () => {
      try {
        // 1. 打开目录选择器
        const selected = await SessionHelpers.selectProjectPath();

        if (!selected) {
          return; // 用户取消选择
        }

        // 2. 检查项目是否已存在
        const existingProjects = await api.listProjects();
        const existingProject = existingProjects.find(p => p.path === selected);

        if (existingProject) {
          // 已存在的项目，直接导航到其 SessionList
          await handleProjectClick(existingProject);
          return;
        }

        // 3. 创建新项目对象（使用路径作为初始 ID）
        const mockProject: Project = {
          id: selected,
          path: selected,
          sessions: [],
          created_at: Math.floor(Date.now() / 1000)
        };

        // 4. 加载会话列表（新项目将为空数组）
        // 注意：getProjectSessions 会自动在 ~/.claude/projects/ 中创建项目目录结构
        const sessionList = await api.getProjectSessions(mockProject.id);
        setSessions(sessionList);
        setSelectedProject(mockProject);

        // 5. 刷新项目列表以包含新项目
        await loadProjects();

        // 6. 显示成功消息
        const projectName = selected.split(/[\\/]/).pop() || selected;
        setToast({
          message: `项目 "${projectName}" 已创建`,
          type: "success"
        });
      } catch (err) {
        console.error("Failed to create new project:", err);
        setToast({
          message: `创建项目失败: ${err instanceof Error ? err.message : String(err)}`,
          type: "error"
        });
      }
    };

  /**
   * Returns to project list view
   */
  const handleBack = () => {
    setSelectedProject(null);
    setSessions([]);
  };

  /**
   * Handles session deletion
   */
  const handleSessionDelete = async (sessionId: string, projectId: string) => {
    try {
      await api.deleteSession(sessionId, projectId);
      // 重新加载会话列表
      if (selectedProject) {
        const sessionList = await api.getProjectSessions(selectedProject.id);
        setSessions(sessionList);
      }
      setToast({
        message: `会话已成功删除`,
        type: "success"
      });
    } catch (err) {
      console.error("Failed to delete session:", err);
      setToast({
        message: `删除会话失败`,
        type: "error"
      });
      throw err;
    }
  };

  /**
   * Handles batch session deletion
   */
  const handleSessionsBatchDelete = async (sessionIds: string[], projectId: string) => {
    try {
      await api.deleteSessionsBatch(sessionIds, projectId);
      // 重新加载会话列表
      if (selectedProject) {
        const sessionList = await api.getProjectSessions(selectedProject.id);
        setSessions(sessionList);
      }
      setToast({
        message: `成功删除 ${sessionIds.length} 个会话`,
        type: "success"
      });
    } catch (err) {
      console.error("Failed to batch delete sessions:", err);
      setToast({
        message: `批量删除会话失败`,
        type: "error"
      });
      throw err;
    }
  };

  /**
   * 🔧 IMPROVED: Smart navigation with history tracking
   * Handles view changes with navigation protection and history management
   */
  const handleViewChange = (newView: View) => {
    console.log('[App] handleViewChange called:', { from: view, to: newView });

    // Check if we're navigating away from an active Claude session
    if (view === "claude-code-session" && isClaudeStreaming && activeClaudeSessionId) {
      // Show in-app confirmation dialog instead of system confirm
      setPendingView(newView);
      setShowNavigationConfirm(true);
      return;
    }

    // 🔧 NEW: Add current view to history before navigating
    setNavigationHistory(prev => {
      // Avoid duplicate consecutive entries
      if (prev[prev.length - 1] !== view) {
        return [...prev, view];
      }
      return prev;
    });

    setPreviousView(view);
    setView(newView);
  };

  /**
   * 🔧 NEW: Smart back function that uses navigation history
   */
  const handleSmartBack = () => {
    if (navigationHistory.length > 1) {
      // Remove current view and get previous one
      const newHistory = [...navigationHistory];
      newHistory.pop(); // Remove current
      const targetView = newHistory[newHistory.length - 1];

      setNavigationHistory(newHistory);
      setView(targetView);
      return targetView;
    }
    // Fallback to projects if no history
    setView("projects");
    return "projects";
  };

  /**
   * Handles navigation confirmation
   */
  const handleNavigationConfirm = () => {
    if (pendingView) {
      setView(pendingView);
      setPendingView(null);
    }
    setShowNavigationConfirm(false);
  };

  /**
   * Handles navigation cancellation
   */
  const handleNavigationCancel = () => {
    setPendingView(null);
    setShowNavigationConfirm(false);
  };

  const handleProjectSettings = (project: Project) => {
    setProjectForSettings(project);
    setIsProjectCapabilityManagerOpen(true);
  };

  /**
   * 处理项目删除
   * Handles project deletion
   */
  const handleProjectDelete = async (project: Project) => {
    try {
      setLoading(true);
      await api.deleteProject(project.id);
      setToast({ message: `项目 "${project.path.split('/').pop()}" 已删除成功`, type: "success" });
      // 重新加载项目列表
      await loadProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
      setToast({ message: `删除项目失败: ${err}`, type: "error" });
      setLoading(false);
    }
  };

  /**
   * 🍞 渲染面包屑导航
   * 根据当前视图和状态显示正确的层级路径
   */
  const renderBreadcrumbs = () => {
    const breadcrumbs = [];

    // 根据不同视图构建面包屑路径
    switch (view) {
      case 'projects':
        // 进入项目后不显示面包屑（避免与下方的返回按钮+项目路径冗余）
        // if (selectedProject) { ... } - 已移除
        break;

      case 'editor':
        breadcrumbs.push(
          <BreadcrumbItem key="home" onClick={() => handleViewChange('projects')}>
            {t('common.ccProjectsTitle')}
          </BreadcrumbItem>,
          <BreadcrumbItem key="editor" current>
            CLAUDE.md 编辑器
          </BreadcrumbItem>
        );
        break;

      case 'settings':
        breadcrumbs.push(
          <BreadcrumbItem key="home" onClick={() => handleViewChange('projects')}>
            {t('common.ccProjectsTitle')}
          </BreadcrumbItem>,
          <BreadcrumbItem key="settings" current>
            {t('navigation.settings')}
          </BreadcrumbItem>
        );
        break;

      case 'usage-dashboard':
        breadcrumbs.push(
          <BreadcrumbItem key="home" onClick={() => handleViewChange('projects')}>
            {t('common.ccProjectsTitle')}
          </BreadcrumbItem>,
          <BreadcrumbItem key="usage" current>
            使用统计
          </BreadcrumbItem>
        );
        break;

      case 'mcp':
        breadcrumbs.push(
          <BreadcrumbItem key="home" onClick={() => handleViewChange('projects')}>
            {t('common.ccProjectsTitle')}
          </BreadcrumbItem>,
          <BreadcrumbItem key="mcp" current>
            MCP 管理器
          </BreadcrumbItem>
        );
        break;

      case 'claude-extensions':
        breadcrumbs.push(
          <BreadcrumbItem key="home" onClick={() => handleViewChange('projects')}>
            {t('common.ccProjectsTitle')}
          </BreadcrumbItem>,
          <BreadcrumbItem key="extensions" current>
            扩展管理
          </BreadcrumbItem>
        );
        break;

      case 'enhanced-hooks-manager':
        breadcrumbs.push(
          <BreadcrumbItem key="home" onClick={() => handleViewChange('projects')}>
            {t('common.ccProjectsTitle')}
          </BreadcrumbItem>,
          <BreadcrumbItem key="hooks" current>
            Hooks 管理
          </BreadcrumbItem>
        );
        break;

      default:
        return null;
    }

    // 如果没有面包屑项，则不显示
    if (breadcrumbs.length === 0) return null;

    return (
      <div className="border-b border-border/50 bg-muted/20 px-4 py-2.5">
        <div className="container mx-auto">
          <Breadcrumbs>{breadcrumbs}</Breadcrumbs>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (view) {
      case "welcome":
        return (
          <WelcomeHome
            onNavigateTo={(target) => {
              if (target === 'agents') {
                handleViewChange('agents');
              } else if (target === 'projects') {
                handleViewChange('projects');
              }
            }}
          />
        );

      case "agents":
        return (
          <PluginLibrary
            onBack={() => handleViewChange('welcome')}
            onNavigateToProject={async (projectPath: string) => {
              try {
                // 检查项目是否已存在
                const existingProjects = await api.listProjects();
                const existingProject = existingProjects.find(p => p.path === projectPath);

                if (existingProject) {
                  // 已存在的项目，直接导航到其 SessionList
                  await handleProjectClick(existingProject);
                  handleViewChange("projects");
                } else {
                  // 创建新项目对象
                  const mockProject: Project = {
                    id: projectPath,
                    path: projectPath,
                    sessions: [],
                    created_at: Math.floor(Date.now() / 1000)
                  };

                  // 加载会话列表（会自动创建项目目录结构）
                  const sessionList = await api.getProjectSessions(mockProject.id);
                  setSessions(sessionList);
                  setSelectedProject(mockProject);
                  handleViewChange("projects");

                  // 刷新项目列表
                  const projectList = await api.listProjects();
                  setProjects(projectList);

                  const projectName = projectPath.split(/[\\/]/).pop() || projectPath;
                  setToast({
                    message: `项目 "${projectName}" 已创建`,
                    type: "success"
                  });
                }
              } catch (err) {
                console.error("Failed to navigate to project:", err);
                setToast({
                  message: `跳转失败: ${err instanceof Error ? err.message : String(err)}`,
                  type: "error"
                });
              }
            }}
          />
        );

      case "enhanced-hooks-manager":
        return (
          <EnhancedHooksManager
            onBack={handleSmartBack}
            projectPath={projectForSettings?.path}
          />
        );

      case "claude-extensions":
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">
              <ClaudeExtensionsManager
                projectPath={projectForSettings?.path}
                onBack={handleSmartBack}
              />
            </div>
          </div>
        );

      case "editor":
        return (
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor onBack={handleSmartBack} />
          </div>
        );
      
      case "settings":
        return (
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            <Settings onBack={handleSmartBack} />
          </div>
        );

      case "projects":
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">
              {/* Header - 只在主页显示，标题和新建按钮在同一行 */}
              {!selectedProject && (
                <div className="mb-6">
                  {/* 返回按钮 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewChange('welcome')}
                    className="mb-4 -ml-2"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    返回欢迎页
                  </Button>

                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <h1 className="text-3xl font-bold tracking-tight">{t('common.ccProjectsTitle')}</h1>
                    </div>
                    <Button
                      onClick={handleNewProject}
                      size="default"
                      className="flex-shrink-0 bg-[#d97757] hover:bg-[#c56647] text-white"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t('common.newProject')}
                    </Button>
                  </div>

                  {/* 搜索栏 */}
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={t('placeholders.searchProjects')}
                      value={projectSearchQuery}
                      onChange={(e) => setProjectSearchQuery(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    {projectSearchQuery && (
                      <button
                        onClick={() => setProjectSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="清除搜索"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* 快速访问区域 - 显示最近3个项目 */}
                  {!projectSearchQuery && projects.length > 0 && (
                    <div className="mt-6">
                      <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        快速访问
                      </h2>
                      <div className="flex gap-3 flex-wrap">
                        {projects.slice(0, 3).map((project) => {
                          const projectName = project.path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || project.path;
                          return (
                            <button
                              key={project.id}
                              onClick={() => handleProjectClick(project)}
                              className="px-5 py-4 rounded-xl bg-card hover:bg-muted/50 border border-border/60 hover:border-primary/40 transition-all group text-left min-w-[200px]"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <FolderOpen className="w-5 h-5 text-primary/70 group-hover:text-primary" />
                                <span className="font-medium text-base group-hover:text-primary transition-colors">{projectName}</span>
                              </div>
                              <p className="text-xs text-muted-foreground font-mono truncate max-w-[280px]" title={project.path}>
                                {project.path}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error display */}
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive max-w-2xl">
                  {error}
                </div>
              )}

              {/* Loading state with skeleton */}
              {loading && (
                <>
                  {selectedProject ? (
                    // Session list skeleton
                    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                      {[...Array(8)].map((_, i) => (
                        <SessionListItemSkeleton key={i} />
                      ))}
                    </div>
                  ) : (
                    // Project list skeleton
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                      {[...Array(6)].map((_, i) => (
                        <ProjectCardSkeleton key={i} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Content - 移除动画避免重复触发 */}
              {!loading && (
                <>
                  {selectedProject ? (
                    <div>
                      <SessionList
                        sessions={sessions}
                        projectPath={selectedProject.path}
                        onBack={handleBack}
                        onSessionDelete={handleSessionDelete}
                        onSessionsBatchDelete={handleSessionsBatchDelete}
                        onSessionClick={(session) => {
                          // 打开会话并自动切换到该标签页
                          const result = openSessionInBackground(session);
                          switchToTab(result.tabId);
                          setTabManagerSource('session-list');
                          handleViewChange("claude-tab-manager");
                          if (result.isNew) {
                            setToast({
                              message: `会话 ${session.id.slice(-8)} 已打开`,
                              type: "success"
                            });
                          } else {
                            setToast({
                              message: `已切换到会话 ${session.id.slice(-8)}`,
                              type: "info"
                            });
                          }
                        }}
                        onNewSession={(projectPath) => {
                          setSelectedSession(null); // Clear any existing session
                          setNewSessionProjectPath(projectPath); // Store the project path for new session
                          setTabManagerSource('session-list');
                          handleViewChange("claude-tab-manager");
                        }}
                      />
                    </div>
                  ) : (
                    <section className="space-y-4">
                      {filteredProjects.length > 0 ? (
                        <ProjectList
                          projects={filteredProjects}
                          onProjectClick={handleProjectClick}
                          onProjectSettings={handleProjectSettings}
                          onProjectDelete={handleProjectDelete}
                          onProjectsChanged={loadProjects}
                          loading={loading}
                        />
                      ) : projectSearchQuery.trim() ? (
                        <div className="py-12 text-center border border-dashed border-border/50 rounded-xl">
                          <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                          <p className="text-sm text-muted-foreground mb-1">
                            未找到匹配 "{projectSearchQuery}" 的项目
                          </p>
                          <p className="text-xs text-muted-foreground">
                            尝试其他搜索词或{' '}
                            <button
                              onClick={() => setProjectSearchQuery('')}
                              className="text-primary hover:underline"
                            >
                              清除搜索
                            </button>
                          </p>
                        </div>
                      ) : (
                        <div className="py-8 text-center border border-dashed border-border/50 rounded-xl">
                          <p className="text-sm text-muted-foreground">
                            {t('common.noProjectsFound')}
                          </p>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        );
      
      case "claude-code-session":
        return (
          <ClaudeCodeSession
            session={selectedSession || undefined}
            initialProjectPath={newSessionProjectPath}
            onStreamingChange={(isStreaming, sessionId) => {
              setIsClaudeStreaming(isStreaming);
              setActiveClaudeSessionId(sessionId);
            }}
          />
        );

      case "claude-tab-manager":
        return (
          <TabManager
            initialSession={selectedSession || undefined}
            initialProjectPath={newSessionProjectPath}
            onBack={() => {
              setSelectedSession(null);
              setNewSessionProjectPath("");

              // 智能返回：如果从 SessionList 进入，则返回 SessionList
              if (tabManagerSource === 'session-list' && selectedProject) {
                setTabManagerSource(null);
                // 保持 selectedProject，视图切换到 "projects" 会显示 SessionList
                handleViewChange("projects");
              } else {
                // 默认：返回项目列表
                setSelectedProject(null);
                setTabManagerSource(null);
                handleViewChange("projects");
              }
            }}
          />
        );
      


      case "usage-dashboard":
        return (
          <UsageDashboard onBack={handleSmartBack} />
        );

      case "mcp":
        return (
          <MCPManager onBack={handleSmartBack} />
        );
      
      default:
        return null;
    }
  };

  return (
    <OutputCacheProvider>
      <div className="h-screen bg-background flex flex-col">
          {/* Topbar - 条件渲染：在欢迎页、标签页管理器中隐藏，提供沉浸式体验 */}
          {view !== "claude-tab-manager" && view !== "welcome" && (
            <Topbar
              onClaudeClick={() => handleViewChange("editor")}
              onSettingsClick={() => handleViewChange("settings")}
              onUsageClick={() => handleViewChange("usage-dashboard")}
              onMCPClick={() => handleViewChange("mcp")}
              onExtensionsClick={() => handleViewChange("claude-extensions")}
              onTabsClick={() => handleViewChange("claude-tab-manager")}
              onUpdateClick={() => setShowUpdateDialog(true)}
              onAboutClick={() => setShowAboutDialog(true)}
              onHomeClick={() => handleViewChange("welcome")}
              tabsCount={getTabStats().total}
            />
          )}

          {/* 🍞 Breadcrumb Navigation - 面包屑导航 */}
          {view !== "claude-tab-manager" && view !== "welcome" && renderBreadcrumbs()}

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            {renderContent()}
          </div>

          {/* NFO Credits Modal */}

          {/* Claude Binary Dialog */}
          <ClaudeBinaryDialog
            open={showClaudeBinaryDialog}
            onOpenChange={setShowClaudeBinaryDialog}
            onSuccess={() => {
              setToast({ message: t('messages.saved'), type: "success" });
              // Trigger a refresh of the Claude version check
              window.location.reload();
            }}
            onError={(message) => setToast({ message, type: "error" })}
          />

          {/* Navigation Confirmation Dialog */}
          <Dialog open={showNavigationConfirm} onOpenChange={setShowNavigationConfirm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认离开</DialogTitle>
                <DialogDescription>
                  Claude 正在处理您的请求。确定要离开当前会话吗？这将中断正在进行的对话。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={handleNavigationCancel}>
                  取消
                </Button>
                <Button onClick={handleNavigationConfirm}>
                  确定离开
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Toast Container */}
          <ToastContainer>
            {toast && (
              <Toast
                message={toast.message}
                type={toast.type}
                onDismiss={() => setToast(null)}
              />
            )}
          </ToastContainer>

          {/* Update Dialog */}
          <UpdateDialog
            open={showUpdateDialog}
            onClose={() => setShowUpdateDialog(false)}
          />

          {/* About Dialog */}
          <AboutDialog
            open={showAboutDialog}
            onClose={() => setShowAboutDialog(false)}
            onCheckUpdate={() => {
              setShowAboutDialog(false);
              setShowUpdateDialog(true);
            }}
          />

          {projectForSettings && (
            <ProjectPluginManager
              projectPath={projectForSettings.path}
              open={isProjectCapabilityManagerOpen}
              onOpenChange={(open) => {
                setIsProjectCapabilityManagerOpen(open);
                if (!open) {
                  setProjectForSettings(null);
                }
              }}
            />
          )}
        </div>
      </OutputCacheProvider>
  );
}

export default App;

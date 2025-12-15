import React, { useState } from "react";
import { ArrowLeft, Clock, Plus, Trash2, CheckSquare, Square, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatUnixTimestamp, formatISOTimestamp, truncateText, getFirstLine } from "@/lib/date-utils";
import type { Session } from "@/lib/api";
import { useTranslation } from '@/hooks/useTranslation';
import { ProjectPluginManager } from "@/components/ProjectPluginManager";

interface SessionListProps {
  /**
   * Array of sessions to display
   */
  sessions: Session[];
  /**
   * The current project path being viewed
   */
  projectPath: string;
  /**
   * Callback to go back to project list
   */
  onBack: () => void;
  /**
   * Callback when a session is clicked
   */
  onSessionClick?: (session: Session) => void;
  /**
   * Callback when a session should be deleted
   */
  onSessionDelete?: (sessionId: string, projectId: string) => Promise<void>;
  /**
   * Callback when multiple sessions should be deleted
   */
  onSessionsBatchDelete?: (sessionIds: string[], projectId: string) => Promise<void>;
  /**
   * Callback when new session button is clicked
   */
  onNewSession?: (projectPath: string) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 20;

/**
 * SessionList component - Displays paginated sessions for a specific project
 * 
 * @example
 * <SessionList
 *   sessions={sessions}
 *   projectPath="/Users/example/project"
 *   onBack={() => setSelectedProject(null)}
 *   onSessionClick={(session) => console.log('Selected session:', session)}
 * />
 */
export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  projectPath,
  onBack,
  onSessionClick,
  onSessionDelete,
  onSessionsBatchDelete,
  onNewSession,
  className,
}) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Multi-selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());

  // Plugin manager state
  const [pluginManagerOpen, setPluginManagerOpen] = useState(false);

  // 🔧 过滤掉空白无用的会话（没有 first_message 或 id 为空的）
  const validSessions = sessions.filter(session =>
    session.id && session.id.trim() !== '' &&
    (session.first_message && session.first_message.trim() !== '')
  );

  // 🔧 按活跃度排序：优先使用最后一条消息时间，其次第一条消息时间，最后使用创建时间
  const sortedSessions = [...validSessions].sort((a, b) => {
    // 获取会话 A 的最后活跃时间
    const timeA = a.last_message_timestamp
      ? new Date(a.last_message_timestamp).getTime()
      : a.message_timestamp
      ? new Date(a.message_timestamp).getTime()
      : a.created_at * 1000;

    // 获取会话 B 的最后活跃时间
    const timeB = b.last_message_timestamp
      ? new Date(b.last_message_timestamp).getTime()
      : b.message_timestamp
      ? new Date(b.message_timestamp).getTime()
      : b.created_at * 1000;

    return timeB - timeA; // 降序：最新的在前
  });

  // Calculate pagination
  const totalPages = Math.ceil(sortedSessions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSessions = sortedSessions.slice(startIndex, endIndex);

  // Smart pagination adjustment: if current page becomes empty after deletion, go to previous page
  React.useEffect(() => {
    if (sortedSessions.length > 0 && currentSessions.length === 0 && currentPage > 1) {
      // Current page is empty but not the first page, go to previous page
      setCurrentPage(currentPage - 1);
    }
  }, [sortedSessions.length, currentSessions.length, currentPage]);

  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation(); // Prevent triggering onSessionClick
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  // Confirm deletion
  const confirmDelete = async () => {
    if (!sessionToDelete || !onSessionDelete) return;

    try {
      setIsDeleting(true);
      await onSessionDelete(sessionToDelete.id, sessionToDelete.project_id);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel deletion
  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedSessions(new Set());
  };

  // Toggle session selection
  const toggleSessionSelection = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  // Select all sessions on current page
  const selectAllOnPage = () => {
    if (selectedSessions.size === currentSessions.length) {
      setSelectedSessions(new Set());
    } else {
      const newSelected = new Set(currentSessions.map(s => s.id));
      setSelectedSessions(newSelected);
    }
  };

  // Batch delete selected sessions
  const handleBatchDelete = async () => {
    if (selectedSessions.size === 0 || !onSessionsBatchDelete) return;

    try {
      setIsDeleting(true);
      const sessionIds = Array.from(selectedSessions);
      // Get the project_id from the first session
      const firstSession = sessions.find(s => s.id === sessionIds[0]);
      if (firstSession) {
        await onSessionsBatchDelete(sessionIds, firstSession.project_id);
        setSelectedSessions(new Set());
        setIsSelectionMode(false);
      }
    } catch (error) {
      console.error("Failed to batch delete sessions:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 🎯 重构后的布局：项目信息 + Edit CLAUDE.md 按钮在同一行 */}
      <div className="flex items-center justify-between gap-4">
        {/* 左侧：返回按钮 + 项目信息 */}
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <Button
            variant="default"
            size="default"
            onClick={onBack}
            className="h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all duration-200 shadow-md flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span>返回项目列表</span>
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-medium truncate">{projectPath}</h2>
            <p className="text-xs text-muted-foreground">
              {validSessions.length} valid session{validSessions.length !== 1 ? 's' : ''}
              {sessions.length !== validSessions.length && (
                <span className="text-muted-foreground/70"> ({sessions.length - validSessions.length} hidden)</span>
              )}
            </p>
          </div>
        </div>

        {/* 右侧：插件管理 + Edit CLAUDE.md 按钮 */}
        <div className="flex items-center gap-2">
          {/* 插件管理按钮 */}
          <Button
            variant="default"
            size="default"
            onClick={() => setPluginManagerOpen(true)}
            className="px-4 flex-shrink-0 bg-[#d97757] hover:bg-[#FE6F00]/90 text-white"
          >
            <Package className="h-4 w-4 mr-2" />
            <span>项目能力</span>
          </Button>
        </div>
      </div>

      {/* 🎯 新布局：批量管理会话 + 新建会话按钮在同一行 */}
      <div className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border border-border">
        {/* 左侧：批量管理会话 */}
        <div className="flex items-center gap-2 flex-1">
          {onSessionsBatchDelete && validSessions.length > 0 && (
            <>
              {isSelectionMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllOnPage}
                  >
                    {selectedSessions.size === currentSessions.length ? (
                      <>
                        <CheckSquare className="h-4 w-4 mr-2" />
                        取消全选
                      </>
                    ) : (
                      <>
                        <Square className="h-4 w-4 mr-2" />
                        全选当前页
                      </>
                    )}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    已选择 {selectedSessions.size} 个会话
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  批量管理会话
                </span>
              )}
            </>
          )}
        </div>

        {/* 右侧：批量操作按钮 + 新建会话按钮 */}
        <div className="flex items-center gap-2">
          {isSelectionMode && selectedSessions.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "删除中..." : `删除选中 (${selectedSessions.size})`}
            </Button>
          )}

          {onSessionsBatchDelete && validSessions.length > 0 && (
            <Button
              variant={isSelectionMode ? "default" : "outline"}
              size="sm"
              onClick={toggleSelectionMode}
              disabled={isDeleting}
            >
              {isSelectionMode ? "取消选择" : "批量选择"}
            </Button>
          )}

          {/* 新建会话按钮 */}
          {onNewSession && (
            <Button
              onClick={() => onNewSession(projectPath)}
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('claude.newSession')}
            </Button>
          )}
        </div>
      </div>

      {/* Compact session list */}
      <div
        className="border border-border rounded-lg overflow-hidden divide-y divide-border"
        role="list"
        aria-label="会话列表"
        aria-live="polite"
      >
        {currentSessions.map((session) => {
          const firstMessagePreview = session.first_message
            ? truncateText(getFirstLine(session.first_message), 80)
            : session.id;
          const timeDisplay = session.last_message_timestamp
            ? formatISOTimestamp(session.last_message_timestamp)
            : session.message_timestamp
            ? formatISOTimestamp(session.message_timestamp)
            : formatUnixTimestamp(session.created_at);

          return (
            <div
              key={session.id}
              role="listitem"
              className={cn(
                "relative flex items-center group hover:bg-muted/30 transition-colors",
                session.todo_data && "bg-primary/5 border-l-2 border-l-primary",
                isSelectionMode && selectedSessions.has(session.id) && "bg-primary/10"
              )}
            >
              {/* Checkbox in selection mode */}
              {isSelectionMode && (
                <div className="px-3 py-2.5">
                  <Checkbox
                    checked={selectedSessions.has(session.id)}
                    onCheckedChange={() => toggleSessionSelection(session.id)}
                    aria-label={`选择会话 ${firstMessagePreview}`}
                  />
                </div>
              )}

              <button
                onClick={() => {
                  if (isSelectionMode) {
                    toggleSessionSelection(session.id);
                  } else {
                    onSessionClick?.(session);
                  }
                }}
                className="flex-1 text-left px-4 py-2.5 min-w-0"
                aria-label={`会话: ${firstMessagePreview}，时间: ${timeDisplay}`}
              >
              <div className="flex items-center justify-between gap-3">
                {/* Session info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  {/* First message preview */}
                  <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                    {firstMessagePreview}
                  </p>

                  {/* Session ID (small and subtle) */}
                  <p className="text-xs font-mono text-muted-foreground truncate" aria-label={`会话 ID: ${session.id}`}>
                    {session.id}
                  </p>
                </div>

                {/* Timestamp - 优先显示最后一条消息时间 */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <time dateTime={session.last_message_timestamp || session.message_timestamp || new Date(session.created_at * 1000).toISOString()}>
                    {timeDisplay}
                  </time>
                </div>
              </div>
            </button>

            {/* Delete button - shown on hover (hidden in selection mode) */}
            {!isSelectionMode && onSessionDelete && (
              <button
                onClick={(e) => handleDeleteClick(e, session)}
                className="px-3 py-2.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity hover:bg-destructive/10 text-destructive"
                aria-label={`删除会话 ${firstMessagePreview}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          );
        })}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除会话</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              确定要删除此会话吗？此操作将永久删除会话记录和相关数据，无法恢复。
            </p>
            {sessionToDelete && (
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium text-foreground">
                  {sessionToDelete.first_message
                    ? truncateText(getFirstLine(sessionToDelete.first_message), 60)
                    : sessionToDelete.id}
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {sessionToDelete.id}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelDelete}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plugin Manager Dialog */}
      <ProjectPluginManager
        projectPath={projectPath}
        open={pluginManagerOpen}
        onOpenChange={setPluginManagerOpen}
      />
    </div>
  );
}; 

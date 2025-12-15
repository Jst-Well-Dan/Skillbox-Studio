import React, { useState } from "react";
import {
  FolderOpen,
  FileText,
  MoreVertical,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Project } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

interface ProjectListProps {
  /**
   * Array of projects to display
   */
  projects: Project[];
  /**
   * Callback when a project is clicked
   */
  onProjectClick: (project: Project) => void;
  /**
   * Callback when hooks configuration is clicked
   */
  onProjectSettings?: (project: Project) => void;
  /**
   * Callback when a project is deleted
   */
  onProjectDelete?: (project: Project) => Promise<void>;
  /**
   * Callback when projects are changed (for refresh)
   */
  onProjectsChanged?: () => void;
  /**
   * Whether the list is currently loading
   */
  loading?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 5;

/**
 * Extracts the project name from the full path
 * Handles both Windows (\) and Unix (/) path separators
 */
const getProjectName = (path: string): string => {
  if (!path) return 'Unknown Project';
  
  // Normalize path separators and split
  const normalizedPath = path.replace(/\\/g, '/');
  const parts = normalizedPath.split('/').filter(Boolean);
  
  // Get the last non-empty part (directory name)
  const projectName = parts[parts.length - 1];
  
  // Fallback to the original path if we can't extract a name
  return projectName || path;
};

/**
 * ProjectList component - Displays a paginated list of projects with hover animations
 * 
 * @example
 * <ProjectList
 *   projects={projects}
 *   onProjectClick={(project) => console.log('Selected:', project)}
 * />
 */
export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onProjectClick,
  onProjectSettings,
  onProjectDelete,
  onProjectsChanged: _onProjectsChanged,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Calculate pagination
  const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProjects = projects.slice(startIndex, endIndex);
  
  // Reset to page 1 if projects change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [projects.length]);

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete || !onProjectDelete) return;
    
    setIsDeleting(true);
    try {
      await onProjectDelete(projectToDelete);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };
  
  const ProjectListView = () => (
    <div className="space-y-4">
      {/* 所有项目标题 */}
      <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <FolderOpen className="w-4 h-4" />
        所有项目 ({projects.length})
      </h2>

      {/* 列表视图 */}
      <div
        className="border border-border/60 rounded-lg divide-y divide-border/40 bg-card overflow-hidden"
        role="list"
        aria-label="项目列表"
      >
        {currentProjects.map((project) => {
          const projectName = getProjectName(project.path);
          const sessionCount = project.sessions.length;

          return (
            <div
              key={project.id}
              role="listitem"
              tabIndex={0}
              onClick={() => onProjectClick(project)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onProjectClick(project);
                }
              }}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors group cursor-pointer"
              aria-label={`项目 ${projectName}，包含 ${sessionCount} 个会话`}
            >
              {/* 项目图标 */}
              <div className="p-2 rounded-lg bg-primary/5 text-primary shrink-0 transition-colors group-hover:bg-primary/10">
                <FolderOpen className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
              </div>

              {/* 项目名称和路径 */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
                  {projectName}
                </h3>
                <p
                  className="text-xs text-muted-foreground truncate font-mono opacity-70"
                  title={project.path}
                >
                  {project.path}
                </p>
              </div>

              {/* 会话数 */}
              {sessionCount > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 bg-secondary text-secondary-foreground border border-border/50 rounded-md shrink-0"
                  aria-label={`${sessionCount} 个会话`}
                >
                  <FileText className="h-3 w-3 opacity-70" aria-hidden="true" strokeWidth={1.5} />
                  <span className="text-xs font-medium">{sessionCount}</span>
                </div>
              )}

              {/* 操作菜单 */}
              {(onProjectSettings || onProjectDelete) && (
                <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 hover:bg-muted data-[state=open]:opacity-100"
                        aria-label={`${projectName} 项目操作菜单`}
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onProjectSettings && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onProjectSettings(project);
                          }}
                        >
                          <Zap className="h-4 w-4 mr-2 text-primary" aria-hidden="true" />
                          项目能力管理
                        </DropdownMenuItem>
                      )}
                      {onProjectSettings && onProjectDelete && (
                        <DropdownMenuSeparator />
                      )}
                      {onProjectDelete && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                          删除项目
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      <ProjectListView />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除项目</DialogTitle>
            <DialogDescription>
              您确定要删除项目 "{projectToDelete ? getProjectName(projectToDelete.path) : ""}" 吗？
              这将删除所有相关的会话数据和Todo文件，此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
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
    </div>
  );
}; 

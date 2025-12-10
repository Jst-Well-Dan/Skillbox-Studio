import React, { useState, useEffect } from 'react';
import { api, type WorkspaceProject, type ProjectPluginsSummary } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  FolderOpen,
  MessageSquare,
  Settings,
  Package,
  Loader2,
  Plus,
  RefreshCcw,
} from 'lucide-react';
import { ProjectPluginManager } from '@/components/ProjectPluginManager';

interface ProjectWithPlugins extends WorkspaceProject {
  pluginsSummary?: ProjectPluginsSummary;
}

interface ProjectsPageProps {
  onBack: () => void;
  onStartConversation: (projectPath: string) => void;
  onCreateProject?: () => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  onBack,
  onStartConversation,
  onCreateProject,
}) => {
  const [projects, setProjects] = useState<ProjectWithPlugins[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [pluginDialogOpen, setPluginDialogOpen] = useState(false);

  // Load projects
  const loadProjects = async () => {
    try {
      setLoading(true);
      const workspaceProjects = await api.listWorkspaceProjects();

      // Load plugin summaries for each project
      const projectsWithPlugins = await Promise.all(
        workspaceProjects.map(async (project) => {
          try {
            const pluginsSummary = await api.getProjectPluginsSummary(project.path);
            return { ...project, pluginsSummary };
          } catch (error) {
            console.error(`Failed to load plugins for ${project.name}:`, error);
            return { ...project, pluginsSummary: { projectPlugins: [], systemPlugins: [] } };
          }
        })
      );

      setProjects(projectsWithPlugins);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Format plugin ID for display
  const formatPluginName = (pluginId: string) => {
    return pluginId.split('@')[0];
  };

  // Handle start conversation
  const handleStartConversation = (projectPath: string) => {
    onStartConversation(projectPath);
  };

  // Handle configure plugins
  const handleConfigurePlugins = (projectPath: string) => {
    setSelectedProjectPath(projectPath);
    setPluginDialogOpen(true);
  };

  // Handle plugin dialog close and reload
  const handlePluginDialogClose = (open: boolean) => {
    setPluginDialogOpen(open);
    if (!open) {
      // Reload plugins summary when dialog closes
      loadProjects();
    }
  };

  // Handle create project
  const handleCreateProject = () => {
    if (onCreateProject) {
      onCreateProject();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首页
          </Button>
          <div>
            <h1 className="text-2xl font-bold">我的项目</h1>
            <p className="text-sm text-gray-600">选择一个项目开始对话，或配置项目专属能力</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadProjects} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="default" size="sm" onClick={handleCreateProject}>
            <Plus className="w-4 h-4 mr-2" />
            新建项目
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      <ScrollArea className="flex-1 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FolderOpen className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg mb-2">暂无项目</p>
            <p className="text-sm">点击"新建项目"开始创建你的第一个项目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.path}
                className="p-6 hover:shadow-lg transition-shadow"
              >
                {/* Project Header */}
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{project.name}</h3>
                      <p className="text-xs text-gray-500 truncate" title={project.path}>
                        {project.path}
                      </p>
                    </div>
                  </div>
                  {project.lastModified && (
                    <p className="text-xs text-gray-400">
                      最后修改: {new Date(project.lastModified).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>

                {/* Plugins Summary */}
                <div className="mb-4 pb-4 border-b">
                  {project.pluginsSummary && project.pluginsSummary.projectPlugins.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">项目插件:</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {project.pluginsSummary.projectPlugins.slice(0, 5).map((pluginId) => (
                          <div key={pluginId} className="flex items-center gap-1 text-sm">
                            <span className="text-blue-600">•</span>
                            <span className="text-gray-700 truncate" title={pluginId}>
                              {formatPluginName(pluginId)}
                            </span>
                          </div>
                        ))}
                        {project.pluginsSummary.projectPlugins.length > 5 && (
                          <div className="text-xs text-gray-500">
                            +{project.pluginsSummary.projectPlugins.length - 5} 个插件...
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        <span>暂无项目插件</span>
                      </div>
                      {project.pluginsSummary && (
                        <p className="text-xs mt-1">
                          使用 {project.pluginsSummary.systemPlugins.length} 个系统插件
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => handleStartConversation(project.path)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    开始对话
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleConfigurePlugins(project.path)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Plugin Configuration Dialog */}
      {selectedProjectPath && (
        <ProjectPluginManager
          projectPath={selectedProjectPath}
          open={pluginDialogOpen}
          onOpenChange={handlePluginDialogClose}
        />
      )}
    </div>
  );
};

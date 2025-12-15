import React from 'react';
import { motion } from 'framer-motion';
import { useFileBrowserSidebar } from '@/hooks/useFileBrowserSidebar';
import { SidebarHeader } from './SidebarHeader';
import { FileUsageHints } from './FileUsageHints';
import { DirectoryTree } from './DirectoryTree';
import { Toast, ToastContainer } from '@/components/ui/toast';
import { Loader2 } from 'lucide-react';

interface FileBrowserSidebarProps {
  /**
   * Root project path to browse
   */
  projectPath: string;
  /**
   * Whether the sidebar is visible
   */
  isVisible: boolean;
  /**
   * Callback to toggle sidebar visibility
   */
  onToggle: () => void;
}

/**
 * Main file browser sidebar component
 *
 * Features:
 * - Collapsible with smooth animations
 * - Directory tree with lazy loading
 * - Usage hints
 * - Toast notifications
 * - Loading and error states
 *
 * @example
 * <FileBrowserSidebar
 *   projectPath="/path/to/project"
 *   isVisible={true}
 *   onToggle={() => setSidebarVisible(!sidebarVisible)}
 * />
 */
export const FileBrowserSidebar: React.FC<FileBrowserSidebarProps> = ({
  projectPath,
  isVisible,
  onToggle,
}) => {
  const {
    rootEntries,
    expandedDirs,
    loadedDirs,
    loading,
    error,
    toast,
    toggleDirectory,
    copyFilePath,
    openFolderInExplorer,
    clearToast,
  } = useFileBrowserSidebar(projectPath);

  const handleOpenProjectFolder = () => {
    openFolderInExplorer(projectPath);
  };

  return (
    <>
      {/* Sidebar with animation */}
      <motion.div
        initial={false}
        animate={{ width: isVisible ? 280 : 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex-shrink-0 bg-background border-r border-border overflow-hidden"
      >
        <div className="h-full flex flex-col w-[280px]">
          {/* Header */}
          <SidebarHeader
            onToggleCollapse={onToggle}
            onOpenProjectFolder={handleOpenProjectFolder}
          />

          {/* Usage hints */}
          <FileUsageHints />

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              // Loading state
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              // Error state
              <div className="px-3 py-4 text-sm text-destructive">
                {error}
              </div>
            ) : (
              // Directory tree
              <DirectoryTree
                entries={rootEntries}
                depth={0}
                expandedDirs={expandedDirs}
                loadedDirs={loadedDirs}
                onToggle={toggleDirectory}
                onCopyPath={copyFilePath}
                onOpenFolder={openFolderInExplorer}
                projectPath={projectPath}
              />
            )}
          </div>
        </div>
      </motion.div>

      {/* Toast notifications */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            duration={2000}
            onDismiss={clearToast}
          />
        )}
      </ToastContainer>
    </>
  );
};

import { useState, useEffect, useCallback } from 'react';
import { api, type FileEntry } from '@/lib/api';
import { clipboardService } from '@/lib/clipboard';
import { useTranslation } from '@/hooks/useTranslation';

interface FileBrowserSidebarState {
  rootEntries: FileEntry[];
  expandedDirs: Set<string>;
  loadedDirs: Map<string, FileEntry[]>;
  loading: boolean;
  error: string | null;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UseFileBrowserSidebarReturn {
  rootEntries: FileEntry[];
  expandedDirs: Set<string>;
  loadedDirs: Map<string, FileEntry[]>;
  loading: boolean;
  error: string | null;
  toast: ToastMessage | null;
  toggleDirectory: (path: string) => Promise<void>;
  copyFilePath: (filePath: string) => Promise<void>;
  openFolderInExplorer: (folderPath: string) => Promise<void>;
  clearToast: () => void;
}

/**
 * Custom hook for managing file browser sidebar state and operations
 *
 * Features:
 * - Lazy loading of directory contents
 * - Caching of loaded directories
 * - Copy-to-clipboard with @ prefix
 * - Toast notifications
 *
 * @param projectPath - The root project path
 * @returns File browser state and control functions
 */
export const useFileBrowserSidebar = (projectPath: string): UseFileBrowserSidebarReturn => {
  const { t } = useTranslation();

  const [state, setState] = useState<FileBrowserSidebarState>({
    rootEntries: [],
    expandedDirs: new Set<string>(),
    loadedDirs: new Map<string, FileEntry[]>(),
    loading: false,
    error: null,
  });

  const [toast, setToast] = useState<ToastMessage | null>(null);

  /**
   * Load directory contents from API
   * Uses caching to avoid redundant requests
   */
  const loadDirectory = useCallback(async (path: string): Promise<FileEntry[]> => {
    // Check cache first
    const cached = state.loadedDirs.get(path);
    if (cached) {
      return cached;
    }

    try {
      // Call API
      const entries = await api.listDirectoryContents(path);

      // Sort: directories first, then files (alphabetically within each group)
      const sorted = entries.sort((a: FileEntry, b: FileEntry) => {
        if (a.is_directory !== b.is_directory) {
          return a.is_directory ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      // Update cache
      setState(prev => ({
        ...prev,
        loadedDirs: new Map(prev.loadedDirs).set(path, sorted),
      }));

      return sorted;
    } catch (error) {
      console.error(`Failed to load directory: ${path}`, error);
      setToast({
        message: t('fileBrowser.loadError'),
        type: 'error',
      });
      throw error;
    }
  }, [state.loadedDirs, t]);

  /**
   * Toggle directory expansion/collapse
   * Triggers lazy loading if directory is being expanded for the first time
   */
  const toggleDirectory = useCallback(async (path: string) => {
    const isExpanded = state.expandedDirs.has(path);

    if (isExpanded) {
      // Collapse directory
      setState(prev => {
        const next = new Set(prev.expandedDirs);
        next.delete(path);
        return {
          ...prev,
          expandedDirs: next,
        };
      });
    } else {
      // Expand directory - load contents if not cached
      setState(prev => {
        const next = new Set(prev.expandedDirs);
        next.add(path);
        return {
          ...prev,
          expandedDirs: next,
        };
      });

      // Lazy load directory contents
      if (!state.loadedDirs.has(path)) {
        await loadDirectory(path);
      }
    }
  }, [state.expandedDirs, state.loadedDirs, loadDirectory]);

  /**
   * Copy file path to clipboard with @ prefix
   * Handles paths with spaces by wrapping in quotes
   */
  const copyFilePath = useCallback(async (filePath: string) => {
    try {
      // Calculate relative path from project root
      let relativePath = filePath
        .replace(projectPath, '')
        .replace(/^[/\\]+/, ''); // Remove leading slashes

      // Normalize path separators to forward slashes
      relativePath = relativePath.replace(/\\/g, '/');

      // Format with @ prefix, wrap in quotes if contains spaces
      const atReference = relativePath.includes(' ')
        ? `@"${relativePath}"`
        : `@${relativePath}`;

      // Copy to clipboard
      await clipboardService.writeText(atReference);

      // Show success toast
      setToast({
        message: t('fileBrowser.pathCopied'),
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to copy file path:', error);
      setToast({
        message: t('errors.generic'),
        type: 'error',
      });
    }
  }, [projectPath, t]);

  /**
   * Open directory in system file explorer
   */
  const openFolderInExplorer = useCallback(async (folderPath: string) => {
    try {
      await api.openDirectoryInExplorer(folderPath);
      setToast({
        message: '已在系统文件管理器中打开',
        type: 'info',
      });
    } catch (error) {
      console.error('Failed to open folder:', error);
      setToast({
        message: '打开文件夹失败',
        type: 'error',
      });
    }
  }, []);

  /**
   * Clear toast notification
   */
  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  /**
   * Load root directory on mount and when projectPath changes
   */
  useEffect(() => {
    const loadRootDirectory = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const entries = await loadDirectory(projectPath);
        setState(prev => ({
          ...prev,
          rootEntries: entries,
          loading: false,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: t('fileBrowser.loadError'),
        }));
      }
    };

    loadRootDirectory();
  }, [projectPath, loadDirectory, t]);

  return {
    rootEntries: state.rootEntries,
    expandedDirs: state.expandedDirs,
    loadedDirs: state.loadedDirs,
    loading: state.loading,
    error: state.error,
    toast,
    toggleDirectory,
    copyFilePath,
    openFolderInExplorer,
    clearToast,
  };
};

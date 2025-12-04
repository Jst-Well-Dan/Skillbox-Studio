import React from 'react';
import { FileTreeItem } from './FileTreeItem';
import type { FileEntry } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

interface DirectoryTreeProps {
  /**
   * Array of file/directory entries to display
   */
  entries: FileEntry[];
  /**
   * Current nesting depth (0-based)
   */
  depth: number;
  /**
   * Set of expanded directory paths
   */
  expandedDirs: Set<string>;
  /**
   * Map of loaded directory contents
   */
  loadedDirs: Map<string, FileEntry[]>;
  /**
   * Callback to toggle directory expansion
   */
  onToggle: (path: string) => void;
  /**
   * Callback to copy file path to clipboard
   */
  onCopyPath: (path: string) => void;
  /**
   * Callback to open folder in explorer
   */
  onOpenFolder: (path: string) => void;
}

/**
 * Recursive directory tree component
 *
 * Features:
 * - Renders file/folder hierarchy
 * - Lazy loading (only shows children of expanded directories)
 * - Recursive rendering for nested structures
 * - Empty state handling
 */
export const DirectoryTree: React.FC<DirectoryTreeProps> = ({
  entries,
  depth,
  expandedDirs,
  loadedDirs,
  onToggle,
  onCopyPath,
  onOpenFolder,
}) => {
  const { t } = useTranslation();

  // Handle empty directories
  if (!entries || entries.length === 0) {
    return (
      <div
        className="px-3 py-2 text-xs text-muted-foreground italic"
        style={{ paddingLeft: `${depth * 16 + 28}px` }}
      >
        {t('fileBrowser.emptyDirectory')}
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry) => {
        const isExpanded = expandedDirs.has(entry.path);
        const childEntries = entry.is_directory && isExpanded
          ? loadedDirs.get(entry.path) || []
          : [];

        return (
          <React.Fragment key={entry.path}>
            {/* Render current item */}
            <FileTreeItem
              entry={entry}
              depth={depth}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onCopyPath={onCopyPath}
              onOpenFolder={onOpenFolder}
            />

            {/* Recursively render children if directory is expanded */}
            {entry.is_directory && isExpanded && (
              <DirectoryTree
                entries={childEntries}
                depth={depth + 1}
                expandedDirs={expandedDirs}
                loadedDirs={loadedDirs}
                onToggle={onToggle}
                onCopyPath={onCopyPath}
                onOpenFolder={onOpenFolder}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

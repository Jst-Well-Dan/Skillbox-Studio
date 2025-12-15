import React from 'react';
import {
  Folder,
  ChevronRight,
  ChevronDown,
  FileCode,
  FileText,
  FileImage,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileEntry } from '@/lib/api';

interface FileTreeItemProps {
  /**
   * File or directory entry
   */
  entry: FileEntry;
  /**
   * Nesting depth level (0-based)
   */
  depth: number;
  /**
   * Whether this directory is currently expanded
   */
  isExpanded: boolean;
  /**
   * Callback when directory is clicked (toggle expand/collapse)
   */
  onToggle: (path: string) => void;
  /**
   * Callback when file is clicked (copy path to clipboard)
   */
  onCopyPath: (path: string) => void;
  /**
   * Callback to open folder in explorer
   */
  onOpenFolder?: (path: string) => void;
  /**
   * Project root path for calculating relative paths
   */
  projectPath: string;
}

/**
 * Get the appropriate icon for a file based on its extension
 */
const getFileIcon = (extension?: string) => {
  if (!extension) return <FileText className="h-4 w-4 text-muted-foreground" />;

  const ext = extension.toLowerCase();

  // Code files
  const codeExts = [
    'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h',
    'hpp', 'cs', 'rb', 'php', 'swift', 'kt', 'dart', 'vue', 'svelte',
  ];
  if (codeExts.includes(ext)) {
    return <FileCode className="h-4 w-4 text-blue-500" />;
  }

  // Image files
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
  if (imageExts.includes(ext)) {
    return <FileImage className="h-4 w-4 text-purple-500" />;
  }

  // Default text file
  return <FileText className="h-4 w-4 text-muted-foreground" />;
};

/**
 * Individual file or folder item in the directory tree
 *
 * Features:
 * - Indentation based on depth
 * - Chevron indicator for directories
 * - Appropriate icons for files
 * - Hover effects
 * - Click handlers
 */
export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  entry,
  depth,
  isExpanded,
  onToggle,
  onCopyPath,
  onOpenFolder,
  projectPath,
}) => {
  const handleClick = () => {
    if (entry.is_directory) {
      onToggle(entry.path);
    } else {
      onCopyPath(entry.path);
    }
  };

  // Handle drag start - calculate relative path and set drag data
  const handleDragStart = (e: React.DragEvent) => {
    // Calculate relative path from project root
    const relativePath = entry.path
      .replace(projectPath, '')
      .replace(/^[/\\]+/, '');

    // Normalize path separators to forward slashes
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Add trailing slash for directories
    const pathWithSuffix = entry.is_directory
      ? `${normalizedPath}/`
      : normalizedPath;

    // Set drag data as plain text
    e.dataTransfer.setData('text/plain', pathWithSuffix);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Icon selection
  const icon = entry.is_directory
    ? <Folder className="h-4 w-4 text-blue-500" />
    : getFileIcon(entry.extension);

  // Chevron for directories
  const chevron = entry.is_directory && (
    isExpanded
      ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
  );

  return (
    <div
      role="button"
      tabIndex={0}
      draggable="true"
      onDragStart={handleDragStart}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "group flex items-center gap-2 py-1.5 cursor-grab active:cursor-grabbing select-none",
        "hover:bg-accent transition-colors rounded-sm",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      )}
      style={{
        paddingLeft: `${depth * 16 + 12}px`,
        paddingRight: '12px',
      }}
      aria-label={
        entry.is_directory
          ? `${entry.name} folder, ${isExpanded ? 'expanded' : 'collapsed'}`
          : `${entry.name} file`
      }
    >
      {/* Chevron (directories only) */}
      <div className="w-3 flex-shrink-0">
        {chevron}
      </div>

      {/* Icon */}
      <div className="flex-shrink-0">
        {icon}
      </div>

      {/* Name */}
      <span className="text-sm truncate flex-1 min-w-0">
        {entry.name}
      </span>

      {entry.is_directory && onOpenFolder && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenFolder(entry.path);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
          aria-label={`在文件管理器中打开 ${entry.name}`}
        >
          <FolderOpen className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

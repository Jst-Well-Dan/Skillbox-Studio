import React from 'react';
import { FolderOpen, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

interface SidebarHeaderProps {
  /**
   * Callback when the collapse button is clicked
   */
  onToggleCollapse: () => void;
}

/**
 * Header component for the file browser sidebar
 *
 * Features:
 * - Title with folder icon
 * - Collapse button
 * - Clean border separation
 */
export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  onToggleCollapse,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
      {/* Title with icon */}
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{t('fileBrowser.title')}</h3>
      </div>

      {/* Collapse button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleCollapse}
        className="h-7 w-7 p-0"
        aria-label="折叠侧边栏"
      >
        <PanelLeftClose className="h-4 w-4" />
      </Button>
    </div>
  );
};

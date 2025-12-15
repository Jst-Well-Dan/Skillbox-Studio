import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Collapsible hints section showing usage instructions
 *
 * Features:
 * - Shows helpful tips for using the file browser
 * - Collapsible with localStorage persistence
 * - Smooth animation
 */
export const FileUsageHints: React.FC = () => {
  const { t } = useTranslation();

  // Initialize from localStorage (default: open)
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('fileBrowserHints.dismissed');
    return saved !== 'true'; // Open by default unless explicitly dismissed
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    // Save preference to localStorage
    localStorage.setItem('fileBrowserHints.dismissed', String(!open));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <div className="px-3 py-2 bg-muted/30 border-b border-border flex-shrink-0">
        {/* Collapsible trigger button */}
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="切换使用提示"
          >
            <span>💡 使用提示</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                !isOpen && "-rotate-90"
              )}
            />
          </button>
        </CollapsibleTrigger>

        {/* Collapsible content */}
        <CollapsibleContent className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="select-none">•</span>
            <span>{t('fileBrowser.hints.dragToReference')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="select-none">•</span>
            <span>{t('fileBrowser.hints.clickToCopy')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="select-none">•</span>
            <span>{t('fileBrowser.hints.useAtSymbol')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="select-none">•</span>
            <span>{t('fileBrowser.hints.toggleShortcut')}</span>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

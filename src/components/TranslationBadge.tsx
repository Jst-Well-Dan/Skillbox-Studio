import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranslationBadgeProps {
  /**
   * Whether the content is currently translated
   */
  isTranslated: boolean;

  /**
   * Whether translation is in progress
   */
  isTranslating: boolean;

  /**
   * Callback when badge is clicked to toggle translation
   */
  onToggle: () => void;

  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * TranslationBadge component - Shows translation state and allows toggling
 *
 * States:
 * - Untranslated: Shows "译" badge (gray, clickable)
 * - Translating: Shows "翻译中..." with spinner (loading state)
 * - Translated: Shows "原文" badge (outline, clickable)
 */
export const TranslationBadge: React.FC<TranslationBadgeProps> = ({
  isTranslated,
  isTranslating,
  onToggle,
  className = '',
}) => {
  // Translating state
  if (isTranslating) {
    return (
      <Badge
        variant="secondary"
        className={cn('cursor-wait flex items-center gap-1', className)}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>翻译中...</span>
      </Badge>
    );
  }

  // Translated or Untranslated state (both clickable)
  return (
    <Badge
      variant={isTranslated ? 'outline' : 'secondary'}
      className={cn(
        'cursor-pointer hover:bg-primary/10 transition-colors select-none',
        className
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {isTranslated ? '原文' : '译'}
    </Badge>
  );
};

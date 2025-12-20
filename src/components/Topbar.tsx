import React from "react";
import { motion } from "framer-motion";
import { Settings, BarChart3, Package, Bot, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UpdateBadge } from "@/components/UpdateBadge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

import type { ClaudeStreamMessage } from '@/types/claude';

interface TopbarProps {
  onClaudeClick: () => void;
  onSettingsClick: () => void;
  onUsageClick: () => void;
  onMCPClick: () => void;
  onExtensionsClick?: () => void;
  onTabsClick?: () => void;
  onUpdateClick?: () => void;
  onAboutClick?: () => void;
  onHomeClick?: () => void;
  tabsCount?: number;
  messages?: ClaudeStreamMessage[];
  sessionId?: string;
  className?: string;
}

/**
 * 🎨 Premium Topbar Component - Unified Style
 */
export const Topbar: React.FC<TopbarProps> = ({
  onClaudeClick: _onClaudeClick,
  onSettingsClick,
  onUsageClick,
  onMCPClick: _onMCPClick,
  onExtensionsClick,
  onTabsClick: _onTabsClick,
  onUpdateClick,
  onAboutClick,
  onHomeClick,
  tabsCount: _tabsCount = 0,
  messages: _messages,
  sessionId: _sessionId,
  className,
}) => {
  const { t } = useTranslation();
  
  return (
    <motion.div
      role="banner"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex items-center justify-between gap-4 px-6 lg:px-10 py-4 z-40 relative w-full",
        "border-b border-border/40 bg-card text-foreground shadow-[0_10px_40px_-25px_rgba(15,23,42,0.7)]",
        "transition-colors duration-300",
        className
      )}
    >
      {/* 🔹 Left: Brand & Status */}
      <div className="flex items-center gap-4">
        {/* Brand Logo - Click to go home */}
        <motion.div
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={onHomeClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center">
            <Bot size={14} strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground/90">
            Skillbox Studio
          </span>
        </motion.div>

        {/* About button */}
        {onAboutClick && (
          <motion.button
            onClick={onAboutClick}
            className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="关于 Skillbox Studio"
          >
            <Info size={14} strokeWidth={2} />
          </motion.button>
        )}
      </div>
      
      {/* 🔹 Right: Actions */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15 }}
        className="flex items-center gap-2"
      >
        {/* Update Badge */}
        {onUpdateClick && (
          <UpdateBadge onClick={onUpdateClick} />
        )}

        {/* Theme Toggle */}
        <ThemeToggle
          variant="with-text" 
          size="sm"
          className="h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        />

        {/* Usage */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onUsageClick}
          className="h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all hover:scale-105"
        >
          <BarChart3 className="h-4 w-4 mr-2 opacity-70" strokeWidth={2} />
          {t('navigation.usage')}
        </Button>

        {/* Extensions */}
        {onExtensionsClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExtensionsClick}
            className="h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all hover:scale-105"
          >
            <Package className="h-4 w-4 mr-2 opacity-70" strokeWidth={2} />
            扩展
          </Button>
        )}

        <div className="h-4 w-px bg-border/40 mx-1" />

        {/* Settings */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Settings className="h-4 w-4" strokeWidth={2} />
        </Button>
      </motion.div>
    </motion.div>
  );
}; 

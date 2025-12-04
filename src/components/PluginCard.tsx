import React from 'react';
import { Package } from 'lucide-react';
import type { PluginCard as PluginCardType } from '../lib/pluginReader';

interface PluginCardProps {
  plugin: PluginCardType;
  onStartConversation: (plugin: PluginCardType) => void;
}

/**
 * PluginCard组件 - 显示单个Plugin的卡片
 * 点击后会为该Plugin创建/确保工作空间存在，并启动对话
 *
 * 注：翻译由父组件统一管理
 */
export const PluginCard: React.FC<PluginCardProps> = ({ plugin, onStartConversation }) => {

  return (
    <div
      className="group relative p-6 rounded-xl border-2 border-border hover:border-primary/40 transition-all duration-200 bg-card hover:shadow-lg cursor-pointer"
      onClick={() => onStartConversation(plugin)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onStartConversation(plugin);
        }
      }}
    >
      {/* 顶部：图标 + 名称 */}
      <div className="flex items-start gap-4 mb-4">
        {/* Plugin图标 */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
          <Package className="w-6 h-6 text-blue-500" />
        </div>

        {/* Plugin名称 */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {plugin.name}
          </h3>
          <p className="text-xs text-muted-foreground truncate mt-1">
            {plugin.id}
          </p>
        </div>
      </div>

      {/* 描述 */}
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-4 min-h-[3.6rem]">
        {plugin.description}
      </p>

      {/* 底部：工作空间路径 + 按钮 */}
      <div className="space-y-3">
        {/* 工作空间路径显示 */}
        <div className="text-xs text-muted-foreground/70 truncate">
          <span className="font-mono">📁 {plugin.workspacePath}</span>
        </div>

        {/* 开始对话按钮 */}
        <button
          className="w-full py-2.5 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium text-sm transition-colors duration-200 flex items-center justify-center gap-2 group-hover:bg-primary group-hover:text-primary-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onStartConversation(plugin);
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onStartConversation(plugin);
            }
          }}
        >
          <span>开始对话</span>
          <svg
            className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </button>
      </div>

      {/* 悬浮时的边框高亮效果 */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
    </div>
  );
};

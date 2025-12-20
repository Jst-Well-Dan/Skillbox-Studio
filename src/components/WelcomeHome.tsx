import React from 'react';
import { Bot, FolderOpen, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface WelcomeHomeProps {
  onNavigateTo: (view: 'agents' | 'projects') => void;
}

export const WelcomeHome: React.FC<WelcomeHomeProps> = ({ onNavigateTo }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background relative overflow-hidden min-h-[600px]">
      {/* 🌌 Background Decor - Subtle & Premium */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Soft gradient orb - Top Left */}
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] opacity-40 animate-pulse-slow" />
        {/* Soft gradient orb - Bottom Right */}
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] opacity-40 animate-pulse-slow delay-1000" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJNMCAwaDI0djI0SDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTEgMWgydjJIMUMxeiIgZmlsbD0iY3VycmVudENvbG9yIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz48L3N2Zz4=')] opacity-30" />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-6 flex flex-col items-center gap-16">
        
        {/* 🏷️ Hero Section */}
        <div className="text-center space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium tracking-wide uppercase border border-primary/20">
              Skillbox Studio
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-5xl md:text-6xl font-bold tracking-tight text-foreground"
          >
            一键加载技能，<span style={{ color: 'var(--color-primary)' }}>突破能力象限</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: '#666666' }}
          >
            <span className="font-bold bg-muted px-1.5 py-0.5 rounded" style={{ color: '#4C5458' }}>Skillbox</span> ,让 AI 拥有解决问题的“手”与“眼”。
            <br className="hidden sm:block" />
            无需编程基础，你的想法即刻落地。
          </motion.p>
        </div>

        {/* 🃏 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          
          {/* Card 1: Intelligent Agents */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            onClick={() => onNavigateTo('agents')}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border p-8 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10 flex flex-col h-full justify-between gap-8">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors duration-300">
                  <Bot size={32} strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  全域技能库
                  <Sparkles size={16} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  产选实战技能，按需一键加载，即刻拓宽 AI 能力边界。
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Projects Workspace */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            onClick={() => onNavigateTo('projects')}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border p-8 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10 flex flex-col h-full justify-between gap-8">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors duration-300">
                  <FolderOpen size={32} strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  智能工作台
                  <Zap size={16} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  管理工作项目，跟踪对话历史，随时调用 AI 助手处理任务
                </p>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
};
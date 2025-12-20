import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
// Badge import removed - hidden for UI simplification
import { FilePicker } from "../FilePicker";
import { SlashCommandPicker } from "../SlashCommandPicker";
import { ImagePreview } from "../ImagePreview";
import { ThinkingModeToggle } from "./ThinkingModeToggle";
import { PlanModeToggle } from "./PlanModeToggle";
// ModelSelector import removed - hidden for UI simplification
// Popover import removed - hidden for UI simplification
import { FloatingPromptInputProps, FloatingPromptInputRef, ThinkingMode, ModelType, ModelConfig } from "./types";
import { THINKING_MODES, MODELS } from "./constants";
// formatDuration import removed - hidden for UI simplification
import { useImageHandling } from "./hooks/useImageHandling";
import { useFileSelection } from "./hooks/useFileSelection";
import { useSlashCommands } from "./hooks/useSlashCommands";
import { api } from "@/lib/api";
import { SessionToolbar } from "@/components/SessionToolbar";

// Re-export types for external use
export type { FloatingPromptInputRef, FloatingPromptInputProps, ThinkingMode, ModelType } from "./types";

/**
 * FloatingPromptInput - Refactored modular component
 * 
 * @example
 * const promptRef = useRef<FloatingPromptInputRef>(null);
 * <FloatingPromptInput
 *   ref={promptRef}
 *   onSend={(prompt, model, thinking) => console.log('Send:', prompt, model, thinking)}
 *   isLoading={false}
 *   isPlanMode={false}
 *   onTogglePlanMode={() => setPlanMode(!planMode)}
 * />
 */
const FloatingPromptInputInner = (
  {
    onSend,
    isLoading = false,
    disabled = false,
    defaultModel = "sonnet",
    sessionModel,
    projectPath,
    sessionId: _sessionId,      // 🆕
    projectId: _projectId,      // 🆕
    className,
    onCancel,
    getConversationContext: _getConversationContext,
    messages,       // 🆕 完整消息列表
    isPlanMode = false,
    onTogglePlanMode,
    sessionCost: _sessionCost,
    sessionStats: _sessionStats,
    hasMessages: _hasMessages = false,
    session,
  }: FloatingPromptInputProps,
  ref: React.Ref<FloatingPromptInputRef>,
) => {
  // Helper function to convert backend model string to frontend ModelType
  const parseSessionModel = (modelStr?: string): ModelType | null => {
    if (!modelStr) return null;

    const lowerModel = modelStr.toLowerCase();
    if (lowerModel.includes("opus")) return "opus";
    if (lowerModel.includes("sonnet") && lowerModel.includes("1m")) return "sonnet1m";
    if (lowerModel.includes("sonnet")) return "sonnet";

    return null;
  };

  // State - Initialize selectedModel from sessionModel if available
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelType>(() => {
    const parsedSessionModel = parseSessionModel(sessionModel);
    return parsedSessionModel || defaultModel;
  });
  const [customModelName, setCustomModelName] = useState<string | null>(null);
  const [selectedThinkingMode, setSelectedThinkingMode] = useState<ThinkingMode>("on");
  const [isExpanded, setIsExpanded] = useState(false);
  // showCostPopover state removed - hidden for UI simplification
  const [cursorPosition, setCursorPosition] = useState(0);

  // 动态加载模型列表（包括自定义模型）
  // Note: availableModels is kept for future use when ModelSelector is re-enabled
  const [_availableModels, setAvailableModels] = useState<ModelConfig[]>(MODELS);


  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Custom hooks
  const {
    imageAttachments,
    embeddedImages,
    dragActive,
    handlePaste,
    handleRemoveImageAttachment,
    handleRemoveEmbeddedImage,
    handleDrag,
    handleDrop,
    addImage,
    setImageAttachments,
    setEmbeddedImages,
  } = useImageHandling({
    prompt,
    projectPath,
    isExpanded,
    onPromptChange: setPrompt,
    textareaRef,
    expandedTextareaRef,
  });

  const {
    showFilePicker,
    filePickerQuery,
    detectAtSymbol,
    updateFilePickerQuery,
    handleFileSelect,
    handleFilePickerClose,
    setShowFilePicker,
    setFilePickerQuery,
  } = useFileSelection({
    prompt,
    projectPath,
    cursorPosition,
    isExpanded,
    onPromptChange: setPrompt,
    onCursorPositionChange: setCursorPosition,
    textareaRef,
    expandedTextareaRef,
  });

  const {
    showSlashCommandPicker,
    slashCommandQuery,
    detectSlashSymbol,
    updateSlashCommandQuery,
    handleSlashCommandSelect,
    handleSlashCommandPickerClose,
    setShowSlashCommandPicker,
    setSlashCommandQuery,
  } = useSlashCommands({
    prompt,
    cursorPosition,
    isExpanded,
    onPromptChange: setPrompt,
    onCursorPositionChange: setCursorPosition,
    textareaRef,
    expandedTextareaRef,
  });

  // 恢复会话模型选择（当 sessionModel 变化时）
  useEffect(() => {
    const parsedSessionModel = parseSessionModel(sessionModel);
    if (parsedSessionModel) {
      console.log(`[FloatingPromptInput] Restoring model from session: ${sessionModel} -> ${parsedSessionModel}`);
      setSelectedModel(parsedSessionModel);
      return;
    }

    if (sessionModel && customModelName && sessionModel.toLowerCase() === customModelName.toLowerCase()) {
      setSelectedModel("custom");
    }
  }, [sessionModel, customModelName]);

  // 读取 settings.json 中的自定义模型配置
  useEffect(() => {
    const loadCustomModel = async () => {
      try {
        const settings = await api.getClaudeSettings();
        const envVars = settings?.data?.env || settings?.env;

        if (envVars && typeof envVars === 'object') {
          // 查找自定义模型名称
          const customModel = envVars.ANTHROPIC_MODEL ||
                             envVars.ANTHROPIC_DEFAULT_SONNET_MODEL ||
                             envVars.ANTHROPIC_DEFAULT_OPUS_MODEL;

          if (customModel && typeof customModel === 'string') {
            setCustomModelName(customModel);
            // 检查是否是第三方模型（不是标准的 Claude 模型）
            const isThirdPartyModel = !customModel.toLowerCase().includes('claude') &&
                                     !customModel.toLowerCase().includes('sonnet') &&
                                     !customModel.toLowerCase().includes('opus');

            if (isThirdPartyModel) {
              console.log(`[FloatingPromptInput] Detected custom model: ${customModel}`);

              // 添加自定义模型到列表
              const customModelConfig: ModelConfig = {
                id: "custom" as ModelType,
                name: customModel,
                description: "Third-party model from settings.json",
                icon: <Sparkles className="h-4 w-4" />
              };

              // 更新模型列表（如果还没有自定义模型）
              setAvailableModels(prev => {
                const withoutCustom = prev.filter(m => m.id !== "custom");
                return [...withoutCustom, customModelConfig];
              });
            }
            return;
          }
        }

        // 没有自定义模型时移除占位项
        setCustomModelName(null);
        setAvailableModels(prev => prev.filter(m => m.id !== "custom"));
      } catch (error) {
        console.error('[FloatingPromptInput] Failed to load custom model:', error);
      }
    };

    loadCustomModel();
  }, []); // 只在组件挂载时加载一次

  // Imperative handle for ref
  useImperativeHandle(ref, () => ({
    addImage,
    setPrompt: (text: string) => {
      setPrompt(text);
    },
  }));

  // Toggle thinking mode
  const handleToggleThinkingMode = async () => {
    const newMode: ThinkingMode = selectedThinkingMode === "off" ? "on" : "off";
    setSelectedThinkingMode(newMode);

    // Update settings.json with the new thinking mode
    try {
      const thinkingMode = THINKING_MODES.find(m => m.id === newMode);
      const enabled = newMode === "on";
      const tokens = thinkingMode?.tokens;

      await api.updateThinkingMode(enabled, tokens);
      console.log(`Thinking mode ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error("Failed to update thinking mode in settings.json:", error);
      // Revert the UI state on error
      setSelectedThinkingMode(prev => prev === "off" ? "on" : "off");
    }
  };

  // Focus management when expanded state changes
  useEffect(() => {
    if (isExpanded && expandedTextareaRef.current) {
      expandedTextareaRef.current.focus();
    } else if (!isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight (content height)
    const newHeight = Math.min(textarea.scrollHeight, 160); // Max 160px as per original CSS
    textarea.style.height = `${newHeight}px`;
  };

  // Auto-resize on prompt change
  useEffect(() => {
    const textarea = isExpanded ? expandedTextareaRef.current : textareaRef.current;
    adjustTextareaHeight(textarea);
  }, [prompt, isExpanded]);

  // Tab key listener for thinking mode toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab key (without Shift) to toggle thinking mode
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only if not in textarea (to avoid interfering with textarea Tab)
        const activeElement = document.activeElement;
        const isInTextarea = activeElement?.tagName === 'TEXTAREA';

        if (!isInTextarea && !disabled) {
          e.preventDefault();
          handleToggleThinkingMode();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [disabled]);

  // Event handlers
  const handleSend = () => {
    if (prompt.trim() && !disabled) {
      const runtimeModel =
        selectedModel === "custom" && customModelName ? customModelName : selectedModel;

      let finalPrompt = prompt.trim();

      // Add image attachment paths to the prompt
      if (imageAttachments.length > 0) {
        const imagePathMentions = imageAttachments.map(attachment => {
          return attachment.filePath.includes(' ') ? `@"${attachment.filePath}"` : `@${attachment.filePath}`;
        }).join(' ');

        finalPrompt = finalPrompt + (finalPrompt.endsWith(' ') || finalPrompt === '' ? '' : ' ') + imagePathMentions;
      }

      // Note: Thinking mode is now controlled via settings.json, not per-request
      // The maxThinkingTokens parameter is kept for backward compatibility but not used
      onSend(finalPrompt, runtimeModel as ModelType, undefined);
      setPrompt("");
      setImageAttachments([]);
      setEmbeddedImages([]);

      // Reset textarea height after sending
      setTimeout(() => {
        const textarea = isExpanded ? expandedTextareaRef.current : textareaRef.current;
        if (textarea) {
          textarea.style.height = 'auto';
        }
      }, 0);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;

    // Detect slash command trigger
    detectSlashSymbol(newValue, newCursorPosition);

    // Detect @ file mention trigger
    detectAtSymbol(newValue, newCursorPosition);

    // Update slash command query
    updateSlashCommandQuery(newValue, newCursorPosition);

    // Update file picker query
    updateFilePickerQuery(newValue, newCursorPosition);

    setPrompt(newValue);
    setCursorPosition(newCursorPosition);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showFilePicker && e.key === 'Escape') {
      e.preventDefault();
      setShowFilePicker(false);
      setFilePickerQuery("");
      return;
    }

    if (showSlashCommandPicker && e.key === 'Escape') {
      e.preventDefault();
      setShowSlashCommandPicker(false);
      setSlashCommandQuery("");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !isExpanded && !showFilePicker && !showSlashCommandPicker) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">编写提示词</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(false)}
                  className="h-8 w-8"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Image attachments preview */}
              {imageAttachments.length > 0 && (
                <div className="border-t border-border pt-2">
                  <div className="text-sm font-medium mb-2">附件预览</div>
                  <div className="flex gap-2 overflow-x-auto">
                    {imageAttachments.map((attachment) => (
                      <div key={attachment.id} className="relative flex-shrink-0 group">
                        <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                          <img
                            src={attachment.previewUrl}
                            alt="Screenshot preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => handleRemoveImageAttachment(attachment.id)}
                              className="w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Embedded images preview */}
              {embeddedImages.length > 0 && (
                <ImagePreview
                  images={embeddedImages}
                  onRemove={handleRemoveEmbeddedImage}
                  className="border-t border-border pt-2"
                />
              )}

              <Textarea
                ref={expandedTextareaRef}
                value={prompt}
                onChange={handleTextChange}
                onPaste={handlePaste}
                placeholder="输入您的提示词..."
                className="min-h-[240px] resize-none"
                disabled={disabled}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              />

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {/* 模型选择器已隐藏 - Hidden for simplification
                  <ModelSelector
                    models={availableModels}
                    selectedModel={selectedModel}
                    onSelect={setSelectedModel}
                    disabled={disabled}
                  />
                  */}
                  <ThinkingModeToggle
                    isEnabled={selectedThinkingMode === "on"}
                    onToggle={handleToggleThinkingMode}
                    disabled={disabled}
                  />
                  {onTogglePlanMode && (
                    <PlanModeToggle
                      isPlanMode={isPlanMode || false}
                      onToggle={onTogglePlanMode}
                      disabled={disabled}
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSend}
                    disabled={!prompt.trim() || disabled}
                    size="default"
                  >
                    发送
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Floating Input */}
      <div className={cn("fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}>
        {/* Image attachments preview */}
        {imageAttachments.length > 0 && (
          <div className="border-b border-border p-4">
            <div className="text-sm font-medium mb-2">附件预览</div>
            <div className="flex gap-2 overflow-x-auto">
              {imageAttachments.map((attachment) => (
                <div key={attachment.id} className="relative flex-shrink-0 group">
                  <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                    <img
                      src={attachment.previewUrl}
                      alt="Screenshot preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handleRemoveImageAttachment(attachment.id)}
                        className="w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Embedded images preview */}
        {embeddedImages.length > 0 && (
          <ImagePreview
            images={embeddedImages}
            onRemove={handleRemoveEmbeddedImage}
            className="border-b border-border"
          />
        )}

        <div className="p-4 space-y-2">
          {/* First Row: Prompt Input */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={dragActive ? "拖放图片到这里..." : "向 Claude 提问..."}
              disabled={disabled}
              className={cn(
                "min-h-[56px] max-h-[160px] resize-none pr-10 overflow-y-auto",
                dragActive && "border-primary"
              )}
              rows={1}
              style={{ height: 'auto' }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(true)}
              disabled={disabled}
              className="absolute right-1 bottom-1 h-8 w-8"
              aria-label="展开输入框"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </Button>

            {/* File Picker */}
            <AnimatePresence>
              {showFilePicker && projectPath && projectPath.trim() && (
                <FilePicker
                  basePath={projectPath.trim()}
                  onSelect={handleFileSelect}
                  onClose={handleFilePickerClose}
                  initialQuery={filePickerQuery}
                />
              )}
            </AnimatePresence>

            {/* Slash Command Picker */}
            <AnimatePresence>
              {showSlashCommandPicker && (
                <SlashCommandPicker
                  projectPath={projectPath}
                  onSelect={handleSlashCommandSelect}
                  onClose={handleSlashCommandPickerClose}
                  initialQuery={slashCommandQuery}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Second Row: All Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 模型选择器已隐藏 - Hidden for simplification
            <ModelSelector
              models={availableModels}
              selectedModel={selectedModel}
              onSelect={setSelectedModel}
              disabled={disabled}
            />
            */}
            {/* Thinking Mode Toggle */}
            <ThinkingModeToggle
              isEnabled={selectedThinkingMode === "on"}
              onToggle={handleToggleThinkingMode}
              disabled={disabled}
            />

            {/* Plan Mode Toggle */}
            {onTogglePlanMode && (
              <PlanModeToggle
                isPlanMode={isPlanMode || false}
                onToggle={onTogglePlanMode}
                disabled={disabled}
              />
            )}

            {/* Session Cost - Hidden for UI simplification
            {hasMessages && sessionCost && sessionStats && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                onMouseEnter={() => setShowCostPopover(true)}
                onMouseLeave={() => setShowCostPopover(false)}
              >
                <Popover
                  open={showCostPopover}
                  onOpenChange={setShowCostPopover}
                  trigger={
                    <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 h-8 cursor-default hover:bg-accent transition-colors">
                      <DollarSign className="h-3 w-3 text-green-600 dark:text-green-400" />
                      <span className="font-mono text-xs">{sessionCost}</span>
                      <Info className="h-3 w-3 text-muted-foreground ml-1" />
                    </Badge>
                  }
                  content={
                    <div className="space-y-2">
                      <div className="font-medium text-sm border-b pb-1">会话统计</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">总成本:</span>
                          <span className="font-mono font-medium">{sessionCost}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">总 Tokens:</span>
                          <span className="font-mono">{sessionStats.totalTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>├─ 输入:</span>
                          <span className="font-mono">{sessionStats.inputTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>├─ 输出:</span>
                          <span className="font-mono">{sessionStats.outputTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>├─ Cache 读:</span>
                          <span className="font-mono">{sessionStats.cacheReadTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>└─ Cache 写:</span>
                          <span className="font-mono">{sessionStats.cacheWriteTokens.toLocaleString()}</span>
                        </div>
                        {sessionStats.durationSeconds > 0 && (
                          <>
                            <div className="border-t pt-1 mt-1"></div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">会话时长:</span>
                              <span className="font-mono">{formatDuration(sessionStats.durationSeconds)}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                              <span>API 时长:</span>
                              <span className="font-mono">{formatDuration(sessionStats.apiDurationSeconds)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  }
                  side="top"
                  align="center"
                  className="w-80"
                />
              </motion.div>
            )}

            {hasMessages && sessionCost && !sessionStats && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 h-8">
                  <DollarSign className="h-3 w-3 text-green-600" />
                  <span className="font-mono text-xs">{sessionCost}</span>
                </Badge>
              </motion.div>
            )}
            */}

            {/* Loading Indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-600 h-8"
              >
                <div className="rotating-symbol text-blue-600" style={{ width: '12px', height: '12px' }} />
                <span>处理中</span>
              </motion.div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Session Export Toolbar */}
            {messages && messages.length > 0 && (
              <SessionToolbar
                messages={messages}
                session={session}
                isStreaming={isLoading}
              />
            )}

            {/* Send/Cancel Button */}
            {isLoading ? (
              <Button
                onClick={onCancel}
                variant="destructive"
                size="default"
                disabled={disabled}
                className="h-8"
              >
                取消
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!prompt.trim() || disabled}
                size="default"
                className="h-8"
              >
                发送
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export const FloatingPromptInput = forwardRef(FloatingPromptInputInner);

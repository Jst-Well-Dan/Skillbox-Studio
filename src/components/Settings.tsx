import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Save,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  api,
  type ClaudeSettings,
  type ClaudePermissionConfig
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { LanguageSelector } from "./LanguageSelector";
import { useTranslation } from "@/hooks/useTranslation";
import ProviderManager from "./ProviderManager";
import { TranslationSettings } from "./TranslationSettings";
import { DiagnosticPanel } from "./DiagnosticPanel";
import RouterSetupWizard from "./RouterSetupWizard";
import RouterSettings from "./RouterSettings";

interface SettingsProps {
  /**
   * Callback to go back to the main view
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

interface PermissionRule {
  id: string;
  value: string;
}

/**
 * 全面的设置界面，用于管理 Claude Code 设置
 * 提供无代码界面来编辑 settings.json 文件
 * Comprehensive Settings UI for managing Claude Code settings
 * Provides a no-code interface for editing the settings.json file
 */
export const Settings: React.FC<SettingsProps> = ({
  onBack,
  className,
}) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // Hidden for simplified UI - Event listener for switching to prompt-api tab
  // useEffect(() => {
  //   const handleSwitchTab = () => {
  //     console.log('[Settings] Switching to prompt-api tab');
  //     setActiveTab("prompt-api");
  //   };

  //   window.addEventListener('switch-to-prompt-api-tab', handleSwitchTab);
  //   return () => window.removeEventListener('switch-to-prompt-api-tab', handleSwitchTab);
  // }, []);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Permission rules state
  const [allowRules, setAllowRules] = useState<PermissionRule[]>([]);
  const [denyRules, setDenyRules] = useState<PermissionRule[]>([]);

  // Permission configuration state
  const [permissionConfig, setPermissionConfig] = useState<ClaudePermissionConfig | null>(null);

  // Hooks state
  const [userHooksChanged, setUserHooksChanged] = useState(false);
  const getUserHooks = React.useRef<(() => any) | null>(null);

  // Router setup state
  const [routerSetupComplete, setRouterSetupComplete] = useState(false);

  // 挂载时加载设置
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Check Router dependencies on mount
  useEffect(() => {
    api.checkRouterDependencies().then(status => {
      setRouterSetupComplete(status.node_installed && status.ccr_installed);
    }).catch(() => {
      setRouterSetupComplete(false);
    });
  }, []);



  /**
   * Loads the current Claude settings
   */
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSettings = await api.getClaudeSettings();
      
      // Ensure loadedSettings is an object
      if (!loadedSettings || typeof loadedSettings !== 'object') {
        console.warn("Loaded settings is not an object:", loadedSettings);
        setSettings({});
        return;
      }
      
      setSettings(loadedSettings);

      // Parse permissions
      if (loadedSettings.permissions && typeof loadedSettings.permissions === 'object') {
        if (Array.isArray(loadedSettings.permissions.allow)) {
          setAllowRules(
            loadedSettings.permissions.allow.map((rule: string, index: number) => ({
              id: `allow-${index}`,
              value: rule,
            }))
          );
        }
        if (Array.isArray(loadedSettings.permissions.deny)) {
          setDenyRules(
            loadedSettings.permissions.deny.map((rule: string, index: number) => ({
              id: `deny-${index}`,
              value: rule,
            }))
          );
        }
      }

      // Load permission configuration
      try {
        const config = await api.getClaudePermissionConfig();
        setPermissionConfig(config);
      } catch (err) {
        console.error("Failed to load permission config:", err);
        // Set default permission config if loading fails
        setPermissionConfig({
          allowed_tools: [],
          disallowed_tools: [],
          permission_mode: 'Interactive',
          auto_approve_edits: false,
          enable_dangerous_skip: true, // Default to true for backward compatibility
        });
      }

    } catch (err) {
      console.error("Failed to load settings:", err);
      setError("加载设置失败。请确保 ~/.claude 目录存在。");
      setSettings({});
    } finally {
      setLoading(false);
    }
  };

  /**
   * Saves the current settings
   */
  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setToast(null);

      // Build the settings object
      const updatedSettings: ClaudeSettings = {
        ...settings,
        permissions: {
          allow: allowRules.map(rule => rule.value).filter(v => v.trim()),
          deny: denyRules.map(rule => rule.value).filter(v => v.trim()),
        },
      };

      await api.saveClaudeSettings(updatedSettings);
      setSettings(updatedSettings);

      // Save permission configuration
      if (permissionConfig) {
        await api.updateClaudePermissionConfig(permissionConfig);
      }

      // Save user hooks if changed
      if (userHooksChanged && getUserHooks.current) {
        const hooks = getUserHooks.current();
        await api.updateHooksConfig('user', hooks);
        setUserHooksChanged(false);
      }

      setToast({ message: "Settings saved successfully!", type: "success" });
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("保存设置失败。");
      setToast({ message: "保存设置失败", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full bg-background/50 backdrop-blur-sm">
        {/* Header - Premium Minimalist */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between px-6 py-5 border-b border-border/40"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-9 w-9 rounded-full hover:bg-muted/60 transition-colors"
              aria-label="返回"
            >
              <ArrowLeft className="h-5 w-5 opacity-70" strokeWidth={2} />
            </Button>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{t('settings.title')}</h2>
              <p className="text-sm text-muted-foreground font-light tracking-wide opacity-80">
                  {t('common.configureClaudePreferences')}
              </p>
            </div>
          </div>
          
          <Button
            onClick={saveSettings}
            disabled={saving || loading}
            size="sm"
            className={cn(
              "gap-2 font-medium shadow-lg shadow-primary/20 px-4 flex-shrink-0 bg-[#d97757] hover:bg-[#FE6F00]/90 text-white",
              "transition-all duration-300",
              saving && "scale-95 opacity-80"
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.savingSettings')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {t('common.saveSettings')}
              </>
            )}
          </Button>
        </motion.div>
      
        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 pt-4"
            >
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      
        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
              <TabsList className="w-full justify-start h-12 p-1 bg-muted/30 rounded-xl border border-border/30 gap-1">
                <TabsTrigger
                  value="diagnostic"
                  className="h-full px-6 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-300"
                >
                  环境检测
                </TabsTrigger>
                <TabsTrigger
                  value="general"
                  className="h-full px-6 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-300"
                >
                  {t('settings.general')}
                </TabsTrigger>
                <TabsTrigger
                  value="provider"
                  className="h-full px-6 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-300"
                >
                  API 配置
                </TabsTrigger>
                <TabsTrigger
                  value="router"
                  className="h-full px-6 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-300"
                >
                  CCR 服务
                </TabsTrigger>
                <TabsTrigger
                  value="translation"
                  className="h-full px-6 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-300"
                >
                  翻译
                </TabsTrigger>
              </TabsList>
            
            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <Card className="p-6 space-y-6 border-border/50 shadow-sm rounded-xl">
                <div>
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-foreground">
                    <span className="w-1 h-5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]"/>
                    {t('settings.general')}
                  </h3>

                  <div className="space-y-6">
                    {/* Language Selector */}
                    <div className="bg-muted/30 p-4 rounded-lg border border-border/30 hover:border-border/60 transition-colors">
                       <LanguageSelector />
                    </div>

                    {/* Permission Settings */}
                    <div className="bg-muted/30 p-4 rounded-lg border border-border/30 hover:border-border/60 transition-colors">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-lg font-semibold text-foreground mb-1">权限设置</h4>
                          <p className="text-xs text-muted-foreground">
                            配置 Claude Code 执行权限和安全选项
                          </p>
                        </div>

                        <div className="flex items-center justify-between py-2">
                          <div className="flex-1">
                            <label className="text-sm font-medium text-foreground/90 cursor-pointer">
                              自动授权常规操作
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                              开启后将自动批准读取和写入权限，避免频繁的确认中断，让对话更流畅。系统内置安全锁，将强制拦截删除（rm/del）等危险命令，确保您的文件绝对安全。
                            </p>
                          </div>
                          <Switch
                            checked={permissionConfig?.enable_dangerous_skip ?? false}
                            onCheckedChange={(checked) => {
                              if (permissionConfig) {
                                setPermissionConfig({
                                  ...permissionConfig,
                                  enable_dangerous_skip: checked,
                                });
                              }
                            }}
                            className="ml-4"
                          />
                          </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Hidden for simplified UI - Hooks Settings */}
            {/* <TabsContent value="hooks" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold mb-2">用户钩子</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      配置适用于您用户账户的所有 Claude Code 会话的钩子。
                      这些设置存储在 <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">~/.claude/settings.json</code> 中
                    </p>
                  </div>
                  
                  <HooksEditor
                    key={activeTab}
                    scope="user"
                    className="border-0"
                    hideActions={true}
                    onChange={(hasChanges, getHooks) => {
                      setUserHooksChanged(hasChanges);
                      getUserHooks.current = getHooks;
                    }}
                  />
                </div>
              </Card>
            </TabsContent> */}

            {/* Hidden for simplified UI - Commands Tab */}
            {/* <TabsContent value="commands">
              <Card className="p-6">
                <SlashCommandsManager className="p-0" />
              </Card>
            </TabsContent> */}

            {/* Translation Tab - Zhipu AI 沉浸式翻译 */}
            <TabsContent value="translation">
              <TranslationSettings />
            </TabsContent>

            {/* Hidden for simplified UI - Prompt Enhancement API Tab */}
            {/* <TabsContent value="prompt-api">
              <PromptEnhancementSettings />
            </TabsContent> */}

            {/* Provider Tab - Keep this tab */}
            <TabsContent value="provider">
              <ProviderManager onBack={() => {}} />
            </TabsContent>

            {/* Router Tab */}
            <TabsContent value="router">
              {routerSetupComplete ? (
                <RouterSettings />
              ) : (
                <RouterSetupWizard
                  onSetupComplete={() => setRouterSetupComplete(true)}
                  onGoToEnvironment={() => setActiveTab("diagnostic")}
                />
              )}
            </TabsContent>

            {/* Diagnostic Tab */}
            <TabsContent value="diagnostic">
              <DiagnosticPanel />
            </TabsContent>

            {/* Hidden for simplified UI - Storage Tab */}
            {/* <TabsContent value="storage">
              <StorageTab />
            </TabsContent> */}
            
          </Tabs>
        </div>
      )}
      </div>
      
      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
}; 

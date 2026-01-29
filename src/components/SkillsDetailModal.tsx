import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Languages, Loader2, Check } from "lucide-react";
import { SkillMetadata, translateBatch, detectTextLanguage } from "../lib/api";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

interface SkillsDetailModalProps {
    isOpen: boolean;
    pluginName: string;
    skills: SkillMetadata[];
    onClose: () => void;
    isLoading?: boolean;
    translationConfig?: {
        enabled: boolean;
        api_key: string;
    } | null;
    onTranslationError?: (message: string) => void;
}

type TranslationStatus = 'idle' | 'translating' | 'translated' | 'error';
type DisplayMode = 'original' | 'translated';

export function SkillsDetailModal({
    isOpen,
    pluginName,
    skills,
    onClose,
    isLoading = false,
    translationConfig,
    onTranslationError,
}: SkillsDetailModalProps) {
    const { i18n } = useTranslation();
    const [translationStatus, setTranslationStatus] = useState<TranslationStatus>('idle');
    const [displayMode, setDisplayMode] = useState<DisplayMode>('original');
    const [translatedSkills, setTranslatedSkills] = useState<SkillMetadata[]>([]);

    // Reset state when modal opens or skills change
    useEffect(() => {
        if (isOpen) {
            setTranslationStatus('idle');
            setDisplayMode('original');
            setTranslatedSkills([]);
            checkAutoTranslation();
        }
    }, [isOpen, skills]);

    const checkAutoTranslation = async () => {
        if (skills.length === 0) return;

        try {
            // Check if backend translation is enabled via config
            if (!translationConfig || !translationConfig.enabled) return;

            // Simple heuristic check: if app language is zh and first skill has mostly english
            const firstDesc = skills[0].description || "";
            if (firstDesc && i18n.language.startsWith('zh')) {
                const lang = await detectTextLanguage(firstDesc);
                if (lang === 'en') {
                    // Optional: Could auto-trigger translation here if desired
                    // For now, we just let the user see the "Translate" option
                }
            }
        } catch (error) {
            console.error("Auto-translation check failed:", error);
        }
    };

    const handleTranslate = async () => {
        if (translationStatus === 'translated') {
            // Toggle between original and translated
            setDisplayMode(prev => prev === 'original' ? 'translated' : 'original');
            return;
        }

        if (translationStatus === 'translating') return;

        if (!translationConfig || !translationConfig.enabled) {
            onTranslationError?.("翻译功能未启用，请在设置中开启并配置 API Key。");
            setTranslationStatus('error');
            setTimeout(() => setTranslationStatus('idle'), 3000);
            return;
        }
        if (!translationConfig.api_key) {
            onTranslationError?.("未配置翻译 API Key，请在设置中填写后重试。");
            setTranslationStatus('error');
            setTimeout(() => setTranslationStatus('idle'), 3000);
            return;
        }

        setTranslationStatus('translating');

        try {
            const descriptions = skills.map(s => s.description);
            // Default target: zh if current is not zh, else en. 
            // Simplified logic: matches app language or defaults to zh for chinese users
            const targetLang = i18n.language.startsWith('zh') ? 'zh' : 'en';

            const results = await translateBatch(descriptions, targetLang);

            const newSkills = skills.map((skill, index) => ({
                ...skill,
                description: results[index] || skill.description // Fallback to original if missing
            }));

            setTranslatedSkills(newSkills);
            setTranslationStatus('translated');
            setDisplayMode('translated');
        } catch (error) {
            console.error("Translation failed:", error);
            setTranslationStatus('error');
            onTranslationError?.(error?.toString?.() || "Translation failed");
            // Revert to idle after short delay so user can retry
            setTimeout(() => setTranslationStatus('idle'), 3000);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
                <Dialog.Content
                    className={cn(
                        "fixed top-1/2 left-1/2 z-50 w-full max-w-[500px] md:max-w-md",
                        "transform -translate-x-1/2 -translate-y-1/2",
                        "rounded-xl border border-border bg-background shadow-2xl",
                        "max-h-[80vh] overflow-hidden flex flex-col", // Use flex col for better scroll handling
                        "animate-in fade-in zoom-in-95 duration-200"
                    )}
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                        <Dialog.Title className="text-lg font-semibold text-foreground truncate max-w-[200px]" title={pluginName}>
                            {pluginName}
                        </Dialog.Title>

                        <div className="flex items-center gap-1">
                            {/* Translation Toggle Pill */}
                            {!isLoading && skills.length > 0 && (
                                <button
                                    onClick={handleTranslate}
                                    disabled={translationStatus === 'translating'}
                                    className={cn(
                                        "group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300",
                                        displayMode === 'translated'
                                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                    title={displayMode === 'translated' ? "显示原文" : "翻译内容"}
                                >
                                    {translationStatus === 'translating' ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            <span>翻译中...</span>
                                        </>
                                    ) : translationStatus === 'translated' && displayMode === 'translated' ? (
                                        <>
                                            <Check className="h-3.5 w-3.5" />
                                            <span>已翻译</span>
                                        </>
                                    ) : (
                                        <>
                                            <Languages className="h-3.5 w-3.5" />
                                            <span>{translationStatus === 'translated' ? '显示翻译' : '翻译'}</span>
                                        </>
                                    )}
                                </button>
                            )}

                            <div className="w-px h-4 bg-border mx-1" />

                            <Dialog.Close asChild>
                                <button
                                    className="inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </Dialog.Close>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">正在加载技能...</span>
                            </div>
                        ) : skills.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <p className="text-sm">该插件暂无技能描述</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {skills.map((skill, index) => (
                                    <SkillItem
                                        key={index}
                                        original={skill}
                                        translated={translatedSkills[index]}
                                        showTranslated={displayMode === 'translated'}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function SkillItem({
    original,
    translated,
    showTranslated
}: {
    original: SkillMetadata,
    translated?: SkillMetadata,
    showTranslated: boolean
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Use translated content if available and mode is enabled
    const currentSkill = (showTranslated && translated) ? translated : original;
    const isTranslatedView = showTranslated && !!translated;

    // Determine if text is long enough to need a read more button.
    const hasChinese = /[\u4e00-\u9fa5]/.test(currentSkill.description || '');
    const threshold = hasChinese ? 80 : 120;
    const isLong = currentSkill.description && currentSkill.description.length > threshold;

    return (
        <div className="group relative rounded-lg border border-border/50 bg-card p-3 shadow-sm hover:shadow-md hover:border-border transition-all duration-200">
            <div className="flex items-start gap-3">
                <div className="mt-1.5 h-2 w-2 rounded-full bg-primary/70 group-hover:bg-primary group-hover:shadow-[0_0_8px_rgba(var(--primary),0.5)] transition-all"></div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground break-words leading-tight">
                        {currentSkill.name}
                    </h4>

                    <div className="relative mt-1.5">
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={isTranslatedView ? 'translated' : 'original'}
                                initial={{ opacity: 0, y: 2 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -2 }}
                                transition={{ duration: 0.15 }}
                                className={cn(
                                    "text-xs text-muted-foreground leading-relaxed",
                                    !isExpanded && "line-clamp-3"
                                )}
                                title={!isExpanded ? currentSkill.description : undefined}
                            >
                                {currentSkill.description || "暂无描述"}
                            </motion.p>
                        </AnimatePresence>

                        {isLong && (
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="text-[10px] font-medium text-primary/80 hover:text-primary hover:underline mt-1 bg-transparent border-none cursor-pointer p-0"
                            >
                                {isExpanded ? "收起" : "阅读更多"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

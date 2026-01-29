import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const changeLanguage = async (lng: string) => {
        i18n.changeLanguage(lng);
        setIsOpen(false);

        // Sync with backend config
        try {
            const { getAppConfig, updateGeneralSettings } = await import('../lib/api');
            const config = await getAppConfig();
            const configLang = lng === 'zh' ? 'zh-CN' : lng;

            if (config.general.language !== configLang) {
                await updateGeneralSettings({
                    ...config.general,
                    language: configLang
                });
            }
        } catch (e) {
            console.error("Failed to sync language setting:", e);
        }
    };

    return (
        <div className="relative">
            <Button
                className="w-9 h-9 p-0 bg-transparent hover:bg-muted text-foreground"
                onClick={() => setIsOpen(!isOpen)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            >
                <Languages className="h-5 w-5" />
            </Button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md z-50 bg-white dark:bg-slate-950">
                    <div
                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer"
                        onClick={() => changeLanguage('en')}
                    >
                        English
                    </div>
                    <div
                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer"
                        onClick={() => changeLanguage('zh')}
                    >
                        中文
                    </div>
                </div>
            )}
        </div>
    );
}

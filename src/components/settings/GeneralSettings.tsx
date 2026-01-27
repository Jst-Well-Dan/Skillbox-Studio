import React from 'react';
import { AppConfig } from '../../lib/types_config';
import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { updateGeneralSettings } from '../../lib/api';

import { useTheme } from '../ThemeProvider';

interface GeneralSettingsProps {
    config: AppConfig;
    onChange: (newConfig: AppConfig) => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ config, onChange }) => {
    const { setTheme } = useTheme();

    const handleChange = async (key: keyof AppConfig['general'], value: any) => {

        const newConfig = {
            ...config,
            general: {
                ...config.general,
                [key]: value
            }
        };
        onChange(newConfig);
        await updateGeneralSettings(newConfig.general);
        if (key === 'theme') {
            setTheme(value);
        }
    };

    return (
        <div className="space-y-8">
            {/* Theme Section */}
            <section className="space-y-4">
                <h3 className="text-base font-medium text-foreground">Appearance</h3>
                <div className="grid grid-cols-3 gap-4 max-w-md">
                    <ThemeOption
                        active={config.general.theme === 'light'}
                        onClick={() => handleChange('theme', 'light')}
                        icon={<Sun size={20} />}
                        label="Light"
                    />
                    <ThemeOption
                        active={config.general.theme === 'dark'}
                        onClick={() => handleChange('theme', 'dark')}
                        icon={<Moon size={20} />}
                        label="Dark"
                    />
                    <ThemeOption
                        active={config.general.theme === 'auto'}
                        onClick={() => handleChange('theme', 'auto')}
                        icon={<Monitor size={20} />}
                        label="System"
                    />
                </div>
            </section>

            {/* Language Section */}
            <section className="space-y-4">
                <h3 className="text-base font-medium text-foreground">Language</h3>
                <div className="bg-card border border-border rounded-lg divide-y divide-border max-w-md">
                    <button
                        onClick={() => handleChange('language', 'zh-CN')}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    >
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">简体中文</span>
                            <span className="text-xs text-muted-foreground">Chinese (Simplified)</span>
                        </div>
                        {config.general.language === 'zh-CN' && <Check size={16} className="text-primary" />}
                    </button>
                    <button
                        onClick={() => handleChange('language', 'en')}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    >
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">English</span>
                            <span className="text-xs text-muted-foreground">United States</span>
                        </div>
                        {config.general.language === 'en' && <Check size={16} className="text-primary" />}
                    </button>
                </div>
            </section>

            {/* Update Section */}
            <section className="space-y-4">
                <h3 className="text-base font-medium text-foreground">Updates</h3>
                <div className="flex items-center justify-between max-w-md p-4 bg-card border border-border rounded-lg">
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Check for updates on startup</span>
                        <span className="text-xs text-muted-foreground">Automatically check for new versions of Skillbox Studio</span>
                    </div>
                    <Switch
                        checked={config.general.auto_check_updates}
                        onCheckedChange={(c) => handleChange('auto_check_updates', c)}
                    />
                </div>
            </section>
        </div>
    );
};

const ThemeOption: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({
    active, onClick, icon, label
}) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all
      ${active
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
            }`}
    >
        <div className={active ? 'text-primary' : 'text-muted-foreground'}>{icon}</div>
        <span className={`text-sm font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{label}</span>
    </button>
);

const Switch: React.FC<{ checked: boolean; onCheckedChange: (c: boolean) => void }> = ({ checked, onCheckedChange }) => (
    <button
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
      ${checked ? 'bg-primary' : 'bg-input'}
    `}
    >
        <span
            className={`block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform
        ${checked ? 'translate-x-5' : 'translate-x-0.5'}
      `}
        />
    </button>
);

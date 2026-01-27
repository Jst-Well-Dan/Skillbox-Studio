import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Package, Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MarketplaceSettings } from './MarketplaceSettings';
import { GeneralSettings } from './GeneralSettings';
import { LocalSkillsSettings } from './LocalSkillsSettings';
import { AppConfig } from '../../lib/types_config';

interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
    config: AppConfig;
    onConfigChange: (newConfig: AppConfig) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose, config, onConfigChange }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('general');

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                    >
                        <div
                            className="w-full max-w-4xl h-[600px] bg-background border border-border rounded-xl shadow-2xl flex overflow-hidden pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Sidebar */}
                            <div className="w-64 bg-muted/30 border-r border-border p-4 flex flex-col gap-2">
                                <div className="text-xl font-bold px-4 py-2 mb-4 text-foreground/80">{t('settings.title')}</div>

                                <TabButton
                                    active={activeTab === 'general'}
                                    onClick={() => setActiveTab('general')}
                                    icon={<Settings size={18} />}
                                    label={t('settings.tabs.general')}
                                />
                                <TabButton
                                    active={activeTab === 'marketplace'}
                                    onClick={() => setActiveTab('marketplace')}
                                    icon={<Package size={18} />}
                                    label={t('settings.tabs.marketplace')}
                                />
                                <TabButton
                                    active={activeTab === 'local_skills'}
                                    onClick={() => setActiveTab('local_skills')}
                                    icon={<Folder size={18} />}
                                    label={t('settings.tabs.local_skills')}
                                />
                                {/* 
                <TabButton 
                  active={activeTab === 'agents'} 
                  onClick={() => setActiveTab('agents')}
                  icon={<AppWindow size={18} />}
                  label="Agents"
                />
                */}
                            </div>

                            {/* Content */}
                            <div className="flex-1 flex flex-col min-w-0">
                                <div className="flex items-center justify-between p-4 border-b border-border">
                                    <h2 className="text-lg font-semibold capitalize">
                                        {activeTab === 'general' && t('settings.tabs.general')}
                                        {activeTab === 'marketplace' && t('settings.tabs.marketplace')}
                                        {activeTab === 'local_skills' && t('settings.tabs.local_skills')}
                                    </h2>
                                    <button
                                        onClick={onClose}
                                        className="p-2 hover:bg-muted rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6">
                                    {activeTab === 'general' && (
                                        <GeneralSettings config={config} onChange={onConfigChange} />
                                    )}
                                    {activeTab === 'marketplace' && (
                                        <MarketplaceSettings config={config} onChange={onConfigChange} />
                                    )}
                                    {activeTab === 'local_skills' && (
                                        <LocalSkillsSettings />
                                    )}
                                    {/*
                  {activeTab === 'agents' && (
                    <div>Agent Settings Coming Soon</div>
                  )}
                  */}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
        ${active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
        >
            {icon}
            {label}
        </button>
    );
};

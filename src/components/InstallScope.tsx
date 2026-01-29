import { Card, CardContent, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Globe, FolderOpen } from "lucide-react";
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useTranslation } from "react-i18next";

interface InstallScopeProps {
    scope: "global" | "project";
    projectPath: string;
    onScopeChange: (s: "global" | "project") => void;
    onProjectPathChange: (p: string) => void;
    onNext: () => void;
    onBack: () => void;
}

export function InstallScope({ scope, projectPath, onScopeChange, onProjectPathChange, onNext, onBack }: InstallScopeProps) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col h-full p-6 max-w-4xl mx-auto w-full">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">{t('install_scope.title')}</h2>
                <p className="text-muted-foreground">{t('install_scope.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card
                    className={`cursor-pointer transition-all border-2 ${scope === 'global' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    onClick={() => onScopeChange('global')}
                >
                    <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-4">
                        <Globe className={`h-16 w-16 ${scope === 'global' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                            <CardTitle className="mb-2">{t('install_scope.global')}</CardTitle>
                            <CardDescription className="whitespace-pre-line">
                                {t('install_scope.global_description')}
                            </CardDescription>
                        </div>
                    </CardContent>
                </Card>

                <Card
                    className={`cursor-pointer transition-all border-2 ${scope === 'project' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    onClick={() => onScopeChange('project')}
                >
                    <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-4">
                        <FolderOpen className={`h-16 w-16 ${scope === 'project' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                            <CardTitle className="mb-2">{t('install_scope.project')}</CardTitle>
                            <CardDescription>
                                {t('install_scope.project_description')}
                            </CardDescription>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {scope === 'project' && (
                <div className="mb-8 animate-in fade-in slide-in-from-top-4 p-4 border rounded-md bg-muted/30">
                    <label className="block text-sm font-medium mb-2">{t('install_scope.path_placeholder')}</label>
                    <div className="flex gap-2">
                        <Input
                            value={projectPath}
                            onChange={e => onProjectPathChange(e.target.value)}
                            placeholder="e.g. C:\Users\Dev\MyProject"
                            className="flex-1"
                        />
                        <Button
                            type="button"
                            className="border border-input bg-background text-foreground hover:bg-muted px-3"
                            onClick={async () => {
                                try {
                                    const selected = await openDialog({
                                        directory: true,
                                        multiple: false,
                                        defaultPath: projectPath || undefined,
                                    });
                                    if (selected && typeof selected === 'string') {
                                        onProjectPathChange(selected);
                                    }
                                } catch (err) {
                                    console.error("Failed to open dialog", err);
                                }
                            }}
                        >
                            <FolderOpen className="h-4 w-4 mr-2" />
                            {t('install_scope.browse')}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{t('install_scope.path_hint')}</p>
                </div>
            )}

            <div className="flex justify-between mt-auto">
                <Button
                    className="border border-input bg-background text-foreground hover:bg-muted"
                    onClick={onBack}
                >
                    {t('common.back')}
                </Button>
                <Button
                    onClick={onNext}
                    disabled={scope === 'project' && !projectPath.trim()}
                    className="px-8"
                >
                    {t('skill_market.next')}
                </Button>
            </div>
        </div>
    )
}

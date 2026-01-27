import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { open, ask } from '@tauri-apps/plugin-dialog';
import {
    listRegisteredDirectories,
    registerLocalDirectory,
    unregisterLocalDirectory,
    updateLocalDirectory,
    LocalDirectory
} from '../../lib/api';
import { Plus, Trash2, Folder, Pencil, X, Check, Loader2, AlertCircle } from 'lucide-react';

export const LocalSkillsSettings: React.FC = () => {
    const { t } = useTranslation();
    const [directories, setDirectories] = useState<LocalDirectory[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Editing state
    const [editingPath, setEditingPath] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        loadDirectories();
    }, []);

    const loadDirectories = async () => {
        setIsLoading(true);
        try {
            const dirs = await listRegisteredDirectories();
            setDirectories(dirs);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });

            if (selected && typeof selected === 'string') {
                setIsLoading(true);
                const added = await registerLocalDirectory(selected);
                if (added) {
                    await loadDirectories();
                } else {
                    setError("Directory already registered");
                }
            }
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemove = async (path: string) => {
        const confirmed = await ask(t('dialogs.confirm_remove_directory'), {
            title: t('dialogs.titles.confirm_remove'),
            kind: 'warning',
        });

        if (!confirmed) return;

        try {
            await unregisterLocalDirectory(path);
            await loadDirectories();
            if (editingPath === path) {
                setEditingPath(null);
            }
        } catch (err: any) {
            setError(err.toString());
        }
    };

    const handleStartEdit = (dir: LocalDirectory) => {
        setEditingPath(dir.path);
        setEditName(dir.name);
        setError(null);
    };

    const handleCancelEdit = () => {
        setEditingPath(null);
        setEditName('');
    };

    const handleUpdateDirectory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPath) return;

        setIsLoading(true);
        setError(null);

        try {
            await updateLocalDirectory(editingPath, editName);
            await loadDirectories();
            setEditingPath(null);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-foreground">{t('settings.local_skills.title')}</h3>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
                >
                    <Plus size={16} />
                    {t('settings.local_skills.add_directory')}
                </button>
            </div>

            {error && (
                <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {directories.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                        {isLoading ? t('common.loading') : t('settings.local_skills.no_directories')}
                    </div>
                ) : (
                    directories.map(dir => (
                        <div key={dir.path} className="group flex flex-col p-4 bg-card border border-border rounded-lg hover:shadow-sm transition-all gap-4">
                            {editingPath === dir.path ? (
                                <form onSubmit={handleUpdateDirectory} className="space-y-3">
                                    <div className="grid gap-2">
                                        <label className="text-xs text-muted-foreground">{t('settings.local_skills.display_name')}</label>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="grid gap-1">
                                        <label className="text-xs text-muted-foreground">{t('settings.local_skills.path')}</label>
                                        <div className="text-xs text-muted-foreground break-all opacity-70">
                                            {dir.path}
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            className="p-1.5 text-muted-foreground hover:bg-muted rounded-md"
                                        >
                                            <X size={16} />
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="p-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                                        >
                                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
                                            <Folder size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-medium text-sm truncate">{dir.name}</h4>
                                            <p className="text-xs text-muted-foreground truncate" title={dir.path}>{dir.path}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleStartEdit(dir)}
                                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                                            title={t('settings.local_skills.display_name')}
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleRemove(dir.path)}
                                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                            title={t('dialogs.titles.confirm_remove')}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

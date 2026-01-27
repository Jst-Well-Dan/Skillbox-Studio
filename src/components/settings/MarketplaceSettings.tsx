import React, { useState } from 'react';
import { AppConfig } from '../../lib/types_config';
import { addMarketplaceRepository, addRepositoryToConfig, removeRepositoryFromConfig, updateRepositoryEnabled, updateRepositoryInConfig } from '../../lib/api';
import { Plus, Trash2, GitBranch, AlertCircle, Loader2, Pencil, X, Check } from 'lucide-react';

interface MarketplaceSettingsProps {
    config: AppConfig;
    onChange: (newConfig: AppConfig) => void;
}

export const MarketplaceSettings: React.FC<MarketplaceSettingsProps> = ({ config, onChange }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newRepoUrl, setNewRepoUrl] = useState('');
    const [newRepoName, setNewRepoName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Editing state
    const [editingRepoId, setEditingRepoId] = useState<string | null>(null);
    const [editRepoName, setEditRepoName] = useState('');
    const [editRepoUrl, setEditRepoUrl] = useState('');

    const handleAddRepo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRepoUrl) return;

        setIsLoading(true);
        setError(null);

        try {
            // 1. Call backend to clone and validate
            const repoInfo = await addMarketplaceRepository(newRepoUrl, newRepoName || 'Custom Repo', 'public');

            // 2. Add to config via backend
            await addRepositoryToConfig(repoInfo);

            // 3. Update local state
            const newConfig = {
                ...config,
                marketplace: {
                    ...config.marketplace,
                    repositories: [...config.marketplace.repositories, repoInfo]
                }
            };
            onChange(newConfig);

            setIsAdding(false);
            setNewRepoUrl('');
            setNewRepoName('');
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveRepo = async (id: string) => {
        if (!confirm('Are you sure you want to remove this repository?')) return;

        try {
            await removeRepositoryFromConfig(id);

            const newConfig = {
                ...config,
                marketplace: {
                    ...config.marketplace,
                    repositories: config.marketplace.repositories.filter(r => r.id !== id)
                }
            };
            onChange(newConfig);
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleRepo = async (id: string, enabled: boolean) => {
        try {
            await updateRepositoryEnabled(id, enabled);

            const newConfig = {
                ...config,
                marketplace: {
                    ...config.marketplace,
                    repositories: config.marketplace.repositories.map(r =>
                        r.id === id ? { ...r, enabled } : r
                    )
                }
            };
            onChange(newConfig);
        } catch (err) {
            console.error(err);
        }
    };

    const handleStartEdit = (repo: any) => {
        setEditingRepoId(repo.id);
        setEditRepoName(repo.name);
        setEditRepoUrl(repo.url);
        setError(null);
    };

    const handleCancelEdit = () => {
        setEditingRepoId(null);
        setEditRepoName('');
        setEditRepoUrl('');
    };

    const handleUpdateRepo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRepoId) return;

        setIsLoading(true);
        setError(null);

        try {
            await updateRepositoryInConfig(editingRepoId, editRepoName, editRepoUrl);

            const newConfig = {
                ...config,
                marketplace: {
                    ...config.marketplace,
                    repositories: config.marketplace.repositories.map(r =>
                        r.id === editingRepoId ? { ...r, name: editRepoName, url: editRepoUrl } : r
                    )
                }
            };
            onChange(newConfig);
            setEditingRepoId(null);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-foreground">Repositories</h3>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
                >
                    <Plus size={16} />
                    Add Repository
                </button>
            </div>

            {isAdding && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-sm font-medium">Add New Repository</h4>
                    {error && (
                        <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleAddRepo} className="space-y-3">
                        <div className="grid gap-2">
                            <label className="text-xs text-muted-foreground">Git URL (HTTPS)</label>
                            <input
                                type="url"
                                value={newRepoUrl}
                                onChange={e => setNewRepoUrl(e.target.value)}
                                placeholder="https://github.com/username/repo.git"
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-xs text-muted-foreground">Name (Optional)</label>
                            <input
                                type="text"
                                value={newRepoName}
                                onChange={e => setNewRepoName(e.target.value)}
                                placeholder="My Custom Skills"
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsAdding(false)}
                                className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50"
                            >
                                {isLoading && <Loader2 size={14} className="animate-spin" />}
                                {isLoading ? 'Cloning...' : 'Add Repository'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-3">
                {config.marketplace.repositories.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                        No repositories configured. Add one to get started.
                    </div>
                ) : (
                    config.marketplace.repositories.map(repo => (
                        <div key={repo.id} className="group flex flex-col p-4 bg-card border border-border rounded-lg hover:shadow-sm transition-all gap-4">
                            {editingRepoId === repo.id ? (
                                <form onSubmit={handleUpdateRepo} className="space-y-3">
                                    <div className="grid gap-2">
                                        <label className="text-xs text-muted-foreground">Name</label>
                                        <input
                                            type="text"
                                            value={editRepoName}
                                            onChange={e => setEditRepoName(e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-xs text-muted-foreground">Git URL (HTTPS)</label>
                                        <input
                                            type="url"
                                            value={editRepoUrl}
                                            onChange={e => setEditRepoUrl(e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            required
                                        />
                                    </div>
                                    {error && (
                                        <div className="text-destructive text-xs px-1">
                                            {error}
                                        </div>
                                    )}
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
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full ${repo.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                            <GitBranch size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-sm">{repo.name}</h4>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">{repo.url}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Switch
                                            checked={repo.enabled}
                                            onCheckedChange={(c) => handleToggleRepo(repo.id, c)}
                                        />
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleStartEdit(repo)}
                                                disabled={repo.type === 'official'}
                                                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                                                title="Edit Repository"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleRemoveRepo(repo.id)}
                                                disabled={repo.type === 'official'}
                                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                                                title="Remove Repository"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
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

const Switch: React.FC<{ checked: boolean; onCheckedChange: (c: boolean) => void }> = ({ checked, onCheckedChange }) => (
    <button
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
      ${checked ? 'bg-primary' : 'bg-input'}
    `}
    >
        <span
            className={`block h-3.5 w-3.5 rounded-full bg-background shadow-lg ring-0 transition-transform
        ${checked ? 'translate-x-4' : 'translate-x-1'}
      `}
        />
    </button>
);

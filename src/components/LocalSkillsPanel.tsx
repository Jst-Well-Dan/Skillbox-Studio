import React, { useState, useEffect } from 'react';
import { open, ask } from '@tauri-apps/plugin-dialog';
import {
    registerLocalDirectory,
    unregisterLocalDirectory,
    listRegisteredDirectories,
    scanLocalSkills,
    updateLocalDirectory,
    openProjectFolder,
    LocalSkill,
    LocalSkillScanResult,
    LocalDirectory
} from '../lib/api';
import { SkillCard } from './SkillCard';
import { Button } from './ui/button';
import { FolderPlus, Trash2, RefreshCw, Pencil, FolderOpen } from 'lucide-react';
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

interface LocalSkillsPanelProps {
    onInstall: (skills: LocalSkill[]) => void;
}

export function LocalSkillsPanel({ onInstall }: LocalSkillsPanelProps) {
    const { t } = useTranslation();
    const [registeredDirs, setRegisteredDirs] = useState<LocalDirectory[]>([]);
    const [scannedSkills, setScannedSkills] = useState<LocalSkill[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDir, setSelectedDir] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<LocalSkillScanResult | null>(null);
    const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
    const [editingPath, setEditingPath] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    // Load directories on mount
    useEffect(() => {
        loadDirectories();
    }, []);

    // Reset selection when changing directory
    useEffect(() => {
        setSelectedSkills(new Set());
    }, [selectedDir]);

    const loadDirectories = async () => {
        const dirs = await listRegisteredDirectories();
        setRegisteredDirs(dirs);

        // Auto-select first directory if available and none selected
        if (dirs.length > 0 && !selectedDir) {
            handleScanDirectory(dirs[0].path);
        }
    };

    const handleAddDirectory = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });

            if (selected && typeof selected === 'string') {
                const added = await registerLocalDirectory(selected);
                if (added) {
                    loadDirectories();
                    handleScanDirectory(selected);
                }
            }
        } catch (err) {
            console.error('Failed to select directory:', err);
        }
    };

    const handleRemoveDirectory = async (path: string, e: React.MouseEvent) => {
        e.stopPropagation();

        const confirmed = await ask(t('dialogs.confirm_remove_directory'), {
            title: t('dialogs.titles.confirm_remove'),
            kind: 'warning',
        });

        if (!confirmed) return;

        try {
            await unregisterLocalDirectory(path);
            const newDirs = await listRegisteredDirectories();
            setRegisteredDirs(newDirs);

            if (selectedDir === path) {
                setSelectedDir(null);
                setScannedSkills([]);
                setScanResult(null);

                if (newDirs.length > 0) {
                    handleScanDirectory(newDirs[0].path);
                }
            }
        } catch (err) {
            console.error('Failed to remove directory:', err);
        }
    };

    const handleScanDirectory = async (dirPath: string) => {
        setLoading(true);
        setSelectedDir(dirPath);

        try {
            if (dirPath === "all_directories") {
                // Scan all registered directories
                const allSkills: LocalSkill[] = [];
                let hasError = false;

                for (const dir of registeredDirs) {
                    try {
                        const result = await scanLocalSkills(dir.path);
                        if (result.success) {
                            allSkills.push(...result.skills_found);
                        }
                    } catch (e) {
                        console.error(`Failed to scan ${dir.path}`, e);
                        hasError = true;
                    }
                }

                // Deduplicate by path
                const uniqueSkills = Array.from(new Map(allSkills.map(s => [s.path, s])).values());

                setScanResult({
                    success: !hasError,
                    path: "All Directories",
                    skills_found: uniqueSkills,
                    total_skills: uniqueSkills.length,
                    error_message: hasError ? "Some directories failed to scan" : undefined
                });
                setScannedSkills(uniqueSkills);
            } else {
                const result = await scanLocalSkills(dirPath);
                setScanResult(result);
                if (result.success) {
                    setScannedSkills(result.skills_found);
                } else {
                    setScannedSkills([]);
                }
            }
        } catch (err) {
            console.error('Scan failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleSkill = (skillPath: string) => {
        const newSet = new Set(selectedSkills);
        if (newSet.has(skillPath)) {
            newSet.delete(skillPath);
        } else {
            newSet.add(skillPath);
        }
        setSelectedSkills(newSet);
    };

    const handleBatchInstall = () => {
        const skillsToInstall = scannedSkills.filter(s => selectedSkills.has(s.path));
        onInstall(skillsToInstall);
    };

    const selectAll = () => {
        if (selectedSkills.size === scannedSkills.length) {
            setSelectedSkills(new Set());
        } else {
            setSelectedSkills(new Set(scannedSkills.map(s => s.path)));
        }
    };

    const startEditing = (dir: LocalDirectory, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPath(dir.path);
        setEditName(dir.name);
    };

    const saveEdit = async () => {
        if (editingPath && editName.trim()) {
            await updateLocalDirectory(editingPath, editName.trim());
            setEditingPath(null);
            loadDirectories();
        } else {
            cancelEdit();
        }
    };

    const cancelEdit = () => {
        setEditingPath(null);
        setEditName("");
    };

    const handleOpenFolder = async () => {
        if (selectedDir && selectedDir !== "all_directories") {
            try {
                await openProjectFolder(selectedDir);
            } catch (error) {
                console.error("Failed to open folder:", error);
            }
        }
    };

    const selectedDirObj = registeredDirs.find(d => d.path === selectedDir);

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex gap-6 h-full">
                {/* Sidebar: Directories */}
                <div className="w-64 flex flex-col gap-4 border-r border-border/40 pr-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">{t('local_skills.directories')}</h3>
                        <Button
                            onClick={handleAddDirectory}
                            title={t('local_skills.add_directory')}
                            className="h-8 w-8 border border-input bg-muted/60 text-foreground hover:bg-accent hover:text-accent-foreground p-0 transition-all hover:scale-105 active:scale-95 shadow-sm"
                        >
                            <FolderPlus className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2 overflow-y-auto pr-2">
                        {/* All Directories Option */}
                        <div
                            className={cn(
                                "group flex items-center justify-between p-2 rounded-md text-sm cursor-pointer transition-colors mb-2",
                                selectedDir === "all_directories" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                            )}
                            onClick={() => handleScanDirectory("all_directories")}
                        >
                            <div className="truncate flex-1 font-medium">
                                {t('local_skills.all_directories')}
                            </div>
                        </div>

                        {registeredDirs.length === 0 && (
                            <div className="text-sm text-muted-foreground italic p-2 text-center border border-dashed border-border rounded-md">
                                {t('local_skills.no_directories')}
                            </div>
                        )}

                        {registeredDirs.map(dir => (
                            <div
                                key={dir.path}
                                className={cn(
                                    "group flex items-center justify-between p-2 rounded-md text-sm cursor-pointer transition-colors",
                                    selectedDir === dir.path ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                )}
                                onClick={() => handleScanDirectory(dir.path)}
                            >
                                {editingPath === dir.path ? (
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={saveEdit}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveEdit();
                                            if (e.key === 'Escape') cancelEdit();
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex-1 min-w-0 h-6 text-sm px-1 py-0 mr-2 bg-background border border-input rounded"
                                    />
                                ) : (
                                    <div className="truncate flex-1 font-medium" title={dir.path}>
                                        {dir.name}
                                    </div>
                                )}
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => startEditing(dir, e)}
                                        className="p-1 hover:text-primary mr-1"
                                        title={t('common.edit') || "Edit"}
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={(e) => handleRemoveDirectory(dir.path, e)}
                                        className="p-1 hover:text-destructive"
                                        title={t('common.remove') || "Remove"}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content: Skills */}
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    {selectedDir ? (
                        <>
                            <div className="flex items-center justify-between pb-2 border-b border-border/40">
                                <div>
                                    <h3 className="font-semibold text-lg text-foreground">
                                        {selectedDir === "all_directories" ? t('local_skills.all_directories') : selectedDirObj?.name || "Unknown"}
                                    </h3>
                                    <p className="text-xs text-muted-foreground truncate max-w-md" title={selectedDir}>
                                        {selectedDir === "all_directories" ? `${registeredDirs.length} directories` : selectedDir}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground mr-2">
                                        {loading ? t('local_skills.scanning') : t('local_skills.skills_found', { count: scannedSkills.length })}
                                    </span>

                                    {!loading && scannedSkills.length > 0 && (
                                        <>
                                            <Button
                                                onClick={selectAll}
                                                className="h-8 bg-background text-foreground border border-input hover:bg-accent hover:text-accent-foreground"
                                            >
                                                {selectedSkills.size === scannedSkills.length ? t('local_skills.deselect_all') : t('local_skills.select_all')}
                                            </Button>

                                            <Button
                                                onClick={handleBatchInstall}
                                                disabled={selectedSkills.size === 0}
                                                className="h-8 px-3 text-xs"
                                            >
                                                {t('local_skills.install_selected', { count: selectedSkills.size })}
                                            </Button>
                                        </>
                                    )}

                                    <Button
                                        onClick={() => handleScanDirectory(selectedDir)}
                                        disabled={loading}
                                        className="h-8 w-8 border border-input bg-muted/60 text-foreground hover:bg-accent hover:text-accent-foreground p-0 transition-all hover:scale-105 active:scale-95 shadow-sm ml-2"
                                        title={t('common.refresh') || "Refresh"}
                                    >
                                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                                    </Button>

                                    {selectedDir !== "all_directories" && (
                                        <Button
                                            onClick={handleOpenFolder}
                                            className="h-8 w-8 border border-input bg-muted/60 text-foreground hover:bg-accent hover:text-accent-foreground p-0 transition-all hover:scale-105 active:scale-95 shadow-sm ml-2"
                                            title={t('plugin_card.open_folder')}
                                        >
                                            <FolderOpen className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {scanResult?.error_message && (
                                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                                    {scanResult.error_message}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto p-1">
                                {scannedSkills.map(skill => (
                                    <SkillCard
                                        key={skill.path}
                                        skill={skill}
                                        isSelected={selectedSkills.has(skill.path)}
                                        onToggle={() => toggleSkill(skill.path)}
                                        className="h-full"
                                    />
                                ))}

                                {!loading && scannedSkills.length === 0 && !scanResult?.error_message && (
                                    <div className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground">
                                        <p>{t('local_skills.no_skills_found')}</p>
                                        <p className="text-xs mt-1">{t('local_skills.ensure_skill_md')}</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <FolderPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>{t('local_skills.select_directory_hint')}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

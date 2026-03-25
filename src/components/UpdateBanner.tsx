import { useTranslation } from 'react-i18next';
import { Download, X, Loader2, CheckCircle2 } from 'lucide-react';
import { UpdaterState } from '../hooks/useAppUpdater';

interface UpdateBannerProps {
    state: UpdaterState;
    version?: string;
    onInstall: () => void;
    onDismiss: () => void;
}

export function UpdateBanner({ state, version, onInstall, onDismiss }: UpdateBannerProps) {
    const { t } = useTranslation();

    if (state !== 'available' && state !== 'downloading' && state !== 'installed') {
        return null;
    }

    return (
        <div className="px-6 py-2.5 border-b bg-primary/5 flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
                {state === 'downloading' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                ) : state === 'installed' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                    <Download className="h-4 w-4 text-primary shrink-0" />
                )}
                <span className="text-foreground">
                    {state === 'downloading'
                        ? t('updater.downloading')
                        : state === 'installed'
                            ? t('updater.installed')
                            : t('updater.available', { version })}
                </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {state === 'available' && (
                    <button
                        onClick={onInstall}
                        className="text-xs font-medium px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        {t('updater.download_install')}
                    </button>
                )}
                {state !== 'downloading' && (
                    <button
                        onClick={onDismiss}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title={t('updater.dismiss')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

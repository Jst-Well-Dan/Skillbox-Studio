import { useState, useEffect, useRef } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { getAppConfig } from '../lib/api';

export type UpdaterState = 'idle' | 'checking' | 'available' | 'downloading' | 'installed' | 'dismissed';

export interface UpdaterInfo {
    state: UpdaterState;
    version?: string;
    dismiss: () => void;
    install: () => Promise<void>;
}

export function useAppUpdater(): UpdaterInfo {
    const [state, setState] = useState<UpdaterState>('idle');
    const [version, setVersion] = useState<string | undefined>();
    const updateRef = useRef<Update | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            try {
                const config = await getAppConfig();
                if (!config.general.auto_check_updates || cancelled) return;

                setState('checking');
                const result = await check();

                if (cancelled) return;

                if (result?.available) {
                    updateRef.current = result;
                    setVersion(result.version);
                    setState('available');
                } else {
                    setState('idle');
                }
            } catch {
                if (!cancelled) setState('idle');
            }
        };

        run();
        return () => { cancelled = true; };
    }, []);

    const install = async () => {
        const update = updateRef.current;
        if (!update) return;
        setState('downloading');
        try {
            await update.downloadAndInstall();
            setState('installed');
        } catch {
            setState('available');
        }
    };

    const dismiss = () => setState('dismissed');

    return { state, version, dismiss, install };
}

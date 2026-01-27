import { Button } from "./ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { useTranslation } from "react-i18next";

interface InstallResultProps {
    status: "installing" | "success" | "error";
    message: string;
    onClose: () => void;
}

export function InstallResult({ status, message, onClose }: InstallResultProps) {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in">
            <Card className="w-full max-w-md border shadow-lg">
                <CardContent className="flex flex-col items-center justify-center p-6 space-y-4 pt-10">
                    {status === 'installing' && (
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    )}
                    {status === 'success' && (
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                    )}
                    {status === 'error' && (
                        <XCircle className="h-12 w-12 text-destructive" />
                    )}

                    <h2 className="text-xl font-semibold">
                        {status === 'installing' ? t('install_result.installing') : status === 'success' ? t('install_result.success') : t('install_result.failed')}
                    </h2>

                    <div className="text-center text-sm text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto w-full bg-muted/30 p-2 rounded">
                        {message || t('install_result.please_wait')}
                    </div>

                    {status !== 'installing' && (
                        <Button onClick={onClose} className="w-full mt-4">
                            {t('common.close')}
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

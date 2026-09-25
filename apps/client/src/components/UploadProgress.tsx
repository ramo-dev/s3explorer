import { Spinner } from './ui/spinner';
import { Progress } from './ui/progress';

interface UploadProgressProps {
    uploading: boolean;
    progress: number;
}

export function UploadProgress({ uploading, progress }: UploadProgressProps) {
    if (!uploading) return null;

    return (
        <div
            className="px-4 py-3 border-b border-border bg-background-secondary animate-fadeInDown"
            role="status"
            aria-live="polite"
            aria-label={`Uploading files: ${progress}% complete`}
        >
            <div className="flex items-center gap-3">
                <Spinner className="text-primary" aria-label="Uploading" />

                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm">Uploading…</span>
                        <span className="text-sm text-foreground-muted tabular-nums">{progress}%</span>
                    </div>

                    <Progress
                        className="gap-0"
                        value={progress}
                        aria-label={`Uploading files: ${progress}% complete`}
                    />
                </div>
            </div>
        </div>
    );
}

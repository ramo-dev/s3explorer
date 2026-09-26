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
            className="animate-fade-in-down border-b border-border bg-card px-4 py-3"
            role="status"
            aria-live="polite"
            aria-label={`Uploading files: ${progress}% complete`}
        >
            <div className="flex items-center gap-3">
                <Spinner className="text-primary" aria-label="Uploading" />

                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm">Uploading…</span>
                        <span className="text-sm tabular-nums text-muted-foreground">{progress}%</span>
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

import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import type { UploadJobSummary, UploadProgressState } from '@/types';

interface UploadProgressProps {
    uploading: boolean;
    progress: UploadProgressState;
    jobs: UploadJobSummary[];
    onCancel: () => void;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unit = units[0];
    for (let index = 1; value >= 1024 && index < units.length; index++) { value /= 1024; unit = units[index]; }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

function formatEta(seconds: number | null) {
    if (seconds === null || !Number.isFinite(seconds)) return 'Calculating time…';
    if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))}s left`;
    return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s left`;
}

export function UploadProgress({ uploading, progress, jobs, onCancel }: UploadProgressProps) {
    const activeJobs = jobs.filter(job => job.status === 'active');
    if (!uploading && activeJobs.length === 0) return null;
    const remoteFiles = activeJobs.reduce((sum, job) => sum + job.totalFiles, 0);
    const remoteCompleted = activeJobs.reduce((sum, job) => sum + job.completedFiles, 0);
    const remoteActive = activeJobs.reduce((sum, job) => sum + job.activeFiles, 0);
    const remoteProgress = remoteFiles ? Math.round((remoteCompleted / remoteFiles) * 100) : 0;
    const shownProgress = uploading ? progress.percent : remoteProgress;
    const jobLabel = activeJobs.length > 1
        ? `${activeJobs.length} upload batches`
        : `${Math.max(remoteFiles, 1)} files${remoteActive ? ` · ${remoteActive} active` : ''}`;

    return (
        <div
            className="animate-fade-in-down border-b border-border bg-card px-4 py-3"
            role="status"
            aria-live="polite"
            aria-label={`Uploading ${jobLabel}: ${shownProgress}% complete`}
        >
            <div className="flex items-center gap-3">
                <Spinner className="text-primary" aria-label="Uploading" />

                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm">Uploading {jobLabel}…</span>
                        <span className="text-sm tabular-nums text-muted-foreground">{shownProgress}%</span>
                    </div>

                    <Progress
                        className="gap-0"
                        value={shownProgress}
                        aria-label={`Uploading ${jobLabel}: ${shownProgress}% complete`}
                    />
                    {uploading && (
                        <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>{formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)} · {formatBytes(progress.speedBps)}/s · {formatEta(progress.etaSeconds)}</span>
                            <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5" onClick={onCancel} aria-label="Cancel upload">
                                Cancel upload
                            </Button>
                        </div>
                    )}
                    {uploading && progress.multipart && progress.multipart.totalParts > 0 && (
                        <div className="mt-2" aria-label={`${progress.multipart.completedParts} of ${progress.multipart.totalParts} chunks sent`}>
                            <div className="mb-1 text-xs text-muted-foreground">Chunks sent: {progress.multipart.completedParts} / {progress.multipart.totalParts}</div>
                            <div className="flex gap-0.5">
                                {Array.from({ length: progress.multipart.totalParts }, (_, index) => (
                                    <span key={index} className={`h-1 flex-1 rounded-full ${index < progress.multipart!.completedParts ? 'bg-primary' : 'bg-muted'}`} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import type { UploadJobSummary } from '@/types';

interface UploadProgressProps {
    uploading: boolean;
    progress: number;
    jobs: UploadJobSummary[];
}

export function UploadProgress({ uploading, progress, jobs }: UploadProgressProps) {
    const activeJobs = jobs.filter(job => job.status === 'active');
    if (!uploading && activeJobs.length === 0) return null;
    const remoteFiles = activeJobs.reduce((sum, job) => sum + job.totalFiles, 0);
    const remoteCompleted = activeJobs.reduce((sum, job) => sum + job.completedFiles, 0);
    const remoteActive = activeJobs.reduce((sum, job) => sum + job.activeFiles, 0);
    const remoteProgress = remoteFiles ? Math.round((remoteCompleted / remoteFiles) * 100) : 0;
    const shownProgress = uploading ? progress : remoteProgress;
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
                </div>
            </div>
        </div>
    );
}

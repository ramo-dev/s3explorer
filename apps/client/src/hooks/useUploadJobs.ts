import { useEffect, useState } from 'react';
import { listUploadJobs } from '@/api/objects';
import type { UploadJobSummary } from '@/types';

const UPLOAD_JOB_POLL_INTERVAL = 5000;

export function useUploadJobs(enabled: boolean, pollingEnabled = true): UploadJobSummary[] {
  const [jobs, setJobs] = useState<UploadJobSummary[]>([]);

  useEffect(() => {
    if (!enabled) {
      setJobs([]);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await listUploadJobs();
        if (!cancelled) setJobs(next);
      } catch {
        // Upload progress is informational; the upload itself has its own error path.
      }
    };
    if (!pollingEnabled) return () => { cancelled = true; };
    void refresh();
    const timer = window.setInterval(() => void refresh(), UPLOAD_JOB_POLL_INTERVAL);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, pollingEnabled]);

  return jobs;
}

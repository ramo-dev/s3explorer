import { useEffect, useState } from 'react';
import { listUploadJobs } from '@/api/objects';
import type { UploadJobSummary } from '@/types';

export function useUploadJobs(enabled: boolean): UploadJobSummary[] {
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
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return jobs;
}

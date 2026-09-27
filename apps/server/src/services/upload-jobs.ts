import { randomUUID } from 'node:crypto';

export interface UploadJobSummary {
  id: string;
  bucket: string;
  prefix: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  activeFiles: number;
  totalBytes: number;
  completedBytes: number;
  status: 'active' | 'complete' | 'failed';
  createdAt: number;
  updatedAt: number;
}

interface UploadJob extends UploadJobSummary {
  running: Set<number>;
}

const jobs = new Map<string, UploadJob>();
const KEEP_MS = 10 * 60 * 1000;

function summary(job: UploadJob): UploadJobSummary {
  const { running, ...result } = job;
  return { ...result, activeFiles: running.size };
}

function getJob(id: string): UploadJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  job.updatedAt = Date.now();
  return job;
}

export function createUploadJob(bucket: string, prefix: string, totalFiles: number, totalBytes: number): UploadJobSummary {
  const now = Date.now();
  const job: UploadJob = {
    id: randomUUID(), bucket, prefix, totalFiles, completedFiles: 0, failedFiles: 0,
    activeFiles: 0, totalBytes, completedBytes: 0, status: 'active', createdAt: now,
    updatedAt: now, running: new Set(),
  };
  jobs.set(job.id, job);
  return summary(job);
}

export function startUploadFile(id: string, index: number): void {
  const job = getJob(id);
  if (job?.status === 'active') job.running.add(index);
}

export function completeUploadFile(id: string, index: number, bytes: number): void {
  const job = getJob(id);
  if (!job || job.status !== 'active') return;
  job.running.delete(index);
  job.completedFiles += 1;
  job.completedBytes += bytes;
  if (job.completedFiles + job.failedFiles >= job.totalFiles) job.status = job.failedFiles ? 'failed' : 'complete';
}

export function failUploadFile(id: string, index: number): void {
  const job = getJob(id);
  if (!job || job.status !== 'active') return;
  job.running.delete(index);
  job.failedFiles += 1;
  if (job.completedFiles + job.failedFiles >= job.totalFiles) job.status = 'failed';
}

export function listUploadJobs(bucket?: string): UploadJobSummary[] {
  const cutoff = Date.now() - KEEP_MS;
  for (const [id, job] of jobs) {
    if (job.updatedAt < cutoff) jobs.delete(id);
  }
  return [...jobs.values()]
    .filter(job => !bucket || job.bucket === bucket)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(summary);
}

export function failUploadJob(id: string): void {
  const job = getJob(id);
  if (job) {
    job.status = 'failed';
    job.running.clear();
  }
}

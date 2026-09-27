import { randomUUID } from 'node:crypto';
import * as s3 from './s3.js';
import * as uploadJobs from './upload-jobs.js';

export const MULTIPART_PART_SIZE = 16 * 1024 * 1024;
const SESSION_TTL = 24 * 60 * 60 * 1000;

interface MultipartSession {
  id: string;
  bucket: string;
  key: string;
  uploadId: string;
  size: number;
  totalParts: number;
  createdAt: number;
  jobId?: string;
  fileIndex?: number;
}

const sessions = new Map<string, MultipartSession>();

const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL;
  for (const [id, value] of sessions) {
    if (value.createdAt >= cutoff) continue;
    sessions.delete(id);
    void s3.abortMultipartUpload(value.bucket, value.key, value.uploadId).catch(() => undefined);
  }
}, 60 * 60 * 1000);
cleanupTimer.unref();

function session(id: string): MultipartSession {
  const value = sessions.get(id);
  if (!value || Date.now() - value.createdAt > SESSION_TTL) throw new Error('Multipart upload session expired');
  return value;
}

export async function create(bucket: string, key: string, size: number, contentType?: string, jobId?: string, fileIndex?: number): Promise<MultipartSession & { partSize: number }> {
  const uploadId = await s3.initiateMultipartUpload(bucket, key, contentType);
  const value = { id: randomUUID(), bucket, key, uploadId, size, totalParts: Math.ceil(size / MULTIPART_PART_SIZE), createdAt: Date.now(), jobId, fileIndex };
  sessions.set(value.id, value);
  if (jobId && fileIndex !== undefined && Number.isInteger(fileIndex)) uploadJobs.startUploadFile(jobId, fileIndex);
  return { ...value, partSize: MULTIPART_PART_SIZE };
}

export async function signPart(id: string, partNumber: number): Promise<{ url: string; partSize: number }> {
  const value = session(id);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > value.totalParts) throw new Error('Invalid multipart part number');
  return { url: await s3.signMultipartPart(value.bucket, value.key, value.uploadId, partNumber), partSize: MULTIPART_PART_SIZE };
}

export async function complete(id: string, parts: Array<{ PartNumber: number; ETag: string }>): Promise<{ bucket: string; key: string; size: number }> {
  const value = session(id);
  if (parts.length !== value.totalParts || parts.some(part => !Number.isInteger(part.PartNumber) || !part.ETag)) throw new Error('Incomplete multipart upload');
  await s3.completeMultipartUpload(value.bucket, value.key, value.uploadId, parts);
  sessions.delete(id);
  if (value.jobId && value.fileIndex !== undefined && Number.isInteger(value.fileIndex)) uploadJobs.completeUploadFile(value.jobId, value.fileIndex, value.size);
  return { bucket: value.bucket, key: value.key, size: value.size };
}

export async function abort(id: string): Promise<void> {
  const value = session(id);
  await s3.abortMultipartUpload(value.bucket, value.key, value.uploadId);
  sessions.delete(id);
  if (value.jobId && value.fileIndex !== undefined && Number.isInteger(value.fileIndex)) uploadJobs.failUploadFile(value.jobId, value.fileIndex);
}

import { API_TIMEOUTS } from '../constants';
import type { UploadJobSummary, UploadProgressState } from '../types';
import { ApiError, apiUrl, request, responseJson } from './client';

export interface UploadResult { key: string; size: number; }
export interface UploadOptions {
  onProgress?: (progress: UploadProgressState) => void;
  signal?: AbortSignal;
}

const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const MULTIPART_PART_CONCURRENCY = 3;

export function getUploadPath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new ApiError('Upload cancelled', 0, 'CANCELLED');
}

async function createUploadJob(bucket: string, prefix: string, files: File[], names: string[]): Promise<UploadJobSummary> {
  const response = await request(apiUrl(`/objects/${encodeURIComponent(bucket)}/upload/jobs`), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, files: files.map((file, index) => ({ name: names[index], size: file.size })) }),
  });
  return responseJson<UploadJobSummary>(response);
}

async function failUploadJob(bucket: string, jobId: string): Promise<void> {
  await request(apiUrl(`/objects/${encodeURIComponent(bucket)}/upload/jobs/${encodeURIComponent(jobId)}/fail`), { method: 'POST' });
}

interface MultipartSession { sessionId: string; partSize: number; totalParts: number; }

async function initiateMultipart(bucket: string, key: string, file: File, jobId: string, fileIndex: number): Promise<MultipartSession> {
  const response = await request(apiUrl('/objects/multipart/initiate'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, key, size: file.size, contentType: file.type || 'application/octet-stream', jobId, fileIndex }),
  });
  return responseJson<MultipartSession>(response);
}

async function putSignedPart(url: string, body: Blob, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const cancel = () => xhr.abort();
    xhr.open('PUT', url);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag');
        if (etag) resolve(etag);
        else reject(new ApiError('Storage did not return a part checksum', xhr.status, 'MULTIPART_ETAG_MISSING'));
      } else reject(new ApiError('Multipart upload failed', xhr.status, 'MULTIPART_PART_FAILED'));
    };
    xhr.onerror = () => reject(new ApiError('Network error during multipart upload', 0, 'NETWORK_ERROR'));
    xhr.onabort = () => reject(new ApiError('Upload cancelled', 0, 'CANCELLED'));
    xhr.ontimeout = () => reject(new ApiError('Multipart part timed out', 408, 'TIMEOUT'));
    xhr.timeout = API_TIMEOUTS.UPLOAD;
    signal?.addEventListener('abort', cancel, { once: true });
    checkCancelled(signal);
    xhr.send(body);
  });
}

async function uploadPartWithRetry(sessionId: string, partNumber: number, body: Blob, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      checkCancelled(signal);
      const signedResponse = await request(apiUrl(`/objects/multipart/${encodeURIComponent(sessionId)}/parts/${partNumber}/url`), { method: 'POST' });
      const { url } = await responseJson<{ url: string }>(signedResponse);
      return await putSignedPart(url, body, onProgress, signal);
    } catch (error) {
      lastError = error;
      if ((error as { code?: string }).code === 'CANCELLED') throw error;
      if (attempt < 2) await new Promise(resolve => window.setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function uploadMultipartFile(bucket: string, prefix: string, file: File, name: string, jobId: string, fileIndex: number, onProgress: (loaded: number, parts: { completedParts: number; totalParts: number }) => void, signal?: AbortSignal): Promise<UploadResult[]> {
  const key = `${prefix}${name}`;
  const session = await initiateMultipart(bucket, key, file, jobId, fileIndex);
  const parts: Array<{ PartNumber: number; ETag: string }> = [];
  const loaded = new Array<number>(session.totalParts).fill(0);
  let nextPart = 1;
  const report = () => onProgress(loaded.reduce((sum, value) => sum + value, 0), {
    completedParts: loaded.filter((value, index) => value >= Math.min(session.partSize, file.size - index * session.partSize)).length,
    totalParts: session.totalParts,
  });
  const worker = async () => {
    while (nextPart <= session.totalParts) {
      checkCancelled(signal);
      const partNumber = nextPart++;
      const start = (partNumber - 1) * session.partSize;
      const blob = file.slice(start, Math.min(start + session.partSize, file.size));
      const etag = await uploadPartWithRetry(session.sessionId, partNumber, blob, value => { loaded[partNumber - 1] = value; report(); }, signal);
      parts.push({ PartNumber: partNumber, ETag: etag });
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(MULTIPART_PART_CONCURRENCY, session.totalParts) }, worker));
    checkCancelled(signal);
    const completeResponse = await request(apiUrl(`/objects/multipart/${encodeURIComponent(session.sessionId)}/complete`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parts }),
    });
    await responseJson(completeResponse);
    onProgress(file.size, { completedParts: session.totalParts, totalParts: session.totalParts });
    return [{ key, size: file.size }];
  } catch (error) {
    await request(apiUrl(`/objects/multipart/${encodeURIComponent(session.sessionId)}`), { method: 'DELETE' }).catch(() => undefined);
    throw error;
  }
}

function uploadOneFile(bucket: string, prefix: string, file: File, name: string, jobId: string, fileIndex: number, onProgress: (loaded: number, parts?: { completedParts: number; totalParts: number }) => void, signal?: AbortSignal): Promise<UploadResult[]> {
  if (file.size > MULTIPART_THRESHOLD) return uploadMultipartFile(bucket, prefix, file, name, jobId, fileIndex, onProgress as (loaded: number, parts: { completedParts: number; totalParts: number }) => void, signal);
  const formData = new FormData();
  formData.append('prefix', prefix); formData.append('files', file); formData.append('names', JSON.stringify([name]));
  formData.append('jobId', jobId); formData.append('fileIndex', String(fileIndex));
  return new Promise<UploadResult[]>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl(`/objects/${encodeURIComponent(bucket)}/upload`)); xhr.withCredentials = true; xhr.timeout = API_TIMEOUTS.UPLOAD;
    const cancel = () => xhr.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve((JSON.parse(xhr.responseText) as { uploaded?: UploadResult[] }).uploaded ?? []); } catch { resolve([]); }
      } else {
        try { const data = JSON.parse(xhr.responseText); const error = new ApiError(data.error || data.message || data.Message || 'Upload failed', xhr.status, undefined, data.s3Code || data.code || data.Code); error.message = error.getUserMessage(); reject(error); } catch { reject(new ApiError('Upload failed', xhr.status, 'UPLOAD_ERROR')); }
      }
    };
    xhr.onerror = () => reject(new ApiError('Network error - check your connection', 0, 'NETWORK_ERROR'));
    xhr.onabort = () => reject(new ApiError('Upload cancelled', 0, 'CANCELLED'));
    xhr.ontimeout = () => reject(new ApiError('Request timed out', 408, 'TIMEOUT'));
    checkCancelled(signal); xhr.send(formData);
  });
}

export async function uploadFiles(bucket: string, prefix: string, files: File[], renamedNames?: Map<File, string>, options: UploadOptions = {}): Promise<UploadResult[]> {
  const names = files.map(file => renamedNames?.get(file) ?? getUploadPath(file));
  const job = await createUploadJob(bucket, prefix, files, names);
  const progress = new Array<number>(files.length).fill(0);
  const partCounts = new Array<{ completedParts: number; totalParts: number } | undefined>(files.length);
  const results: UploadResult[] = [];
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const startedAt = performance.now();
  let nextIndex = 0;
  const report = () => {
    const uploadedBytes = progress.reduce((sum, value) => sum + value, 0);
    const elapsedSeconds = (performance.now() - startedAt) / 1000;
    const speedBps = elapsedSeconds > 0 ? uploadedBytes / elapsedSeconds : 0;
    const remaining = Math.max(totalBytes - uploadedBytes, 0);
    const multipart = { completedParts: 0, totalParts: 0 };
    for (const value of partCounts) {
      multipart.completedParts += value?.completedParts ?? 0;
      multipart.totalParts += value?.totalParts ?? 0;
    }
    options.onProgress?.({ percent: totalBytes ? Math.round((uploadedBytes / totalBytes) * 100) : 100, uploadedBytes, totalBytes, speedBps, etaSeconds: speedBps > 0 ? remaining / speedBps : null, multipart: multipart.totalParts > 0 ? multipart : undefined });
  };
  const worker = async () => {
    while (nextIndex < files.length) {
      checkCancelled(options.signal);
      const index = nextIndex++;
      const uploaded = await uploadOneFile(bucket, prefix, files[index], names[index], job.id, index, (loaded, parts) => { progress[index] = loaded; partCounts[index] = parts; report(); }, options.signal);
      results.push(...uploaded);
    }
  };
  try { await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker)); return results; }
  catch (error) { await failUploadJob(bucket, job.id).catch(() => undefined); throw error; }
}

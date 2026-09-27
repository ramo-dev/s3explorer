import { API_TIMEOUTS } from '../constants';
import type { S3Object, UploadJobSummary } from '../types';
import { ApiError, apiUrl, request, responseJson } from './client';

export interface ObjectListing { objects: S3Object[]; nextContinuationToken?: string; isTruncated: boolean; }

export async function listObjects(bucket: string, prefix = '', maxKeys?: number, continuationToken?: string): Promise<ObjectListing> {
  const params = new URLSearchParams({ prefix });
  if (maxKeys !== undefined) params.set('maxKeys', String(maxKeys));
  if (continuationToken) params.set('continuationToken', continuationToken);
  return responseJson(await request(apiUrl(`/objects/${encodeURIComponent(bucket)}?${params}`), { requestKey: 'listObjects' }));
}

export async function searchObjects(bucket: string, query: string): Promise<S3Object[]> {
  const params = new URLSearchParams({ q: query });
  return (await responseJson<{ results: S3Object[] }>(await request(apiUrl(`/objects/${encodeURIComponent(bucket)}/search?${params}`), { requestKey: 'searchObjects' }))).results;
}

export function getProxyUrl(bucket: string, key: string, width?: number) {
  const params = new URLSearchParams({ key });
  if (width) params.set('w', String(width));
  return apiUrl(`/objects/${encodeURIComponent(bucket)}/proxy?${params}`);
}

export async function createZipDownload(bucket: string, prefix: string, objects: Array<{ key: string; isFolder: boolean }>) {
  return responseJson<{ token: string; filename: string; fileCount: number }>(await request(apiUrl(`/objects/${encodeURIComponent(bucket)}/zip`), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix, objects }), timeout: API_TIMEOUTS.ZIP_PREPARE,
  }));
}

export const getZipUrl = (bucket: string, token: string) => apiUrl(`/objects/${encodeURIComponent(bucket)}/zip/${token}`);

export interface UploadResult { key: string; size: number; }
const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const MULTIPART_PART_CONCURRENCY = 3;
export function getUploadPath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

export async function listUploadJobs(): Promise<UploadJobSummary[]> {
  const response = await request(apiUrl('/objects/uploads/jobs'));
  return (await responseJson<{ jobs: UploadJobSummary[] }>(response)).jobs;
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

async function putSignedPart(url: string, body: Blob, onProgress: (loaded: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
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
    xhr.ontimeout = () => reject(new ApiError('Multipart part timed out', 408, 'TIMEOUT'));
    xhr.timeout = API_TIMEOUTS.UPLOAD;
    xhr.send(body);
  });
}

async function uploadPartWithRetry(sessionId: string, partNumber: number, body: Blob, onProgress: (loaded: number) => void): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const signedResponse = await request(apiUrl(`/objects/multipart/${encodeURIComponent(sessionId)}/parts/${partNumber}/url`), { method: 'POST' });
      const { url } = await responseJson<{ url: string }>(signedResponse);
      return await putSignedPart(url, body, onProgress);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => window.setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function uploadMultipartFile(bucket: string, prefix: string, file: File, name: string, jobId: string, fileIndex: number, onProgress: (loaded: number) => void): Promise<UploadResult[]> {
  const key = `${prefix}${name}`;
  const session = await initiateMultipart(bucket, key, file, jobId, fileIndex);
  const parts: Array<{ PartNumber: number; ETag: string }> = [];
  const loaded = new Array<number>(session.totalParts).fill(0);
  let nextPart = 1;
  const report = () => onProgress(loaded.reduce((sum, value) => sum + value, 0));
  const worker = async () => {
    while (nextPart <= session.totalParts) {
      const partNumber = nextPart++;
      const start = (partNumber - 1) * session.partSize;
      const blob = file.slice(start, Math.min(start + session.partSize, file.size));
      const etag = await uploadPartWithRetry(session.sessionId, partNumber, blob, value => { loaded[partNumber - 1] = value; report(); });
      parts.push({ PartNumber: partNumber, ETag: etag });
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(MULTIPART_PART_CONCURRENCY, session.totalParts) }, worker));
    const completeResponse = await request(apiUrl(`/objects/multipart/${encodeURIComponent(session.sessionId)}/complete`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parts }),
    });
    await responseJson(completeResponse);
    onProgress(file.size);
    return [{ key, size: file.size }];
  } catch (error) {
    await request(apiUrl(`/objects/multipart/${encodeURIComponent(session.sessionId)}`), { method: 'DELETE' }).catch(() => undefined);
    throw error;
  }
}

function uploadOneFile(bucket: string, prefix: string, file: File, name: string, jobId: string, fileIndex: number, onProgress: (loaded: number) => void): Promise<UploadResult[]> {
  if (file.size > MULTIPART_THRESHOLD) return uploadMultipartFile(bucket, prefix, file, name, jobId, fileIndex, onProgress);
  const formData = new FormData();
  formData.append('prefix', prefix);
  formData.append('files', file);
  formData.append('names', JSON.stringify([name]));
  formData.append('jobId', jobId);
  formData.append('fileIndex', String(fileIndex));

  return new Promise<UploadResult[]>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl(`/objects/${encodeURIComponent(bucket)}/upload`));
    xhr.withCredentials = true;
    xhr.timeout = API_TIMEOUTS.UPLOAD;
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { uploaded?: UploadResult[] };
          resolve(data.uploaded ?? []);
        } catch { resolve([]); }
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText);
        const error = new ApiError(data.error || data.message || data.Message || 'Upload failed', xhr.status, undefined, data.s3Code || data.code || data.Code);
        error.message = error.getUserMessage();
        reject(error);
      } catch { reject(new ApiError('Upload failed', xhr.status, 'UPLOAD_ERROR')); }
    };
    xhr.onerror = () => reject(new ApiError('Network error - check your connection', 0, 'NETWORK_ERROR'));
    xhr.ontimeout = () => reject(new ApiError('Request timed out', 408, 'TIMEOUT'));
    xhr.send(formData);
  });
}

export async function uploadFiles(bucket: string, prefix: string, files: File[], renamedNames?: Map<File, string>, onProgress?: (percent: number) => void): Promise<UploadResult[]> {
  const names = files.map(file => renamedNames?.get(file) ?? getUploadPath(file));
  const job = await createUploadJob(bucket, prefix, files, names);
  const progress = new Array<number>(files.length).fill(0);
  const results: UploadResult[] = [];
  let nextIndex = 0;
  const report = () => {
    const total = files.reduce((sum, file) => sum + file.size, 0);
    const loaded = progress.reduce((sum, value) => sum + value, 0);
    onProgress?.(total ? Math.round((loaded / total) * 100) : 100);
  };
  const worker = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      const uploaded = await uploadOneFile(bucket, prefix, files[index], names[index], job.id, index, loaded => {
        progress[index] = loaded;
        report();
      });
      results.push(...uploaded);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
    return results;
  } catch (error) {
    await failUploadJob(bucket, job.id).catch(() => undefined);
    throw error;
  }
}

export async function createFolder(bucket: string, path: string) {
  await responseJson(await request(apiUrl(`/objects/${encodeURIComponent(bucket)}/folder`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }));
}
export async function renameObject(bucket: string, oldKey: string, newKey: string) {
  await responseJson(await request(apiUrl(`/objects/${encodeURIComponent(bucket)}/rename`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldKey, newKey }), timeout: API_TIMEOUTS.RENAME }));
}
export async function copyObject(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string) {
  await responseJson(await request(apiUrl(`/objects/${encodeURIComponent(sourceBucket)}/copy`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceKey, destBucket, destKey }) }));
}
export async function deleteObject(bucket: string, key: string, isFolder: boolean) {
  const params = new URLSearchParams({ key, isFolder: String(isFolder) });
  await responseJson(await request(apiUrl(`/objects/${encodeURIComponent(bucket)}?${params}`), { method: 'DELETE', timeout: API_TIMEOUTS.DELETE_FOLDER }));
}
export function deleteObjects(bucket: string, objects: Array<{ key: string; isFolder: boolean }>) {
  return request(apiUrl(`/objects/${encodeURIComponent(bucket)}/batch-delete`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objects }), timeout: API_TIMEOUTS.DELETE_FOLDER * 2 })
    .then(responseJson<{ deleted: string[]; failed: string[] }>);
}

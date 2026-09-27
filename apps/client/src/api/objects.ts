import { API_TIMEOUTS } from '../constants';
import type { S3Object } from '../types';
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

export function getUploadPath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

export function uploadFiles(bucket: string, prefix: string, files: File[], renamedNames?: Map<File, string>, onProgress?: (percent: number) => void): Promise<UploadResult[]> {
  const formData = new FormData();
  formData.append('prefix', prefix);
  if (renamedNames?.size) {
    const names: string[] = [];
    for (const file of files) { formData.append('files', file); names.push(renamedNames.get(file) ?? file.name); }
    formData.append('names', JSON.stringify(names));
  } else for (const file of files) formData.append('files', file);

  return new Promise<UploadResult[]>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl(`/objects/${encodeURIComponent(bucket)}/upload`));
    xhr.withCredentials = true;
    xhr.timeout = API_TIMEOUTS.UPLOAD;
    xhr.upload.onprogress = event => { if (onProgress && event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
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

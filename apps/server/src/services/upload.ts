import path from 'node:path';
import * as s3 from './s3.js';

export interface UploadPart {
  path: string;
  size: number;
  mimetype: string;
  originalname: string;
}

export interface UploadedObject {
  key: string;
  size: number;
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[<>:"|?*\x00-\x1f]/g, '_');
}

function safeRelativePath(input: string): string | null {
  const normalized = path.posix.normalize(input.replaceAll('\\', '/')).replace(/^\.\//, '');
  if (!normalized || normalized === '.' || normalized.startsWith('/') || normalized === '..' || normalized.startsWith('../')) {
    return null;
  }
  const segments = normalized.split('/').filter(Boolean).map(sanitizeSegment);
  return segments.length ? segments.join('/') : null;
}

function objectKey(prefix: string, relativePath: string): string {
  return `${prefix}${relativePath}`;
}

async function uploadOne(bucket: string, prefix: string, part: UploadPart, relativePath: string): Promise<UploadedObject | null> {
  const safePath = safeRelativePath(relativePath);
  if (!safePath) return null;
  const key = objectKey(prefix, safePath);
  if (Buffer.byteLength(key, 'utf8') > 1024) return null;
  await s3.uploadFile(bucket, key, part.path, part.size, part.mimetype);
  return { key, size: part.size };
}

export async function uploadParts(bucket: string, prefix: string, files: UploadPart[], names: string[]): Promise<UploadedObject[]> {
  const results: UploadedObject[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = names[i] || file.originalname;
    const uploaded = await uploadOne(bucket, prefix, file, relativePath);
    if (uploaded) results.push(uploaded);
  }
  return results;
}

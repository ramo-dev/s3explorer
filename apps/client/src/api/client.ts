import { API_TIMEOUTS } from '../constants';

const API_BASE = '/api';
const activeRequests = new Map<string, AbortController>();

const S3_ERROR_MESSAGES: Record<string, string> = {
  NoSuchBucket: 'Bucket does not exist',
  NoSuchKey: 'File or folder does not exist',
  BucketAlreadyExists: 'A bucket with this name already exists',
  BucketAlreadyOwnedByYou: 'You already own a bucket with this name',
  BucketNotEmpty: 'Bucket is not empty',
  AccessDenied: 'Access denied - check your credentials',
  InvalidAccessKeyId: 'Invalid access key',
  SignatureDoesNotMatch: 'Invalid secret key',
  InvalidBucketName: 'Invalid bucket name',
  InvalidObjectState: 'Object is in an invalid state for this operation',
  KeyTooLongError: 'File name is too long',
  EntityTooLarge: 'File is too large to upload',
  SlowDown: 'Too many requests - please wait and try again',
  ServiceUnavailable: 'S3 service is temporarily unavailable',
  InternalError: 'S3 internal error - please try again',
  RequestTimeout: 'Request timed out',
  ExpiredToken: 'Session expired - please reconnect',
  InvalidToken: 'Invalid session token',
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public s3Code?: string) {
    super(message);
    this.name = 'ApiError';
  }

  getUserMessage() {
    return this.s3Code && S3_ERROR_MESSAGES[this.s3Code] ? S3_ERROR_MESSAGES[this.s3Code] : this.message;
  }
}

export function cancelRequest(key: string) {
  activeRequests.get(key)?.abort();
  activeRequests.delete(key);
}

export async function request(url: string, options: RequestInit & { timeout?: number; requestKey?: string } = {}) {
  const { timeout = API_TIMEOUTS.DEFAULT, requestKey, ...fetchOptions } = options;
  if (requestKey) cancelRequest(requestKey);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  if (requestKey) activeRequests.set(requestKey, controller);

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal, credentials: 'include' });
  } catch (caught) {
    if (caught instanceof Error && caught.name === 'AbortError') {
      const wasCancelled = requestKey && activeRequests.get(requestKey) !== controller;
      throw new ApiError(wasCancelled ? 'Request cancelled' : 'Request timed out', wasCancelled ? 0 : 408, wasCancelled ? 'CANCELLED' : 'TIMEOUT');
    }
    throw new ApiError('Network error - check your connection', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeoutId);
    if (requestKey && activeRequests.get(requestKey) === controller) activeRequests.delete(requestKey);
  }
}

export async function responseJson<T>(response: Response): Promise<T> {
  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('Invalid response from server', response.status, 'PARSE_ERROR');
  }
  if (!response.ok) {
    const s3Code = String(data.s3Code ?? data.code ?? data.Code ?? '');
    const message = String(data.error ?? data.message ?? data.Message ?? 'Request failed');
    const error = new ApiError(message, response.status, undefined, s3Code);
    error.message = error.getUserMessage();
    throw error;
  }
  return data as T;
}

export const apiUrl = (path: string) => `${API_BASE}${path}`;

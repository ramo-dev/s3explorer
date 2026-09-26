import { API_TIMEOUTS } from '../constants';
import type { Bucket } from '../types';
import { apiUrl, request, responseJson } from './client';

export async function listBuckets(): Promise<Bucket[]> {
  return (await responseJson<{ buckets: Bucket[] }>(await request(apiUrl('/buckets')))).buckets;
}

export async function createBucket(name: string) {
  await responseJson(await request(apiUrl('/buckets'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  }));
}

export async function deleteBucket(name: string) {
  await responseJson(await request(apiUrl(`/buckets/${encodeURIComponent(name)}`), {
    method: 'DELETE', timeout: API_TIMEOUTS.DELETE_BUCKET,
  }));
}

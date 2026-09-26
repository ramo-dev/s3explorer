import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { login, setup } from './auth';
import { listObjects, searchObjects } from './objects';
import type { S3Object } from '../types';

export const queryKeys = {
  objectSearch: (bucket: string, query: string) => ["objects", "search", bucket, query] as const,
};

export const useLogin = () => useMutation({ mutationFn: ({ password, rememberMe }: { password: string; rememberMe: boolean }) => login(password, rememberMe) });
export const useSetup = () => useMutation({ mutationFn: ({ password, sessionSecret }: { password: string; sessionSecret?: string }) => setup(password, sessionSecret) });

/**
 * Search is page data, but its cache key and transport policy belong at the
 * API seam. A disabled query deliberately exposes no stale result when a
 * search is cleared or contains fewer than two characters.
 */
export function useObjectSearch(bucket: string | null, query: string) {
  const trimmedQuery = query.trim();
  const enabled = Boolean(bucket && trimmedQuery.length >= 2);
  const result = useQuery<S3Object[]>({
    queryKey: queryKeys.objectSearch(bucket ?? '', trimmedQuery),
    queryFn: () => searchObjects(bucket!, trimmedQuery),
    enabled,
    retry: false,
  });

  return {
    searchResults: enabled ? result.data ?? null : null,
    searching: enabled && result.isFetching,
  };
}

/**
 * Keeps the existing paginated listing behaviour behind the same API hook
 * seam as queries. Optimistic file actions still need a local updater today;
 * once those actions are mutations, this implementation can switch to
 * `useInfiniteQuery` without changing route components.
 */
export function useObjectListing(bucket: string | null, path: string, authenticated: boolean | null) {
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextTokenRef = useRef<string>();

  const loadObjects = useCallback(async () => {
    if (!bucket) return;
    try {
      setLoading(true);
      setError(null);
      nextTokenRef.current = undefined;
      const result = await listObjects(bucket, path, 200);
      setObjects(result.objects);
      nextTokenRef.current = result.nextContinuationToken;
      setHasMore(result.isTruncated);
    } catch (caught) {
      const err = caught as { code?: string; message?: string };
      if (err.code !== 'CANCELLED') setError(err.message ?? 'Failed to load objects');
    } finally {
      setLoading(false);
    }
  }, [bucket, path]);

  const loadMore = useCallback(async () => {
    if (!bucket || !nextTokenRef.current || loadingMore) return;
    try {
      setLoadingMore(true);
      const result = await listObjects(bucket, path, 200, nextTokenRef.current);
      setObjects(previous => [...previous, ...result.objects]);
      nextTokenRef.current = result.nextContinuationToken;
      setHasMore(result.isTruncated);
    } catch (caught) {
      const err = caught as { code?: string; message?: string };
      if (err.code !== 'CANCELLED') setError(err.message ?? 'Failed to load more objects');
    } finally {
      setLoadingMore(false);
    }
  }, [bucket, path, loadingMore]);

  useEffect(() => {
    if (bucket && authenticated) void loadObjects();
  }, [authenticated, bucket, loadObjects]);

  return { objects, setObjects, loading, setLoading, error, setError, hasMore, loadingMore, loadObjects, loadMore };
}

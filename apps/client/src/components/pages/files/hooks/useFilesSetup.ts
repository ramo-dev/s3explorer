import { useCallback, useEffect, useState } from 'react';
import { getAuthStatus, logout } from '@/api/auth';
import { getActiveConnection } from '@/api/connections';
import { listBuckets } from '@/api/buckets';
import type { Bucket, S3Object } from '@/types';
import type { Connection } from '@/api';

export function useFilesSetup(options: {
  setSelectedBucket: (bucket: string | null) => void;
  setCurrentPath: (path: string) => void;
  setSearchQuery: (query: string) => void;
  setObjects: React.Dispatch<React.SetStateAction<S3Object[]>>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  showConnectionManager: () => void;
}) {
  const { setSelectedBucket, setCurrentPath, setSearchQuery, setObjects, setLoading, setError, showConnectionManager } = options;
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucketsLoaded, setBucketsLoaded] = useState(false);

  const loadBuckets = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      setBuckets(await listBuckets()); setBucketsLoaded(true);
    } catch (err: any) {
      if (err.message?.includes('No active S3 connection')) showConnectionManager();
      else setError(err.message);
    } finally { setLoading(false); }
  }, [setLoading, setError, showConnectionManager]);

  const loadActiveConnection = useCallback(async () => {
    try {
      const connection = await getActiveConnection();
      setActiveConnection(connection);
      if (connection?.bucket) { setBuckets([{ name: connection.bucket }]); setSelectedBucket(connection.bucket); }
      else if (connection) await loadBuckets();
    } catch (err) { console.error('Failed to load active connection:', err); }
  }, [loadBuckets, setSelectedBucket]);

  const checkAuth = useCallback(async () => {
    try {
      const status = await getAuthStatus();
      setAuthenticated(status.authenticated); setConfigured(status.configured);
      if (status.authenticated) loadActiveConnection();
    } catch { setAuthenticated(false); }
    finally { setCheckingAuth(false); }
  }, [loadActiveConnection]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const handleLogin = () => { setAuthenticated(true); loadActiveConnection(); };
  const resetConnectionState = () => { setSelectedBucket(null); setCurrentPath(''); setObjects([]); setSearchQuery(''); loadActiveConnection(); };
  const handleLogout = async (showToast: (message: string, type?: 'success' | 'error') => void) => {
    try { await logout(); setAuthenticated(false); setBuckets([]); setSelectedBucket(null); setObjects([]); setActiveConnection(null); }
    catch { showToast('Logout failed', 'error'); }
  };
  return { authenticated, configured, checkingAuth, activeConnection, buckets, bucketsLoaded, setBuckets,
    setAuthenticated, checkAuth, loadActiveConnection, handleLogin, handleLogout, resetConnectionState };
}

import { useCallback, useEffect, useRef, useState } from 'react';

interface NetworkStatus {
    isOnline: boolean;
    isBackendReachable: boolean;
    lastChecked: Date | null;
}

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

export function useNetworkStatus(): NetworkStatus {
    const [status, setStatus] = useState<NetworkStatus>({
        isOnline: navigator.onLine,
        isBackendReachable: true, // Assume reachable initially
        lastChecked: null,
    });

    const checkingRef = useRef(false);

    const checkBackendHealth = useCallback(async () => {
        // Prevent concurrent checks
        if (checkingRef.current) return;
        checkingRef.current = true;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

            // We ping /api/auth/status because it's lightweight, always available, and
            // even a 401 proves the backend is running (just unauthenticated).
            const response = await fetch('/api/auth/status', {
                method: 'GET',
                signal: controller.signal,
                credentials: 'include',
            });

            clearTimeout(timeoutId);

            setStatus(prev => ({
                ...prev,
                isBackendReachable: response.ok || response.status === 401,
                lastChecked: new Date(),
            }));
        } catch {
            setStatus(prev => ({
                ...prev,
                isBackendReachable: false,
                lastChecked: new Date(),
            }));
        } finally {
            checkingRef.current = false;
        }
    }, []);

    // Listen for online/offline events
    useEffect(() => {
        const handleOnline = () => {
            setStatus(prev => ({ ...prev, isOnline: true }));
            checkBackendHealth();
        };

        const handleOffline = () => {
            setStatus(prev => ({ ...prev, isOnline: false, isBackendReachable: false }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [checkBackendHealth]);

    // Periodic health check
    useEffect(() => {
        // Initial check
        checkBackendHealth();

        const intervalId = setInterval(checkBackendHealth, HEALTH_CHECK_INTERVAL);

        return () => clearInterval(intervalId);
    }, [checkBackendHealth]);

    // Re-check when the user returns to the tab -- the connection state could
    // have changed while the tab was in the background (laptop sleep, network switch, etc.)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkBackendHealth();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [checkBackendHealth]);

    return status;
}

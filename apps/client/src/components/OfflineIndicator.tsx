import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface OfflineIndicatorProps {
    isOnline: boolean;
    isBackendReachable: boolean;
}

export function OfflineIndicator({ isOnline, isBackendReachable }: OfflineIndicatorProps) {
    // Don't show if everything is fine
    if (isOnline && isBackendReachable) return null;

    const message = !isOnline
        ? 'No internet connection'
        : 'Unable to reach server';

    const handleRetry = () => {
        window.location.reload();
    };

    return (
        <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 mb-safe animate-slide-up-fade"
            role="alert"
            aria-live="assertive"
        >
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-destructive/15 border border-destructive/20 text-foreground shadow-lg backdrop-blur-xs">
                <WifiOff className="text-destructive shrink-0" aria-hidden="true" />
                <span className="text-xs sm:text-sm font-medium">{message}</span>
                <Button
                    onClick={handleRetry}
                    variant="link"
                    size="sm"
                    className="ml-1 sm:ml-2 text-destructive hover:text-destructive/80"
                    aria-label="Retry connection"
                >
                    <RefreshCw aria-hidden="true" />
                    Retry
                </Button>
            </div>
        </div>
    );
}

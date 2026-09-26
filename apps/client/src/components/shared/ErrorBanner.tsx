import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBannerProps {
    error: string | null;
    onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
    if (!error) return null;

    return (
        <div
            className="px-4 py-3 bg-destructive/10 border-b border-destructive/20 flex items-center justify-between animate-fade-in-down"
            role="alert"
            aria-live="assertive"
        >
            <span className="text-sm text-destructive">{error}</span>

            <Button
                onClick={onDismiss}
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                aria-label="Dismiss error"
            >
                <X aria-hidden="true" />
            </Button>
        </div>
    );
}

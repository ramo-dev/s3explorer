import { cn } from 'cn';
import { Check, X } from 'lucide-react';
import { useEffect } from 'react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error';
    onClose: () => void;
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
    useEffect(() => {
        const timeout = setTimeout(onClose, 3000);
        return () => clearTimeout(timeout);
    }, [onClose]);

    const isSuccess = type === 'success';

    return (
        <div
            className={cn(
                'fixed right-5 bottom-5 z-50 mb-safe flex items-center gap-2.5 rounded-md border border-border px-3.5 py-2.5 text-xs font-medium animate-slide-in-right',
                isSuccess ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive',
            )}
            role="alert"
            aria-live="polite"
        >
            <div
                className={cn(
                    'flex size-5 items-center justify-center rounded-full text-white',
                    isSuccess ? 'bg-success' : 'bg-destructive',
                )}
                aria-hidden="true"
            >
                {isSuccess ? (
                    <Check className="size-3" />
                ) : (
                    <X className="size-3" />
                )}
            </div>
            {message}
        </div>
    );
}

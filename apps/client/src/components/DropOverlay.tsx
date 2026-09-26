import { Upload } from 'lucide-react';

interface DropOverlayProps {
    isDragActive: boolean;
}

export function DropOverlay({ isDragActive }: DropOverlayProps) {
    if (!isDragActive) return null;

    return (
        <div
            className="fixed inset-0 z-60 flex items-center justify-center pointer-events-none"
            role="status"
            aria-live="polite"
            aria-label="Drop files to upload"
        >
            <div className="absolute inset-4 rounded-lg border-2 border-dashed border-primary bg-background/90" aria-hidden="true" />
            <div className="relative text-center">
                {/* The old gradient ran accent-purple to accent-pink. Both are now
                    the same --primary token, so a two-hue gradient is no longer
                    expressible; this keeps the same light-to-dark falloff. */}
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary/70">
                    <Upload className="size-8 text-primary-foreground" aria-hidden="true" />
                </div>
                <p className="text-base font-medium">Drop to upload</p>
            </div>
        </div>
    );
}

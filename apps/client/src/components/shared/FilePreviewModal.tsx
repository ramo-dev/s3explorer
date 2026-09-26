import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { cn } from 'cn';
import { ChevronLeft, ChevronRight, Download, Maximize, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getProxyUrl } from '@/api/objects';
import type { S3Object } from '@/types';
import { getFileName, getPreviewType } from '@/lib/fileUtils';
import { formatBytes } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { PreviewContent } from './PreviewContent';

interface FilePreviewModalProps {
    object: S3Object | null;
    bucket: string;
    onClose: () => void;
    onDownload: (obj: S3Object) => void;
    objects?: S3Object[];
    startIndex?: number;
}

const MAX_TEXT_SIZE = 5 * 1024 * 1024;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
const ZOOM_BUTTON_FACTOR = 1.3; // 30% per click

// Floating prev/next controls that sit on top of the media, so they are styled
// for a dark backdrop rather than as surface controls. The old .preview-nav-arrow
// carried a [data-theme="light"] override, but the backdrop is always black/85,
// so on a light theme those arrows were black/50 on near-black -- less visible
// than the white/12 they override. One style for both themes is the fix.
const NAV_ARROW_CLASSES = 'absolute z-10 rounded-full border border-white/15 bg-white/12 text-white backdrop-blur-[8px] transition-colors hover:bg-white/20 hover:text-white';

export function FilePreviewModal({ object, bucket, onClose, onDownload, objects, startIndex }: FilePreviewModalProps) {
    const [textContent, setTextContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(startIndex ?? 0);
    const [zoom, setZoom] = useState(1);
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const isMulti = objects && objects.length > 0;
    const activeObject = isMulti ? objects[currentIndex] : object;
    const totalCount = isMulti ? objects.length : 0;

    const fileName = activeObject ? getFileName(activeObject.key) : '';
    const previewType = activeObject ? getPreviewType(activeObject.key) : null;
    const proxyUrl = activeObject ? getProxyUrl(bucket, activeObject.key) : '';

    useEffect(() => {
        if (startIndex !== undefined) setCurrentIndex(startIndex);
    }, [startIndex]);

    // Reset states when active object changes
    useEffect(() => {
        setImageLoaded(false);
        setError(null);
        setTextContent(null);
        setLoading(false);
        setZoom(1);
    }, [activeObject?.key]);

    // Fetch text content
    useEffect(() => {
        if (!activeObject || previewType !== 'text') return;
        if (activeObject.size > MAX_TEXT_SIZE) {
            setError(`File too large to preview (${formatBytes(activeObject.size)}, max ${formatBytes(MAX_TEXT_SIZE)})`);
            return;
        }
        setLoading(true);
        setError(null);
        const controller = new AbortController();
        fetch(proxyUrl, { credentials: 'include', signal: controller.signal })
            .then(res => { if (!res.ok) throw new Error('Failed to load file'); return res.text(); })
            .then(text => setTextContent(text))
            .catch(err => { if (err.name !== 'AbortError') setError(err.message || 'Failed to load file'); })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [activeObject?.key, previewType, proxyUrl, activeObject?.size]);

    const goToPrev = useCallback(() => {
        if (isMulti && currentIndex > 0) setCurrentIndex(i => i - 1);
    }, [isMulti, currentIndex]);

    const goToNext = useCallback(() => {
        if (isMulti && currentIndex < objects.length - 1) setCurrentIndex(i => i + 1);
    }, [isMulti, currentIndex, objects?.length]);

    const zoomIn = useCallback(() => setZoom(z => Math.min(z * ZOOM_BUTTON_FACTOR, ZOOM_MAX)), []);
    const zoomOut = useCallback(() => setZoom(z => Math.max(z / ZOOM_BUTTON_FACTOR, ZOOM_MIN)), []);
    const zoomReset = useCallback(() => setZoom(1), []);

    // Arrow keys and zoom shortcuts. Escape and the body scroll lock are not
    // handled here: the Dialog primitive owns both, and this listener used to
    // reset body overflow to '' on cleanup, which would have unlocked the page
    // behind any modal opened on top of the preview.
    useEffect(() => {
        if (!activeObject) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isMulti) {
                if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev(); }
                if (e.key === 'ArrowRight') { e.preventDefault(); goToNext(); }
            }
            if (previewType === 'image') {
                if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
                if (e.key === '-') { e.preventDefault(); zoomOut(); }
                if (e.key === '0') { e.preventDefault(); zoomReset(); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeObject, isMulti, goToPrev, goToNext, previewType, zoomIn, zoomOut, zoomReset]);

    useEffect(() => {
        if (!activeObject || previewType !== 'image') return;
        const container = imageContainerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const normalized = -e.deltaY / 300;
            // Exponential scaling (2^x) ensures each scroll tick changes zoom by a
            // consistent *percentage* regardless of current zoom level. Dividing by
            // 300 normalizes between trackpad (small deltas) and mouse wheel (~100-120
            // per notch) so both feel smooth.
            const factor = 2 ** normalized;
            setZoom(z => Math.min(Math.max(z * factor, ZOOM_MIN), ZOOM_MAX));
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [activeObject?.key, previewType]);

    if (!activeObject) return null;

    const hasPrev = isMulti && currentIndex > 0;
    const hasNext = isMulti && currentIndex < objects.length - 1;

    return (
        <Dialog open={!!activeObject} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogPortal>
                <DialogOverlay className="bg-black/85 backdrop-blur-xs" />
                {/* The popup is the entire viewport, so it fills what the overlay
                    is there to do: there is no click-outside area, which matches
                    the previous behaviour where every region had stopPropagation
                    and only the X button or Escape actually dismissed. It also
                    gains the focus trap the hand-rolled version never had, so Tab
                    no longer walks into the page behind the preview. */}
                <DialogPrimitive.Popup
                    ref={popupRef}
                    className="fixed inset-0 z-50 flex flex-col outline-none"
                    initialFocus={popupRef}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-card border-b border-border shrink-0">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <DialogTitle className="text-sm font-medium truncate text-foreground">{fileName}</DialogTitle>
                            {activeObject.size > 0 && (
                                <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{formatBytes(activeObject.size)}</span>
                            )}
                            {isMulti && (
                                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                                    {currentIndex + 1}/{totalCount}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                            {/* Zoom controls - images only */}
                            {previewType === 'image' && imageLoaded && (
                                <>
                                    <Button onClick={zoomOut} variant="ghost" size="icon-lg" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN}>
                                        <ZoomOut className="size-4" aria-hidden="true" />
                                    </Button>
                                    <Button onClick={zoomReset} variant="ghost" size="icon-lg" aria-label="Reset zoom">
                                        <Maximize className="size-4" aria-hidden="true" />
                                    </Button>
                                    <Button onClick={zoomIn} variant="ghost" size="icon-lg" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX}>
                                        <ZoomIn className="size-4" aria-hidden="true" />
                                    </Button>
                                    <div className="w-px h-5 bg-border mx-0.5" aria-hidden="true" />
                                </>
                            )}
                            <Button onClick={() => onDownload(activeObject)} variant="ghost" size="icon-lg" aria-label="Download file">
                                <Download className="size-4" aria-hidden="true" />
                            </Button>
                            <Button onClick={onClose} variant="ghost" size="icon-lg" aria-label="Close preview">
                                <X className="size-4" aria-hidden="true" />
                            </Button>
                        </div>
                    </div>

                    {/* Content area with navigation arrows */}
                    <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0 relative">
                        {/* Left arrow */}
                        {isMulti && hasPrev && (
                            <Button
                                onClick={goToPrev}
                                variant="ghost"
                                size="icon-lg"
                                className={cn(NAV_ARROW_CLASSES, 'left-1.5 sm:left-3')}
                                aria-label="Previous file"
                            >
                                <ChevronLeft className="size-5" aria-hidden="true" />
                            </Button>
                        )}

                        {/* Preview content */}
                        <div className={cn('flex-1 flex items-center justify-center h-full p-2 sm:p-6 min-w-0', isMulti && 'mx-10 sm:mx-14')}>
                            <PreviewContent
                                 activeObject={activeObject}
                                 previewType={previewType}
                                 proxyUrl={proxyUrl}
                                 fileName={fileName}
                                 error={error}
                                 loading={loading}
                                 textContent={textContent}
                                 imageLoaded={imageLoaded}
                                 imageContainerRef={imageContainerRef}
                                 zoom={zoom}
                                 onImageLoad={() => setImageLoaded(true)}
                                 onError={setError}
                                 onDownload={onDownload}
                             />
                        </div>

                        {/* Right arrow */}
                        {isMulti && hasNext && (
                            <Button
                                onClick={goToNext}
                                variant="ghost"
                                size="icon-lg"
                                className={cn(NAV_ARROW_CLASSES, 'right-1.5 sm:right-3')}
                                aria-label="Next file"
                            >
                                <ChevronRight className="size-5" aria-hidden="true" />
                            </Button>
                        )}
                    </div>

                    {/* Bottom bar for multi-file mode */}
                    {isMulti && (
                        <div className="flex items-center justify-center gap-4 px-3 py-2 bg-card border-t border-border shrink-0">
                            <Button
                                onClick={goToPrev}
                                disabled={!hasPrev}
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                <ChevronLeft className="size-3.5" aria-hidden="true" />Prev
                            </Button>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {currentIndex + 1} of {totalCount}
                            </span>
                            <Button
                                onClick={goToNext}
                                disabled={!hasNext}
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Next<ChevronRight className="size-3.5" aria-hidden="true" />
                            </Button>
                        </div>
                    )}
                </DialogPrimitive.Popup>
            </DialogPortal>
        </Dialog>
    );
}

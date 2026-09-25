import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import type { S3Object } from '../types';
import { getFileName, getPreviewType } from '../utils/fileUtils';
import { getProxyUrl } from '../api';
import { formatBytes } from '../utils/formatters';

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

export function FilePreviewModal({ object, bucket, onClose, onDownload, objects, startIndex }: FilePreviewModalProps) {
    const [textContent, setTextContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(startIndex ?? 0);
    const [zoom, setZoom] = useState(1);
    const imageContainerRef = useRef<HTMLDivElement>(null);

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

    // Keyboard and scroll lock
    const stableOnClose = useCallback(() => onClose(), [onClose]);
    useEffect(() => {
        if (!activeObject) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') stableOnClose();
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
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = ''; };
    }, [activeObject, stableOnClose, isMulti, goToPrev, goToNext, previewType, zoomIn, zoomOut, zoomReset]);

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
            const factor = Math.pow(2, normalized);
            setZoom(z => Math.min(Math.max(z * factor, ZOOM_MIN), ZOOM_MAX));
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [activeObject?.key, previewType]);

    if (!activeObject) return null;

    const hasPrev = isMulti && currentIndex > 0;
    const hasNext = isMulti && currentIndex < objects.length - 1;

    const renderPreview = () => {
        if (error) {
            return (
                <div className="text-center p-8">
                    <p className="text-foreground-muted">{error}</p>
                    <button onClick={() => onDownload(activeObject)} className="btn btn-secondary mt-4">Download instead</button>
                </div>
            );
        }

        switch (previewType) {
            case 'image':
                return (
                    <div ref={imageContainerRef} className="flex items-center justify-center w-full h-full overflow-auto">
                        {!imageLoaded && (
                            <svg className="w-6 h-6 animate-spin text-foreground-muted absolute" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}
                        <img
                            src={proxyUrl}
                            alt={fileName}
                            decoding="async"
                            className={`rounded ${imageLoaded ? '' : 'hidden'}`}
                            style={{
                                transform: `scale(${zoom})`,
                                transformOrigin: 'center center',
                                maxWidth: zoom <= 1 ? '100%' : 'none',
                                maxHeight: zoom <= 1 ? '100%' : 'none',
                                objectFit: 'contain',
                                // Hint the browser to promote this to its own GPU layer so
                                // scale transforms during zoom don't repaint the whole page.
                                willChange: 'transform',
                            }}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => setError('Failed to load image')}
                        />
                    </div>
                );

            case 'video':
                return (
                    <div className="flex items-center justify-center w-full h-full">
                        {/* key={activeObject.key} forces a full remount when switching between
                           files. Without it, React reuses the element and the browser keeps
                           playing the previous source even after the <source> src changes. */}
                        <video key={activeObject.key} controls autoPlay className="max-w-full max-h-full rounded" onError={() => setError('Failed to load video')}>
                            <source src={proxyUrl} />
                        </video>
                    </div>
                );

            case 'audio':
                return (
                    <div className="flex flex-col items-center justify-center gap-4 p-8">
                        <div className="w-24 h-24 rounded-full bg-background-tertiary flex items-center justify-center">
                            <svg className="w-10 h-10 text-accent-purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                            </svg>
                        </div>
                        <p className="text-sm text-foreground-secondary">{fileName}</p>
                        {/* Same remount trick as <video> above -- see comment there. */}
                        <audio key={activeObject.key} controls autoPlay className="w-full max-w-md" onError={() => setError('Failed to load audio')}>
                            <source src={proxyUrl} />
                        </audio>
                    </div>
                );

            case 'text':
                if (loading) {
                    return (
                        <div className="flex items-center justify-center h-full">
                            <svg className="w-6 h-6 animate-spin text-foreground-muted" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        </div>
                    );
                }
                return (
                    <div className="w-full h-full overflow-auto bg-background rounded border border-border">
                        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap wrap-break-word p-4 leading-relaxed">{textContent}</pre>
                    </div>
                );

            case 'pdf':
                return <iframe src={proxyUrl} className="w-full h-full border-0 rounded bg-white" title={fileName} />;

            default:
                return (
                    <div className="text-center p-8">
                        <p className="text-foreground-muted">Preview not available for this file type</p>
                        <button onClick={() => onDownload(activeObject)} className="btn btn-secondary mt-4">Download</button>
                    </div>
                );
        }
    };

    return (
        <div
            className="fixed inset-0 z-60 flex flex-col bg-black/85 backdrop-blur-xs"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview: ${fileName}`}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 sm:px-4 py-2 bg-background-secondary border-b border-border shrink-0"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <h3 className="text-sm font-medium truncate text-foreground">{fileName}</h3>
                    {activeObject.size > 0 && (
                        <span className="text-xs text-foreground-muted shrink-0 hidden sm:inline">{formatBytes(activeObject.size)}</span>
                    )}
                    {isMulti && (
                        <span className="text-xs text-foreground-muted shrink-0 tabular-nums">
                            {currentIndex + 1}/{totalCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    {/* Zoom controls - images only */}
                    {previewType === 'image' && imageLoaded && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); zoomOut(); }} className="btn btn-ghost btn-icon w-9 h-9 sm:w-8 sm:h-8" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN}>
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); zoomReset(); }} className="btn btn-ghost btn-icon w-9 h-9 sm:w-8 sm:h-8" aria-label="Reset zoom">
                                <Maximize className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); zoomIn(); }} className="btn btn-ghost btn-icon w-9 h-9 sm:w-8 sm:h-8" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX}>
                                <ZoomIn className="w-4 h-4" />
                            </button>
                            <div className="w-px h-5 bg-border mx-0.5" />
                        </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onDownload(activeObject); }} className="btn btn-ghost btn-icon w-9 h-9 sm:w-8 sm:h-8" aria-label="Download file">
                        <Download className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="btn btn-ghost btn-icon w-9 h-9 sm:w-8 sm:h-8" aria-label="Close preview">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content area with navigation arrows */}
            <div
                className="flex-1 flex items-center justify-center overflow-hidden min-h-0 relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Left arrow */}
                {isMulti && hasPrev && (
                    <button
                        onClick={goToPrev}
                        className="preview-nav-arrow absolute left-1.5 sm:left-3 z-10"
                        aria-label="Previous file"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}

                {/* Preview content */}
                <div className={`flex-1 flex items-center justify-center h-full p-2 sm:p-6 min-w-0 ${isMulti ? 'mx-10 sm:mx-14' : ''}`}>
                    {renderPreview()}
                </div>

                {/* Right arrow */}
                {isMulti && hasNext && (
                    <button
                        onClick={goToNext}
                        className="preview-nav-arrow absolute right-1.5 sm:right-3 z-10"
                        aria-label="Next file"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Bottom bar for multi-file mode */}
            {isMulti && (
                <div
                    className="flex items-center justify-center gap-4 px-3 py-2 bg-background-secondary border-t border-border shrink-0"
                    onClick={e => e.stopPropagation()}
                >
                    <button onClick={goToPrev} disabled={!hasPrev} className="text-xs text-foreground-secondary hover:text-foreground disabled:opacity-30 transition-colors flex items-center gap-1">
                        <ChevronLeft className="w-3.5 h-3.5" />Prev
                    </button>
                    <span className="text-xs text-foreground-muted tabular-nums">
                        {currentIndex + 1} of {totalCount}
                    </span>
                    <button onClick={goToNext} disabled={!hasNext} className="text-xs text-foreground-secondary hover:text-foreground disabled:opacity-30 transition-colors flex items-center gap-1">
                        Next<ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}

import { ImageOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getProxyUrl } from '../api';
import { GRID } from '../constants';
import { getPreviewType } from '../utils/fileUtils';
import { Skeleton } from './ui/skeleton';

interface ObjectThumbnailProps {
    bucket: string;
    /** Named objectKey, not key: `key` is React's reserved prop, so a prop
     *  literally called `key` is consumed by the reconciler and arrives here
     *  as undefined. */
    objectKey: string;
    isFolder: boolean;
    size: number;
}

/**
 * Square thumbnail for one object.
 *
 * The important constraint: there is no server-side resizing, so an <img>
 * against the proxy route pulls the *entire* object. A grid of 200 photos would
 * be hundreds of megabytes. Three things keep that bounded:
 *
 *   1. IntersectionObserver gates the request, so only tiles near the viewport
 *      fetch. Scrolling is when the user actually asks for more.
 *   2. MAX_THUMBNAIL_BYTES caps the per-tile cost. A folder of 50MB TIFFs
 *      would otherwise fetch gigabytes to render 200px squares.
 *   3. onError falls back to the icon. S3 Content-Type is frequently wrong or
 *      absent, and HEIC/AVIF won't decode in most browsers -- a broken <img>
 *      icon is worse than the generic file icon.
 */
export function ObjectThumbnail({ bucket, objectKey, isFolder, size }: ObjectThumbnailProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [nearViewport, setNearViewport] = useState(false);
    const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

    const previewType = getPreviewType(objectKey);
    const eligible = !isFolder && previewType === 'image' && size <= GRID.MAX_THUMBNAIL_BYTES;

    useEffect(() => {
        if (!eligible) return;
        const element = ref.current;
        if (!element) return;

        // Already on screen: fire immediately rather than waiting a frame for
        // the observer's first callback, which would show an empty tile.
        if (typeof IntersectionObserver === 'undefined') {
            setNearViewport(true);
            return;
        }

        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(e => e.isIntersecting)) {
                    setNearViewport(true);
                    observer.disconnect();
                }
            },
            { rootMargin: `${GRID.ROOT_MARGIN_PX}px` },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [eligible]);

    const showImage = eligible && nearViewport && status !== 'failed';

    return (
        <div ref={ref} className="relative size-full overflow-hidden bg-muted/40">
            {showImage ? (
                <>
                    {status === 'loading' && <Skeleton className="absolute inset-0 size-full rounded-none" />}
                    <img
                        src={getProxyUrl(bucket, objectKey, GRID.THUMBNAIL_WIDTH_PARAM)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        // object-cover, not contain: a grid of mixed aspect ratios
                        // with letterboxing reads as broken alignment, whereas a
                        // uniform crop is what Drive does and what the eye expects.
                        className="size-full object-cover transition-opacity duration-150"
                        style={{ opacity: status === 'loaded' ? 1 : 0 }}
                        onLoad={() => setStatus('loaded')}
                        onError={() => setStatus('failed')}
                    />
                </>
            ) : eligible && status === 'failed' ? (
                // Decode failure, not a missing thumbnail. Worth distinguishing
                // from the ineligible case so the icon is the honest answer.
                <div className="flex size-full items-center justify-center text-muted-foreground/50">
                    <ImageOff className="size-6" aria-hidden="true" />
                </div>
            ) : null}
        </div>
    );
}

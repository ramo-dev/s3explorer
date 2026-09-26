import { cn } from 'cn';
import type { RefObject } from 'react';
import type { S3Object } from '@/types';
import { getPreviewType } from '@/lib/fileUtils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface PreviewContentProps {
  activeObject: S3Object;
  previewType: ReturnType<typeof getPreviewType>;
  proxyUrl: string;
  fileName: string;
  error: string | null;
  loading: boolean;
  textContent: string | null;
  imageLoaded: boolean;
  imageContainerRef: RefObject<HTMLDivElement>;
  zoom: number;
  onImageLoad: () => void;
  onError: (message: string) => void;
  onDownload: (object: S3Object) => void;
}

export function PreviewContent({
  activeObject,
  previewType,
  proxyUrl,
  fileName,
  error,
  loading,
  textContent,
  imageLoaded,
  imageContainerRef,
  zoom,
  onImageLoad,
  onError,
  onDownload,
}: PreviewContentProps) {
  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => onDownload(activeObject)} variant="secondary" className="mt-4">
          Download instead
        </Button>
      </div>
    );
  }

  switch (previewType) {
    case 'image':
      return (
        <div ref={imageContainerRef} className="flex items-center justify-center w-full h-full overflow-auto">
          {!imageLoaded && <Spinner className="size-6 text-muted-foreground" aria-hidden="true" />}
          <img
            src={proxyUrl}
            alt={fileName}
            decoding="async"
            className={cn('rounded', !imageLoaded && 'hidden')}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              maxWidth: zoom <= 1 ? '100%' : 'none',
              maxHeight: zoom <= 1 ? '100%' : 'none',
              objectFit: 'contain',
              willChange: 'transform',
            }}
            onLoad={onImageLoad}
            onError={() => onError('Failed to load image')}
          />
        </div>
      );
    case 'video':
      return (
        <div className="flex items-center justify-center w-full h-full">
          <video key={activeObject.key} controls autoPlay className="max-w-full max-h-full rounded" onError={() => onError('Failed to load video')}>
            <source src={proxyUrl} />
          </video>
        </div>
      );
    case 'audio':
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8">
          <div className="size-24 rounded-full bg-muted flex items-center justify-center">
            <svg className="size-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">{fileName}</p>
          <audio key={activeObject.key} controls autoPlay className="w-full max-w-md" onError={() => onError('Failed to load audio')}>
            <source src={proxyUrl} />
          </audio>
        </div>
      );
    case 'text':
      return loading ? (
        <div className="flex items-center justify-center h-full"><Spinner className="size-6 text-muted-foreground" /></div>
      ) : (
        <div className="w-full h-full overflow-auto bg-background rounded border border-border">
          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap wrap-break-word p-4 leading-relaxed">{textContent}</pre>
        </div>
      );
    case 'pdf':
      return <iframe src={proxyUrl} className="w-full h-full border-0 rounded bg-white" title={fileName} />;
    default:
      return (
        <div className="text-center p-8">
          <p className="text-muted-foreground">Preview not available for this file type</p>
          <Button onClick={() => onDownload(activeObject)} variant="secondary" className="mt-4">Download</Button>
        </div>
      );
  }
}

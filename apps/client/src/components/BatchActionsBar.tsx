import { cn } from 'cn';
import { X } from 'lucide-react';
import { Button } from './ui/button';

interface BatchActionsBarProps {
    selectedCount: number;
    previewableCount: number;
    // 'file' streams a single file directly; 'zip' bundles the selection (folders included).
    downloadMode: 'file' | 'zip';
    downloading: boolean;
    onClearSelection: () => void;
    onDeleteSelected: () => void;
    onPreviewSelected: () => void;
    onDownloadSelected: () => void;
}

export function BatchActionsBar({
    selectedCount,
    previewableCount,
    downloadMode,
    downloading,
    onClearSelection,
    onDeleteSelected,
    onPreviewSelected,
    onDownloadSelected,
}: BatchActionsBarProps) {
    if (selectedCount === 0) return null;

    const downloadLabel = downloading
        ? 'Preparing…'
        : downloadMode === 'zip' ? 'Download .zip' : 'Download';

    // Segmented bar: the buttons sit flush inside a bordered container and are
    // separated by hairlines, so each segment has to neutralise the Button
    // primitive's own rounding, border and height. One shared class keeps them
    // identical, which was previously copy-pasted five times.
    //
    // pointer-events-auto while disabled is deliberate: the primitive sets
    // pointer-events-none, which would swallow the wait cursor that tells the
    // user a zip is still being built.
    const segment = cn(
        'h-auto rounded-none border-0 px-3 py-2 text-xs font-medium whitespace-nowrap',
        'disabled:pointer-events-auto',
    );

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 mb-safe animate-slide-up-fade">
            <div className="flex items-center gap-px overflow-hidden rounded-lg border border-border bg-border shadow-lg">
                <span className={cn(segment, 'bg-card text-muted-foreground')}>
                    {selectedCount} selected
                </span>

                {previewableCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onPreviewSelected}
                        className={cn(segment, 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground')}
                    >
                        Preview
                    </Button>
                )}

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDownloadSelected}
                    disabled={downloading}
                    aria-busy={downloading}
                    className={cn(
                        segment,
                        'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        'disabled:cursor-wait disabled:opacity-60',
                    )}
                >
                    {downloadLabel}
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDeleteSelected}
                    className={cn(segment, 'bg-card text-destructive hover:bg-destructive/10 hover:text-destructive')}
                >
                    Delete
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearSelection}
                    aria-label="Clear selection"
                    className={cn(segment, 'w-8 bg-card px-0 text-muted-foreground hover:bg-accent hover:text-foreground')}
                >
                    <X className="size-3.5" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}

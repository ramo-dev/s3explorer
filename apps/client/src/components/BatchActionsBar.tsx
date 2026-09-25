import { X } from 'lucide-react';

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

    // Segmented bar: buttons sit flush inside a bordered container and are
    // separated by hairlines, so they are not Button variants. One shared
    // class keeps the five segments visually identical, which was previously
    // copy-pasted five times.
    const segment = 'text-xs font-medium px-3 py-2 transition-colors whitespace-nowrap';

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 mb-safe animate-slide-up-fade">
            <div className="flex items-center gap-px overflow-hidden rounded-lg border border-border bg-border shadow-lg">
                <span className={`${segment} bg-card text-muted-foreground`}>
                    {selectedCount} selected
                </span>

                {previewableCount > 0 && (
                    <button
                        type="button"
                        onClick={onPreviewSelected}
                        className={`${segment} cursor-pointer bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground`}
                    >
                        Preview
                    </button>
                )}

                <button
                    type="button"
                    onClick={onDownloadSelected}
                    disabled={downloading}
                    aria-busy={downloading}
                    className={`${segment} cursor-pointer bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-wait disabled:opacity-60`}
                >
                    {downloadLabel}
                </button>

                <button
                    type="button"
                    onClick={onDeleteSelected}
                    className={`${segment} cursor-pointer bg-card text-destructive hover:bg-destructive/10`}
                >
                    Delete
                </button>

                <button
                    type="button"
                    onClick={onClearSelection}
                    className="flex w-8 cursor-pointer items-center justify-center bg-card py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Clear selection"
                >
                    <X className="size-3.5" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

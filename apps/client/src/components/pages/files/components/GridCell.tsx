import { cn } from 'cn';
import { MoreHorizontal } from 'lucide-react';
import type { S3Object } from '@/types';
import { GRID } from '@/constants';
import { getFileIcon, getFileName } from '@/lib/fileUtils';
import { formatBytes, formatDate } from '@/lib/formatters';
import { ObjectThumbnail } from './ObjectThumbnail';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export interface CellData {
    bucket: string;
    objects: S3Object[];
    selectedKeys: Set<string>;
    onSelect: (key: string, selected: boolean) => void;
    onContextMenu: (e: React.MouseEvent, obj: S3Object) => void;
    onTileClick: (index: number, obj: S3Object) => void;
    onTileContextMenu: (index: number, e: React.MouseEvent, obj: S3Object) => void;
    activeIndex: number;
    columns: number;
}

export const cellId = (index: number) => `grid-cell-${index}`;

/**
 * One grid tile.
 *
 * Deliberately a module-level component rather than an inline render prop.
 * react-window passes cell props as arguments, so everything this needs can
 * come from `data`; defining it inline instead gives React a new element type
 * on every FileGrid render, which remounts every cell. See CellData.
 */
export function GridCell({
    columnIndex,
    rowIndex,
    style,
    data: cellData,
}: {
    columnIndex: number;
    rowIndex: number;
    style: React.CSSProperties;
    data: CellData;
}) {
    const index = rowIndex * cellData.columns + columnIndex;
    const obj = cellData.objects[index];
    if (!obj) return null;

    const fileName = getFileName(obj.key);
    const isSelected = cellData.selectedKeys.has(obj.key);

    return (
        <div style={{ ...style, padding: GRID.GAP / 2 }}>
            <div
                id={cellId(index)}
                role="option"
                aria-selected={isSelected}
                aria-label={`${obj.isFolder ? 'Folder' : 'File'}: ${fileName}`}
                onClick={() => cellData.onTileClick(index, obj)}
                onContextMenu={e => cellData.onTileContextMenu(index, e, obj)}
                className={cn(
                    'group/tile flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-md border bg-card transition-colors',
                    'hover:border-primary/50 hover:bg-accent/40 focus-within:border-primary/50',
                    isSelected && 'border-primary bg-primary/10',
                    // The active cell is the one the keyboard is on. It is not
                    // focused (aria-activedescendant owns that) so it needs its
                    // own visual marker.
                    cellData.activeIndex === index && 'ring-1 ring-primary/60',
                )}
            >
                <div className="relative aspect-square w-full shrink-0 overflow-hidden">
                    {obj.isFolder ? (
                        <div className="flex size-full items-center justify-center bg-primary/10 text-primary">
                            <FolderTileIcon />
                        </div>
                    ) : (
                        <ObjectThumbnail
                            bucket={cellData.bucket}
                            objectKey={obj.key}
                            isFolder={obj.isFolder}
                            size={obj.size}
                        />
                    )}

                    {/* Overlaid controls, the way Drive does it, so the thumbnail
                        keeps the full tile width. Dimmed rather than hidden:
                        hidden-until-hover is unreachable on touch and invisible to
                        keyboard users, who would tab onto a control they cannot
                        see. */}
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-1.5">
                        <span
                            className="grid size-5 place-items-center rounded bg-background/70 backdrop-blur-[2px] transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100"
                            onClick={e => e.stopPropagation()}
                        >
                            <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => cellData.onSelect(obj.key, !isSelected)}
                                aria-label={`Select ${fileName}`}
                                className="size-3.5"
                            />
                        </span>

                        <Button
                            onClick={e => {
                                e.stopPropagation();
                                cellData.onContextMenu(e, obj);
                            }}
                            variant="secondary"
                            size="icon-sm"
                            aria-label={`More options for ${fileName}`}
                            aria-haspopup="menu"
                            className="size-6 rounded bg-background/70 opacity-70 backdrop-blur-[2px] transition-opacity hover:bg-background group-hover/tile:opacity-100 focus-visible:opacity-100 group-focus-within/tile:opacity-100"
                        >
                            <MoreHorizontal className="size-3.5" aria-hidden="true" />
                        </Button>
                    </div>
                </div>

                <div
                    className="flex min-w-0 shrink-0 flex-col justify-center gap-0.5 px-2"
                    // Fixed rather than flex-1: rowHeight is derived from
                    // CAPTION_HEIGHT, and a caption allowed to grow would push
                    // the tile past its row and break the alignment the geometry
                    // depends on.
                    style={{ height: GRID.CAPTION_HEIGHT }}
                >
                    <span className="truncate text-xs font-medium" title={fileName}>
                        {fileName}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground tabular-nums">
                        {obj.isFolder
                            ? '—'
                            : `${formatBytes(obj.size)}${obj.lastModified ? ` · ${formatDate(obj.lastModified)}` : ''}`}
                    </span>
                </div>
            </div>
        </div>
    );
}

/** Folder glyph, sized to the tile rather than to a list row. */
function FolderTileIcon() {
    return <span className="block [&>svg]:size-1/2">{getFileIcon('', true)}</span>;
}

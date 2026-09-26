import { cn } from 'cn';
import { MoreHorizontal } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { GRID, gridColumnsFor, PAGINATION } from '../constants';
import { useElementSize } from '../hooks/useElementSize';
import type { S3Object } from '../types';
import { getFileIcon, getFileName } from '../utils/fileUtils';
import { formatBytes, formatDate } from '../utils/formatters';
import { ObjectThumbnail } from './ObjectThumbnail';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Spinner } from './ui/spinner';

export interface FileGridProps {
    bucket: string;
    objects: S3Object[];
    selectedKeys: Set<string>;
    onNavigate: (obj: S3Object) => void;
    onPreview: (obj: S3Object) => void;
    onContextMenu: (e: React.MouseEvent, obj: S3Object) => void;
    onSelect: (key: string, selected: boolean) => void;
    onSelectRange: (keys: string[]) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
}

interface CellData {
    bucket: string;
    objects: S3Object[];
    selectedKeys: Set<string>;
    onSelect: (key: string, selected: boolean) => void;
    onContextMenu: (e: React.MouseEvent, obj: S3Object) => void;
    onTileClick: (index: number, obj: S3Object) => void;
    onTileContextMenu: (index: number, e: React.MouseEvent, obj: S3Object) => void;
    // Everything GridCell needs to render itself has to be in here, not read
    // from FileGrid's closure. A cell renderer defined inline would be a new
    // function identity on every render, and React treats a changed element
    // type as "different component": every cell unmounts and remounts on every
    // render. That resets ObjectThumbnail's loading state (the whole grid
    // flickers through its skeletons) and replaces the button and checkbox
    // under the cursor between mousedown and mouseup, so the browser never
    // fires a click on them at all.
    activeIndex: number;
    columns: number;
}

const cellId = (index: number) => `grid-cell-${index}`;

/**
 * Grid view: one square tile per object, laid out like Google Drive.
 *
 * Virtualisation uses react-window's FixedSizeGrid rather than a second
 * hand-rolled virtualiser, so it shares onItemsRendered, overscan and the
 * infinite-scroll threshold with the list view above it.
 *
 * Keyboard model is aria-activedescendant, not a roving tabindex. A roving
 * tabindex needs the active cell to stay mounted, and here it may not be: it
 * scrolls out of the virtualised window and unmounts, leaving the whole grid
 * unreachable by Tab. aria-activedescendant keeps focus on the scroll container
 * and points it at whichever cell is active, which survives virtualisation.
 */
export function FileGrid({
    bucket,
    objects,
    selectedKeys,
    onNavigate,
    onPreview,
    onContextMenu,
    onSelect,
    onSelectRange,
    onLoadMore,
    hasMore,
    loadingMore,
}: FileGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<Grid>(null);
    const { width, height } = useElementSize(containerRef);

    const columns = gridColumnsFor(width);
    const rowCount = Math.ceil(objects.length / columns);

    // Geometry derived once per resize rather than per cell.
    //
    // columnWidth is react-window's column *pitch*, not the visible tile: each
    // cell carries GAP/2 padding, so the tile is pitch - GAP and adjacent tiles
    // are GAP apart with a GAP/2 gutter at the pane edges. Driving both numbers
    // from the same pitch is what keeps the tiles square and the rows from
    // drifting out of alignment.
    const geometry = useMemo(() => {
        const columnWidth = Math.max(Math.floor(width / columns), GRID.TILE_MIN_WIDTH);
        return {
            columnWidth,
            // Square image (pitch - GAP) plus a fixed caption block.
            rowHeight: columnWidth + GRID.CAPTION_HEIGHT,
        };
    }, [width, columns]);

    const [activeIndex, setActiveIndex] = useState(0);
    // Anchor for shift+arrow range selection, matching the list view's
    // click-checkbox-then-shift-click behaviour.
    const anchorIndex = useRef(0);

    const clamp = useCallback(
        (index: number) => Math.max(0, Math.min(index, objects.length - 1)),
        [objects.length],
    );

    /** Keep the active cell on screen, since only the keyboard can leave it off. */
    const focusIndex = useCallback(
        (index: number) => {
            const next = clamp(index);
            setActiveIndex(next);
            gridRef.current?.scrollToItem({
                rowIndex: Math.floor(next / columns),
                columnIndex: next % columns,
            });
        },
        [clamp, columns],
    );

    const activate = useCallback(
        (obj: S3Object) => {
            if (obj.isFolder) onNavigate(obj);
            else onPreview(obj);
        },
        [onNavigate, onPreview],
    );

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (objects.length === 0) return;
            const current = objects[activeIndex];
            if (!current) return;

            const extend = e.shiftKey;
            const commitRange = (to: number) => {
                const from = Math.min(anchorIndex.current, to);
                const to2 = Math.max(anchorIndex.current, to);
                onSelectRange(objects.slice(from, to2 + 1).map(o => o.key));
            };

            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    if (extend) {
                        const next = clamp(activeIndex + 1);
                        commitRange(next);
                        focusIndex(next);
                    } else focusIndex(activeIndex + 1);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (extend) {
                        const next = clamp(activeIndex - 1);
                        commitRange(next);
                        focusIndex(next);
                    } else focusIndex(activeIndex - 1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (extend) {
                        const next = clamp(activeIndex + columns);
                        commitRange(next);
                        focusIndex(next);
                    } else focusIndex(activeIndex + columns);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (extend) {
                        const next = clamp(activeIndex - columns);
                        commitRange(next);
                        focusIndex(next);
                    } else focusIndex(activeIndex - columns);
                    break;
                case 'Home':
                    e.preventDefault();
                    focusIndex(0);
                    break;
                case 'End':
                    e.preventDefault();
                    focusIndex(objects.length - 1);
                    break;
                case 'Enter':
                    e.preventDefault();
                    anchorIndex.current = activeIndex;
                    activate(current);
                    break;
                case ' ':
                    e.preventDefault();
                    anchorIndex.current = activeIndex;
                    onSelect(current.key, !selectedKeys.has(current.key));
                    break;
                case 'a':
                    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
                        e.preventDefault();
                        onSelectRange(objects.map(o => o.key));
                    }
                    break;
                default:
                    break;
            }
        },
        [objects, activeIndex, columns, clamp, focusIndex, activate, onSelect, onSelectRange, selectedKeys],
    );

    const onTileClick = useCallback(
        (index: number, obj: S3Object) => {
            setActiveIndex(index);
            anchorIndex.current = index;
            activate(obj);
        },
        [activate],
    );

    const onTileContextMenu = useCallback(
        (index: number, e: React.MouseEvent, obj: S3Object) => {
            setActiveIndex(index);
            onContextMenu(e, obj);
        },
        [onContextMenu],
    );

    const data = useMemo<CellData>(
        () => ({
            bucket,
            objects,
            selectedKeys,
            onSelect,
            onContextMenu,
            onTileClick,
            onTileContextMenu,
            activeIndex,
            columns,
        }),
        [bucket, objects, selectedKeys, onSelect, onContextMenu, onTileClick, onTileContextMenu, activeIndex, columns],
    );

    const activeId = objects[activeIndex] ? cellId(activeIndex) : undefined;

    if (objects.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {loadingMore ? <Spinner className="mr-2" aria-hidden="true" /> : null}
                {loadingMore ? 'Loading...' : 'No files'}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            role="listbox"
            aria-multiselectable="true"
            aria-label="Files"
            aria-activedescendant={activeId}
            tabIndex={0}
            onKeyDown={onKeyDown}
            className="h-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
            <Grid
                ref={gridRef}
                className="scrollbar-thin"
                columnCount={columns}
                columnWidth={geometry.columnWidth}
                rowCount={rowCount}
                rowHeight={geometry.rowHeight}
                width={width || 1}
                height={height || 1}
                overscanColumnCount={GRID.OVERSCAN_COLUMNS}
                overscanRowCount={1}
                itemData={data}
                itemKey={({ columnIndex, rowIndex }) => objects[rowIndex * columns + columnIndex]?.key ?? `${rowIndex}-${columnIndex}`}
                onItemsRendered={({ visibleRowStopIndex }) => {
                    // Same tail threshold as the list view, expressed in items
                    // rather than rows so both views agree on when to fetch.
                    const lastVisible = (visibleRowStopIndex + 1) * columns;
                    if (hasMore && !loadingMore && onLoadMore && lastVisible >= objects.length - PAGINATION.LOAD_MORE_THRESHOLD) {
                        onLoadMore();
                    }
                }}
            >
                {GridCell}
            </Grid>
        </div>
    );
}

/**
 * One grid tile.
 *
 * Deliberately a module-level component rather than an inline render prop.
 * react-window passes cell props as arguments, so everything this needs can
 * come from `data`; defining it inline instead gives React a new element type
 * on every FileGrid render, which remounts every cell. See CellData.
 */
function GridCell({
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

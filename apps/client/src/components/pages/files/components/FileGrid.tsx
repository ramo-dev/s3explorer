import { useCallback, useMemo, useRef, useState } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { GRID, gridColumnsFor, PAGINATION } from '@/constants';
import { useElementSize } from '@/hooks/useElementSize';
import type { S3Object } from '@/types';
import { GridCell, cellId, type CellData } from './GridCell';
import { Spinner } from '@/components/ui/spinner';

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
            className="h-full p-2 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
            <Grid
                ref={gridRef}
                className="scrollbar-thin"
                columnCount={columns}
                columnWidth={geometry.columnWidth}
                rowCount={rowCount}
                rowHeight={geometry.rowHeight}
                width={width || 800}
                height={height || 400}
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

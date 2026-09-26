import { useRef, useCallback, useEffect, useState, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { MoreHorizontal, LayoutGrid, LayoutList } from 'lucide-react';
import { cn } from 'cn';
import type { S3Object, SortField, SortDirection } from '../types';
import { formatBytes, formatDate } from '../utils/formatters';
import { getFileName, getFileIcon } from '../utils/fileUtils';
import { PAGINATION } from '../constants';
import type { ViewMode } from '../hooks/useLocationUrl';
import { useElementSize } from '../hooks/useElementSize';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Skeleton } from './ui/skeleton';
import { Spinner } from './ui/spinner';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { FileGrid } from './FileGrid';
import { FilterBar } from './FilterBar';
import type { FileFilters } from '../utils/fileFilters';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from './ui/table';

interface FileTableProps {
    /** Needed by grid thumbnails, which build proxy URLs. */
    bucket: string;
    /** Bucket+path identity, so the keyboard cursor resets when the folder changes. */
    locationKey: string;
    objects: S3Object[];
    loading: boolean;
    selectedKeys: Set<string>;
    onNavigate: (obj: S3Object) => void;
    /** Opens the preview modal. Omitted for a file the caller cannot preview. */
    onPreview: (obj: S3Object) => void;
    onContextMenu: (e: React.MouseEvent, obj: S3Object) => void;
    onSelect: (key: string, selected: boolean) => void;
    onSelectAll: (selected: boolean) => void;
    onSelectRange: (keys: string[]) => void;
    sortField: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField) => void;
    hasMore?: boolean;
    loadingMore?: boolean;
    onLoadMore?: () => void;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    filters: FileFilters;
    onFiltersChange: (next: FileFilters) => void;
    /** Sort with an explicit direction, for the size filter's order control. */
    onSortWithDirection: (field: SortField, direction: SortDirection) => void;
    /** How many objects were loaded before filtering, for the "N of M" readout. */
    loadedCount: number;
}

interface RowData {
    objects: S3Object[];
    selectedKeys: Set<string>;
    onNavigate: (obj: S3Object) => void;
    onPreview: (obj: S3Object) => void;
    onContextMenu: (e: React.MouseEvent, obj: S3Object) => void;
    onItemSelect: (index: number, key: string, isCurrentlySelected: boolean) => void;
    activeIndex: number;
}

interface RowProps {
    index: number;
    style: React.CSSProperties;
    data: RowData;
}

/** Stable DOM id for a row. Index-based, not key-based: S3 keys may contain
 *  spaces, which are not legal in an id. */
const rowId = (index: number) => `file-row-${index}`;

// Selection checkbox. stopPropagation is load-bearing: the row itself is now
// clickable for files as well as folders, so a click that toggles selection
// must not also open a preview.
function SelectCheckbox({ checked, onChange, ariaLabel }: { checked: boolean; onChange: () => void; ariaLabel: string }) {
    return (
        <Checkbox
            checked={checked}
            onCheckedChange={onChange}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            aria-label={ariaLabel}
        />
    );
}

// Clickable sortable column header
function SortButton({ field, label, sortField, sortDirection, onSort, className }: {
    field: SortField;
    label: string;
    sortField: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField) => void;
    className?: string;
}) {
    const isActive = sortField === field;
    return (
        <button
            type="button"
            onClick={() => onSort(field)}
            className={cn(
                'flex cursor-pointer items-center gap-0.5 uppercase tracking-[0.05em] transition-colors select-none hover:text-foreground',
                isActive ? 'text-foreground' : 'text-muted-foreground',
                className,
            )}
            aria-label={`Sort by ${label} ${isActive ? (sortDirection === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
        >
            {label}
        </button>
    );
}

// react-window calls render on every visible row whenever *any* state changes
// (e.g. a single checkbox toggle). Memo prevents re-rendering rows whose props
// haven't actually changed, which matters when hundreds of rows are visible.
const FileRow = memo(({ index, style, data }: RowProps) => {
    const { objects, selectedKeys, onNavigate, onPreview, onContextMenu, onItemSelect, activeIndex } = data;
    const obj = objects[index];
    const fileName = getFileName(obj.key);
    const isSelected = selectedKeys.has(obj.key);

    return (
        <div
            style={style}
            id={rowId(index)}
            className={cn(
                'group/row flex items-center transition-colors hover:bg-accent cursor-pointer',
                isSelected && 'bg-primary/10',
                // The keyboard's current row. Not focused -- aria-activedescendant
                // holds focus on the scroll container -- so it needs its own marker.
                activeIndex === index && 'bg-accent/60 ring-1 ring-inset ring-primary/50',
            )}
            onContextMenu={e => onContextMenu(e, obj)}
            onClick={() => (obj.isFolder ? onNavigate(obj) : onPreview(obj))}
            role="row"
            aria-label={obj.isFolder ? `Folder: ${fileName}` : `File: ${fileName}`}
            aria-selected={isSelected}
        >
            {/* Checkbox column */}
            <div className="w-10 flex items-center justify-center pl-2">
                <SelectCheckbox
                    checked={isSelected}
                    onChange={() => onItemSelect(index, obj.key, isSelected)}
                    ariaLabel={`Select ${fileName}`}
                />
            </div>

            {/* Name column */}
            <div className="flex-1 min-w-0 flex items-center gap-2 px-2 sm:px-3">
                <span
                    className={cn(
                        'shrink-0 transition-colors duration-[50ms]',
                        obj.isFolder ? 'text-primary' : 'text-muted-foreground',
                    )}
                    aria-hidden="true"
                >
                    {getFileIcon(obj.key, obj.isFolder)}
                </span>
                <span
                    className="truncate text-xs group-hover/row:text-primary"
                    title={fileName}
                >
                    {fileName}
                </span>
            </div>

            {/* Size column */}
            <div className="w-[72px] hidden sm:flex items-center justify-center text-muted-foreground text-xs px-2 tabular-nums">
                {obj.isFolder ? '—' : formatBytes(obj.size)}
            </div>

            {/* Modified column */}
            <div className="w-[88px] hidden md:flex items-center justify-center text-muted-foreground text-xs px-2 tabular-nums">
                {obj.isFolder ? '—' : obj.lastModified ? <time dateTime={obj.lastModified}>{formatDate(obj.lastModified)}</time> : '—'}
            </div>

            {/* Actions column */}
            <div className="w-12 sm:w-14 flex items-center justify-end pr-2">
                {/* Size on mobile */}
                {!obj.isFolder && (
                    <span className="text-xs text-muted-foreground sm:hidden mr-1 whitespace-nowrap tabular-nums">
                        {formatBytes(obj.size)}
                    </span>
                )}
                <Button
                    onClick={e => { e.stopPropagation(); onContextMenu(e, obj); }}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`More options for ${fileName}`}
                    aria-haspopup="menu"
                >
                    <MoreHorizontal className="size-3.5" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
});

FileRow.displayName = 'FileRow';

// Standard table row for non-virtualized rendering
function StandardRow({ obj, onNavigate, onPreview, onContextMenu, onItemSelect, isSelected, index, skipAnimations, isActive }: {
    obj: S3Object;
    onNavigate: (obj: S3Object) => void;
    onPreview: (obj: S3Object) => void;
    onContextMenu: (e: React.MouseEvent, obj: S3Object) => void;
    onItemSelect: (index: number, key: string, isCurrentlySelected: boolean) => void;
    isSelected: boolean;
    index: number;
    skipAnimations: boolean;
    isActive: boolean;
}) {
    const fileName = getFileName(obj.key);

    return (
        <TableRow
            id={rowId(index)}
            className={cn(
                'group/row transition-colors hover:bg-accent cursor-pointer',
                !skipAnimations && 'stagger-item',
                isSelected && 'bg-primary/10',
                isActive && 'bg-accent/60 ring-1 ring-inset ring-primary/50',
            )}
            style={!skipAnimations ? { animationDelay: `${index * 25}ms` } : undefined}
            onContextMenu={e => onContextMenu(e, obj)}
            onClick={() => (obj.isFolder ? onNavigate(obj) : onPreview(obj))}
            aria-label={obj.isFolder ? `Folder: ${fileName}` : `File: ${fileName}`}
            aria-selected={isSelected}
        >
            <TableCell className="w-10 py-1.5 sm:py-2 pl-4">
                <div className="flex items-center justify-center">
                    <SelectCheckbox
                        checked={isSelected}
                        onChange={() => onItemSelect(index, obj.key, isSelected)}
                        ariaLabel={`Select ${fileName}`}
                    />
                </div>
            </TableCell>
            <TableCell className="py-1.5 sm:py-2">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            'shrink-0 transition-colors duration-[50ms]',
                            obj.isFolder ? 'text-primary' : 'text-muted-foreground',
                        )}
                        aria-hidden="true"
                    >
                        {getFileIcon(obj.key, obj.isFolder)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <span
                            className="truncate block text-xs max-w-[120px] sm:max-w-none group-hover/row:text-primary"
                            title={fileName}
                        >
                            {fileName.length > 20 && window.innerWidth < 640
                                ? fileName.slice(0, 18) + '…'
                                : fileName}
                        </span>
                    </div>
                </div>
            </TableCell>

            <TableCell className="text-muted-foreground text-xs hidden sm:table-cell text-center! px-2! whitespace-nowrap tabular-nums">
                {obj.isFolder ? '—' : formatBytes(obj.size)}
            </TableCell>

            <TableCell className="text-muted-foreground text-xs hidden md:table-cell text-center! px-2! whitespace-nowrap tabular-nums">
                {obj.isFolder ? '—' : obj.lastModified ? <time dateTime={obj.lastModified}>{formatDate(obj.lastModified)}</time> : '—'}
            </TableCell>

            <TableCell className="py-1.5 sm:py-2 pr-4">
                <div className="flex items-center justify-end">
                    {!obj.isFolder && (
                        <span className="text-xs text-muted-foreground sm:hidden mr-1 whitespace-nowrap tabular-nums">
                            {formatBytes(obj.size)}
                        </span>
                    )}
                    <Button
                        onClick={e => { e.stopPropagation(); onContextMenu(e, obj); }}
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`More options for ${fileName}`}
                        aria-haspopup="menu"
                    >
                        <MoreHorizontal className="size-3.5" aria-hidden="true" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

// Shared "loading more" footer, used by both the virtualized and table branches.
function LoadMoreIndicator() {
    return (
        <div className="flex items-center justify-center py-3 text-muted-foreground text-sm">
            <Spinner className="mr-2" aria-hidden="true" />
            Loading more...
        </div>
    );
}

export function FileTable({ bucket, locationKey, objects, loading, selectedKeys, onNavigate, onPreview, onContextMenu, onSelect, onSelectAll, onSelectRange, sortField, sortDirection, onSort, hasMore, loadingMore, onLoadMore, viewMode, onViewModeChange, filters, onFiltersChange, onSortWithDirection, loadedCount }: FileTableProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastClickedIndexRef = useRef<number>(-1);
    // Keyboard cursor. Rows used to be individually focusable (tabIndex 0 for
    // every folder), which meant a 500-folder directory was 500 tab stops before
    // you reached anything else. Focus now stays on the scroll container and
    // aria-activedescendant points at the active row, which is the composite
    // widget pattern and -- unlike a roving tabindex -- still works when the
    // active row virtualises out of the DOM.
    const [activeIndex, setActiveIndex] = useState(0);
    // Track shift state via global keydown/keyup instead of reading e.shiftKey in
    // click handlers. React's synthetic onChange for checkboxes doesn't reliably
    // propagate the native shiftKey property, so we maintain our own ground truth.
    const shiftKeyRef = useRef(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftKeyRef.current = true; };
        const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftKeyRef.current = false; };
        const handleBlur = () => { shiftKeyRef.current = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Reset shift anchor when objects list changes
    useEffect(() => {
        lastClickedIndexRef.current = -1;
    }, [objects]);

    // Handle item selection with shift+click range support
    const handleItemSelect = useCallback((index: number, key: string, isCurrentlySelected: boolean) => {
        if (shiftKeyRef.current && lastClickedIndexRef.current >= 0 && lastClickedIndexRef.current !== index) {
            const start = Math.min(lastClickedIndexRef.current, index);
            const end = Math.max(lastClickedIndexRef.current, index);
            const keysInRange = objects.slice(start, end + 1).map(obj => obj.key);
            onSelectRange(keysInRange);
        } else {
            onSelect(key, !isCurrentlySelected);
        }
        lastClickedIndexRef.current = index;
    }, [objects, onSelect, onSelectRange]);

    // Below ~100 items a real DOM table with stagger animations feels nicer.
    // Above that threshold, rendering all rows tanks scroll performance, so we
    // switch to react-window's virtual scroll which only mounts visible rows.
    const useVirtualization = objects.length > PAGINATION.VIRTUAL_SCROLL_THRESHOLD;

    // Observed rather than read from clientHeight during render: that returned
    // whatever the height happened to be at that moment, so it went stale after
    // a sidebar toggle and never triggered a re-render when it changed.
    const { height: containerHeight } = useElementSize(containerRef);

    // The active row must stay on screen, since only the keyboard can move it
    // off. Only the virtualised branch needs help doing that.
    const listRef = useRef<List>(null);
    useEffect(() => {
        if (!useVirtualization) return;
        // 'auto' scrolls only when the row is off-screen, which is what a
        // keyboard cursor needs. Aligning every move would jump the viewport.
        listRef.current?.scrollToItem(activeIndex, 'auto');
    }, [activeIndex, useVirtualization]);

    // Navigating to another folder should leave the cursor at the top of the new
    // contents, not on whatever index happened to be active -- which can be past
    // the end of a much shorter listing.
    useEffect(() => {
        setActiveIndex(0);
    }, [locationKey]);

    const allSelected = objects.length > 0 && objects.every(obj => selectedKeys.has(obj.key));

    const sortProps = { sortField, sortDirection, onSort };

    const onContainerKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            // Ignore keys aimed at a control inside a row. Focus reaches those
            // by Tab, and hijacking their arrow keys would break native
            // behaviour. When the container itself holds focus, target is it.
            const target = e.target as HTMLElement;
            if (target !== e.currentTarget && target.closest('button, input, a, [role="button"]')) return;
            if (objects.length === 0) return;

            const clamp = (n: number) => Math.max(0, Math.min(n, objects.length - 1));
            const move = (next: number) => {
                const to = clamp(next);
                if (e.shiftKey && lastClickedIndexRef.current >= 0) {
                    const from = Math.min(lastClickedIndexRef.current, to);
                    const end = Math.max(lastClickedIndexRef.current, to);
                    onSelectRange(objects.slice(from, end + 1).map(o => o.key));
                }
                setActiveIndex(to);
            };

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    move(activeIndex + 1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    move(activeIndex - 1);
                    break;
                case 'Home':
                    e.preventDefault();
                    setActiveIndex(0);
                    break;
                case 'End':
                    e.preventDefault();
                    setActiveIndex(objects.length - 1);
                    break;
                case 'Enter': {
                    const obj = objects[activeIndex];
                    if (!obj) break;
                    e.preventDefault();
                    lastClickedIndexRef.current = activeIndex;
                    if (obj.isFolder) onNavigate(obj);
                    else onPreview(obj);
                    break;
                }
                case ' ': {
                    const obj = objects[activeIndex];
                    if (!obj) break;
                    e.preventDefault();
                    lastClickedIndexRef.current = activeIndex;
                    onSelect(obj.key, !selectedKeys.has(obj.key));
                    break;
                }
                case 'a':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        onSelectRange(objects.map(o => o.key));
                    }
                    break;
                default:
                    break;
            }
        },
        [objects, activeIndex, onNavigate, onPreview, onSelect, onSelectRange, selectedKeys],
    );

    // Shared by both list branches: a focusable composite container that owns
    // the keyboard cursor, with the active row referenced by id.
    const listContainerProps = {
        tabIndex: 0,
        onKeyDown: onContainerKeyDown,
        'aria-activedescendant': objects[activeIndex] ? rowId(activeIndex) : undefined,
    } as const;

    const viewToggle = (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/50 px-3 py-1.5">
            {/* A grid has no column headers, so sorting needs a home here. In list
                mode the headers already do it and a second control would just be
                two ways to do one thing. */}
            {viewMode === 'grid' && (
                <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                    <SortButton field="name" label="Name" {...sortProps} />
                    <SortButton field="size" label="Size" {...sortProps} />
                    <SortButton field="lastModified" label="Modified" {...sortProps} />
                </div>
            )}
            <FilterBar
                filters={filters}
                onFiltersChange={onFiltersChange}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={onSortWithDirection}
                matchedCount={objects.length}
                loadedCount={loadedCount}
                hasMore={hasMore ?? false}
            />
            <div className="ml-auto">
                <ToggleGroup
                    value={[viewMode]}
                    onValueChange={next => {
                        // Clicking the pressed item reports an empty array.
                        // Treating that as "no view" would leave the toolbar blank.
                        if (next.length > 0) onViewModeChange(next[0] as ViewMode);
                    }}
                >
                    <ToggleGroupItem value="list" aria-label="List view" className="size-7 px-1.5">
                        <LayoutList className="size-3.5" aria-hidden="true" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="grid" aria-label="Grid view" className="size-7 px-1.5">
                        <LayoutGrid className="size-3.5" aria-hidden="true" />
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        </div>
    );

    if (loading && objects.length === 0) {
        return (
            <div className="p-3 sm:p-4 space-y-2" role="status" aria-label="Loading files">
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className="stagger-item flex items-center gap-3 p-3"
                        style={{ animationDelay: `${i * 40}ms` }}
                        aria-hidden="true"
                    >
                        <Skeleton className="w-8 h-8 rounded" />
                        <Skeleton className="flex-1 h-4" />
                        <Skeleton className="w-16 h-4 hidden sm:block" />
                    </div>
                ))}
                <span className="sr-only">Loading file list...</span>
            </div>
        );
    }

    if (viewMode === 'grid') {
        return (
            <div className="flex h-full flex-col">
                {viewToggle}
                <div className="min-h-0 flex-1">
                    <FileGrid
                        bucket={bucket}
                        objects={objects}
                        selectedKeys={selectedKeys}
                        onNavigate={onNavigate}
                        onPreview={onPreview}
                        onContextMenu={onContextMenu}
                        onSelect={onSelect}
                        onSelectRange={onSelectRange}
                        onLoadMore={onLoadMore}
                        hasMore={hasMore}
                        loadingMore={loadingMore}
                    />
                </div>
            </div>
        );
    }

    // Virtual scrolling for large lists
    if (useVirtualization) {
        return (
            <div ref={containerRef} className="h-full flex flex-col">
                {viewToggle}
                {/* Header with sortable columns */}
                <div className="flex items-center border-b border-border bg-card/50 text-xs font-medium text-muted-foreground">
                    <div className="w-10 flex items-center justify-center pl-2">
                        <SelectCheckbox
                            checked={allSelected}
                            onChange={() => onSelectAll(!allSelected)}
                            ariaLabel={allSelected ? 'Deselect all' : 'Select all'}
                        />
                    </div>
                    <div className="flex-1 px-2 sm:px-3 py-2">
                        <SortButton field="name" label="Name" {...sortProps} />
                    </div>
                    <div className="w-[72px] hidden sm:flex justify-center px-2 py-2">
                        <SortButton field="size" label="Size" {...sortProps} />
                    </div>
                    <div className="w-[88px] hidden md:flex justify-center px-2 py-2">
                        <SortButton field="lastModified" label="Modified" {...sortProps} />
                    </div>
                    <div className="w-12 sm:w-14 py-2"><span className="sr-only">Actions</span></div>
                </div>

                {/* Virtualized list */}
                <div
                    className="flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    style={{ minHeight: 0 }}
                    role="grid"
                    aria-label="Files and folders"
                    aria-multiselectable="true"
                    {...listContainerProps}
                >
                    <List
                        ref={listRef}
                        // Falls back to 400 only for the first frame, before the
                        // observer has reported. Reading clientHeight during
                        // render instead would be stale for good after any resize.
                        height={containerHeight || 400}
                        itemCount={objects.length}
                        itemSize={PAGINATION.ROW_HEIGHT}
                        width="100%"
                        overscanCount={PAGINATION.OVERSCAN_COUNT}
                        itemData={{
                            objects,
                            selectedKeys,
                            onNavigate,
                            onPreview,
                            onContextMenu,
                            onItemSelect: handleItemSelect,
                            activeIndex,
                        }}
                        onItemsRendered={({ visibleStopIndex }) => {
                            if (hasMore && !loadingMore && onLoadMore && visibleStopIndex >= objects.length - PAGINATION.LOAD_MORE_THRESHOLD) {
                                onLoadMore();
                            }
                        }}
                    >
                        {FileRow}
                    </List>
                </div>
                {loadingMore && <LoadMoreIndicator />}
            </div>
        );
    }

    // 100+ simultaneous CSS stagger animations destroy the frame rate (each row
    // triggers its own composite layer). Skip them when the list is large enough
    // that the visual payoff isn't worth the perf hit.
    const skipAnimations = objects.length > 100;

    return (
        <>
            {viewToggle}
            {/* shadcn's Table wraps the table in an overflow-x-auto div. That div
                would become the nearest scroll container, and since its height is
                content-sized it never scrolls vertically -- which silently breaks
                the sticky header below. Reset it to overflow-visible so sticky
                resolves against the outer pane. */}
            <div
                className="[&_[data-slot=table-container]]:overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                role="grid"
                aria-label="Files and folders"
                aria-multiselectable="true"
                {...listContainerProps}
            >
                <Table>
                    <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card [&_th]:uppercase [&_th]:tracking-[0.05em] [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:text-muted-foreground [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
                        <TableRow className="hover:bg-transparent">
                            <TableHead scope="col" className="w-10">
                                <div className="flex items-center justify-center">
                                    <SelectCheckbox
                                        checked={allSelected}
                                        onChange={() => onSelectAll(!allSelected)}
                                        ariaLabel={allSelected ? 'Deselect all' : 'Select all'}
                                    />
                                </div>
                            </TableHead>
                            <TableHead scope="col">
                                <SortButton field="name" label="Name" {...sortProps} />
                            </TableHead>
                            <TableHead scope="col" className="w-[72px] hidden sm:table-cell text-center! px-2!">
                                <SortButton field="size" label="Size" {...sortProps} className="justify-center w-full" />
                            </TableHead>
                            <TableHead scope="col" className="w-[88px] hidden md:table-cell text-center! px-2!">
                                <SortButton field="lastModified" label="Modified" {...sortProps} className="justify-center w-full" />
                            </TableHead>
                            <TableHead scope="col" className="w-12 sm:w-14"><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {objects.map((obj, i) => (
                            <StandardRow
                                key={obj.key}
                                obj={obj}
                                onNavigate={onNavigate}
                                onPreview={onPreview}
                                onContextMenu={onContextMenu}
                                onItemSelect={handleItemSelect}
                                isSelected={selectedKeys.has(obj.key)}
                                index={i}
                                skipAnimations={skipAnimations}
                                isActive={i === activeIndex}
                            />
                        ))}
                    </TableBody>
                </Table>
            </div>
            {loadingMore && <LoadMoreIndicator />}
            {hasMore && !loadingMore && (
                <div className="flex items-center justify-center py-4">
                    <Button onClick={onLoadMore} variant="ghost" size="sm">
                        Load more files...
                    </Button>
                </div>
            )}
        </>
    );
}

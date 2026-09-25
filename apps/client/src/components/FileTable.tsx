import { useRef, useCallback, useEffect, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { MoreHorizontal } from 'lucide-react';
import { cn } from 'cn';
import type { S3Object, SortField, SortDirection } from '../types';
import { formatBytes, formatDate } from '../utils/formatters';
import { getFileName, getFileIcon } from '../utils/fileUtils';
import { PAGINATION } from '../constants';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Skeleton } from './ui/skeleton';
import { Spinner } from './ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from './ui/table';

interface FileTableProps {
    objects: S3Object[];
    loading: boolean;
    selectedKeys: Set<string>;
    onNavigate: (obj: S3Object) => void;
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
}

interface RowProps {
    index: number;
    style: React.CSSProperties;
    data: {
        objects: S3Object[];
        selectedKeys: Set<string>;
        onNavigate: (obj: S3Object) => void;
        onContextMenu: (e: React.MouseEvent, obj: S3Object) => void;
        onItemSelect: (index: number, key: string, isCurrentlySelected: boolean) => void;
    };
}

// Selection checkbox. stopPropagation is load-bearing: the row itself is
// clickable for folders, so a click that toggles selection must not also
// navigate.
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
    const { objects, selectedKeys, onNavigate, onContextMenu, onItemSelect } = data;
    const obj = objects[index];
    const fileName = getFileName(obj.key);
    const isSelected = selectedKeys.has(obj.key);

    return (
        <div
            style={style}
            className={cn(
                'group/row flex items-center transition-colors hover:bg-accent',
                obj.isFolder ? 'cursor-pointer' : 'cursor-default',
                isSelected && 'bg-primary/10',
            )}
            onContextMenu={e => onContextMenu(e, obj)}
            onClick={() => obj.isFolder && onNavigate(obj)}
            onKeyDown={(e) => obj.isFolder && e.key === 'Enter' && onNavigate(obj)}
            tabIndex={obj.isFolder ? 0 : -1}
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
function StandardRow({ obj, onNavigate, onContextMenu, onItemSelect, isSelected, index, skipAnimations }: {
    obj: S3Object;
    onNavigate: (obj: S3Object) => void;
    onContextMenu: (e: React.MouseEvent, obj: S3Object) => void;
    onItemSelect: (index: number, key: string, isCurrentlySelected: boolean) => void;
    isSelected: boolean;
    index: number;
    skipAnimations: boolean;
}) {
    const fileName = getFileName(obj.key);

    return (
        <TableRow
            className={cn(
                'group/row transition-colors hover:bg-accent',
                !skipAnimations && 'stagger-item',
                obj.isFolder ? 'cursor-pointer' : 'cursor-default',
                isSelected && 'bg-primary/10',
            )}
            style={!skipAnimations ? { animationDelay: `${index * 25}ms` } : undefined}
            onContextMenu={e => onContextMenu(e, obj)}
            onClick={() => obj.isFolder && onNavigate(obj)}
            onKeyDown={(e) => obj.isFolder && e.key === 'Enter' && onNavigate(obj)}
            tabIndex={obj.isFolder ? 0 : -1}
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

export function FileTable({ objects, loading, selectedKeys, onNavigate, onContextMenu, onSelect, onSelectAll, onSelectRange, sortField, sortDirection, onSort, hasMore, loadingMore, onLoadMore }: FileTableProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastClickedIndexRef = useRef<number>(-1);
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

    // Get container height for virtual list
    const getHeight = useCallback(() => {
        if (containerRef.current) {
            return containerRef.current.clientHeight;
        }
        return 400;
    }, []);

    const allSelected = objects.length > 0 && objects.every(obj => selectedKeys.has(obj.key));

    const sortProps = { sortField, sortDirection, onSort };

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

    // Virtual scrolling for large lists
    if (useVirtualization) {
        return (
            <div ref={containerRef} className="h-full flex flex-col">
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
                <div className="flex-1" style={{ minHeight: 0 }}>
                    <List
                        height={getHeight()}
                        itemCount={objects.length}
                        itemSize={PAGINATION.ROW_HEIGHT}
                        width="100%"
                        overscanCount={PAGINATION.OVERSCAN_COUNT}
                        itemData={{ objects, selectedKeys, onNavigate, onContextMenu, onItemSelect: handleItemSelect }}
                        onItemsRendered={({ visibleStopIndex }) => {
                            if (hasMore && !loadingMore && onLoadMore && visibleStopIndex >= objects.length - 20) {
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
            {/* shadcn's Table wraps the table in an overflow-x-auto div. That div
                would become the nearest scroll container, and since its height is
                content-sized it never scrolls vertically -- which silently breaks
                the sticky header below. Reset it to overflow-visible so sticky
                resolves against the outer pane. */}
            <div className="[&_[data-slot=table-container]]:overflow-visible">
                <Table role="grid" aria-label="Files and folders">
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
                                onContextMenu={onContextMenu}
                                onItemSelect={handleItemSelect}
                                isSelected={selectedKeys.has(obj.key)}
                                index={i}
                                skipAnimations={skipAnimations}
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

import { LayoutGrid, LayoutList } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { FixedSizeList as List } from 'react-window';
import { PAGINATION } from '@/constants';
import { useElementSize } from '@/hooks/useElementSize';
import type { ViewMode } from '@/hooks/useLocationUrl';
import type { S3Object, SortDirection, SortField } from '@/types';
import type { FileFilters } from '@/lib/fileFilters';
import { FileGrid } from './FileGrid';
import { FilterBar } from './FilterBar';
import { FileRow, LoadMoreIndicator, rowId, SelectCheckbox, SortButton, StandardRow } from './FileTableRows';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface FileTableViewProps {
    bucket: string; objects: S3Object[]; loading: boolean; selectedKeys: Set<string>;
    onNavigate: (obj: S3Object) => void; onPreview: (obj: S3Object) => void;
    onContextMenu: (e: React.MouseEvent, obj: S3Object) => void;
    onSelect: (key: string, selected: boolean) => void;
    onSelectAll: (selected: boolean) => void; onSelectRange: (keys: string[]) => void;
    sortField: SortField; sortDirection: SortDirection; onSort: (field: SortField) => void;
    hasMore?: boolean; loadingMore?: boolean; onLoadMore?: () => void;
    viewMode: ViewMode; onViewModeChange: (mode: ViewMode) => void;
    filters: FileFilters; onFiltersChange: (next: FileFilters) => void;
    onSortWithDirection: (field: SortField, direction: SortDirection) => void;
    loadedCount: number; activeIndex: number; allSelected: boolean;
    containerRef: RefObject<HTMLDivElement>;
    handleItemSelect: (index: number, key: string, isCurrentlySelected: boolean) => void;
    onContainerKeyDown: (e: React.KeyboardEvent) => void;
}

export function FileTableView({
    bucket, objects, loading, selectedKeys, onNavigate, onPreview, onContextMenu,
    onSelect, onSelectAll, onSelectRange, sortField, sortDirection, onSort,
    hasMore, loadingMore, onLoadMore, viewMode, onViewModeChange, filters,
    onFiltersChange, onSortWithDirection, loadedCount, activeIndex, allSelected,
    containerRef, handleItemSelect, onContainerKeyDown,
}: FileTableViewProps) {
    const useVirtualization = objects.length > PAGINATION.VIRTUAL_SCROLL_THRESHOLD;
    const { height: containerHeight } = useElementSize(containerRef);
    const listRef = useRef<List>(null);
    useEffect(() => {
        if (!useVirtualization) return;
        listRef.current?.scrollToItem(activeIndex, 'auto');
    }, [activeIndex, useVirtualization]);

    const sortProps = { sortField, sortDirection, onSort };
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

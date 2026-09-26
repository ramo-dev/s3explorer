
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ViewMode } from '@/hooks/useLocationUrl';
import type { S3Object, SortDirection, SortField } from '@/types';
import type { FileFilters } from '@/lib/fileFilters';
import { FileTableView } from './FileTableView';

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

    // Navigating to another folder should leave the cursor at the top of the new
    // contents, not on whatever index happened to be active -- which can be past
    // the end of a much shorter listing.
    useEffect(() => {
        setActiveIndex(0);
    }, [locationKey]);

    const allSelected = objects.length > 0 && objects.every(obj => selectedKeys.has(obj.key));

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

    return (
        <FileTableView
            bucket={bucket} objects={objects} loading={loading} selectedKeys={selectedKeys}
            onNavigate={onNavigate} onPreview={onPreview} onContextMenu={onContextMenu}
            onSelect={onSelect} onSelectAll={onSelectAll} onSelectRange={onSelectRange}
            sortField={sortField} sortDirection={sortDirection} onSort={onSort}
            hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore}
            viewMode={viewMode} onViewModeChange={onViewModeChange} filters={filters}
            onFiltersChange={onFiltersChange} onSortWithDirection={onSortWithDirection}
            loadedCount={loadedCount} activeIndex={activeIndex} allSelected={allSelected}
            containerRef={containerRef} handleItemSelect={handleItemSelect}
            onContainerKeyDown={onContainerKeyDown}
        />
    );
}

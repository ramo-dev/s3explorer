import { cn } from 'cn';
import { MoreHorizontal } from 'lucide-react';
import { memo } from 'react';
import type { S3Object, SortDirection, SortField } from '@/types';
import { getFileIcon, getFileName } from '@/lib/fileUtils';
import { formatBytes, formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { TableCell, TableRow } from '@/components/ui/table';

export interface RowData {
    objects: S3Object[];
    selectedKeys: Set<string>;
    onNavigate: (obj: S3Object) => void;
    onPreview: (obj: S3Object) => void;
    onContextMenu: (e: React.MouseEvent, obj: S3Object) => void;
    onItemSelect: (index: number, key: string, isCurrentlySelected: boolean) => void;
    activeIndex: number;
}

export interface RowProps {
    index: number;
    style: React.CSSProperties;
    data: RowData;
}

/** Stable DOM id for a row. Index-based, not key-based: S3 keys may contain
 *  spaces, which are not legal in an id. */
export const rowId = (index: number) => `file-row-${index}`;

// Selection checkbox. stopPropagation is load-bearing: the row itself is now
// clickable for files as well as folders, so a click that toggles selection
// must not also open a preview.
export function SelectCheckbox({ checked, onChange, ariaLabel }: { checked: boolean; onChange: () => void; ariaLabel: string }) {
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
export function SortButton({ field, label, sortField, sortDirection, onSort, className }: {
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
export const FileRow = memo(({ index, style, data }: RowProps) => {
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
export function StandardRow({ obj, onNavigate, onPreview, onContextMenu, onItemSelect, isSelected, index, skipAnimations, isActive }: {
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
export function LoadMoreIndicator() {
    return (
        <div className="flex items-center justify-center py-3 text-muted-foreground text-sm">
            <Spinner className="mr-2" aria-hidden="true" />
            Loading more...
        </div>
    );
}


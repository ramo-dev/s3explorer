import { ArrowDown, ArrowUp, CalendarDays, SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import type { SortDirection, SortField } from '@/types';
import {
    activeFilterCount,
    CATEGORY_SAMPLE_KEY,
    DATE_PRESETS,
    EMPTY_FILTERS,
    type FileFilters,
    isDateRangeActive,
    isFiltersActive,
    parseISODate,
    SIZE_OPTIONS,
    TYPE_OPTIONS,
    type TypeFilter,
    toISODate,
} from '@/lib/fileFilters';
import { getFileIcon } from '@/lib/fileUtils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { FilterTrigger } from './FilterTrigger';

export interface FilterBarProps {
    filters: FileFilters;
    onFiltersChange: (next: FileFilters) => void;
    sortField: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField, direction: SortDirection) => void;
    /** Objects left after filtering, and how many were loaded before filtering. */
    matchedCount: number;
    loadedCount: number;
    /** True when more pages exist, so the count is a floor and not a total. */
    hasMore: boolean;
}

type SizeOrder = 'none' | 'asc' | 'desc';

const labelFor = <T extends string>(options: readonly { value: T; label: string }[], value: T): string =>
    options.find(o => o.value === value)?.label ?? options[0].label;

export function FilterBar({
    filters,
    onFiltersChange,
    sortField,
    sortDirection,
    onSort,
    matchedCount,
    loadedCount,
    hasMore,
}: FilterBarProps) {
    const set = <K extends keyof FileFilters>(key: K, value: FileFilters[K]) =>
        onFiltersChange({ ...filters, [key]: value });

    const typeLabel = filters.type === 'all' ? null : labelFor(TYPE_OPTIONS, filters.type);
    const sizeLabel = filters.size === 'all' ? null : labelFor(SIZE_OPTIONS, filters.size);
    const sizeOrder: SizeOrder = sortField === 'size' ? sortDirection : 'none';

    const range = filters.modified;
    const selectedRange = useMemo(
        () => ({ from: parseISODate(range.from) ?? undefined, to: parseISODate(range.to) ?? undefined }),
        [range],
    );

    const modifiedLabel = useMemo(() => {
        if (!isDateRangeActive(range)) return null;
        const from = parseISODate(range.from);
        const to = parseISODate(range.to);
        const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (from && to) return `${fmt(from)} – ${fmt(to)}`;
        if (from) return `Since ${fmt(from)}`;
        if (to) return `Before ${fmt(to)}`;
        return null;
    }, [range]);

    const active = isFiltersActive(filters) || sizeOrder !== 'none';
    const count = activeFilterCount(filters);

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {/* ---- Type ---- */}
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <FilterTrigger
                            label="Type"
                            valueLabel={typeLabel}
                            active={filters.type !== 'all'}
                            icon={<SlidersHorizontal className="size-3.5" aria-hidden="true" />}
                        />
                    }
                />
                <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuRadioGroup
                        value={filters.type}
                        onValueChange={value => set('type', value as TypeFilter)}
                    >
                        <DropdownMenuLabel>Type</DropdownMenuLabel>
                        {TYPE_OPTIONS.map(option => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.value === 'all' ? (
                                    option.label
                                ) : (
                                    <>
                                        {getFileIcon(
                                            CATEGORY_SAMPLE_KEY[option.value],
                                            option.value === 'folder',
                                        )}
                                        {option.label}
                                    </>
                                )}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* ---- Modified: a real range, not a list of buckets ---- */}
            <Popover>
                <PopoverTrigger
                    render={
                        <FilterTrigger
                            label="Modified"
                            valueLabel={modifiedLabel}
                            active={isDateRangeActive(range)}
                            icon={<CalendarDays className="size-3.5" aria-hidden="true" />}
                        />
                    }
                />
                <PopoverContent align="start" className="w-auto gap-3 p-3">
                    <PopoverTitle className="text-xs font-medium text-muted-foreground">
                        Date modified
                    </PopoverTitle>

                    {/* Presets write the same bounds the calendar writes, so
                        there is only one kind of range to reason about. */}
                    <div className="flex flex-wrap gap-1">
                        {DATE_PRESETS.map(preset => {
                            const next = preset.range();
                            const isActive = next.from === range.from && next.to === range.to;
                            return (
                                <Button
                                    key={preset.label}
                                    type="button"
                                    size="xs"
                                    variant={isActive ? 'secondary' : 'ghost'}
                                    aria-pressed={isActive}
                                    onClick={() => set('modified', next)}
                                >
                                    {preset.label}
                                </Button>
                            );
                        })}
                    </div>

                    <Calendar
                        className="[--cell-size:2.5rem]"
                        mode="range"
                        selected={selectedRange}
                        onSelect={value => {
                            // react-day-picker reports from >= to while the user
                            // is still dragging; storing that would filter the
                            // listing to nothing mid-gesture.
                            if (!value || !value.from) {
                                set('modified', { from: null, to: null });
                                return;
                            }
                            set('modified', {
                                from: toISODate(value.from),
                                to: value.to ? toISODate(value.to) : null,
                            });
                        }}
                        // Nothing in a bucket is modified in the future, so
                        // future days are dead ends: selectable, and they would
                        // filter the listing to nothing.
                        disabled={{ after: new Date() }}
                        autoFocus
                    />
                </PopoverContent>
            </Popover>

            {/* ---- Size, plus the direction to read it in ---- */}
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <FilterTrigger
                            label="Size"
                            valueLabel={sizeLabel}
                            active={filters.size !== 'all' || sizeOrder !== 'none'}
                            icon={
                                sizeOrder === 'asc' ? (
                                    <ArrowUp className="size-3.5" aria-hidden="true" />
                                ) : sizeOrder === 'desc' ? (
                                    <ArrowDown className="size-3.5" aria-hidden="true" />
                                ) : (
                                    <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                                )
                            }
                        />
                    }
                />
                <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuRadioGroup
                        value={filters.size}
                        onValueChange={value => set('size', value as FileFilters['size'])}
                    >
                        <DropdownMenuLabel>Size</DropdownMenuLabel>
                        {SIZE_OPTIONS.map(option => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>

                    <DropdownMenuSeparator />

                    {/* Direction is not a filter, it is a read order, so it
                        drives the same sort state the column headers do rather
                        than inventing a second one that could disagree. */}
                    <DropdownMenuRadioGroup
                        value={sizeOrder}
                        onValueChange={value => {
                            if (value === 'none') return;
                            onSort('size', value as SortDirection);
                        }}
                    >
                        <DropdownMenuLabel>Order</DropdownMenuLabel>
                        <DropdownMenuRadioItem value="none">Unsorted</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="asc">
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                            Smallest first
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="desc">
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                            Largest first
                        </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {active ? (
                <Button variant="ghost" size="sm" onClick={() => onFiltersChange(EMPTY_FILTERS)}>
                    Clear{count > 0 ? ` (${count})` : ''}
                </Button>
            ) : null}

            {count > 0 ? (
                <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                    {/* "of N loaded" is the honest phrasing: filtering happens
                        client-side over pages already fetched, so the count is a
                        floor while hasMore is true, not a total. */}
                    {matchedCount} of {loadedCount} loaded
                    {hasMore ? '+' : ''} match
                </span>
            ) : null}
        </div>
    );
}

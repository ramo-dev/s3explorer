import type { S3Object } from '../types';

export type FileCategory = 'folder' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'document' | 'other';

const MB = 1024 * 1024;

/**
 * One extension list per category, and the only one in the app.
 *
 * The icon and the filter must agree, or "Images" shows tiles wearing a generic
 * file glyph and the result reads as a bug. getFileIcon is built on top of this
 * for exactly that reason, rather than keeping its own parallel list.
 */
const CATEGORY_EXTENSIONS: Record<Exclude<FileCategory, 'folder' | 'other'>, readonly string[]> = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif', 'heic', 'heif', 'tif', 'tiff'],
    video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'mpg', 'mpeg', 'wmv', 'flv'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'wma'],
    archive: ['zip', 'tar', 'gz', 'tgz', 'rar', '7z', 'bz2', 'xz'],
    code: [
        'js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'rb', 'php', 'swift', 'kt',
        'css', 'scss', 'sass', 'less', 'html', 'htm', 'json', 'yaml', 'yml', 'xml', 'sql', 'sh', 'bash', 'zsh',
        'toml', 'ini', 'cfg', 'conf', 'env', 'lock',
    ],
    document: [
        'pdf', 'txt', 'md', 'markdown', 'rtf', 'doc', 'docx', 'odt', 'pages', 'csv', 'tsv',
        'xls', 'xlsx', 'ods', 'ppt', 'pptx', 'odp',
    ],
};

const EXTENSION_LOOKUP: ReadonlyMap<string, FileCategory> = new Map(
    (Object.keys(CATEGORY_EXTENSIONS) as Array<Exclude<FileCategory, 'folder' | 'other'>>).flatMap(category =>
        CATEGORY_EXTENSIONS[category].map(ext => [ext, category] as const),
    ),
);

/** Classifies a key into exactly one category. Never throws, never returns undefined. */
export function getFileCategory(key: string, isFolder: boolean): FileCategory {
    if (isFolder) return 'folder';
    const name = key.split('/').filter(Boolean).pop() ?? key;
    const dot = name.lastIndexOf('.');
    // No dot at all, or a trailing dot: there is no extension to speak of.
    if (dot < 0 || dot === name.length - 1) return 'other';
    // The lookup, not the dot's position, decides what counts as an extension.
    // That is what separates ".env" (a code file) from ".gitignore" (a dotfile
    // that happens to start with a dot) -- both have their dot at index 0 -- and
    // it keeps a file literally named "env" out of the code category.
    return EXTENSION_LOOKUP.get(name.slice(dot + 1).toLowerCase()) ?? 'other';
}

/**
 * A representative key per category, so menus can render the same glyph
 * getFileIcon would give a real object instead of a second icon mapping.
 */
export const CATEGORY_SAMPLE_KEY: Record<FileCategory, string> = {
    folder: 'folder',
    image: 'sample.png',
    video: 'sample.mp4',
    audio: 'sample.mp3',
    archive: 'sample.zip',
    code: 'sample.ts',
    document: 'sample.pdf',
    other: 'sample.bin',
};

export type TypeFilter = 'all' | FileCategory;
export type SizeFilter = 'all' | 'lt1mb' | '1to10mb' | '10to100mb' | 'gt100mb';

/** Inclusive 'YYYY-MM-DD' bounds, or null for open-ended. */
export interface DateRange {
    from: string | null;
    to: string | null;
}

export interface FileFilters {
    type: TypeFilter;
    modified: DateRange;
    size: SizeFilter;
}

export const EMPTY_FILTERS: FileFilters = { type: 'all', modified: { from: null, to: null }, size: 'all' };

export const isDateRangeActive = (r: DateRange): boolean => r.from !== null || r.to !== null;

export const isFiltersActive = (f: FileFilters): boolean =>
    f.type !== 'all' || isDateRangeActive(f.modified) || f.size !== 'all';

export const activeFilterCount = (f: FileFilters): number =>
    (f.type !== 'all' ? 1 : 0) + (isDateRangeActive(f.modified) ? 1 : 0) + (f.size !== 'all' ? 1 : 0);

interface Option<T extends string> {
    value: T;
    label: string;
}

export const TYPE_OPTIONS: readonly Option<TypeFilter>[] = [
    { value: 'all', label: 'All types' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Video' },
    { value: 'audio', label: 'Audio' },
    { value: 'document', label: 'Documents' },
    { value: 'archive', label: 'Archives' },
    { value: 'code', label: 'Code' },
    { value: 'folder', label: 'Folders' },
    { value: 'other', label: 'Other' },
];

export const SIZE_OPTIONS: readonly Option<SizeFilter>[] = [
    { value: 'all', label: 'Any size' },
    { value: 'lt1mb', label: 'Under 1 MB' },
    { value: '1to10mb', label: '1 – 10 MB' },
    { value: '10to100mb', label: '10 – 100 MB' },
    { value: 'gt100mb', label: 'Over 100 MB' },
];

/**
 * Quick ranges above the calendar. Each is just a pair of bounds, so choosing
 * one and then dragging the calendar are the same kind of edit -- there is no
 * second "mode" to be in.
 */
export interface DatePreset {
    label: string;
    range: () => DateRange;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const toISODate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const daysAgo = (n: number): string => toISODate(new Date(Date.now() - n * DAY_MS));

export const DATE_PRESETS: readonly DatePreset[] = [
    { label: 'Any time', range: () => ({ from: null, to: null }) },
    { label: 'Today', range: () => ({ from: toISODate(new Date()), to: null }) },
    { label: 'Last 7 days', range: () => ({ from: daysAgo(6), to: null }) },
    { label: 'Last 30 days', range: () => ({ from: daysAgo(29), to: null }) },
    { label: 'This year', range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: null }) },
];

/** Parses 'YYYY-MM-DD' as local midnight, or null if it is not that shape. */
export function parseISODate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    // Rejects overflow like 2024-02-31, which Date would roll over to March.
    if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) {
        return null;
    }
    return date;
}

function matchesSize(size: number, filter: SizeFilter): boolean {
    switch (filter) {
        case 'all':
            return true;
        case 'lt1mb':
            return size < MB;
        case '1to10mb':
            return size >= MB && size < 10 * MB;
        case '10to100mb':
            return size >= 10 * MB && size < 100 * MB;
        case 'gt100mb':
            return size >= 100 * MB;
    }
}

function matchesDateRange(stamp: number, range: DateRange): boolean {
    const from = parseISODate(range.from);
    // `to` is inclusive, so it becomes the end of that local day. Without this a
    // range of "Mar 3 - Mar 20" would silently exclude everything after
    // midnight on the 20th, which is the day the user actually clicked.
    const to = parseISODate(range.to);
    if (from && stamp < from.getTime()) return false;
    if (to && stamp > to.getTime() + DAY_MS - 1) return false;
    return true;
}

/**
 * Whether one object survives the active filters.
 *
 * Two deliberate calls, both because the alternative is a silently wrong
 * result rather than an obviously empty one:
 *
 *   - A folder has no LastModified and no meaningful size, so a date or size
 *     filter excludes it. Otherwise "Under 1 MB" matches every folder in the
 *     listing, since a CommonPrefix reports 0 bytes.
 *   - An object with no LastModified is excluded by a date filter rather than
 *     assumed to match. S3 always returns it, so this only affects hand-built
 *     listings, and guessing "recent" would be the worse failure.
 */
export function matchesFilters(obj: S3Object, filters: FileFilters): boolean {
    const isFolder = obj.isFolder;

    if (filters.type !== 'all' && getFileCategory(obj.key, isFolder) !== filters.type) return false;

    if (isDateRangeActive(filters.modified)) {
        if (isFolder || !obj.lastModified) return false;
        const stamp = new Date(obj.lastModified).getTime();
        if (Number.isNaN(stamp) || !matchesDateRange(stamp, filters.modified)) return false;
    }

    if (filters.size !== 'all') {
        if (isFolder || !matchesSize(obj.size, filters.size)) return false;
    }

    return true;
}

export function applyFilters(objects: S3Object[], filters: FileFilters): S3Object[] {
    if (!isFiltersActive(filters)) return objects;
    return objects.filter(obj => matchesFilters(obj, filters));
}

// --- URL round-tripping -----------------------------------------------------
// Filters live in the URL beside ?view= and ?q= so a filtered view is a
// shareable link, which is the whole reason location state moved into the URL.

const TYPE_VALUES = new Set(TYPE_OPTIONS.map(o => o.value));
const SIZE_VALUES = new Set(SIZE_OPTIONS.map(o => o.value));

export function parseFilterParams(params: URLSearchParams): FileFilters {
    const readEnum = <T extends string>(key: string, allowed: Set<T>, fallback: T): T => {
        const raw = params.get(key);
        return raw !== null && allowed.has(raw as T) ? (raw as T) : fallback;
    };

    // Dates are validated, not just read: a hand-edited or stale ?from= should
    // degrade to "no filter" rather than exclude every object in the bucket.
    const rawFrom = params.get('from');
    const rawTo = params.get('to');
    const from = parseISODate(rawFrom) ? rawFrom : null;
    const to = parseISODate(rawTo) ? rawTo : null;

    return {
        type: readEnum('type', TYPE_VALUES as Set<TypeFilter>, 'all'),
        modified: { from, to },
        size: readEnum('size', SIZE_VALUES as Set<SizeFilter>, 'all'),
    };
}

export function writeFilterParams(params: URLSearchParams, filters: FileFilters): void {
    // Only non-defaults are written, so an unfiltered URL stays clean.
    if (filters.type !== 'all') params.set('type', filters.type);
    if (filters.modified.from) params.set('from', filters.modified.from);
    if (filters.modified.to) params.set('to', filters.modified.to);
    if (filters.size !== 'all') params.set('size', filters.size);
}

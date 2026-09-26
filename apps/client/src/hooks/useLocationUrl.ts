import { useCallback, useEffect, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../constants';
import {
    EMPTY_FILTERS,
    parseFilterParams,
    writeFilterParams,
    type FileFilters,
} from '../utils/fileFilters';

export type ViewMode = 'list' | 'grid';

/** Everything the URL carries about where the user is. */
export interface LocationUrl {
    /** null means no bucket selected, which is the app's root. */
    bucket: string | null;
    /** S3 prefix. Either '' (bucket root) or ends with '/'. */
    path: string;
    /** null when absent from the URL, meaning "use the stored preference". */
    view: ViewMode | null;
    search: string;
    filters: FileFilters;
}

const ROOT = '/';
const BUCKET_PREFIX = '/b/';

const EMPTY: LocationUrl = { bucket: null, path: '', view: null, search: '', filters: EMPTY_FILTERS };

/**
 * Reads location state out of a URL.
 *
 * The app had no router, so the address bar was frozen at "/" and navigation
 * was stashed in `history.state` -- which is in-memory only and does not
 * survive a reload. That is why a refresh dropped the user back at the root.
 * The location has to live in the URL itself to be shareable and reloadable.
 *
 * Shape: /b/<bucket>/<folder/...>?view=grid&q=<search>&type=image&after=30d&size=10to100mb
 *
 * Path segments are individually percent-encoded. S3 keys routinely contain
 * spaces, '#', '?' and non-ASCII, and encoding the whole path in one go would
 * escape the separators that make it a path.
 */
export function parseLocationUrl(href?: string): LocationUrl {
    const url = new URL(href ?? window.location.href);

    if (!url.pathname.startsWith(BUCKET_PREFIX)) {
        // Not a location URL at all (the login screen, a stale bookmark, a
        // stray path). Stay at the root rather than guessing.
        return { ...EMPTY };
    }

    const segments = url.pathname
        .slice(BUCKET_PREFIX.length)
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent);

    const [bucket, ...folders] = segments;
    if (!bucket) return { ...EMPTY };

    const params = url.searchParams;
    const view = params.get('view');

    return {
        bucket,
        // A path always ends in '/' except at the bucket root, matching the
        // CommonPrefix values S3 returns and the rest of the app expects.
        path: folders.length ? `${folders.join('/')}/` : '',
        view: view === 'grid' || view === 'list' ? view : null,
        search: params.get('q') ?? '',
        filters: parseFilterParams(params),
    };
}

/** Serialises location state back to a URL. Inverse of parseLocationUrl. */
export function buildLocationUrl(loc: LocationUrl): string {
    if (!loc.bucket) return ROOT;

    const segments = [loc.bucket, ...loc.path.split('/').filter(Boolean)].map(encodeURIComponent);
    const params = new URLSearchParams();
    // Only non-defaults are written, so the common case stays a clean path.
    if (loc.view === 'grid') params.set('view', 'grid');
    if (loc.search) params.set('q', loc.search);
    writeFilterParams(params, loc.filters);

    const query = params.toString();
    return `${BUCKET_PREFIX}${segments.join('/')}${query ? `?${query}` : ''}`;
}

const readStoredView = (): ViewMode => (localStorage.getItem(STORAGE_KEYS.VIEW_MODE) === 'grid' ? 'grid' : 'list');

/**
 * Owns location state in the URL, in both directions.
 *
 * State and URL are two representations of one thing, and the previous version
 * of this let them drift because writing to history lived in App.tsx while
 * reading from it lived in a popstate handler. Keeping both here means the
 * push-vs-replace decision -- which decides whether Back undoes a navigation
 * or a cosmetic preference change -- is made in exactly one place.
 *
 * History is pushed only for navigation (bucket and path). Switching to grid
 * view or typing a search replaces the current entry instead, because a Back
 * button that walks through five view toggles is worse than one that does not.
 */
export function useUrlLocation() {
    // Parsed exactly once, as a lazy useState initialiser rather than a ref
    // assigned during render: this has to be the single value every useState
    // below sees, and a ref write in the render body is a side effect that a
    // discarded concurrent render could leave half-applied.
    const [initial] = useState<LocationUrl>(parseLocationUrl);

    const [bucket, setBucket] = useState<string | null>(initial.bucket);
    const [path, setPath] = useState(initial.path);
    // A ?view= in the URL wins over the stored preference, so a shared link
    // shows what the sender saw. Absent from the URL, the preference stands.
    const [view, setView] = useState<ViewMode>(initial.view ?? readStoredView());
    const [search, setSearch] = useState(initial.search);
    // Filters survive navigation, matching Drive: narrowing to "Images" and then
    // descending into a folder should not silently widen back to everything.
    const [filters, setFilters] = useState<FileFilters>(initial.filters);

    // The last location written to history, so the sync effect can tell a
    // navigation (push) from a preference change (replace).
    const lastWritten = useRef({ bucket: initial.bucket, path: initial.path });

    useEffect(() => {
        const previous = lastWritten.current;
        const navigated = previous.bucket !== bucket || previous.path !== path;
        lastWritten.current = { bucket, path };

        const url = buildLocationUrl({ bucket, path, view, search, filters });
        if (navigated) {
            window.history.pushState(null, '', url);
        } else {
            // Also covers the first render, which must replace rather than push
            // or the page the user came from gets orphaned behind an identical
            // entry for the app root.
            window.history.replaceState(null, '', url);
        }
    }, [bucket, path, view, search, filters]);

    useEffect(() => {
        const onPopState = () => {
            // Read the URL, not event.state: the URL is the source of truth, so
            // a bookmark, a shared link and a Back press all take one code path.
            const next = parseLocationUrl();
            setBucket(next.bucket);
            setPath(next.path);
            if (next.view) setView(next.view);
            setSearch(next.search);
            setFilters(next.filters);
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    // The stored preference is what a fresh session with no ?view= falls back
    // to, so it is written on every change regardless of where the value came
    // from.
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.VIEW_MODE, view);
    }, [view]);

    /** Navigate into a folder. */
    const navigateTo = useCallback((nextBucket: string | null, nextPath: string) => {
        setBucket(nextBucket);
        setPath(nextPath);
    }, []);

    return {
        bucket,
        path,
        view,
        search,
        filters,
        setBucket,
        setPath,
        setView,
        setSearch,
        setFilters,
        navigateTo,
    };
}

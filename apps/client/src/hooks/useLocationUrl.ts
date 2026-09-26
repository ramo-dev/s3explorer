import { useCallback, useEffect, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../constants';
import { buildLocationUrl, parseLocationUrl, type LocationUrl, type ViewMode } from '../app/paths';
import type { FileFilters } from '../lib/fileFilters';

export { buildLocationUrl, parseLocationUrl } from '../app/paths';
export type { LocationUrl, ViewMode } from '../app/paths';

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
        // Stable semantic aliases used by route-facing components. Keep the
        // lower-level setters above for existing callers during migration.
        setSelectedBucket: setBucket,
        setCurrentPath: setPath,
        setViewMode: setView,
        setSearchQuery: setSearch,
    };
}

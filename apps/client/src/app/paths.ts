import {
  EMPTY_FILTERS,
  parseFilterParams,
  writeFilterParams,
  type FileFilters,
} from '../lib/fileFilters';

export type ViewMode = 'list' | 'grid';

/** Everything the URL carries about where the user is. */
export interface LocationUrl {
  bucket: string | null;
  path: string;
  view: ViewMode | null;
  search: string;
  filters: FileFilters;
}

const EMPTY: LocationUrl = {
  bucket: null,
  path: '',
  view: null,
  search: '',
  filters: EMPTY_FILTERS,
};

/** Decode and parse the app-owned bucket/object path from a URL. */
export function parseLocationUrl(href?: string): LocationUrl {
  const url = new URL(href ?? window.location.href);
  if (!url.pathname.startsWith('/b/')) return { ...EMPTY };

  const segments = url.pathname
    .slice('/b/'.length)
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
  const [bucket, ...folders] = segments;
  if (!bucket) return { ...EMPTY };

  const params = url.searchParams;
  const view = params.get('view');
  return {
    bucket,
    path: folders.length ? `${folders.join('/')}/` : '',
    view: view === 'grid' || view === 'list' ? view : null,
    search: params.get('q') ?? '',
    filters: parseFilterParams(params),
  };
}

/** Encode each bucket/key segment independently so S3 keys remain lossless. */
export function buildLocationUrl(loc: LocationUrl): string {
  if (!loc.bucket) return '/';
  const segments = [loc.bucket, ...loc.path.split('/').filter(Boolean)].map(encodeURIComponent);
  const params = new URLSearchParams();
  if (loc.view === 'grid') params.set('view', 'grid');
  if (loc.search) params.set('q', loc.search);
  writeFilterParams(params, loc.filters);
  const query = params.toString();
  return `/b/${segments.join('/')}${query ? `?${query}` : ''}`;
}

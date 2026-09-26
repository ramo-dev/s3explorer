import { useMemo, type MutableRefObject } from 'react';
import type { S3Object, SortDirection, SortField } from '@/types';
import { applyFilters, type FileFilters } from '@/lib/fileFilters';
import { getFileName, isPreviewable } from '@/lib/fileUtils';

interface Options {
  currentPath: string;
  searchResults: S3Object[] | null;
  objects: S3Object[];
  filters: FileFilters;
  sortField: SortField;
  sortDirection: SortDirection;
  selectedKeys: Set<string>;
  displayObjectKeysRef: MutableRefObject<string[]>;
}

export function useFilesPageListing({ currentPath, searchResults, objects, filters, sortField, sortDirection, selectedKeys, displayObjectKeysRef }: Options) {
  const breadcrumbs = useMemo(() => currentPath.split('/').filter(Boolean), [currentPath]);
  const sourceObjects = searchResults ?? objects;
  const filteredObjects = useMemo(() => applyFilters(sourceObjects, filters), [sourceObjects, filters]);
  const displayObjects = useMemo(() => [...filteredObjects].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'name') return multiplier * getFileName(a.key).localeCompare(getFileName(b.key));
    if (sortField === 'size') return multiplier * (a.size - b.size);
    return multiplier * ((a.lastModified ? new Date(a.lastModified).getTime() : 0) - (b.lastModified ? new Date(b.lastModified).getTime() : 0));
  }), [filteredObjects, sortField, sortDirection]);
  displayObjectKeysRef.current = displayObjects.map(object => object.key);
  const selectedObjects = useMemo(() => sourceObjects.filter(obj => selectedKeys.has(obj.key)), [sourceObjects, selectedKeys]);
  const previewableSelectedCount = useMemo(() => objects.filter(obj => selectedKeys.has(obj.key) && !obj.isFolder && isPreviewable(obj.key)).length, [selectedKeys, objects]);
  return { breadcrumbs, sourceObjects, displayObjects, selectedObjects, previewableSelectedCount };
}

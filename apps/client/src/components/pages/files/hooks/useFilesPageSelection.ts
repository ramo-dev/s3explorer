import { useCallback, useMemo } from 'react';
import type { S3Object, SortDirection, SortField } from '@/types';
import type { FileFilters } from '@/lib/fileFilters';
import { isPreviewable } from '@/lib/fileUtils';

interface Options {
  sortField: SortField;
  sortDirection: SortDirection;
  setSortField: (field: SortField) => void;
  setSortDirection: (direction: SortDirection) => void;
  setFilters: (filters: FileFilters) => void;
  selectedKeys: Set<string>;
  objects: S3Object[];
  searchResults: S3Object[] | null;
  handleDownload: (object: S3Object) => void;
  handleDownloadZip: (objects: S3Object[]) => void;
  setBatchPreviewObjects: (objects: S3Object[]) => void;
  setBatchPreviewStartIndex: (index: number) => void;
  setContextMenu: (context: { x: number; y: number; object: S3Object }) => void;
}

export function useFilesPageSelection({ sortField, sortDirection, setSortField, setSortDirection, setFilters, selectedKeys, objects, searchResults, handleDownload, handleDownloadZip, setBatchPreviewObjects, setBatchPreviewStartIndex, setContextMenu }: Options) {
  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  }, [sortField, sortDirection, setSortField, setSortDirection]);
  const handleSortWithDirection = useCallback((field: SortField, direction: SortDirection) => { setSortField(field); setSortDirection(direction); }, [setSortField, setSortDirection]);
  const handleFiltersChange = useCallback((next: FileFilters) => setFilters(next), [setFilters]);
  const handleBatchPreview = useCallback(() => {
    const previewableFiles = objects.filter(obj => selectedKeys.has(obj.key) && !obj.isFolder && isPreviewable(obj.key));
    if (previewableFiles.length) { setBatchPreviewObjects(previewableFiles); setBatchPreviewStartIndex(0); }
  }, [selectedKeys, objects, setBatchPreviewObjects, setBatchPreviewStartIndex]);
  const selectedObjects = useMemo(() => (searchResults ?? objects).filter(obj => selectedKeys.has(obj.key)), [searchResults, objects, selectedKeys]);
  const batchDownloadMode: 'file' | 'zip' = selectedObjects.length === 1 && !selectedObjects[0].isFolder ? 'file' : 'zip';
  const handleBatchDownload = useCallback(() => {
    if (!selectedObjects.length) return;
    if (batchDownloadMode === 'file') handleDownload(selectedObjects[0]);
    else handleDownloadZip(selectedObjects);
  }, [selectedObjects, batchDownloadMode, handleDownload, handleDownloadZip]);
  const previewableSelectedCount = objects.filter(obj => selectedKeys.has(obj.key) && !obj.isFolder && isPreviewable(obj.key)).length;
  const handleContextMenu = useCallback((event: React.MouseEvent, object: S3Object) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, object });
  }, [setContextMenu]);
  return { handleSort, handleSortWithDirection, handleFiltersChange, handleBatchPreview, selectedObjects, batchDownloadMode, handleBatchDownload, previewableSelectedCount, handleContextMenu };
}

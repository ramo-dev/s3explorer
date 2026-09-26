import { Database, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from './EmptyState';
import { FileTable } from './FileTable';
import type { S3Object, SortDirection, SortField } from '@/types';
import { EMPTY_FILTERS, isFiltersActive, type FileFilters } from '@/lib/fileFilters';

export function FilesMainContent(props: {
  activeConnection: boolean;
  selectedBucket: string | null;
  searching: boolean;
  searchActive: boolean;
  displayObjects: S3Object[];
  sourceObjects: S3Object[];
  loading: boolean;
  filters: FileFilters;
  viewMode: 'grid' | 'list';
  selectedKeys: Set<string>;
  locationKey: string;
  sortField: SortField;
  sortDirection: SortDirection;
  hasMore: boolean;
  loadingMore: boolean;
  onAddConnection: () => void;
  onNavigate: (object: S3Object) => void;
  onPreview: (object: S3Object) => void;
  onContextMenu: (event: React.MouseEvent, object: S3Object) => void;
  onSelect: (key: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onSelectRange: (keys: string[]) => void;
  onSort: (field: SortField) => void;
  onLoadMore: () => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onFiltersChange: (filters: FileFilters) => void;
  onSortWithDirection: (field: SortField, direction: SortDirection) => void;
}) {
  const {
    activeConnection, selectedBucket, searching, searchActive, displayObjects, sourceObjects, loading,
    filters, viewMode, selectedKeys, locationKey, sortField, sortDirection, hasMore,
    loadingMore, onAddConnection, onNavigate, onPreview, onContextMenu, onSelect,
    onSelectAll, onSelectRange, onSort, onLoadMore, onViewModeChange, onFiltersChange,
    onSortWithDirection,
  } = props;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {!activeConnection ? (
        <EmptyState icon={Database} title="No connection configured" description="Add an S3 connection to get started" action={
          <Button onClick={onAddConnection} variant="outline" className="group mt-6 border-dashed text-sm font-medium hover:border-primary hover:bg-primary/5 hover:text-primary">Add Connection</Button>
        } />
      ) : !selectedBucket ? (
        <EmptyState icon={Database} title="No bucket selected" description="Select a bucket from the sidebar" />
      ) : searching ? (
        <EmptyState icon={Database} title="Searching..." description="" />
      ) : displayObjects.length === 0 && searchActive ? (
        <EmptyState icon={Folder} title="No results" description="No files or folders match your search" />
      ) : displayObjects.length === 0 && !loading && !isFiltersActive(filters) ? (
        <EmptyState icon={Folder} title="Empty folder" description="Drop files here to upload" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {displayObjects.length === 0 && isFiltersActive(filters) && !loading && (
            <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span>{sourceObjects.length} loaded item{sourceObjects.length === 1 ? '' : 's'} hidden by the current filters.</span>
              <Button type="button" variant="ghost" size="xs" onClick={() => onFiltersChange(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            </div>
          )}
          <FileTable bucket={selectedBucket} locationKey={locationKey} objects={displayObjects} loading={loading}
            selectedKeys={selectedKeys} onNavigate={onNavigate} onPreview={onPreview} onContextMenu={onContextMenu}
            onSelect={onSelect} onSelectAll={onSelectAll} onSelectRange={onSelectRange} sortField={sortField}
            sortDirection={sortDirection} onSort={onSort} hasMore={hasMore} loadingMore={loadingMore}
            onLoadMore={onLoadMore} viewMode={viewMode} onViewModeChange={onViewModeChange} filters={filters}
            onFiltersChange={onFiltersChange} onSortWithDirection={onSortWithDirection} loadedCount={sourceObjects.length} />
        </div>
      )}
    </div>
  );
}

import type { HTMLAttributes, InputHTMLAttributes } from 'react';
import { DropOverlay } from './DropOverlay';
import { ErrorBanner } from '@/components/shared/ErrorBanner';
import { FilesMainContent } from './FilesMainContent';
import { FilesOverlays } from './FilesOverlays';
import { DashboardHeader } from '@/components/layout/dashboard/DashboardHeader';
import { OfflineIndicator } from '@/components/shared/OfflineIndicator';
import { DashboardSidebar } from '@/components/layout/dashboard/DashboardSidebar';
import { Toast } from '@/components/shared/Toast';
import { UploadProgress } from './UploadProgress';
import { BatchActionsBar } from './BatchActionsBar';
import type { Bucket, ContextMenuState, S3Object, SortDirection, SortField, ToastState, UploadJobSummary } from '@/types';
import type { FileFilters } from '@/lib/fileFilters';
import type { Connection } from '@/api';
import { getFileName } from '@/lib/fileUtils';
import { lazy, Suspense } from 'react';

const WelcomeMessage = lazy(() => import('./WelcomeMessage').then(m => ({ default: m.WelcomeMessage })));

interface AuthenticatedFilesShellProps {
  activeConnection: Connection | null;
  buckets: Bucket[];
  selectedBucket: string | null;
  currentPath: string;
  searchQuery: string;
  loading: boolean;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'dark' | 'light';
  toast: ToastState | null;
  error: string | null;
  uploading: boolean;
  uploadProgress: number;
  uploadJobs: UploadJobSummary[];
  isDragActive: boolean;
  networkStatus: { isOnline: boolean; isBackendReachable: boolean };
  filters: FileFilters;
  viewMode: 'grid' | 'list';
  selectedKeys: Set<string>;
  displayObjects: S3Object[];
  sourceObjects: S3Object[];
  searchResults: S3Object[] | null;
  searching: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  hasMore: boolean;
  loadingMore: boolean;
  breadcrumbs: string[];
  contextMenu: ContextMenuState | null;
  showNewBucket: boolean;
  showNewFolder: boolean;
  showRename: S3Object | null;
  showDelete: S3Object | null;
  showDeleteBucket: string | null;
  showConnectionManager: boolean;
  showCommandPalette: boolean;
  newName: string;
  previewObject: S3Object | null;
  batchPreviewObjects: S3Object[];
  batchPreviewStartIndex: number;
  preparingZip: boolean;
  batchDownloadMode: 'file' | 'zip';
  previewableSelectedCount: number;
  getRootProps: () => HTMLAttributes<HTMLElement>;
  getInputProps: () => InputHTMLAttributes<HTMLInputElement>;
  onDrop: (files: File[]) => void;
  onUploadFolder: (files: File[]) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onLogout: () => void;
  onToggleTheme: () => void;
  onSetSidebarOpen: (open: boolean) => void;
  onSetSidebarCollapsed: (collapsed: boolean) => void;
  onSearchChange: (query: string) => void;
  onBucketSelect: (name: string) => void;
  onNewBucket: () => void;
  onDeleteBucket: (name: string) => void;
  onNavigateHome: () => void;
  onOpenConnections: () => void;
  onGoBack: () => void;
  onNavigate: (object: S3Object) => void;
  onSetCurrentPath: (path: string) => void;
  onSetViewMode: (mode: 'grid' | 'list') => void;
  onRefresh: () => void;
  onNewFolder: () => void;
  onOpenCommandPalette: () => void;
  onSetError: (error: string | null) => void;
  onSetToast: (toast: ToastState | null) => void;
  onSetPreviewObject: (object: S3Object | null) => void;
  onSetContextMenu: (menu: ContextMenuState | null) => void;
  onSetNewName: (name: string) => void;
  onSetShowNewBucket: (open: boolean) => void;
  onSetShowNewFolder: (open: boolean) => void;
  onSetShowRename: (object: S3Object | null) => void;
  onSetShowDelete: (object: S3Object | null) => void;
  onSetShowDeleteBucket: (name: string | null) => void;
  onSetShowConnectionManager: (open: boolean) => void;
  onSetShowCommandPalette: (open: boolean) => void;
  onHandleSelect: (key: string, selected: boolean) => void;
  onHandleSelectAll: (selected: boolean) => void;
  onHandleSelectRange: (keys: string[]) => void;
  onHandleSort: (field: SortField) => void;
  onHandleSortWithDirection: (field: SortField, direction: SortDirection) => void;
  onHandleFiltersChange: (filters: FileFilters) => void;
  onLoadMore: () => void;
  onHandleDownload: (object: S3Object) => void;
  onHandleDownloadZip: (objects: S3Object[]) => void;
  onHandleContextMenu: (event: React.MouseEvent, object: S3Object) => void;
  onHandleBatchPreview: () => void;
  onHandleBatchDownload: () => void;
  onHandleBatchDelete: () => void;
  onClearSelection: () => void;
  onSetBatchPreviewObjects: (objects: S3Object[]) => void;
  onHandleCreateBucket: () => void;
  onHandleCreateFolder: () => void;
  onHandleRename: () => void;
  onHandleDelete: () => void;
  onHandleDeleteBucket: (name: string) => void;
  onHandleConnectionChange: () => void;
  onHandleDownloadCurrentFolder: () => void;
  onLoadObjects: () => void;
}

export function AuthenticatedFilesShell({
  activeConnection, buckets, selectedBucket, currentPath, searchQuery, loading, sidebarOpen, sidebarCollapsed,
  theme, toast, error, uploading, uploadProgress, uploadJobs, isDragActive, networkStatus, filters, viewMode, selectedKeys,
  displayObjects, sourceObjects, searchResults, searching, sortField, sortDirection, hasMore, loadingMore,
  breadcrumbs, contextMenu, showNewBucket, showNewFolder, showRename, showDelete, showDeleteBucket,
  showConnectionManager, showCommandPalette, newName, previewObject, batchPreviewObjects, batchPreviewStartIndex,
  preparingZip, batchDownloadMode, previewableSelectedCount, getRootProps, getInputProps, onDrop, onUploadFolder, fileInputRef,
  onLogout, onToggleTheme, onSetSidebarOpen, onSetSidebarCollapsed, onSearchChange, onBucketSelect, onNewBucket,
  onDeleteBucket, onNavigateHome, onOpenConnections, onGoBack, onNavigate, onSetCurrentPath, onSetViewMode,
  onRefresh, onNewFolder, onOpenCommandPalette, onSetError, onSetToast, onSetPreviewObject, onSetContextMenu,
  onSetNewName, onSetShowNewBucket, onSetShowNewFolder, onSetShowRename, onSetShowDelete, onSetShowDeleteBucket,
  onSetShowConnectionManager, onSetShowCommandPalette, onHandleSelect, onHandleSelectAll, onHandleSelectRange,
  onHandleSort, onHandleSortWithDirection, onHandleFiltersChange, onLoadMore, onHandleDownload, onHandleDownloadZip,
  onHandleContextMenu, onHandleBatchPreview, onHandleBatchDownload, onHandleBatchDelete, onClearSelection,
  onSetBatchPreviewObjects, onHandleCreateBucket, onHandleCreateFolder, onHandleRename, onHandleDelete,
  onHandleDeleteBucket, onHandleConnectionChange, onHandleDownloadCurrentFolder, onLoadObjects,
}: AuthenticatedFilesShellProps) {
  const inputRef = fileInputRef as { current: HTMLInputElement | null };
  return (
    // pt-[env(safe-area-inset-top)]: viewport-fit=cover is set, so in installed
    // standalone mode the notch and status bar overlay the app and the header's
    // controls land underneath them. Zero everywhere else, including Safari's
    // own browser chrome. An arbitrary value rather than a @utility, because
    // biome cannot parse Tailwind v4 @utility and each one costs a finding.
    <div className="h-screen flex bg-background overflow-hidden pt-[env(safe-area-inset-top)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100 focus:bg-background focus:px-4 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-ring focus:text-foreground">Skip to main content</a>
      <DashboardSidebar buckets={buckets} selectedBucket={selectedBucket} searchQuery={searchQuery} loading={loading}
        sidebarOpen={sidebarOpen} collapsed={sidebarCollapsed} onToggleCollapse={() => onSetSidebarCollapsed(!sidebarCollapsed)}
        activeConnectionName={activeConnection?.name} pinnedBucket={activeConnection?.bucket ?? undefined} theme={theme}
        onToggleTheme={onToggleTheme} onSearchChange={onSearchChange} onBucketSelect={onBucketSelect} onNewBucket={onNewBucket}
        onDeleteBucket={onDeleteBucket} onCloseSidebar={() => onSetSidebarOpen(false)} onNavigateHome={onNavigateHome}
        onOpenConnections={onOpenConnections} onLogout={onLogout} />
      <main id="main-content" className="flex-1 flex flex-col min-w-0" tabIndex={-1} {...getRootProps()}>
        <input {...getInputProps()} />
        <DashboardHeader selectedBucket={selectedBucket} currentPath={currentPath} loading={loading}
          onOpenSidebar={() => onSetSidebarOpen(true)} onGoBack={onGoBack} onNavigateToRoot={() => onSetCurrentPath('')}
          onNavigateToBreadcrumb={i => onSetCurrentPath(breadcrumbs.slice(0, i + 1).join('/') + '/')}
          onRefresh={onRefresh} onNewFolder={onNewFolder} onUpload={onDrop} onUploadFolder={onUploadFolder} onOpenCommandPalette={onOpenCommandPalette} />
        <ErrorBanner error={error} onDismiss={() => onSetError(null)} />
        <UploadProgress uploading={uploading} progress={uploadProgress} jobs={uploadJobs} />
        <DropOverlay isDragActive={isDragActive} />
        <FilesMainContent activeConnection={!!activeConnection} selectedBucket={selectedBucket} searching={searching}
          searchActive={!!searchResults} displayObjects={displayObjects} sourceObjects={sourceObjects} loading={loading}
          filters={filters} viewMode={viewMode} selectedKeys={selectedKeys} locationKey={`${selectedBucket ?? ''}${currentPath}`}
          sortField={sortField} sortDirection={sortDirection} hasMore={hasMore} loadingMore={loadingMore}
          onAddConnection={onOpenConnections} onNavigate={onNavigate} onPreview={onSetPreviewObject} onContextMenu={onHandleContextMenu}
          onSelect={onHandleSelect} onSelectAll={onHandleSelectAll} onSelectRange={onHandleSelectRange} onSort={onHandleSort}
          onLoadMore={onLoadMore} onViewModeChange={onSetViewMode} onFiltersChange={onHandleFiltersChange}
          onSortWithDirection={onHandleSortWithDirection} />
      </main>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{toast?.message}</div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => onSetToast(null)} />}
      <FilesOverlays contextMenu={contextMenu} setContextMenu={onSetContextMenu} setPreviewObject={onSetPreviewObject}
        handleDownload={onHandleDownload} handleDownloadZip={onHandleDownloadZip} setShowRename={onSetShowRename}
        setShowDelete={onSetShowDelete} getFileName={getFileName} showNewBucket={showNewBucket}
        showNewFolder={showNewFolder} newName={newName} setNewName={onSetNewName} setShowNewBucket={onSetShowNewBucket}
        setShowNewFolder={onSetShowNewFolder} handleCreateBucket={onHandleCreateBucket} handleCreateFolder={onHandleCreateFolder}
        showRename={showRename} handleRename={onHandleRename} showDelete={showDelete} handleDelete={onHandleDelete}
        showDeleteBucket={showDeleteBucket} handleDeleteBucket={onHandleDeleteBucket} showConnectionManager={showConnectionManager}
        setShowDeleteBucket={onSetShowDeleteBucket} setShowConnectionManager={onSetShowConnectionManager}
        handleConnectionChange={onHandleConnectionChange} showCommandPalette={showCommandPalette}
        setShowCommandPalette={onSetShowCommandPalette} buckets={buckets} selectedBucket={selectedBucket} currentPath={currentPath}
        canCreateBucket={!activeConnection?.bucket} setSelectedBucket={name => onBucketSelect(name)} setCurrentPath={onSetCurrentPath}
        setSearchQuery={onSearchChange} handleGoBack={onGoBack} loadObjects={onLoadObjects} setFileInput={() => fileInputRef.current?.click()}
        handleDownloadCurrentFolder={onHandleDownloadCurrentFolder} previewObject={previewObject} batchPreviewObjects={batchPreviewObjects}
        setBatchPreviewObjects={onSetBatchPreviewObjects} batchPreviewStartIndex={batchPreviewStartIndex} />
      <input key={uploadProgress} ref={node => { inputRef.current = node; }} type="file" multiple className="hidden" onChange={e => e.target.files && onDrop(Array.from(e.target.files))} />
      {!activeConnection && <Suspense fallback={null}><WelcomeMessage onConfigure={onOpenConnections} /></Suspense>}
      <OfflineIndicator isOnline={networkStatus.isOnline} isBackendReachable={networkStatus.isBackendReachable} />
      <BatchActionsBar selectedCount={selectedKeys.size} previewableCount={previewableSelectedCount} downloadMode={batchDownloadMode}
        downloading={preparingZip} onClearSelection={onClearSelection} onDeleteSelected={onHandleBatchDelete}
        onPreviewSelected={onHandleBatchPreview} onDownloadSelected={onHandleBatchDownload} />
    </div>
  );
}

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { getAuthStatus, logout } from '@/api/auth';
import { getActiveConnection } from '@/api/connections';
import { listBuckets } from '@/api/buckets';
import { useObjectListing, useObjectSearch } from '@/api/queries';
import { useUrlLocation } from '@/hooks/useLocationUrl';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useUploadJobs } from '@/hooks/useUploadJobs';
import type { Bucket, S3Object, SortDirection, SortField, ToastState, UploadProgressState } from '@/types';
import { useSelection } from './hooks/useSelection';
import { useViewPrefs } from './hooks/useViewPrefs';
import { useDialogs } from './hooks/useDialogs';
import { useFileUpload } from './hooks/useFileUpload';
import { useBucketActions } from './hooks/useBucketActions';
import { useObjectActions } from './hooks/useObjectActions';
import { useFilesPageListing } from './hooks/useFilesPageListing';
import { useFilesPageSelection } from './hooks/useFilesPageSelection';
const LoginPage = lazy(() => import('../login/LoginPage').then(m => ({ default: m.LoginPage })));
const SetupPage = lazy(() => import('../setup/SetupPage').then(m => ({ default: m.SetupPage })));
import type { Connection } from '@/api';
import { Spinner } from '@/components/ui/spinner';
import { AuthenticatedFilesShell } from './components/AuthenticatedFilesShell';
export default function FilesPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const {
    showConnectionManager, setShowConnectionManager, showNewBucket, setShowNewBucket,
    showNewFolder, setShowNewFolder, showRename, setShowRename, showDelete, setShowDelete,
    showDeleteBucket, setShowDeleteBucket, newName, setNewName, contextMenu, setContextMenu,
    showCommandPalette, setShowCommandPalette, previewObject, setPreviewObject,
    batchPreviewObjects, setBatchPreviewObjects, batchPreviewStartIndex, setBatchPreviewStartIndex,
  } = useDialogs();
  const networkStatus = useNetworkStatus();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const {
    bucket: selectedBucket,
    path: currentPath,
    view: viewMode,
    setBucket: setSelectedBucket,
    setPath: setCurrentPath,
    setView: setViewMode,
    search: searchQuery,
    setSearch: setSearchQuery,
    filters,
    setFilters,
  } = useUrlLocation();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({ percent: 0, uploadedBytes: 0, totalBytes: 0, speedBps: 0, etaSeconds: null });
  // Do not compete with multipart PUTs for connections while a file is uploading.
  // Local upload progress remains available; the job list refreshes when the upload ends.
  const uploadJobs = useUploadJobs(authenticated === true, !uploading);
  const [preparingZip, setPreparingZip] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, theme, toggleTheme } = useViewPrefs();
  const displayObjectKeysRef = useRef<string[]>([]);
  const {
    selectedKeys,
    select: handleSelect,
    selectAll: handleSelectAll,
    selectRange: handleSelectRange,
    clear: clearSelection,
  } = useSelection({ bucket: selectedBucket, path: currentPath, visibleObjectKeys: displayObjectKeysRef });
  const { searchResults, searching } = useObjectSearch(selectedBucket, searchQuery);
  const {
    objects,
    setObjects,
    loading,
    setLoading,
    error,
    setError,
    hasMore,
    loadingMore,
    loadObjects,
    loadMore,
  } = useObjectListing(selectedBucket, currentPath, authenticated);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bucketsLoaded, setBucketsLoaded] = useState(false);
  useEffect(() => {
    checkAuth();
  }, []);
  async function checkAuth() {
    try {
      const status = await getAuthStatus();
      setAuthenticated(status.authenticated);
      setConfigured(status.configured);
      if (status.authenticated) {
        loadActiveConnection();
      }
    } catch (err) {
      setAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  }
  async function loadActiveConnection() {
    try {
      const conn = await getActiveConnection();
      setActiveConnection(conn);
      if (conn) {
        if (conn.bucket) {
          setBuckets([{ name: conn.bucket }]);
          setSelectedBucket(conn.bucket);
        } else {
          loadBuckets();
        }
      }
    } catch (err) {
      console.error('Failed to load active connection:', err);
    }
  }
  function handleLogin() {
    setAuthenticated(true);
    loadActiveConnection();
  }
  async function handleLogout() {
    try {
      await logout();
      setAuthenticated(false);
      setBuckets([]);
      setSelectedBucket(null);
      setObjects([]);
      setActiveConnection(null);
    } catch (err: any) {
      showToastMsg('Logout failed', 'error');
    }
  }
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setShowConnectionManager(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        if (selectedBucket && fileInputRef.current) {
          fileInputRef.current.click();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBucket]);
  const showToastMsg = useCallback((message: string, type: 'success' | 'error' = 'success') => setToast({ message, type }), []);
  const loadBuckets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listBuckets();
      setBuckets(data);
      setBucketsLoaded(true);
    } catch (err: any) {
      if (err.message?.includes('No active S3 connection')) {
        setShowConnectionManager(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!bucketsLoaded || !selectedBucket) return;
    if (buckets.some(b => b.name === selectedBucket)) return;
    setSelectedBucket(null);
    setCurrentPath('');
    setSearchQuery('');
    showToastMsg(`Bucket "${selectedBucket}" is not available on this connection`, 'error');
  }, [bucketsLoaded, buckets, selectedBucket, setSelectedBucket, setCurrentPath, setSearchQuery, showToastMsg]);
  const { onDrop, cancelUpload } = useFileUpload({
    bucket: selectedBucket,
    path: currentPath,
    objects,
    uploading,
    networkStatus,
    setUploading,
    setUploadProgress,
    loadObjects,
    showToast: showToastMsg,
  });
  const { handleCreateBucket, handleDeleteBucket, handleConnectionChange } = useBucketActions({
    buckets, selectedBucket, newName, setBuckets, setSelectedBucket, setCurrentPath,
    setSearchQuery,
    setObjects, setNewName, setShowNewBucket, showToast: showToastMsg, loadActiveConnection,
  });
  const {
    handleDownload, handleDownloadZip, handleCreateFolder, handleRename, handleDelete,
    handleBatchDelete,
  } = useObjectActions({
    selectedBucket, currentPath, objects, selectedKeys, searchResults, newName,
    showRename, showDelete, preparingZip, networkStatus, setObjects, setNewName,
    setShowNewFolder, setShowRename, setShowDelete, setPreparingZip, clearSelection,
    loadObjects, showToast: showToastMsg,
  });
  const handleDownloadCurrentFolder = useCallback(() => {
    if (currentPath) handleDownloadZip([{ key: currentPath, size: 0, isFolder: true }]);
  }, [currentPath, handleDownloadZip]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });
  const handleNavigate = (obj: S3Object) => {
    if (obj.isFolder) setCurrentPath(obj.key);
  };
  const handleGoBack = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length ? parts.join('/') + '/' : '');
  };
  const { breadcrumbs, sourceObjects, displayObjects } = useFilesPageListing({
    currentPath, searchResults, objects, filters, sortField, sortDirection, selectedKeys, displayObjectKeysRef,
  });
  const {
    handleSort, handleSortWithDirection, handleFiltersChange, handleBatchPreview,
    batchDownloadMode, handleBatchDownload, previewableSelectedCount, handleContextMenu,
  } = useFilesPageSelection({
    sortField, sortDirection, setSortField, setSortDirection, setFilters, selectedKeys,
    objects, searchResults, handleDownload, handleDownloadZip, setBatchPreviewObjects,
    setBatchPreviewStartIndex, setContextMenu,
  });
  if (checkingAuth) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center" role="status" aria-live="polite">
        <div className="text-muted-foreground" aria-label="Loading application">
          <Spinner className="size-6" aria-label="Loading application" />
        </div>
      </div>
    );
  }
  if (configured === false) {
    return <Suspense fallback={null}><SetupPage onSetupComplete={() => {
      checkAuth();
      showToastMsg('Setup complete! Please log in.');
    }} /></Suspense>;
  }
  if (!authenticated) {
    return <Suspense fallback={null}><LoginPage onLogin={handleLogin} /></Suspense>;
  }
  return <AuthenticatedFilesShell
    activeConnection={activeConnection} buckets={buckets} selectedBucket={selectedBucket} currentPath={currentPath}
    searchQuery={searchQuery} loading={loading} sidebarOpen={sidebarOpen} sidebarCollapsed={sidebarCollapsed}
    theme={theme} toast={toast} error={error} uploading={uploading} uploadProgress={uploadProgress}
    uploadJobs={uploadJobs}
     isDragActive={isDragActive} networkStatus={networkStatus} filters={filters} viewMode={viewMode}
    selectedKeys={selectedKeys} displayObjects={displayObjects} sourceObjects={sourceObjects} searchResults={searchResults}
    searching={searching} sortField={sortField} sortDirection={sortDirection} hasMore={hasMore} loadingMore={loadingMore}
    breadcrumbs={breadcrumbs} contextMenu={contextMenu} showNewBucket={showNewBucket} showNewFolder={showNewFolder}
    showRename={showRename} showDelete={showDelete} showDeleteBucket={showDeleteBucket}
    showConnectionManager={showConnectionManager} showCommandPalette={showCommandPalette} newName={newName}
    previewObject={previewObject} batchPreviewObjects={batchPreviewObjects} batchPreviewStartIndex={batchPreviewStartIndex}
    preparingZip={preparingZip} batchDownloadMode={batchDownloadMode} previewableSelectedCount={previewableSelectedCount}
     getRootProps={getRootProps} getInputProps={getInputProps} onDrop={onDrop} fileInputRef={fileInputRef}
     onUploadFolder={onDrop}
    onLogout={handleLogout} onToggleTheme={toggleTheme} onSetSidebarOpen={setSidebarOpen}
    onSetSidebarCollapsed={setSidebarCollapsed} onSearchChange={setSearchQuery}
    onBucketSelect={name => { setSelectedBucket(name); setCurrentPath(''); setSidebarOpen(false); setSearchQuery(''); }}
    onNewBucket={() => { setNewName(''); setShowNewBucket(true); }} onDeleteBucket={name => setShowDeleteBucket(name)}
    onNavigateHome={() => { setSelectedBucket(null); setCurrentPath(''); setSidebarOpen(false); setSearchQuery(''); }}
    onOpenConnections={() => setShowConnectionManager(true)} onGoBack={handleGoBack} onNavigate={handleNavigate}
    onSetCurrentPath={setCurrentPath} onSetViewMode={setViewMode} onRefresh={() => loadObjects()}
    onNewFolder={() => { setNewName(''); setShowNewFolder(true); }} onOpenCommandPalette={() => setShowCommandPalette(true)}
    onSetError={setError} onSetToast={setToast} onSetPreviewObject={setPreviewObject} onSetContextMenu={setContextMenu}
    onSetNewName={setNewName} onSetShowNewBucket={setShowNewBucket} onSetShowNewFolder={setShowNewFolder}
    onSetShowRename={setShowRename} onSetShowDelete={setShowDelete} onSetShowDeleteBucket={setShowDeleteBucket}
    onSetShowConnectionManager={setShowConnectionManager} onSetShowCommandPalette={setShowCommandPalette}
    onHandleSelect={handleSelect} onHandleSelectAll={handleSelectAll} onHandleSelectRange={handleSelectRange}
    onHandleSort={handleSort} onHandleSortWithDirection={handleSortWithDirection} onHandleFiltersChange={handleFiltersChange}
    onLoadMore={loadMore} onHandleDownload={handleDownload} onHandleDownloadZip={handleDownloadZip}
    onHandleContextMenu={handleContextMenu} onHandleBatchPreview={handleBatchPreview}
    onHandleBatchDownload={handleBatchDownload} onHandleBatchDelete={handleBatchDelete} onClearSelection={clearSelection}
    onSetBatchPreviewObjects={setBatchPreviewObjects} onHandleCreateBucket={handleCreateBucket}
    onHandleCreateFolder={handleCreateFolder} onHandleRename={handleRename} onHandleDelete={handleDelete}
    onHandleDeleteBucket={handleDeleteBucket} onHandleConnectionChange={handleConnectionChange}
     onHandleDownloadCurrentFolder={handleDownloadCurrentFolder} onLoadObjects={loadObjects} onCancelUpload={cancelUpload}
  />;
}

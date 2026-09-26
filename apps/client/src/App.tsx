import { Database, Download, Edit3, Eye, FilterX, Folder, FolderArchive, Trash2 } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as api from './api';
import { ContextMenu, ContextMenuItem } from './components/ContextMenu';
import { DropOverlay } from './components/DropOverlay';
import { EmptyState } from './components/EmptyState';
import { ErrorBanner } from './components/ErrorBanner';
import { FileTable } from './components/FileTable';
import { Header } from './components/Header';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { UploadProgress } from './components/UploadProgress';
import { useUrlLocation } from './hooks/useLocationUrl';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import type { Bucket, ContextMenuState, S3Object, SortDirection, SortField, ToastState } from './types';
import { applyFilters, type FileFilters, isFiltersActive } from './utils/fileFilters';
import { getFileName, getParentPrefix, isPreviewable, triggerDownload } from './utils/fileUtils';
import { generateUniqueName, hasNameConflict, resolveUploadConflicts } from './utils/uniqueName';

const CreateBucketModal = lazy(() => import('./components/modals/CreateBucketModal').then(m => ({ default: m.CreateBucketModal })));
const CreateFolderModal = lazy(() => import('./components/modals/CreateFolderModal').then(m => ({ default: m.CreateFolderModal })));
const RenameModal = lazy(() => import('./components/modals/RenameModal').then(m => ({ default: m.RenameModal })));
const DeleteModal = lazy(() => import('./components/modals/DeleteModal').then(m => ({ default: m.DeleteModal })));
const DeleteBucketModal = lazy(() => import('./components/modals/DeleteBucketModal').then(m => ({ default: m.DeleteBucketModal })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })));
const LoginPage = lazy(() => import('./components/LoginPage').then(m => ({ default: m.LoginPage })));
const SetupPage = lazy(() => import('./components/SetupPage').then(m => ({ default: m.SetupPage })));
const ConnectionManager = lazy(() => import('./components/ConnectionManager').then(m => ({ default: m.ConnectionManager })));
const WelcomeMessage = lazy(() => import('./components/WelcomeMessage').then(m => ({ default: m.WelcomeMessage })));
const FilePreviewModal = lazy(() => import('./components/FilePreviewModal').then(m => ({ default: m.FilePreviewModal })));

import type { Connection } from './api';
import { BatchActionsBar } from './components/BatchActionsBar';
import { Button } from './components/ui/button';
import { Spinner } from './components/ui/spinner';
import { STORAGE_KEYS } from './constants';

export default function App() {
  // Auth state
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Connection state
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [showConnectionManager, setShowConnectionManager] = useState(false);

  // Network status
  const networkStatus = useNetworkStatus();

  // Bucket/Object state
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  // Bucket, folder, view mode and search all live in the URL. The hook returns
  // setters with the same names and semantics as the useState calls they
  // replaced, so every existing call site is unchanged.
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
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // True while the server expands a zip selection; the browser's own download UI takes over after
  const [preparingZip, setPreparingZip] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Persisted to localStorage so the sidebar remembers its state across sessions
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  });

  // Pagination state
  const nextTokenRef = useRef<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modal state
  const [showNewBucket, setShowNewBucket] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showRename, setShowRename] = useState<S3Object | null>(null);
  const [showDelete, setShowDelete] = useState<S3Object | null>(null);
  const [showDeleteBucket, setShowDeleteBucket] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Selection state for batch operations
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Search state — when a bucket is selected, search finds files inside it
  const [searchResults, setSearchResults] = useState<S3Object[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Preview state
  const [previewObject, setPreviewObject] = useState<S3Object | null>(null);
  const [batchPreviewObjects, setBatchPreviewObjects] = useState<S3Object[]>([]);
  const [batchPreviewStartIndex, setBatchPreviewStartIndex] = useState(0);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Distinguishes "buckets not fetched yet" from "fetched, and the list is
  // empty", which matters because a user with no buckets is legitimate but a
  // deep link that has not been validated yet must not be discarded.
  const [bucketsLoaded, setBucketsLoaded] = useState(false);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const status = await api.getAuthStatus();
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
      const conn = await api.getActiveConnection();
      setActiveConnection(conn);
      if (conn) {
        if (conn.bucket) {
          // Single-bucket connection (e.g., GCS): skip listBuckets, auto-select
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
      await api.logout();
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
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
      // Cmd/Ctrl + U for upload
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
      const data = await api.listBuckets();
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

  const loadObjects = useCallback(async () => {
    if (!selectedBucket) return;
    try {
      setLoading(true);
      setError(null);
      nextTokenRef.current = undefined;
      const result = await api.listObjects(selectedBucket, currentPath, 200);
      setObjects(result.objects);
      nextTokenRef.current = result.nextContinuationToken;
      setHasMore(result.isTruncated);
    } catch (err: any) {
      if (err.code !== 'CANCELLED') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedBucket, currentPath]);

  const loadMore = useCallback(async () => {
    if (!selectedBucket || !nextTokenRef.current || loadingMore) return;
    try {
      setLoadingMore(true);
      const result = await api.listObjects(selectedBucket, currentPath, 200, nextTokenRef.current);
      setObjects(prev => [...prev, ...result.objects]);
      nextTokenRef.current = result.nextContinuationToken;
      setHasMore(result.isTruncated);
    } catch (err: any) {
      if (err.code !== 'CANCELLED') {
        setError(err.message);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [selectedBucket, currentPath, loadingMore]);

  useEffect(() => {
    if (selectedBucket && authenticated) loadObjects();
  }, [selectedBucket, currentPath, authenticated, loadObjects]);

  // When search query changes with a bucket selected, search inside that bucket.
  // Clears results when query is emptied so the normal folder view returns.
  useEffect(() => {
    if (!selectedBucket || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    api.searchObjects(selectedBucket, searchQuery.trim())
      .then(results => { if (!cancelled) { setSearchResults(results); setSearching(false); } })
      .catch(err => { if (!cancelled && err.code !== 'CANCELLED') { setSearchResults(null); setSearching(false); } });
    return () => { cancelled = true; };
  }, [selectedBucket, searchQuery]);

  // Deep-link validation. A URL can name a bucket that does not exist on the
  // active connection -- a shared link, a stale bookmark, a bucket deleted in
  // another tab. Without this the app sits on a URL that can never resolve,
  // showing a listing error for something the user cannot fix from here.
  // Runs only after a successful bucket load, so it never fires on a network
  // error and turn a transient failure into a lost location.
  useEffect(() => {
    if (!bucketsLoaded || !selectedBucket) return;
    if (buckets.some(b => b.name === selectedBucket)) return;
    setSelectedBucket(null);
    setCurrentPath('');
    setSearchQuery('');
    showToastMsg(`Bucket "${selectedBucket}" is not available on this connection`, 'error');
  }, [bucketsLoaded, buckets, selectedBucket, setSelectedBucket, setCurrentPath, setSearchQuery, showToastMsg]);

  // Upload flow: check connectivity first (fail fast), then auto-rename any
  // files that collide with existing names so the user never accidentally
  // overwrites data. We silently rename duplicates (e.g. "photo (1).jpg")
  // rather than prompting, since prompts would be painful for multi-file drops.
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!selectedBucket || acceptedFiles.length === 0 || uploading) return;

    // Bail early if offline -- better UX than waiting for a timeout
    if (!networkStatus.isOnline || !networkStatus.isBackendReachable) {
      showToastMsg('Cannot upload - check your connection', 'error');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Get existing file names in current folder to check for duplicates
      const existingNames = new Set(
        objects
          .filter(obj => !obj.isFolder)
          .map(obj => getFileName(obj.key))
      );

      // Resolve conflicts by generating unique names
      const renamedFiles = resolveUploadConflicts(acceptedFiles, existingNames);

      // Check if any files were renamed
      const renamedCount = Array.from(renamedFiles.entries())
        .filter(([file, newName]) => file.name !== newName).length;

      await api.uploadFiles(selectedBucket, currentPath, acceptedFiles, renamedFiles, (percent) => {
        setUploadProgress(percent);
      });
      setUploadProgress(100);

      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        loadObjects();
        const msg = renamedCount > 0
          ? `${acceptedFiles.length} file${acceptedFiles.length > 1 ? 's' : ''} uploaded(${renamedCount} renamed)`
          : `${acceptedFiles.length} file${acceptedFiles.length > 1 ? 's' : ''} uploaded`;
        showToastMsg(msg);
      }, 400);
    } catch (err: any) {
      setUploadProgress(0);
      setUploading(false);

      // More specific error messages
      const errorMsg = err.code === 'NETWORK_ERROR'
        ? 'Upload failed - connection lost'
        : err.code === 'TIMEOUT'
          ? 'Upload timed out - file may be too large'
          : 'Upload failed';
      showToastMsg(errorMsg, 'error');
    }
  }, [selectedBucket, currentPath, loadObjects, objects, networkStatus.isOnline, networkStatus.isBackendReachable, uploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });

  const handleCreateBucket = async () => {
    if (!newName.trim()) return;
    const name = newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Check if bucket already exists
    const existingBucketNames = new Set(buckets.map(b => b.name.toLowerCase()));
    if (existingBucketNames.has(name)) {
      showToastMsg(`Bucket "${name}" already exists`, 'error');
      return;
    }

    // Optimistic updates: show the new bucket in the sidebar immediately so the
    // UI feels instant, then confirm with the server. If the API call fails we
    // roll back the local state and surface an error toast.
    const newBucket: Bucket = { name, creationDate: new Date().toISOString() };
    setBuckets(prev => [...prev, newBucket].sort((a, b) => a.name.localeCompare(b.name)));
    setShowNewBucket(false);
    setNewName('');

    try {
      await api.createBucket(name);
      setSelectedBucket(name);
      showToastMsg(`Bucket "${name}" created`);
    } catch (err: any) {
      // Rollback -- revert the optimistic insert
      setBuckets(prev => prev.filter(b => b.name !== name));
      setSelectedBucket(null);
      showToastMsg(err.message || 'Failed to create bucket', 'error');
    }
  };

  const handleDeleteBucket = async (name: string) => {
    // Same optimistic pattern: remove from UI now, rollback if the API rejects
    const previousBuckets = buckets;
    setBuckets(prev => prev.filter(b => b.name !== name));

    if (selectedBucket === name) {
      setSelectedBucket(null);
      setObjects([]);
      setCurrentPath('');
    }

    try {
      await api.deleteBucket(name);
      showToastMsg(`Bucket deleted`);
    } catch (err: any) {
      // Rollback on error
      setBuckets(previousBuckets);
      showToastMsg(err.message || 'Failed to delete bucket', 'error');
    }
  };

  const handleNavigate = (obj: S3Object) => {
    if (obj.isFolder) setCurrentPath(obj.key);
  };

  const handleGoBack = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length ? parts.join('/') + '/' : '');
  };

  const handleDownload = (obj: S3Object) => {
    if (!selectedBucket) return;
    triggerDownload(api.getProxyUrl(selectedBucket, obj.key), getFileName(obj.key));
  };

  // Zip download: the server expands folders and mints a one-shot token, then the
  // browser fetches the archive as a native download -- it streams straight to
  // disk with progress in the browser's own download UI, never buffered in memory.
  const handleDownloadZip = useCallback(async (items: S3Object[]) => {
    if (!selectedBucket || items.length === 0 || preparingZip) return;

    if (!networkStatus.isOnline || !networkStatus.isBackendReachable) {
      showToastMsg('Cannot download - check your connection', 'error');
      return;
    }

    try {
      setPreparingZip(true);
      // Archive paths are relative to the folder being browsed. A single folder is
      // rooted at its parent instead so it unpacks as "<name>/...", and search
      // results (which can come from anywhere) keep their full bucket paths.
      const single = items.length === 1 && items[0].isFolder ? items[0] : null;
      const prefix = single ? getParentPrefix(single.key) : searchResults ? '' : currentPath;
      const { token, filename, fileCount } = await api.createZipDownload(
        selectedBucket,
        prefix,
        items.map(obj => ({ key: obj.key, isFolder: obj.isFolder }))
      );
      triggerDownload(api.getZipUrl(selectedBucket, token), filename);
      showToastMsg(`Downloading ${filename} (${fileCount} file${fileCount !== 1 ? 's' : ''})`);
    } catch (err: any) {
      showToastMsg(err.message || 'Failed to prepare download', 'error');
    } finally {
      setPreparingZip(false);
    }
  }, [selectedBucket, currentPath, searchResults, preparingZip, networkStatus.isOnline, networkStatus.isBackendReachable]);

  // "Download this folder" from the command palette
  const handleDownloadCurrentFolder = useCallback(() => {
    if (currentPath) handleDownloadZip([{ key: currentPath, size: 0, isFolder: true }]);
  }, [currentPath, handleDownloadZip]);

  // Selection handlers for batch operations
  const handleSelect = useCallback((key: string, selected: boolean) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedKeys(new Set(displayObjectsRef.current.map(obj => obj.key)));
    } else {
      setSelectedKeys(new Set());
    }
  }, []);

  // Range selection for shift+click
  const handleSelectRange = useCallback((keys: string[]) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      keys.forEach(key => next.add(key));
      return next;
    });
  }, []);

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  // The size filter menu names an explicit direction rather than toggling, so it
  // needs a setter that takes one. Both paths write the same two pieces of
  // state, so a column header and the filter can never disagree.
  const handleSortWithDirection = useCallback((field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  const handleFiltersChange = useCallback((next: FileFilters) => setFilters(next), [setFilters]);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  // Clear selection when path or bucket changes
  useEffect(() => {
    clearSelection();
  }, [selectedBucket, currentPath, clearSelection]);

  // Batch delete handler
  const handleBatchDelete = async () => {
    if (selectedKeys.size === 0 || !selectedBucket) return;

    const objectsToDelete = objects.filter(obj => selectedKeys.has(obj.key));
    const keysToDelete = new Set(selectedKeys);

    // Optimistic update
    setObjects(prev => prev.filter(obj => !keysToDelete.has(obj.key)));
    clearSelection();

    try {
      const result = await api.deleteObjects(
        selectedBucket,
        objectsToDelete.map(obj => ({ key: obj.key, isFolder: obj.isFolder }))
      );

      if (result.failed.length > 0) {
        showToastMsg(`Deleted ${result.deleted.length}, ${result.failed.length} failed`, 'error');
        // Reload to get accurate state
        loadObjects();
      } else {
        showToastMsg(`Deleted ${result.deleted.length} items`);
      }
    } catch (err: any) {
      showToastMsg(err.message || 'Batch delete failed', 'error');
      loadObjects(); // Reload to restore state
    }
  };

  // Filters the selection down to only previewable file types (images, text, etc.)
  // so folders and unsupported formats are silently skipped in batch preview.
  const handleBatchPreview = useCallback(() => {
    if (selectedKeys.size === 0) return;
    const previewableFiles = objects
      .filter(obj => selectedKeys.has(obj.key) && !obj.isFolder && isPreviewable(obj.key));
    if (previewableFiles.length === 0) return;
    setBatchPreviewObjects(previewableFiles);
    setBatchPreviewStartIndex(0);
  }, [selectedKeys, objects]);

  // Selection resolved against whatever the table is showing (search results or
  // the folder listing). A lone file downloads directly; anything else -- several
  // files, or any folder -- goes out as one .zip, since browsers throttle or block
  // a burst of separate downloads and folders can't be fetched any other way.
  const selectedObjects = useMemo(() => {
    const source = searchResults ?? objects;
    return source.filter(obj => selectedKeys.has(obj.key));
  }, [searchResults, objects, selectedKeys]);

  const batchDownloadMode: 'file' | 'zip' =
    selectedObjects.length === 1 && !selectedObjects[0].isFolder ? 'file' : 'zip';

  const handleBatchDownload = () => {
    if (selectedObjects.length === 0) return;
    if (batchDownloadMode === 'file') {
      handleDownload(selectedObjects[0]);
    } else {
      handleDownloadZip(selectedObjects);
    }
  };

  // Count previewable files in selection
  const previewableSelectedCount = useMemo(() => {
    return objects.filter(obj => selectedKeys.has(obj.key) && !obj.isFolder && isPreviewable(obj.key)).length;
  }, [selectedKeys, objects]);

  const handleCreateFolder = async () => {
    if (!newName.trim() || !selectedBucket) return;

    // Get existing names to check for duplicates
    const existingNames = new Set(objects.map(obj => getFileName(obj.key)));

    // Generate unique folder name if needed
    let folderName = newName.trim();
    if (hasNameConflict(folderName, existingNames)) {
      folderName = generateUniqueName(folderName, existingNames, true);
    }

    const folderKey = currentPath + folderName + '/';

    // Optimistic update - add folder immediately
    const newFolder: S3Object = {
      key: folderKey,
      size: 0,
      isFolder: true,
    };
    setObjects(prev => [...prev, newFolder].sort((a, b) => {
      // Folders first, then alphabetical
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.key.localeCompare(b.key);
    }));
    setShowNewFolder(false);
    setNewName('');

    try {
      await api.createFolder(selectedBucket, currentPath + folderName);
      const msg = folderName !== newName.trim()
        ? `Folder created as "${folderName}"`
        : `Folder created`;
      showToastMsg(msg);
    } catch (err: any) {
      // Rollback on error
      setObjects(prev => prev.filter(obj => obj.key !== folderKey));
      showToastMsg(err.message || 'Failed to create folder', 'error');
    }
  };

  const handleRename = async () => {
    if (!showRename || !newName.trim() || !selectedBucket) return;

    // Get existing names (excluding the item being renamed)
    const existingNames = new Set(
      objects
        .filter(obj => obj.key !== showRename.key)
        .map(obj => getFileName(obj.key))
    );

    // Generate unique name if there's a conflict
    let finalName = newName.trim();
    const originalName = finalName;
    if (hasNameConflict(finalName, existingNames)) {
      finalName = generateUniqueName(finalName, existingNames, showRename.isFolder);
    }

    let newKey: string;
    if (showRename.isFolder) {
      const pathParts = showRename.key.split('/').filter(Boolean);
      pathParts.pop();
      const parentPath = pathParts.length > 0 ? pathParts.join('/') + '/' : '';
      newKey = parentPath + finalName + '/';
    } else {
      const lastSlash = showRename.key.lastIndexOf('/');
      const dirPath = lastSlash >= 0 ? showRename.key.substring(0, lastSlash + 1) : '';
      newKey = dirPath + finalName;
    }

    if (showRename.key === newKey) {
      setShowRename(null);
      setNewName('');
      return;
    }

    // Optimistic update - update objects list immediately
    const renamedObj = showRename;
    const previousObjects = objects;
    setObjects(prev => prev.map(obj =>
      obj.key === renamedObj.key ? { ...obj, key: newKey } : obj
    ).sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.key.localeCompare(b.key);
    }));
    setShowRename(null);
    setNewName('');

    const msg = finalName !== originalName
      ? `Renamed to "${finalName}"`
      : `Renamed`;

    try {
      await api.renameObject(selectedBucket, renamedObj.key, newKey);
      showToastMsg(msg);
    } catch (err: any) {
      // Rollback on error
      setObjects(previousObjects);
      showToastMsg(err.message || 'Rename failed', 'error');
    }
  };

  const handleDelete = async () => {
    if (!showDelete || !selectedBucket) return;

    // Optimistic update - remove object immediately
    const deletedObject = showDelete;
    const previousObjects = objects;
    setObjects(prev => prev.filter(obj => obj.key !== deletedObject.key));
    setShowDelete(null);

    try {
      await api.deleteObject(selectedBucket, deletedObject.key, deletedObject.isFolder);
      showToastMsg(`Deleted`);
    } catch (err: any) {
      // Rollback on error
      setObjects(previousObjects);
      showToastMsg(err.message || 'Delete failed', 'error');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, obj: S3Object) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, object: obj });
  };

  const handleConnectionChange = () => {
    // Reset state when switching connections
    setSelectedBucket(null);
    setCurrentPath('');
    setObjects([]);
    setSearchQuery('');
    setSearchResults(null);
    loadActiveConnection();
  };

  const breadcrumbs = useMemo(() => currentPath.split('/').filter(Boolean), [currentPath]);

  // When search is active, show search results instead of the current folder
  const sourceObjects = searchResults ?? objects;

  // Filters run before sorting, not after: the sort comparator and every index
  // into the result (the keyboard cursor, selection, pagination) then refer to
  // the same list the user can see.
  const filteredObjects = useMemo(() => applyFilters(sourceObjects, filters), [sourceObjects, filters]);

  const displayObjects = useMemo(() => {
    return [...filteredObjects].sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      const multiplier = sortDirection === 'asc' ? 1 : -1;

      switch (sortField) {
        case 'name':
          return multiplier * getFileName(a.key).localeCompare(getFileName(b.key));
        case 'size':
          return multiplier * (a.size - b.size);
        case 'lastModified': {
          const aDate = a.lastModified ? new Date(a.lastModified).getTime() : 0;
          const bDate = b.lastModified ? new Date(b.lastModified).getTime() : 0;
          return multiplier * (aDate - bDate);
        }
        default:
          return 0;
      }
    });
  }, [filteredObjects, sortField, sortDirection]);

  // Ref mirrors the latest displayObjects so event callbacks (like handleSelectAll)
  // always see current data without needing displayObjects in their dependency arrays,
  // which would re-create the callbacks on every render and break memoization downstream.
  const displayObjectsRef = useRef(displayObjects);
  displayObjectsRef.current = displayObjects;

  // Loading state - use same background as app to prevent white flash
  if (checkingAuth) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center" role="status" aria-live="polite">
        <div className="text-muted-foreground" aria-label="Loading application">
          <Spinner className="size-6" aria-label="Loading application" />
        </div>
      </div>
    );
  }

  // Not configured - show setup wizard
  if (configured === false) {
    return <Suspense fallback={null}><SetupPage onSetupComplete={() => {
      checkAuth();
      showToastMsg('Setup complete! Please log in.');
    }} /></Suspense>;
  }

  // Not authenticated - show login
  if (!authenticated) {
    return <Suspense fallback={null}><LoginPage onLogin={handleLogin} /></Suspense>;
  }

  // Authenticated - show app
  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100 focus:bg-background focus:px-4 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-ring focus:text-foreground"
      >
        Skip to main content
      </a>

      <Sidebar
        buckets={buckets}
        selectedBucket={selectedBucket}
        searchQuery={searchQuery}
        loading={loading}
        sidebarOpen={sidebarOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        activeConnectionName={activeConnection?.name}
        pinnedBucket={activeConnection?.bucket ?? undefined}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSearchChange={setSearchQuery}
        onBucketSelect={(name) => { setSelectedBucket(name); setCurrentPath(''); setSidebarOpen(false); setSearchQuery(''); }}
        onNewBucket={() => { setNewName(''); setShowNewBucket(true); }}
        onDeleteBucket={(name) => setShowDeleteBucket(name)}
        onCloseSidebar={() => setSidebarOpen(false)}
        onNavigateHome={() => { setSelectedBucket(null); setCurrentPath(''); setSidebarOpen(false); setSearchQuery(''); }}
        onOpenConnections={() => setShowConnectionManager(true)}
        onLogout={handleLogout}
      />

      <main id="main-content" className="flex-1 flex flex-col min-w-0" tabIndex={-1} {...getRootProps()}>
        <input {...getInputProps()} />

        <Header
          selectedBucket={selectedBucket}
          currentPath={currentPath}
          loading={loading}
          onOpenSidebar={() => setSidebarOpen(true)}
          onGoBack={handleGoBack}
          onNavigateToRoot={() => setCurrentPath('')}
          onNavigateToBreadcrumb={(i) => setCurrentPath(breadcrumbs.slice(0, i + 1).join('/') + '/')}
          onRefresh={() => loadObjects()}
          onNewFolder={() => { setNewName(''); setShowNewFolder(true); }}
          onUpload={onDrop}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
        />

        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <UploadProgress uploading={uploading} progress={uploadProgress} />
        <DropOverlay isDragActive={isDragActive} />

        <div className="flex-1 overflow-y-auto">
          {!activeConnection ? (
            <EmptyState
              icon={Database}
              title="No connection configured"
              description="Add an S3 connection to get started"
              action={
                <Button
                  onClick={() => setShowConnectionManager(true)}
                  variant="outline"
                  className="group mt-6 border-dashed text-sm font-medium hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  Add Connection
                </Button>
              }
            />
          ) : !selectedBucket ? (
            <EmptyState icon={Database} title="No bucket selected" description="Select a bucket from the sidebar" />
          ) : searching ? (
            <EmptyState icon={Database} title="Searching..." description="" />
          ) : searchResults && displayObjects.length === 0 ? (
            <EmptyState icon={Folder} title="No results" description="No files or folders match your search" />
          ) : displayObjects.length === 0 && isFiltersActive(filters) ? (
            // Distinct from "Empty folder": a filter that excludes everything
            // must not tell the user to upload files into a full bucket.
            <EmptyState
              icon={FilterX}
              title="Nothing matches these filters"
              description={`${sourceObjects.length} loaded item${sourceObjects.length === 1 ? '' : 's'} hidden. Widen or clear the filters to see them.`}
            />
          ) : displayObjects.length === 0 && !loading ? (
            <EmptyState icon={Folder} title="Empty folder" description="Drop files here to upload" />
          ) : (
            <FileTable
              bucket={selectedBucket}
              locationKey={`${selectedBucket ?? ''}${currentPath}`}
              objects={displayObjects}
              loading={loading}
              selectedKeys={selectedKeys}
              onNavigate={handleNavigate}
              onPreview={setPreviewObject}
              onContextMenu={handleContextMenu}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              onSelectRange={handleSelectRange}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onSortWithDirection={handleSortWithDirection}
              loadedCount={sourceObjects.length}
            />
          )}
        </div>
      </main>

      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {toast?.message}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          {!contextMenu.object.isFolder && isPreviewable(contextMenu.object.key) && (
            <ContextMenuItem
              icon={Eye}
              label="Preview"
              onClick={() => { setPreviewObject(contextMenu.object); setContextMenu(null); }}
            />
          )}
          {!contextMenu.object.isFolder && (
            <ContextMenuItem
              icon={Download}
              label="Download"
              onClick={() => { handleDownload(contextMenu.object); setContextMenu(null); }}
            />
          )}
          {contextMenu.object.isFolder && (
            <ContextMenuItem
              icon={FolderArchive}
              label="Download as .zip"
              onClick={() => { handleDownloadZip([contextMenu.object]); setContextMenu(null); }}
            />
          )}
          <ContextMenuItem
            icon={Edit3}
            label="Rename"
            onClick={() => { setShowRename(contextMenu.object); setNewName(getFileName(contextMenu.object.key)); setContextMenu(null); }}
          />
          <ContextMenuItem
            icon={Trash2}
            label="Delete"
            danger
            onClick={() => { setShowDelete(contextMenu.object); setContextMenu(null); }}
          />
        </ContextMenu>
      )}

      <Suspense fallback={null}>
        <CreateBucketModal
          isOpen={showNewBucket}
          value={newName}
          onChange={setNewName}
          onClose={() => { setNewName(''); setShowNewBucket(false); }}
          onCreate={handleCreateBucket}
        />

        <CreateFolderModal
          isOpen={showNewFolder}
          value={newName}
          onChange={setNewName}
          onClose={() => { setNewName(''); setShowNewFolder(false); }}
          onCreate={handleCreateFolder}
        />

        <RenameModal
          isOpen={!!showRename}
          value={newName}
          onChange={setNewName}
          onClose={() => { setNewName(''); setShowRename(null); }}
          onRename={handleRename}
        />

        <DeleteModal
          object={showDelete}
          onClose={() => setShowDelete(null)}
          onDelete={handleDelete}
        />

        <DeleteBucketModal
          bucketName={showDeleteBucket}
          onClose={() => setShowDeleteBucket(null)}
          onDelete={() => { handleDeleteBucket(showDeleteBucket!); setShowDeleteBucket(null); }}
        />

        <ConnectionManager
          isOpen={showConnectionManager}
          onClose={() => setShowConnectionManager(false)}
          onConnectionChange={handleConnectionChange}
        />

        <CommandPalette
          isOpen={showCommandPalette}
          buckets={buckets}
          selectedBucket={selectedBucket}
          currentPath={currentPath}
          canCreateBucket={!activeConnection?.bucket}
          onClose={() => setShowCommandPalette(false)}
          onSelectBucket={(name) => { setSelectedBucket(name); setCurrentPath(''); setSearchQuery(''); }}
          onNavigateToRoot={() => setCurrentPath('')}
          onGoBack={handleGoBack}
          onRefresh={() => loadObjects()}
          onNewFolder={() => { setNewName(''); setShowNewFolder(true); }}
          onUpload={() => fileInputRef.current?.click()}
          onDownloadFolder={handleDownloadCurrentFolder}
          onOpenConnections={() => setShowConnectionManager(true)}
          onNewBucket={() => { setNewName(''); setShowNewBucket(true); }}
        />

        {/* Single file preview (from context menu) */}
        <FilePreviewModal
          object={previewObject}
          bucket={selectedBucket || ''}
          onClose={() => setPreviewObject(null)}
          onDownload={handleDownload}
        />

        {/* Batch preview (from selection bar) */}
        {batchPreviewObjects.length > 0 && (
          <FilePreviewModal
            object={null}
            bucket={selectedBucket || ''}
            onClose={() => setBatchPreviewObjects([])}
            onDownload={handleDownload}
            objects={batchPreviewObjects}
            startIndex={batchPreviewStartIndex}
          />
        )}

      </Suspense>

      <input
        key={uploadProgress}
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            onDrop(Array.from(e.target.files));
          }
        }}
      />

      {/* Welcome message for new users */}
      {!activeConnection && (
        <Suspense fallback={null}>
          <WelcomeMessage onConfigure={() => setShowConnectionManager(true)} />
        </Suspense>
      )}

      {/* Network status indicator */}
      <OfflineIndicator
        isOnline={networkStatus.isOnline}
        isBackendReachable={networkStatus.isBackendReachable}
      />

      {/* Batch actions bar */}
      <BatchActionsBar
        selectedCount={selectedKeys.size}
        previewableCount={previewableSelectedCount}
        downloadMode={batchDownloadMode}
        downloading={preparingZip}
        onClearSelection={clearSelection}
        onDeleteSelected={handleBatchDelete}
        onPreviewSelected={handleBatchPreview}
        onDownloadSelected={handleBatchDownload}
      />
    </div>
  );
}

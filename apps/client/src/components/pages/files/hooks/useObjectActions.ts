import { createFolder, createZipDownload, deleteObject, deleteObjects, getProxyUrl, getZipUrl, renameObject } from '@/api/objects';
import type { S3Object } from '@/types';
import { getFileName, getParentPrefix, triggerDownload } from '@/lib/fileUtils';
import { generateUniqueName, hasNameConflict } from '@/lib/uniqueName';

type Toast = (message: string, type?: 'success' | 'error') => void;

export function useObjectActions(options: {
  selectedBucket: string | null;
  currentPath: string;
  objects: S3Object[];
  selectedKeys: Set<string>;
  searchResults: S3Object[] | null;
  newName: string;
  showRename: S3Object | null;
  showDelete: S3Object | null;
  preparingZip: boolean;
  networkStatus: { isOnline: boolean; isBackendReachable: boolean };
  setObjects: React.Dispatch<React.SetStateAction<S3Object[]>>;
  setNewName: (name: string) => void;
  setShowNewFolder: (open: boolean) => void;
  setShowRename: (object: S3Object | null) => void;
  setShowDelete: (object: S3Object | null) => void;
  setPreparingZip: (preparing: boolean) => void;
  clearSelection: () => void;
  loadObjects: () => void;
  showToast: Toast;
}) {
  const {
    selectedBucket, currentPath, objects, selectedKeys, searchResults, newName,
    showRename, showDelete, preparingZip, networkStatus, setObjects, setNewName,
    setShowNewFolder, setShowRename, setShowDelete, setPreparingZip,
    clearSelection, loadObjects, showToast,
  } = options;

  const handleDownload = (object: S3Object) => {
    if (selectedBucket) triggerDownload(getProxyUrl(selectedBucket, object.key), getFileName(object.key));
  };

  const handleDownloadZip = async (items: S3Object[]) => {
    if (!selectedBucket || items.length === 0 || preparingZip) return;
    if (!networkStatus.isOnline || !networkStatus.isBackendReachable) {
      showToast('Cannot download - check your connection', 'error');
      return;
    }
    try {
      setPreparingZip(true);
      const single = items.length === 1 && items[0].isFolder ? items[0] : null;
      const prefix = single ? getParentPrefix(single.key) : searchResults ? '' : currentPath;
      const { token, filename, fileCount } = await createZipDownload(
        selectedBucket, prefix, items.map(object => ({ key: object.key, isFolder: object.isFolder }))
      );
      triggerDownload(getZipUrl(selectedBucket, token), filename);
      showToast(`Downloading ${filename} (${fileCount} file${fileCount !== 1 ? 's' : ''})`);
    } catch (err: any) {
      showToast(err.message || 'Failed to prepare download', 'error');
    } finally {
      setPreparingZip(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newName.trim() || !selectedBucket) return;
    const existingNames = new Set(objects.map(object => getFileName(object.key)));
    let folderName = newName.trim();
    if (hasNameConflict(folderName, existingNames)) folderName = generateUniqueName(folderName, existingNames, true);
    const folderKey = currentPath + folderName + '/';
    setObjects(previous => [...previous, { key: folderKey, size: 0, isFolder: true }].sort(sortObjects));
    setShowNewFolder(false);
    setNewName('');
    try {
      await createFolder(selectedBucket, currentPath + folderName);
      showToast(folderName !== newName.trim() ? `Folder created as "${folderName}"` : 'Folder created');
    } catch (err: any) {
      setObjects(previous => previous.filter(object => object.key !== folderKey));
      showToast(err.message || 'Failed to create folder', 'error');
    }
  };

  const handleRename = async () => {
    if (!showRename || !newName.trim() || !selectedBucket) return;
    const existingNames = new Set(objects.filter(object => object.key !== showRename.key).map(object => getFileName(object.key)));
    const originalName = newName.trim();
    const finalName = hasNameConflict(originalName, existingNames)
      ? generateUniqueName(originalName, existingNames, showRename.isFolder) : originalName;
    const newKey = getRenamedKey(showRename, finalName);
    if (showRename.key === newKey) {
      setShowRename(null); setNewName(''); return;
    }
    const renamedObject = showRename;
    const previousObjects = objects;
    setObjects(previous => previous.map(object => object.key === renamedObject.key ? { ...object, key: newKey } : object).sort(sortObjects));
    setShowRename(null); setNewName('');
    try {
      await renameObject(selectedBucket, renamedObject.key, newKey);
      showToast(finalName !== originalName ? `Renamed to "${finalName}"` : 'Renamed');
    } catch (err: any) {
      setObjects(previousObjects); showToast(err.message || 'Rename failed', 'error');
    }
  };

  const handleDelete = async () => {
    if (!showDelete || !selectedBucket) return;
    const deletedObject = showDelete;
    const previousObjects = objects;
    setObjects(previous => previous.filter(object => object.key !== deletedObject.key));
    setShowDelete(null);
    try {
      await deleteObject(selectedBucket, deletedObject.key, deletedObject.isFolder);
      showToast('Deleted');
    } catch (err: any) {
      setObjects(previousObjects); showToast(err.message || 'Delete failed', 'error');
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedBucket || selectedKeys.size === 0) return;
    const selectedObjects = objects.filter(object => selectedKeys.has(object.key));
    setObjects(previous => previous.filter(object => !selectedKeys.has(object.key)));
    clearSelection();
    try {
      const result = await deleteObjects(selectedBucket, selectedObjects.map(object => ({ key: object.key, isFolder: object.isFolder })));
      if (result.failed.length) { showToast(`Deleted ${result.deleted.length}, ${result.failed.length} failed`, 'error'); loadObjects(); }
      else showToast(`Deleted ${result.deleted.length} items`);
    } catch (err: any) { showToast(err.message || 'Batch delete failed', 'error'); loadObjects(); }
  };

  return { handleDownload, handleDownloadZip, handleCreateFolder, handleRename, handleDelete, handleBatchDelete };
}

function sortObjects(a: S3Object, b: S3Object) {
  if (a.isFolder && !b.isFolder) return -1;
  if (!a.isFolder && b.isFolder) return 1;
  return a.key.localeCompare(b.key);
}

function getRenamedKey(object: S3Object, name: string) {
  if (object.isFolder) {
    const parts = object.key.split('/').filter(Boolean); parts.pop();
    return (parts.length ? parts.join('/') + '/' : '') + name + '/';
  }
  const slash = object.key.lastIndexOf('/');
  return (slash >= 0 ? object.key.substring(0, slash + 1) : '') + name;
}

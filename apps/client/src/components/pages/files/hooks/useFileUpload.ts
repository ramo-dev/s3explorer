import { useCallback } from 'react';
import { uploadFiles } from '@/api/objects';
import { getFileName } from '@/lib/fileUtils';
import { resolveUploadConflicts } from '@/lib/uniqueName';
import type { S3Object } from '@/types';

interface NetworkStatus {
  isOnline: boolean;
  isBackendReachable: boolean;
}

interface UseFileUploadOptions {
  bucket: string | null;
  path: string;
  objects: S3Object[];
  uploading: boolean;
  networkStatus: NetworkStatus;
  setUploading: (value: boolean) => void;
  setUploadProgress: (value: number) => void;
  loadObjects: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function useFileUpload({
  bucket,
  path,
  objects,
  uploading,
  networkStatus,
  setUploading,
  setUploadProgress,
  loadObjects,
  showToast,
}: UseFileUploadOptions) {
  return useCallback(async (acceptedFiles: File[]) => {
    if (!bucket || acceptedFiles.length === 0 || uploading) return;
    if (!networkStatus.isOnline || !networkStatus.isBackendReachable) {
      showToast('Cannot upload - check your connection', 'error');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      const existingNames = new Set(objects.filter(obj => !obj.isFolder).map(obj => getFileName(obj.key)));
      const renamedFiles = resolveUploadConflicts(acceptedFiles, existingNames);
      const renamedCount = Array.from(renamedFiles.entries()).filter(([file, name]) => file.name !== name).length;

      await uploadFiles(bucket, path, acceptedFiles, renamedFiles, setUploadProgress);
      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        void loadObjects();
        const suffix = renamedCount > 0 ? ` (${renamedCount} renamed)` : '';
        showToast(`${acceptedFiles.length} file${acceptedFiles.length > 1 ? 's' : ''} uploaded${suffix}`);
      }, 400);
    } catch (error) {
      setUploadProgress(0);
      setUploading(false);
      const code = (error as { code?: string }).code;
      showToast(code === 'NETWORK_ERROR' ? 'Upload failed - connection lost' : code === 'TIMEOUT' ? 'Upload timed out - file may be too large' : 'Upload failed', 'error');
    }
  }, [bucket, path, objects, uploading, networkStatus, setUploading, setUploadProgress, loadObjects, showToast]);
}

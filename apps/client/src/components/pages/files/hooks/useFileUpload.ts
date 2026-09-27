import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { getUploadPath, uploadFiles } from '@/api/objects';
import { getFileName } from '@/lib/fileUtils';
import { resolveUploadConflicts } from '@/lib/uniqueName';
import type { S3Object, UploadProgressState } from '@/types';

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
  setUploadProgress: Dispatch<SetStateAction<UploadProgressState>>;
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
  const controllerRef = useRef<AbortController | null>(null);
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!bucket || acceptedFiles.length === 0 || uploading) return;
    if (!networkStatus.isOnline || !networkStatus.isBackendReachable) {
      showToast('Cannot upload - check your connection', 'error');
      return;
    }

    try {
      setUploading(true);
      const controller = new AbortController();
      controllerRef.current = controller;
      setUploadProgress({ percent: 0, uploadedBytes: 0, totalBytes: acceptedFiles.reduce((sum, file) => sum + file.size, 0), speedBps: 0, etaSeconds: null });
      const existingNames = new Set(objects.filter(obj => !obj.isFolder).map(obj => getFileName(obj.key)));
      const renamedFiles = resolveUploadConflicts(acceptedFiles, existingNames);
      const renamedCount = Array.from(renamedFiles.entries()).filter(([file, name]) => getUploadPath(file) !== name).length;

      const uploaded = await uploadFiles(bucket, path, acceptedFiles, renamedFiles, { onProgress: setUploadProgress, signal: controller.signal });
      setUploadProgress(progress => ({ ...progress, percent: 100 }));
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(progress => ({ ...progress, percent: 0, uploadedBytes: 0, speedBps: 0, etaSeconds: null, multipart: undefined }));
        void loadObjects();
        const suffix = renamedCount > 0 ? ` (${renamedCount} renamed)` : '';
        showToast(uploaded.length === 0
          ? 'No files found in upload'
          : `${uploaded.length} file${uploaded.length > 1 ? 's' : ''} uploaded${suffix}`);
      }, 400);
    } catch (error) {
      setUploadProgress(progress => ({ ...progress, percent: 0, uploadedBytes: 0, speedBps: 0, etaSeconds: null, multipart: undefined }));
      setUploading(false);
      const code = (error as { code?: string }).code;
      showToast(code === 'CANCELLED' ? 'Upload cancelled' : code === 'NETWORK_ERROR' ? 'Upload failed - connection lost' : code === 'TIMEOUT' ? 'Upload timed out - file may be too large' : 'Upload failed', code === 'CANCELLED' ? 'success' : 'error');
    }
  }, [bucket, path, objects, uploading, networkStatus, setUploading, setUploadProgress, loadObjects, showToast]);

  const cancelUpload = useCallback(() => controllerRef.current?.abort(), []);
  return { onDrop, cancelUpload };
}

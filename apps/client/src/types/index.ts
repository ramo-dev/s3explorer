export interface Bucket {
  name: string;
  creationDate?: string;
}

export interface S3Object {
  key: string;
  size: number;
  lastModified?: string;
  isFolder: boolean;
}

export interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export interface UploadJobSummary {
  id: string;
  bucket: string;
  prefix: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  activeFiles: number;
  totalBytes: number;
  completedBytes: number;
  status: 'active' | 'complete' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface UploadProgressState {
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  speedBps: number;
  etaSeconds: number | null;
  multipart?: {
    completedParts: number;
    totalParts: number;
  };
}

export interface ContextMenuState {
  x: number;
  y: number;
  object: S3Object;
}

export interface CommandAction {
  id: string;
  label: string;
  shortcut?: string;
  category: 'navigation' | 'actions' | 'buckets' | 'connections';
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

export type SortField = 'name' | 'size' | 'lastModified';
export type SortDirection = 'asc' | 'desc';

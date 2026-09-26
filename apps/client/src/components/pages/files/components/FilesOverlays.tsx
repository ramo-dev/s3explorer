import { lazy, Suspense } from 'react';
import { Download, Edit3, Eye, FolderArchive, Trash2 } from 'lucide-react';
import type { Bucket, ContextMenuState, S3Object } from '@/types';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { isPreviewable, getFileName } from '@/lib/fileUtils';

const CreateBucketModal = lazy(() => import('../modals/CreateBucketModal').then(module => ({ default: module.CreateBucketModal })));
const CreateFolderModal = lazy(() => import('../modals/CreateFolderModal').then(module => ({ default: module.CreateFolderModal })));
const RenameModal = lazy(() => import('../modals/RenameModal').then(module => ({ default: module.RenameModal })));
const DeleteModal = lazy(() => import('../modals/DeleteModal').then(module => ({ default: module.DeleteModal })));
const DeleteBucketModal = lazy(() => import('../modals/DeleteBucketModal').then(module => ({ default: module.DeleteBucketModal })));
const CommandPalette = lazy(() => import('./CommandPalette').then(module => ({ default: module.CommandPalette })));
const ConnectionManager = lazy(() => import('./ConnectionManager').then(module => ({ default: module.ConnectionManager })));
const FilePreviewModal = lazy(() => import('@/components/shared/FilePreviewModal').then(module => ({ default: module.FilePreviewModal })));

export function FilesOverlays(props: {
  contextMenu: ContextMenuState | null;
  setContextMenu: (value: ContextMenuState | null) => void;
  setPreviewObject: (object: S3Object | null) => void;
  handleDownload: (object: S3Object) => void;
  handleDownloadZip: (objects: S3Object[]) => void;
  setShowRename: (object: S3Object | null) => void;
  setShowDelete: (object: S3Object | null) => void;
  getFileName: (key: string) => string;
  showNewBucket: boolean; showNewFolder: boolean; newName: string;
  setNewName: (name: string) => void; setShowNewBucket: (open: boolean) => void; setShowNewFolder: (open: boolean) => void;
  handleCreateBucket: () => void; handleCreateFolder: () => void;
  showRename: S3Object | null; handleRename: () => void;
  showDelete: S3Object | null; handleDelete: () => void;
  showDeleteBucket: string | null; handleDeleteBucket: (name: string) => void;
  setShowDeleteBucket: (name: string | null) => void;
  showConnectionManager: boolean; setShowConnectionManager: (open: boolean) => void; handleConnectionChange: () => void;
  showCommandPalette: boolean; setShowCommandPalette: (open: boolean) => void;
  buckets: Bucket[]; selectedBucket: string | null; currentPath: string; canCreateBucket: boolean;
  setSelectedBucket: (bucket: string) => void; setCurrentPath: (path: string) => void; setSearchQuery: (query: string) => void;
  handleGoBack: () => void; loadObjects: () => void; setFileInput: () => void; handleDownloadCurrentFolder: () => void;
  previewObject: S3Object | null; batchPreviewObjects: S3Object[]; setBatchPreviewObjects: (objects: S3Object[]) => void;
  batchPreviewStartIndex: number;
}) {
  const p = props;
  return <>
    {p.contextMenu && <ContextMenu x={p.contextMenu.x} y={p.contextMenu.y} onClose={() => p.setContextMenu(null)}>
      {!p.contextMenu!.object.isFolder && isPreviewable(p.contextMenu!.object.key) && <ContextMenuItem icon={Eye} label="Preview" onClick={() => { p.setPreviewObject(p.contextMenu!.object); p.setContextMenu(null); }} />}
      {!p.contextMenu.object.isFolder && <ContextMenuItem icon={Download} label="Download" onClick={() => { p.handleDownload(p.contextMenu!.object); p.setContextMenu(null); }} />}
      {p.contextMenu.object.isFolder && <ContextMenuItem icon={FolderArchive} label="Download as .zip" onClick={() => { p.handleDownloadZip([p.contextMenu!.object]); p.setContextMenu(null); }} />}
      <ContextMenuItem icon={Edit3} label="Rename" onClick={() => { p.setShowRename(p.contextMenu!.object); p.setNewName(getFileName(p.contextMenu!.object.key)); p.setContextMenu(null); }} />
      <ContextMenuItem icon={Trash2} label="Delete" danger onClick={() => { p.setShowDelete(p.contextMenu!.object); p.setContextMenu(null); }} />
    </ContextMenu>}
    <Suspense fallback={null}>
      <CreateBucketModal isOpen={p.showNewBucket} value={p.newName} onChange={p.setNewName} onClose={() => { p.setNewName(''); p.setShowNewBucket(false); }} onCreate={p.handleCreateBucket} />
      <CreateFolderModal isOpen={p.showNewFolder} value={p.newName} onChange={p.setNewName} onClose={() => { p.setNewName(''); p.setShowNewFolder(false); }} onCreate={p.handleCreateFolder} />
      <RenameModal isOpen={!!p.showRename} value={p.newName} onChange={p.setNewName} onClose={() => { p.setNewName(''); p.setShowRename(null); }} onRename={p.handleRename} />
      <DeleteModal object={p.showDelete} onClose={() => p.setShowDelete(null)} onDelete={p.handleDelete} />
      <DeleteBucketModal bucketName={p.showDeleteBucket} onClose={() => p.setShowDeleteBucket(null)} onDelete={() => { p.handleDeleteBucket(p.showDeleteBucket!); p.setShowDeleteBucket(null); }} />
      <ConnectionManager isOpen={p.showConnectionManager} onClose={() => p.setShowConnectionManager(false)} onConnectionChange={p.handleConnectionChange} />
      <CommandPalette isOpen={p.showCommandPalette} buckets={p.buckets} selectedBucket={p.selectedBucket} currentPath={p.currentPath} canCreateBucket={p.canCreateBucket} onClose={() => p.setShowCommandPalette(false)} onSelectBucket={name => { p.setSelectedBucket(name); p.setCurrentPath(''); p.setSearchQuery(''); }} onNavigateToRoot={() => p.setCurrentPath('')} onGoBack={p.handleGoBack} onRefresh={p.loadObjects} onNewFolder={() => { p.setNewName(''); p.setShowNewFolder(true); }} onUpload={p.setFileInput} onDownloadFolder={p.handleDownloadCurrentFolder} onOpenConnections={() => p.setShowConnectionManager(true)} onNewBucket={() => { p.setNewName(''); p.setShowNewBucket(true); }} />
      <FilePreviewModal object={p.previewObject} bucket={p.selectedBucket || ''} onClose={() => p.setPreviewObject(null)} onDownload={p.handleDownload} />
      {p.batchPreviewObjects.length > 0 && <FilePreviewModal object={null} bucket={p.selectedBucket || ''} onClose={() => p.setBatchPreviewObjects([])} onDownload={p.handleDownload} objects={p.batchPreviewObjects} startIndex={p.batchPreviewStartIndex} />}
    </Suspense>
  </>;
}

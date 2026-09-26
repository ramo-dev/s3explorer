import { useState } from 'react';
import type { ContextMenuState, S3Object } from '@/types';

export function useDialogs() {
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [showNewBucket, setShowNewBucket] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showRename, setShowRename] = useState<S3Object | null>(null);
  const [showDelete, setShowDelete] = useState<S3Object | null>(null);
  const [showDeleteBucket, setShowDeleteBucket] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [previewObject, setPreviewObject] = useState<S3Object | null>(null);
  const [batchPreviewObjects, setBatchPreviewObjects] = useState<S3Object[]>([]);
  const [batchPreviewStartIndex, setBatchPreviewStartIndex] = useState(0);

  return {
    showConnectionManager, setShowConnectionManager, showNewBucket, setShowNewBucket,
    showNewFolder, setShowNewFolder, showRename, setShowRename, showDelete, setShowDelete,
    showDeleteBucket, setShowDeleteBucket, newName, setNewName, contextMenu, setContextMenu,
    showCommandPalette, setShowCommandPalette, previewObject, setPreviewObject,
    batchPreviewObjects, setBatchPreviewObjects, batchPreviewStartIndex, setBatchPreviewStartIndex,
  };
}

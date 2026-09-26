import {
  ArrowLeft,
  Database,
  FolderArchive,
  FolderPlus,
  Home,
  RefreshCw,
  Settings,
  Upload,
} from 'lucide-react';
import { useMemo } from 'react';
import type { Bucket, CommandAction } from '@/types';

export interface CommandPaletteActions {
  buckets: Bucket[];
  selectedBucket: string | null;
  currentPath: string;
  canCreateBucket?: boolean;
  onClose: () => void;
  onSelectBucket: (name: string) => void;
  onNavigateToRoot: () => void;
  onGoBack: () => void;
  onRefresh: () => void;
  onNewFolder: () => void;
  onUpload: () => void;
  onDownloadFolder: () => void;
  onOpenConnections: () => void;
  onNewBucket: () => void;
}

export function useCommands({
  buckets,
  selectedBucket,
  currentPath,
  canCreateBucket,
  onClose,
  onSelectBucket,
  onNavigateToRoot,
  onGoBack,
  onRefresh,
  onNewFolder,
  onUpload,
  onDownloadFolder,
  onOpenConnections,
  onNewBucket,
}: CommandPaletteActions, query: string) {
  const actions = useMemo<CommandAction[]>(() => {
    const items: CommandAction[] = [];

    if (currentPath) {
      items.push(
        {
          id: 'go-back', label: 'Go Back', category: 'navigation', icon: ArrowLeft,
          onSelect: () => { onGoBack(); onClose(); },
        },
        {
          id: 'go-root', label: 'Go to Root', category: 'navigation', icon: Home,
          onSelect: () => { onNavigateToRoot(); onClose(); },
        },
      );
    }

    if (selectedBucket) {
      items.push(
        {
          id: 'refresh', label: 'Refresh', category: 'actions', icon: RefreshCw,
          onSelect: () => { onRefresh(); onClose(); },
        },
        {
          id: 'new-folder', label: 'New Folder', category: 'actions', icon: FolderPlus,
          onSelect: () => { onNewFolder(); onClose(); },
        },
        {
          id: 'upload', label: 'Upload Files', category: 'actions', icon: Upload,
          onSelect: () => { onUpload(); onClose(); },
        },
      );
    }

    if (currentPath) {
      items.push({
        id: 'download-folder', label: 'Download Folder as .zip', category: 'actions', icon: FolderArchive,
        onSelect: () => { onDownloadFolder(); onClose(); },
      });
    }

    if (canCreateBucket) {
      items.push({
        id: 'new-bucket', label: 'Create Bucket', category: 'actions', icon: Database,
        onSelect: () => { onNewBucket(); onClose(); },
      });
    }

    items.push({
      id: 'connections', label: 'Connection Manager', category: 'connections', icon: Settings,
      onSelect: () => { onOpenConnections(); onClose(); },
    });

    for (const bucket of buckets) {
      items.push({
        id: `bucket-${bucket.name}`, label: bucket.name, category: 'buckets', icon: Database,
        onSelect: () => { onSelectBucket(bucket.name); onClose(); },
      });
    }

    return items;
  }, [buckets, selectedBucket, currentPath, canCreateBucket, onGoBack, onNavigateToRoot, onRefresh, onNewFolder, onUpload, onDownloadFolder, onOpenConnections, onNewBucket, onSelectBucket, onClose]);

  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions;
    const lowerQuery = query.toLowerCase();
    return actions.filter(action =>
      action.label.toLowerCase().includes(lowerQuery) ||
      action.category.toLowerCase().includes(lowerQuery)
    );
  }, [actions, query]);

  const groupedActions = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {};
    for (const action of filteredActions) {
      (groups[action.category] ??= []).push(action);
    }
    return groups;
  }, [filteredActions]);

  const indexByActionId = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    for (const items of Object.values(groupedActions)) {
      for (const action of items) map.set(action.id, index++);
    }
    return map;
  }, [groupedActions]);

  return { filteredActions, groupedActions, indexByActionId };
}

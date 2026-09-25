import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Database,
  FolderPlus,
  FolderArchive,
  Upload,
  RefreshCw,
  Settings,
  ArrowLeft,
  Home,
  ChevronRight,
} from 'lucide-react';
import { cn } from 'cn';
import { Input } from './ui/input';
import { Kbd, KbdGroup } from './ui/kbd';
import type { Bucket, CommandAction } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  buckets: Bucket[];
  selectedBucket: string | null;
  currentPath: string;
  // Single-bucket (pinned) connections can't create buckets -- mirrors the sidebar's "+"
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

export function CommandPalette({
  isOpen,
  buckets,
  selectedBucket,
  currentPath,
  canCreateBucket = true,
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
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMac, setIsMac] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Detect OS for keyboard shortcut display
  useEffect(() => {
    setIsMac(navigator.platform?.toLowerCase().includes('mac') ||
             navigator.userAgent?.toLowerCase().includes('mac'));
  }, []);

  const actions = useMemo<CommandAction[]>(() => {
    const items: CommandAction[] = [];

    if (currentPath) {
      items.push({
        id: 'go-back',
        label: 'Go Back',
        category: 'navigation',
        icon: ArrowLeft,
        onSelect: () => { onGoBack(); onClose(); },
      });
      items.push({
        id: 'go-root',
        label: 'Go to Root',
        category: 'navigation',
        icon: Home,
        onSelect: () => { onNavigateToRoot(); onClose(); },
      });
    }

    if (selectedBucket) {
      items.push({
        id: 'refresh',
        label: 'Refresh',
        category: 'actions',
        icon: RefreshCw,
        onSelect: () => { onRefresh(); onClose(); },
      });
      items.push({
        id: 'new-folder',
        label: 'New Folder',
        category: 'actions',
        icon: FolderPlus,
        onSelect: () => { onNewFolder(); onClose(); },
      });
      items.push({
        id: 'upload',
        label: 'Upload Files',
        category: 'actions',
        icon: Upload,
        onSelect: () => { onUpload(); onClose(); },
      });
    }

    if (currentPath) {
      items.push({
        id: 'download-folder',
        label: 'Download Folder as .zip',
        category: 'actions',
        icon: FolderArchive,
        onSelect: () => { onDownloadFolder(); onClose(); },
      });
    }

    if (canCreateBucket) {
      items.push({
        id: 'new-bucket',
        label: 'Create Bucket',
        category: 'actions',
        icon: Database,
        onSelect: () => { onNewBucket(); onClose(); },
      });
    }

    items.push({
      id: 'connections',
      label: 'Connection Manager',
      category: 'connections',
      icon: Settings,
      onSelect: () => { onOpenConnections(); onClose(); },
    });

    buckets.forEach(bucket => {
      items.push({
        id: `bucket-${bucket.name}`,
        label: bucket.name,
        category: 'buckets',
        icon: Database,
        onSelect: () => { onSelectBucket(bucket.name); onClose(); },
      });
    });

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
    filteredActions.forEach(action => {
      if (!groups[action.category]) {
        groups[action.category] = [];
      }
      groups[action.category].push(action);
    });
    return groups;
  }, [filteredActions]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    buckets: 'Buckets',
    connections: 'Connections',
  };

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredActions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          filteredActions[selectedIndex].onSelect();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredActions, selectedIndex, onClose]);

  // Flatten grouped actions into a single indexed list so keyboard navigation
  // (ArrowUp/ArrowDown) can use a simple linear index across all groups. The
  // map keyed by action id is what the row renderer looks up; scanning the flat
  // list per row instead made rendering quadratic in the number of buckets.
  const indexByActionId = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const items of Object.values(groupedActions)) {
      for (const action of items) map.set(action.id, idx++);
    }
    return map;
  }, [groupedActions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center pt-[15vh] p-4 bg-black/70 backdrop-blur-[8px] animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="size-5 text-muted-foreground shrink-0" />
          {/* Input carries a border, shadow and md:text-sm by default; this
              field sits inside a bordered surface, so all three are reset. */}
          <Input
            ref={inputRef}
            type="text"
            className="h-auto flex-1 border-0 bg-transparent px-0 py-0 shadow-none text-base md:text-base focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Kbd className="hidden sm:inline-flex" aria-hidden="true">esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filteredActions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No results found for "{query}"
            </div>
          ) : (
            Object.entries(groupedActions).map(([category, items]) => (
              <div key={category} className="mb-2 last:mb-0">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {categoryLabels[category] || category}
                </div>
                {items.map(action => {
                  const itemIndex = indexByActionId.get(action.id) ?? 0;
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <button
                      type="button"
                      key={action.id}
                      data-index={itemIndex}
                      className={cn(
                        'w-full flex cursor-default items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors',
                        isSelected
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                      onClick={action.onSelect}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                    >
                      <action.icon className={cn('size-4 shrink-0', isSelected && 'text-primary')} />
                      <span className="flex-1 text-sm font-medium truncate">{action.label}</span>
                      {action.shortcut && <Kbd aria-hidden="true">{action.shortcut}</Kbd>}
                      {category === 'buckets' && selectedBucket === action.label && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-success/20 text-success rounded">
                          Active
                        </span>
                      )}
                      <ChevronRight className={cn('size-4 transition-transform', isSelected ? 'text-primary translate-x-0.5' : 'text-muted-foreground')} />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-border bg-muted/50 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1">
              <KbdGroup><Kbd>↑</Kbd><Kbd>↓</Kbd></KbdGroup>
              <span className="ml-1">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              <span className="ml-1">Select</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <span>K to open</span>
          </div>
        </div>
      </div>
    </div>
  );
}

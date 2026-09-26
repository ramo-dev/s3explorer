import { cn } from 'cn';
import { Check, Copy, Database, LogOut, Moon, PanelLeft, PanelLeftClose, Plus, Settings, Sun, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { UI_DELAYS } from '@/constants';
import { useDebounce } from '@/hooks/useDebounce';
import type { Bucket } from '@/types';
import { GithubIcon } from '@/components/icons/GithubIcon';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DashboardSidebarExpandedProps {
    idPrefix: 'desktop' | 'mobile'; buckets: Bucket[]; selectedBucket: string | null;
    searchQuery: string; loading: boolean; collapsed: boolean; activeConnectionName?: string;
    pinnedBucket?: string; theme: 'dark' | 'light'; onToggleTheme: () => void;
    onSearchChange: (value: string) => void; onBucketSelect: (name: string) => void;
    onNewBucket: () => void; onDeleteBucket: (name: string) => void;
    onCloseSidebar: () => void; onNavigateHome: () => void; onToggleCollapse: () => void;
    onOpenConnections?: () => void; onLogout?: () => void;
}

export function DashboardSidebarExpanded({
    idPrefix, buckets, selectedBucket, searchQuery, loading, collapsed,
    activeConnectionName, pinnedBucket, theme, onToggleTheme, onSearchChange,
    onBucketSelect, onNewBucket, onDeleteBucket, onCloseSidebar, onNavigateHome,
    onToggleCollapse, onOpenConnections, onLogout,
}: DashboardSidebarExpandedProps) {
    const [copiedBucket, setCopiedBucket] = useState<string | null>(null);
    const [localSearch, setLocalSearch] = useState(searchQuery);
    const debouncedSearch = useDebounce(localSearch, UI_DELAYS.SEARCH_DEBOUNCE);

    useEffect(() => {
        if (debouncedSearch !== searchQuery) onSearchChange(debouncedSearch);
    }, [debouncedSearch, searchQuery, onSearchChange]);

    useEffect(() => {
        if (searchQuery !== localSearch && searchQuery !== debouncedSearch) setLocalSearch(searchQuery);
    }, [searchQuery]);

    const filteredBuckets = useMemo(() =>
        buckets.filter(b => !debouncedSearch.trim() || b.name.toLowerCase().includes(debouncedSearch.toLowerCase())),
        [buckets, debouncedSearch]
    );

    const handleCopyBucketName = useCallback(async (e: React.MouseEvent, bucketName: string) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(bucketName);
            setCopiedBucket(bucketName);
            setTimeout(() => setCopiedBucket(null), 2000);
        } catch {
            try {
                const textArea = document.createElement('textarea');
                textArea.value = bucketName;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                setCopiedBucket(bucketName);
                setTimeout(() => setCopiedBucket(null), 2000);
            } catch { /* ignore */ }
        }
    }, []);

    return (
        <>
            {/* Header */}
            <div className="h-12 flex items-center justify-between pl-3.5 pr-1.5 border-b border-border shrink-0">
                {/* A real <button>, not a div with role="button": as a div the
                    keydown handler only fired on Enter, so the control was
                    unreachable with Space. */}
                <button
                    type="button"
                    onClick={onNavigateHome}
                    tabIndex={collapsed ? -1 : 0}
                    className="group flex cursor-pointer items-center gap-2 transition-all duration-300 hover:opacity-80"
                >
                    <img src="/logo.svg" alt="S3 Explorer logo" className="size-6 logo-spin logo-themed" />
                    <span className="whitespace-nowrap text-sm font-semibold">S3 Explorer</span>
                </button>
                <div className="flex items-center">
                    <Button onClick={onToggleTheme} variant="ghost" size="icon-sm" className="text-muted-foreground" tabIndex={collapsed ? -1 : 0} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
                        {theme === 'dark' ? <Sun /> : <Moon />}
                    </Button>
                    <Button onClick={onToggleCollapse} variant="ghost" size="icon-sm" className="hidden md:inline-flex text-muted-foreground" aria-label="Collapse sidebar">
                        <PanelLeftClose />
                    </Button>
                    <Button onClick={onCloseSidebar} variant="ghost" size="icon-sm" className="inline-flex md:hidden text-muted-foreground" aria-label="Close sidebar">
                        <X />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="px-2.5 pt-2.5 pb-1 shrink-0">
                <Input
                    id={`${idPrefix}-bucket-search`}
                    type="search"
                    name="bucket-search"
                    placeholder={selectedBucket ? "Search files…" : "Search buckets…"}
                    value={localSearch}
                    onChange={e => setLocalSearch(e.target.value)}
                    className="h-8 text-xs"
                    tabIndex={collapsed ? -1 : 0}
                    aria-label={selectedBucket ? 'Search files' : 'Search buckets'}
                    autoComplete="off"
                    spellCheck="false"
                    enterKeyHint="search"
                />
            </div>

            {/* Buckets header */}
            <div className="flex items-center justify-between pl-[18px] pr-1.5 py-1.5 shrink-0">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" id={`${idPrefix}-buckets-heading`}>Buckets</span>
                {!pinnedBucket && (
                    <Button onClick={onNewBucket} variant="ghost" size="icon-sm" className="create-bucket-btn text-muted-foreground" tabIndex={collapsed ? -1 : 0} aria-label="Create new bucket">
                        <Plus />
                    </Button>
                )}
            </div>

            {/* The scroll container is a plain div and the list is a real <ul>.
                role="list" on the wrapper would instead make the <ul> an
                unlabelled nested list with no listitem between the two. */}
            <div className="flex-1 overflow-y-auto px-2.5 min-h-0 bucket-scrollable">
                <ul className="list-none space-y-px" aria-labelledby={`${idPrefix}-buckets-heading`}>
                    {filteredBuckets.map((bucket, i) => (
                        // The row is a plain container so the copy and delete buttons
                        // are siblings of the select button rather than nested inside
                        // it. The previous div[role=listitem] wrapped all three, which
                        // made an interactive element sit inside another one, fired
                        // only on Enter, and used aria-selected on a role that does
                        // not support it.
                        <li key={bucket.name} className="stagger-item" style={{ animationDelay: `${i * 30}ms` }}>
                            <div
                                className={cn(
                                    'group flex h-8 items-center gap-0.5 rounded-md border transition-colors',
                                    selectedBucket === bucket.name
                                        ? 'border-border bg-background'
                                        : 'border-transparent hover:border-border hover:bg-accent',
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => onBucketSelect(bucket.name)}
                                    tabIndex={collapsed ? -1 : 0}
                                    aria-current={selectedBucket === bucket.name || undefined}
                                    aria-label={`Bucket: ${bucket.name}`}
                                    className={cn(
                                        'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 text-left text-xs transition-colors',
                                        selectedBucket === bucket.name
                                            ? 'text-foreground'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Database className={cn('size-3.5 shrink-0', selectedBucket === bucket.name && 'text-primary')} />
                                    <span className="truncate">{bucket.name}</span>
                                </button>
                                {/* Revealed on hover, but group-focus-within keeps them
                                    visible once a keyboard user tabs into them --
                                    otherwise the buttons are focusable while
                                    rendering at zero opacity, which is invisible
                                    focus rather than no focus. */}
                                <div className="flex items-center gap-0.5 pr-1.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                    <Button onClick={e => handleCopyBucketName(e, bucket.name)} variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-primary" tabIndex={collapsed ? -1 : 0} aria-label={`Copy: ${bucket.name}`}>
                                        {copiedBucket === bucket.name ? <Check className="text-success" /> : <Copy />}
                                    </Button>
                                    {!pinnedBucket && (
                                        <Button onClick={e => { e.stopPropagation(); onDeleteBucket(bucket.name); }} variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive" tabIndex={collapsed ? -1 : 0} aria-label={`Delete: ${bucket.name}`}>
                                            <Trash2 />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
                {filteredBuckets.length === 0 && !loading && (
                    <div className="py-8 text-center"><p className="text-sm text-muted-foreground">{debouncedSearch ? 'No matches' : 'No buckets'}</p></div>
                )}
            </div>

            {/* Bottom section */}
            <div className="shrink-0 border-t border-border px-2.5 py-1.5 pb-safe">
                {onOpenConnections && (
                    <Button onClick={onOpenConnections} variant="ghost" size="sm" className="h-8 w-full justify-start px-2.5 text-xs text-muted-foreground" tabIndex={collapsed ? -1 : 0}>
                        <Settings className="size-3.5 shrink-0" />
                        <span className="flex-1 truncate text-left">{activeConnectionName || 'Connections'}</span>
                    </Button>
                )}
                <a
                    href="https://github.com/ramo-dev/s3explorer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-full justify-start px-2.5 text-xs text-muted-foreground')}
                    tabIndex={collapsed ? -1 : 0}
                >
                    <GithubIcon className="size-3.5 shrink-0" />
                    <span>GitHub</span>
                </a>
                {onLogout && (
                    <Button onClick={onLogout} variant="ghost" size="sm" className="h-8 w-full justify-start px-2.5 text-xs text-muted-foreground hover:text-destructive" tabIndex={collapsed ? -1 : 0}>
                        <LogOut className="size-3.5 shrink-0" />
                        <span>Logout</span>
                    </Button>
                )}
            </div>
        </>
    );
}


interface DashboardSidebarCollapsedProps {
    buckets: Bucket[]; selectedBucket: string | null; pinnedBucket?: string;
    theme: 'dark' | 'light'; activeConnectionName?: string; onToggleTheme: () => void;
    onBucketSelect: (name: string) => void; onNewBucket: () => void;
    onToggleCollapse: () => void; onNavigateHome: () => void;
    onOpenConnections?: () => void; onLogout?: () => void;
}

export function DashboardSidebarCollapsed({
    buckets, selectedBucket, pinnedBucket, theme, onToggleTheme, onBucketSelect,
    onNewBucket, onToggleCollapse, onNavigateHome, onOpenConnections,
    activeConnectionName, onLogout,
}: DashboardSidebarCollapsedProps) {
    return (
        <div className="flex flex-col items-center h-full py-1.5 gap-0.5">
            <Button onClick={onToggleCollapse} variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" aria-label="Expand sidebar" title="Expand sidebar">
                <PanelLeft />
            </Button>
            <Button onClick={onNavigateHome} variant="ghost" size="icon-sm" className="my-0.5 shrink-0" aria-label="Home" title="S3 Explorer">
                <img src="/logo.svg" alt="S3 Explorer" className="size-5 logo-themed" />
            </Button>
            {!pinnedBucket && (
                <Button onClick={onNewBucket} variant="ghost" size="icon-sm" className="create-bucket-btn shrink-0 text-muted-foreground" aria-label="Create bucket" title="Create bucket">
                    <Plus className="size-3.5" />
                </Button>
            )}
            <div className="w-5 h-px bg-border my-0.5 shrink-0" />
            <div className="flex-1 flex flex-col items-center gap-px overflow-y-auto min-h-0 bucket-scrollable w-full px-1">
                {buckets.map(bucket => (
                    <Button
                        key={bucket.name}
                        onClick={() => onBucketSelect(bucket.name)}
                        variant="ghost"
                        size="icon-sm"
                        className={cn(
                            'shrink-0',
                            selectedBucket === bucket.name ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                        )}
                        aria-label={`Bucket: ${bucket.name}`}
                        title={bucket.name}
                    >
                        <Database className="size-3.5" />
                    </Button>
                ))}
            </div>
            <div className="w-5 h-px bg-border my-0.5 shrink-0" />
            <Button onClick={onToggleTheme} variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
                {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </Button>
            {onOpenConnections && (
                <Button onClick={onOpenConnections} variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" aria-label="Connections" title={activeConnectionName || 'Connections'}>
                    <Settings className="size-3.5" />
                </Button>
            )}
            <a
                href="https://github.com/ramo-dev/s3explorer"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'shrink-0 text-muted-foreground')}
                aria-label="GitHub"
                title="GitHub"
            >
                <GithubIcon className="size-3.5" />
            </a>
            {onLogout && (
                <Button onClick={onLogout} variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Logout" title="Logout">
                    <LogOut className="size-3.5" />
                </Button>
            )}
        </div>
    );
}

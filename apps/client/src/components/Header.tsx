import { useState, useEffect } from 'react';
import { ChevronLeft, RefreshCw, Menu, Search, FolderPlus } from 'lucide-react';
import { cn } from 'cn';
import { Button } from './ui/button';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
} from './ui/breadcrumb';
import { Kbd, KbdGroup } from './ui/kbd';

interface HeaderProps {
    selectedBucket: string | null;
    currentPath: string;
    loading: boolean;
    onOpenSidebar: () => void;
    onGoBack: () => void;
    onNavigateToRoot: () => void;
    onNavigateToBreadcrumb: (index: number) => void;
    onRefresh: () => void;
    onNewFolder: () => void;
    onUpload: (files: File[]) => void;
    onOpenCommandPalette?: () => void;
}

export function Header({
    selectedBucket,
    currentPath,
    loading,
    onOpenSidebar,
    onGoBack,
    onNavigateToRoot,
    onNavigateToBreadcrumb,
    onRefresh,
    onNewFolder,
    onUpload,
    onOpenCommandPalette,
}: HeaderProps) {
    const [isSpinning, setIsSpinning] = useState(false);
    const [isMac, setIsMac] = useState(true);

    // Detect OS for keyboard shortcut display
    useEffect(() => {
        setIsMac(navigator.platform?.toLowerCase().includes('mac') ||
            navigator.userAgent?.toLowerCase().includes('mac'));
    }, []);

    const breadcrumbs = currentPath.split('/').filter(Boolean);

    const handleRefresh = () => {
        setIsSpinning(true);
        onRefresh();
        setTimeout(() => setIsSpinning(false), 500);
    };

    // Truncate breadcrumbs if too many - fewer on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const maxBreadcrumbs = isMobile ? 1 : 2;
    const showEllipsis = breadcrumbs.length > maxBreadcrumbs;
    // On phones there's only room for the current folder; the bucket name is
    // always visible in the sidebar and the back arrow covers navigating up.
    const hideBucketCrumb = isMobile && breadcrumbs.length > 0;
    const displayBreadcrumbs = showEllipsis
        ? breadcrumbs.slice(-maxBreadcrumbs)
        : breadcrumbs;

    // Truncate text - shorter on mobile
    const truncateText = (text: string, maxLen: number = 20) => {
        const limit = isMobile ? Math.min(maxLen, 12) : maxLen;
        if (text.length <= limit) return text;
        return text.slice(0, limit) + '…';
    };

    // The bucket is the current page only when no folder is open; otherwise it
    // is the first navigable crumb.
    const bucketIsCurrentPage = !currentPath;

    return (
        <header className="h-14 flex items-center justify-between px-2 sm:pl-4 sm:pr-2 border-b border-border bg-card/50 shrink-0 relative" role="banner">
            {/* Left Section - Navigation */}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 sm:flex-none sm:max-w-[280px] z-10">
                <Button
                    onClick={onOpenSidebar}
                    variant="ghost"
                    size="icon-lg"
                    className="shrink-0 md:hidden"
                    aria-label="Open sidebar menu"
                >
                    <Menu className="size-5" aria-hidden="true" />
                </Button>

                {currentPath && (
                    <Button
                        onClick={onGoBack}
                        variant="ghost"
                        size="icon-lg"
                        className="shrink-0 rounded-full"
                        aria-label="Go back to parent folder"
                    >
                        <ChevronLeft className="size-5" aria-hidden="true" />
                    </Button>
                )}

                <Breadcrumb className="min-w-0 overflow-hidden text-sm">
                    <BreadcrumbList className="min-w-0 flex-nowrap">
                        {!hideBucketCrumb && (
                            <BreadcrumbItem className="min-w-0">
                                {bucketIsCurrentPage ? (
                                    <BreadcrumbPage
                                        className={cn('truncate max-w-[100px] sm:max-w-none', 'font-medium')}
                                        title={selectedBucket || undefined}
                                    >
                                        {selectedBucket ? truncateText(selectedBucket, 20) : 'Select bucket'}
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink
                                        render={<button type="button" onClick={onNavigateToRoot} />}
                                        className="truncate max-w-[100px] sm:max-w-none text-muted-foreground"
                                        title={selectedBucket || undefined}
                                        aria-label={selectedBucket ? `Navigate to bucket root: ${selectedBucket}` : 'Select bucket'}
                                    >
                                        {selectedBucket ? truncateText(selectedBucket, 20) : 'Select bucket'}
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        )}

                        {showEllipsis && <span className="text-muted-foreground shrink-0" aria-hidden="true">…</span>}

                        {displayBreadcrumbs.map((part, i) => {
                            const actualIndex = showEllipsis ? breadcrumbs.length - maxBreadcrumbs + i : i;
                            const isLast = actualIndex === breadcrumbs.length - 1;
                            const needsSeparator = i > 0 || showEllipsis || !hideBucketCrumb;
                            return (
                                <BreadcrumbItem key={actualIndex} className="min-w-0">
                                    {needsSeparator && (
                                        <span className="text-muted-foreground shrink-0" aria-hidden="true">/</span>
                                    )}
                                    {isLast ? (
                                        <BreadcrumbPage
                                            className="truncate max-w-[60px] sm:max-w-none font-medium"
                                            title={part}
                                        >
                                            {truncateText(part, 20)}
                                        </BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink
                                            render={<button type="button" onClick={() => onNavigateToBreadcrumb(actualIndex)} />}
                                            className="truncate max-w-[60px] sm:max-w-none text-muted-foreground"
                                            title={part}
                                            aria-label={`Navigate to folder: ${part}`}
                                        >
                                            {truncateText(part, 20)}
                                        </BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                            );
                        })}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>

            {/* Center Section - Search (Absolutely positioned for true center) */}
            {onOpenCommandPalette && (
                <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
                    <Button
                        onClick={onOpenCommandPalette}
                        variant="outline"
                        size="sm"
                        className="w-[170px] justify-start gap-1.5 text-muted-foreground font-normal"
                        aria-label={`Open command palette (${isMac ? 'Cmd' : 'Ctrl'}+K)`}
                    >
                        <Search className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="text-xs">Search...</span>
                        <KbdGroup className="ml-auto" aria-hidden="true"><Kbd>{isMac ? '⌘' : 'Ctrl'}K</Kbd></KbdGroup>
                    </Button>
                </div>
            )}

            {/* Right Section - Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 z-10" role="toolbar" aria-label="File actions">
                {selectedBucket && (
                    <>
                        <Button
                            onClick={onNewFolder}
                            variant="secondary"
                            size="sm"
                            className="rounded-full"
                            aria-label="Create new folder"
                        >
                            <FolderPlus className="size-5 sm:size-4" aria-hidden="true" />
                            <span className="hidden md:inline">Folder</span>
                        </Button>

                        {/* nativeButton={false} is required: the default assumes a
                            real <button> and would add type="button" to a label.
                            It also makes the control focusable and Space/Enter
                            clickable, which a bare label never was. */}
                        <Button
                            render={<label htmlFor="header-upload" />}
                            nativeButton={false}
                            size="sm"
                            className="cursor-pointer rounded-full"
                            aria-label="Upload files"
                        >
                            <img src="/icons/upload.png" alt="" className="size-5 sm:size-4 brightness-0 invert" aria-hidden="true" />
                            <span className="hidden sm:inline">Upload</span>
                        </Button>
                        <input
                            id="header-upload"
                            type="file"
                            multiple
                            accept="*/*"
                            capture={undefined}
                            className="sr-only"
                            onChange={e => e.target.files && onUpload(Array.from(e.target.files))}
                            aria-label="Select files to upload"
                        />
                    </>
                )}

                <Button
                    onClick={handleRefresh}
                    disabled={!selectedBucket || loading}
                    variant="ghost"
                    size="icon-lg"
                    aria-label={loading ? 'Refreshing...' : 'Refresh file list'}
                >
                    <RefreshCw className={cn('size-5', isSpinning && 'animate-spin')} aria-hidden="true" />
                </Button>
            </div>
        </header>
    );
}

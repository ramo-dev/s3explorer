import type { Bucket } from '@/types';
import { DashboardSidebarCollapsed, DashboardSidebarExpanded } from './DashboardSidebarExpanded';

interface SidebarProps {
    buckets: Bucket[];
    selectedBucket: string | null;
    searchQuery: string;
    loading: boolean;
    sidebarOpen: boolean;
    collapsed: boolean;
    onToggleCollapse: () => void;
    activeConnectionName?: string;
    pinnedBucket?: string;
    theme: 'dark' | 'light';
    onToggleTheme: () => void;
    onSearchChange: (value: string) => void;
    onBucketSelect: (name: string) => void;
    onNewBucket: () => void;
    onDeleteBucket: (name: string) => void;
    onCloseSidebar: () => void;
    onNavigateHome: () => void;
    onOpenConnections?: () => void;
    onLogout?: () => void;
}

const EXPANDED_WIDTH = 232;
const COLLAPSED_WIDTH = 48;

export function DashboardSidebar({
    buckets,
    selectedBucket,
    searchQuery,
    loading,
    sidebarOpen,
    collapsed,
    onToggleCollapse,
    activeConnectionName,
    pinnedBucket,
    theme,
    onToggleTheme,
    onSearchChange,
    onBucketSelect,
    onNewBucket,
    onDeleteBucket,
    onCloseSidebar,
    onNavigateHome,
    onOpenConnections,
    onLogout,
}: SidebarProps) {
    return (
        <>
            {/* Mobile overlay backdrop */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onCloseSidebar} />
            )}

            {/* Desktop and mobile need separate <aside> elements because they use
               incompatible positioning models: desktop animates width in the normal
               document flow, while mobile uses a fixed overlay with translate. You
               can't combine both behaviors on one element without layout thrashing. */}
            <aside
                className="hidden md:block relative border-r border-border bg-card shrink-0 overflow-hidden"
                style={{
                    width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
                    transition: 'width 240ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                role="navigation"
                aria-label="Sidebar navigation"
            >
                {/* Cross-fade between collapsed and expanded content. The staggered
                   timing matters: the outgoing layer fades out instantly (120ms, no delay)
                   so it clears before the width animation visually starts, then the
                   incoming layer fades in after an 80ms delay to sync with the width
                   change. Without this stagger, both layers briefly overlap mid-transition. */}

                {/* Collapsed layer */}
                <div
                    className="absolute inset-0"
                    style={{
                        opacity: collapsed ? 1 : 0,
                        pointerEvents: collapsed ? 'auto' : 'none',
                        transition: collapsed
                            ? 'opacity 180ms ease 80ms'   /* fade in after width starts shrinking */
                            : 'opacity 120ms ease',         /* fade out immediately when expanding */
                    }}
                >
                    <DashboardSidebarCollapsed
                        buckets={buckets} selectedBucket={selectedBucket} pinnedBucket={pinnedBucket}
                        theme={theme} activeConnectionName={activeConnectionName}
                        onToggleTheme={onToggleTheme} onBucketSelect={onBucketSelect}
                        onNewBucket={onNewBucket} onToggleCollapse={onToggleCollapse}
                        onNavigateHome={onNavigateHome} onOpenConnections={onOpenConnections}
                        onLogout={onLogout}
                    />
                </div>

                {/* Expanded layer */}
                <div
                    className="h-full flex flex-col"
                    style={{
                        width: EXPANDED_WIDTH,
                        opacity: collapsed ? 0 : 1,
                        pointerEvents: collapsed ? 'none' : 'auto',
                        transition: collapsed
                            ? 'opacity 120ms ease'           /* fade out immediately when collapsing */
                            : 'opacity 180ms ease 80ms',     /* fade in after width starts growing */
                    }}
                >
                    <DashboardSidebarExpanded
                        idPrefix="desktop" buckets={buckets} selectedBucket={selectedBucket}
                        searchQuery={searchQuery} loading={loading} collapsed={collapsed}
                        activeConnectionName={activeConnectionName} pinnedBucket={pinnedBucket} theme={theme}
                        onToggleTheme={onToggleTheme} onSearchChange={onSearchChange}
                        onBucketSelect={onBucketSelect} onNewBucket={onNewBucket}
                        onDeleteBucket={onDeleteBucket} onCloseSidebar={onCloseSidebar}
                        onNavigateHome={onNavigateHome} onToggleCollapse={onToggleCollapse}
                        onOpenConnections={onOpenConnections} onLogout={onLogout}
                    />
                </div>
            </aside>

            {/* ── Mobile sidebar: fixed overlay, unaffected by collapsed state ── */}
            <aside
                className={`md:hidden flex flex-col w-[260px] sm:w-[232px] border-r border-border bg-card fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                role="navigation"
                aria-label="Sidebar navigation"
            >
                <DashboardSidebarExpanded
                    idPrefix="mobile" buckets={buckets} selectedBucket={selectedBucket}
                    searchQuery={searchQuery} loading={loading} collapsed={false}
                    activeConnectionName={activeConnectionName} pinnedBucket={pinnedBucket} theme={theme}
                    onToggleTheme={onToggleTheme} onSearchChange={onSearchChange}
                    onBucketSelect={onBucketSelect} onNewBucket={onNewBucket}
                    onDeleteBucket={onDeleteBucket} onCloseSidebar={onCloseSidebar}
                    onNavigateHome={onNavigateHome} onToggleCollapse={onToggleCollapse}
                    onOpenConnections={onOpenConnections} onLogout={onLogout}
                />
            </aside>
        </>
    );
}

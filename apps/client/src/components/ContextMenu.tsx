import { useEffect, useRef } from 'react';
import { cn } from 'cn';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    children: React.ReactNode;
}

// Surface classes mirror shadcn's ContextMenuContent so this menu is visually
// identical to any other popup in the app, but positioning stays imperative:
// the menu is opened from an onContextMenu handler on a row deep in the tree
// rather than from a wrapped trigger. Base UI's Menu can only anchor to a real
// trigger element, so driving it from {x, y} would mean a hidden virtual
// trigger per open. Converting this to the full primitive is worth doing, but
// it needs browser verification rather than a typecheck.
export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('mousedown', handleClick);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('mousedown', handleClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    // Keep the menu on screen. Clamped to 0 on both axes so a right-click near
    // the top-left corner cannot push it off-viewport.
    const adjustedX = Math.max(0, Math.min(x, window.innerWidth - 180));
    const adjustedY = Math.max(0, Math.min(y, window.innerHeight - 160));

    return (
        <div
            ref={ref}
            className="fixed z-50 min-w-[150px] origin-top-left rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95"
            style={{ left: adjustedX, top: adjustedY }}
            role="menu"
            aria-label="Context menu"
        >
            {children}
        </div>
    );
}

interface ContextMenuItemProps {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    danger?: boolean;
}

export function ContextMenuItem({ icon: Icon, label, onClick, danger = false }: ContextMenuItemProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'w-full flex cursor-default items-center gap-2.5 rounded-sm px-3 py-1.5 text-xs select-none transition-colors outline-none',
                danger
                    ? 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
            )}
            role="menuitem"
        >
            <Icon className="size-4" aria-hidden="true" />
            {label}
        </button>
    );
}

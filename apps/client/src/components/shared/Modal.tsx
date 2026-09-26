import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { cn } from 'cn';
import { X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';

interface ModalProps {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    isOpen?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

// Thin wrapper over the Dialog primitive, kept as a component so the six call
// sites do not have to change. Composed from the parts rather than DialogContent
// because this app's modals are a bottom sheet on phones and a centred dialog
// from sm up, and DialogContent hardcodes centring.
export function Modal({ title, children, onClose, isOpen = true, size = 'md' }: ModalProps) {
    const popupRef = useRef<HTMLDivElement>(null);

    const sizeClasses = {
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-md',
        lg: 'sm:max-w-lg',
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogPortal>
                {/* The base overlay carries supports-backdrop-filter:backdrop-blur-xs
                    (4px). A bare override would not replace it -- different
                    variants are not a conflict as far as cn is concerned -- so
                    both are pinned to the original 8px. */}
                <DialogOverlay className="bg-black/60 backdrop-blur supports-backdrop-filter:backdrop-blur overscroll-contain touch-manipulation" />
                {/* The flex wrapper is what turns the popup into a bottom sheet
                    below sm: it is the positioning context DialogContent lacks. */}
                <DialogPrimitive.Popup
                    ref={popupRef}
                    className={cn(
                        'fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-lg border border-border bg-popover text-popover-foreground shadow-2xl outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg',
                        sizeClasses[size],
                        'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
                    )}
                    initialFocus={() => {
                        // Returning false suppresses Base UI's focus move. A child
                        // with autoFocus has already claimed focus by the time
                        // effects run, and the previous implementation skipped its
                        // own focus in exactly that case, so typing straight after
                        // opening Rename lands in the field rather than on the X.
                        const popup = popupRef.current;
                        return popup?.contains(document.activeElement) ? false : true;
                    }}
                >
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
                        <DialogTitle className="text-sm font-semibold text-foreground">{title}</DialogTitle>
                        <DialogPrimitive.Close
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label="Close modal"
                                />
                            }
                        >
                            <X className="size-4" aria-hidden="true" />
                        </DialogPrimitive.Close>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto">{children}</div>
                </DialogPrimitive.Popup>
            </DialogPortal>
        </Dialog>
    );
}

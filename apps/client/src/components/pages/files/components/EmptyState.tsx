interface EmptyStateProps {
    icon: React.ElementType;
    title: string;
    description: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div
            className="flex h-full flex-col items-center justify-center px-4 py-16 text-center animate-fade-in-up"
            role="status"
            aria-label={title}
        >
            {/* Icon runs a shorter, delayed variant of the same entrance so it
                lands after the container rather than with it. `both` fill mode
                matters here: without it the icon is visible for the 50ms delay
                at full opacity and the stagger reads as a flicker. */}
            <div
                className="mb-3 flex size-12 items-center justify-center rounded-lg border border-border bg-muted animate-[fadeInUp_150ms_ease_50ms_both]"
                aria-hidden="true"
            >
                <Icon className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-sm font-medium">{title}</h3>
            <p className="max-w-[220px] text-xs text-muted-foreground">{description}</p>
            {action && <div className="flex justify-center w-full">{action}</div>}
        </div>
    );
}

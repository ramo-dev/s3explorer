import { cn } from 'cn';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';

export const FilterTrigger = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    valueLabel: string | null;
    active: boolean;
    icon: ReactNode;
  } & Omit<ComponentProps<typeof ButtonPrimitive>, 'children'>
>(function FilterTrigger({ label, valueLabel, active, icon, className, ...props }, ref) {
  return (
    <ButtonPrimitive
      ref={ref}
      type="button"
      aria-label={valueLabel ? `${label}: ${valueLabel}` : label}
      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'pr-7', active && 'border-primary/60 bg-primary/10 text-foreground', className)}
      {...props}
    >
      {icon}
      <span className="max-w-36 truncate">{valueLabel ?? label}</span>
    </ButtonPrimitive>
  );
});

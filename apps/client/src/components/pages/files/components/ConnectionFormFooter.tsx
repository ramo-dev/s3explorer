import { AlertCircle, Check } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';

interface ConnectionFormFooterProps {
  testResult: { success: boolean; message: string } | null;
  saving: boolean;
  canSave: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function ConnectionFormFooter({ testResult, saving, canSave, onCancel, onSave }: ConnectionFormFooterProps) {
  return (
    <>
      {testResult && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border border-border p-3 text-[13px]',
            testResult.success ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
          )}
          role="status"
          aria-live="polite"
        >
          {testResult.success ? <Check className="size-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="size-4 shrink-0" aria-hidden="true" />}
          {testResult.message}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={saving || !canSave}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </>
  );
}

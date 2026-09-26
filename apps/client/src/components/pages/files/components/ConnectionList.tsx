import { cn } from 'cn';
import { ChevronRight, Pencil, Plus, Server, Trash2 } from 'lucide-react';
import type { Connection } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface ConnectionListProps {
  connections: Connection[];
  loading: boolean;
  resetForm: () => void;
  setView: (view: 'list' | 'form') => void;
  handleActivate: (id: number) => void;
  startEdit: (connection: Connection) => void;
  setDeleteConfirm: (id: number) => void;
}

export function ConnectionList({ connections, loading, resetForm, setView, handleActivate, startEdit, setDeleteConfirm }: ConnectionListProps) {
  return (
    <div className="animate-fade-in">
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground"><Spinner className="size-5 mr-2" />Loading...</div>
        ) : connections.length === 0 ? (
          <button type="button" onClick={() => { resetForm(); setView('form'); }} className="group w-full cursor-pointer rounded-md border border-dashed border-border bg-card py-6 text-center transition-all hover:border-primary/30 hover:bg-primary/5">
            <Server className="size-8 mx-auto mb-2 text-muted-foreground transition-colors group-hover:text-primary" />
            <p className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">No connections</p>
            <p className="mt-1 text-xs text-muted-foreground">Click to add your first connection</p>
          </button>
        ) : (
          connections.map(conn => (
            <div key={conn.id} className={cn('group relative flex items-center justify-between overflow-hidden rounded-md bg-muted transition-all', conn.isActive ? 'ring-1 ring-primary' : 'hover:bg-primary/5')}>
              <div className={cn('absolute left-0 top-0 bottom-0 w-1 transition-colors', conn.isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/50')} />
              <button type="button" onClick={() => handleActivate(conn.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left">
                <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-md transition-colors', conn.isActive ? 'bg-primary/20 text-primary' : 'bg-accent text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary')}><Server className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className={cn('truncate text-base font-medium transition-colors sm:text-sm', conn.isActive ? 'text-foreground' : 'text-foreground group-hover:text-primary')}>{conn.name}</span>{conn.isActive && <Badge className="bg-success/20 text-success">Active</Badge>}</div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={conn.endpoint}>{conn.endpoint || 'https://s3.amazonaws.com'}{conn.bucket && <span className="text-primary"> / {conn.bucket}</span>}</p>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1 pr-3">
                <Button variant="ghost" size="icon-sm" onClick={() => startEdit(conn)} className="text-muted-foreground hover:text-primary" aria-label={`Edit ${conn.name}`}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirm(conn.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${conn.name}`}><Trash2 className="size-4" /></Button>
                <ChevronRight className="ml-1 size-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </div>
          ))
        )}
      </div>
      {connections.length > 0 && <Button variant="outline" onClick={() => { resetForm(); setView('form'); }} className="group mt-3 w-full border-dashed text-sm hover:border-primary hover:bg-primary/5 hover:text-primary"><Plus className="size-4 transition-transform group-hover:scale-110" />Add Connection</Button>}
    </div>
  );
}

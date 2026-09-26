import { AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  activateConnection,
  createConnection,
  deleteConnection,
  listConnections,
  testConnection,
  updateConnection,
} from '@/api/connections';
import type { Connection, ConnectionConfig } from '@/api/connections';
import { ConnectionForm } from './ConnectionForm';
import { ConnectionList } from './ConnectionList';
import { CUSTOM_REGION, getRegionsForProvider, PROVIDERS, validateBucketName, validateRegion } from './connectionOptions';
import { Modal } from '@/components/shared/Modal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConnectionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChange: () => void;
}

export function ConnectionManager({ isOpen, onClose, onConnectionChange }: ConnectionManagerProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [bucketTouched, setBucketTouched] = useState(false);
  const [customRegion, setCustomRegion] = useState(false);
  const [regionTouched, setRegionTouched] = useState(false);

  // Form State
  const [selectedProvider, setSelectedProvider] = useState<string>('custom');
  const [form, setForm] = useState<ConnectionConfig>({
    name: '',
    endpoint: '',
    accessKey: '',
    secretKey: '',
    region: 'us-east-1',
    forcePathStyle: true,
    bucket: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadConnections();
      setView('list');
      setError(null);
      setTestResult(null); // Reset test result when modal opens
    }
  }, [isOpen]);

  // Auto-dismiss test result after 3.5 seconds
  useEffect(() => {
    if (testResult) {
      const timer = setTimeout(() => setTestResult(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [testResult]);

  async function loadConnections() {
    setLoading(true);
    try {
      const data = await listConnections();
      setConnections(data);
    } catch {
      setError('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      name: '',
      endpoint: '',
      accessKey: '',
      secretKey: '',
      region: 'us-east-1',
      forcePathStyle: true,
      bucket: '',
    });
    setEditingId(null);
    setSelectedProvider('custom');
    setView('list');
    setTestResult(null);
    setError(null);
    setBucketTouched(false);
    setCustomRegion(false);
    setRegionTouched(false);
  }

  function handleProviderChange(providerId: string) {
    setSelectedProvider(providerId);
    setCustomRegion(false);
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setForm(prev => ({
        ...prev,
        region: provider.defaultRegion,
        endpoint: provider.defaultEndpoint,
        // Cloudflare/DO/MinIO often need path style
        forcePathStyle: providerId === 'minio' || providerId === 'railway' || providerId === 'gcs',
      }));
    }
  }

  function handleRegionChange(region: string) {
    if (region === CUSTOM_REGION) {
      setCustomRegion(true);
      setRegionTouched(false);
      setForm(prev => ({ ...prev, region: '' }));
      return;
    }
    setCustomRegion(false);
    // For DigitalOcean Spaces, update endpoint to match region
    if (selectedProvider === 'digitalocean') {
      setForm(prev => ({
        ...prev,
        region,
        endpoint: `https://${region}.digitaloceanspaces.com`,
      }));
    } else {
      setForm(prev => ({ ...prev, region }));
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const result = await testConnection({
        endpoint: form.endpoint,
        accessKey: form.accessKey,
        secretKey: form.secretKey,
        region: form.region,
        forcePathStyle: form.forcePathStyle,
        bucket: form.bucket || undefined,
      });
      setTestResult({ success: true, message: `Connection successful! Found ${result.bucketCount} bucket${result.bucketCount !== 1 ? 's' : ''}.` });
    } catch (err: any) {
      setTestResult({ success: false, message: `Connection failed: ${err.message}` });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      if (editingId) {
        await updateConnection(editingId, form);
      } else {
        await createConnection(form);
      }
      await loadConnections();
      onConnectionChange();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  }

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    try {
      await deleteConnection(deleteConfirm);
      await loadConnections();
      onConnectionChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, onConnectionChange]);

  async function handleActivate(id: number) {
    try {
      await activateConnection(id);
      await loadConnections();
      onConnectionChange();
      onClose(); // Close modal after activating connection
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(conn: Connection) {
    setForm({
      name: conn.name,
      endpoint: conn.endpoint,
      accessKey: '',
      secretKey: '',
      region: conn.region,
      forcePathStyle: conn.forcePathStyle,
      bucket: conn.bucket || '',
    });
    setEditingId(conn.id);
    setSelectedProvider('custom'); // Or try to infer from endpoint? Keeping simple for now.
    // A stored region the dropdown doesn't know (e.g. "garage") would otherwise
    // render as the first option while the form silently keeps the real value.
    setCustomRegion(!getRegionsForProvider('custom').some(r => r.value === conn.region));
    setRegionTouched(false);
    setView('form');
  }

  const bucketError = bucketTouched ? validateBucketName(form.bucket || '', selectedProvider) : null;
  const regionError = regionTouched && customRegion ? validateRegion(form.region || '') : null;

  return (
    <>
      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} variant="destructive" className="flex-1">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal isOpen={isOpen} onClose={onClose} title="Connection Manager" size="lg">
        <div className="relative flex flex-col">

          {error && (
            <Alert variant="destructive" className="mb-4 bg-destructive/15 py-3 text-[13px]">
              <AlertCircle aria-hidden="true" />
              <AlertDescription className="text-destructive">{error}</AlertDescription>
            </Alert>
          )}

          {view === 'list' ? (
            <ConnectionList
              connections={connections}
              loading={loading}
              resetForm={resetForm}
              setView={setView}
              handleActivate={handleActivate}
              startEdit={startEdit}
              setDeleteConfirm={setDeleteConfirm}
            />
          ) : (
            <ConnectionForm
              selectedProvider={selectedProvider}
              form={form}
              customRegion={customRegion}
              regionError={regionError}
              bucketError={bucketError}
              editingId={editingId}
              testing={testing}
              saving={saving}
              testResult={testResult}
              setForm={setForm}
              setBucketTouched={setBucketTouched}
              setRegionTouched={setRegionTouched}
              handleProviderChange={handleProviderChange}
              handleRegionChange={handleRegionChange}
              handleTest={handleTest}
              handleSave={handleSave}
              setView={setView}
              setTestResult={setTestResult}
            />
          )}
        </div>
      </Modal>
    </>
  );
}

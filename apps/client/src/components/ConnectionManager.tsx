import { cn } from 'cn';
import { AlertCircle, Check, ChevronDown, ChevronRight, Pencil, Plus, RefreshCw, Server, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Connection, ConnectionConfig } from '../api';
import * as api from '../api';
import { Modal } from './Modal';
import { Alert, AlertDescription } from './ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Field, FieldError, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Spinner } from './ui/spinner';

// Provider Presets
const PROVIDERS = [
  { id: 'aws', name: 'Amazon S3', defaultRegion: 'us-east-1', defaultEndpoint: '' },
  { id: 'gcs', name: 'Google Cloud Storage', defaultRegion: 'auto', defaultEndpoint: 'https://storage.googleapis.com' },
  { id: 'cloudflare', name: 'Cloudflare R2', defaultRegion: 'auto', defaultEndpoint: 'https://<accountid>.r2.cloudflarestorage.com' },
  { id: 'digitalocean', name: 'DigitalOcean Spaces', defaultRegion: 'nyc3', defaultEndpoint: 'https://nyc3.digitaloceanspaces.com' },
  { id: 'railway', name: 'Railway Buckets', defaultRegion: 'us-west-1', defaultEndpoint: 'http://localhost:4444' },
  { id: 'minio', name: 'MinIO (Self-hosted)', defaultRegion: 'us-east-1', defaultEndpoint: 'http://localhost:9000' },
  { id: 'custom', name: 'Custom', defaultRegion: 'us-east-1', defaultEndpoint: '' },
];

// AWS S3 Regions (Complete list)
const AWS_REGIONS = [
  // US Regions
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  // Africa
  { value: 'af-south-1', label: 'Africa (Cape Town)' },
  // Asia Pacific
  { value: 'ap-east-1', label: 'Asia Pacific (Hong Kong)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'ap-south-2', label: 'Asia Pacific (Hyderabad)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-southeast-3', label: 'Asia Pacific (Jakarta)' },
  { value: 'ap-southeast-4', label: 'Asia Pacific (Melbourne)' },
  { value: 'ap-southeast-5', label: 'Asia Pacific (Malaysia)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { value: 'ap-northeast-3', label: 'Asia Pacific (Osaka)' },
  // Canada
  { value: 'ca-central-1', label: 'Canada (Central)' },
  { value: 'ca-west-1', label: 'Canada West (Calgary)' },
  // Europe
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'eu-central-2', label: 'Europe (Zurich)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-west-3', label: 'Europe (Paris)' },
  { value: 'eu-south-1', label: 'Europe (Milan)' },
  { value: 'eu-south-2', label: 'Europe (Spain)' },
  { value: 'eu-north-1', label: 'Europe (Stockholm)' },
  // Israel
  { value: 'il-central-1', label: 'Israel (Tel Aviv)' },
  // Middle East
  { value: 'me-south-1', label: 'Middle East (Bahrain)' },
  { value: 'me-central-1', label: 'Middle East (UAE)' },
  // South America
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
];

// Cloudflare R2 Region
const R2_REGIONS = [
  { value: 'auto', label: 'Auto (Recommended)' },
  { value: 'wnam', label: 'Western North America' },
  { value: 'enam', label: 'Eastern North America' },
  { value: 'weur', label: 'Western Europe' },
  { value: 'eeur', label: 'Eastern Europe' },
  { value: 'apac', label: 'Asia Pacific' },
];

// Google Cloud Storage Regions
const GCS_REGIONS = [
  { value: 'auto', label: 'Auto (Recommended)' },
  { value: 'us-east1', label: 'US East (South Carolina)' },
  { value: 'us-central1', label: 'US Central (Iowa)' },
  { value: 'us-west1', label: 'US West (Oregon)' },
  { value: 'europe-west1', label: 'Europe West (Belgium)' },
  { value: 'asia-east1', label: 'Asia East (Taiwan)' },
];

// DigitalOcean Spaces Regions
const DO_REGIONS = [
  { value: 'nyc3', label: 'New York (NYC3)' },
  { value: 'sfo3', label: 'San Francisco (SFO3)' },
  { value: 'ams3', label: 'Amsterdam (AMS3)' },
  { value: 'sgp1', label: 'Singapore (SGP1)' },
  { value: 'fra1', label: 'Frankfurt (FRA1)' },
  { value: 'syd1', label: 'Sydney (SYD1)' },
  { value: 'blr1', label: 'Bangalore (BLR1)' },
];

// Generic regions for MinIO, Railway, Custom
const GENERIC_REGIONS = [
  { value: 'us-east-1', label: 'US East 1 (Default)' },
  { value: 'us-west-1', label: 'US West 1' },
  { value: 'eu-west-1', label: 'EU West 1' },
  { value: 'ap-southeast-1', label: 'AP Southeast 1' },
];

// Mirror of server-side isValidBucketName: DNS-safe S3 bucket name rules.
const BUCKET_NAME_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
function validateBucketName(name: string, providerId: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return providerId === 'gcs' ? 'Required for Google Cloud Storage' : null;
  }
  if (!BUCKET_NAME_RE.test(trimmed) || trimmed.includes('..')) {
    return 'Lowercase letters, numbers, dots, hyphens; 3–63 chars';
  }
  return null;
}

// Sentinel <option> that swaps the region dropdown for a free-text input. Garage,
// Ceph, SeaweedFS and other self-hosted stacks use regions no preset list covers.
const CUSTOM_REGION = '__custom__';

// Mirror of server-side isValidRegion. SigV4 only embeds the region in the
// credential scope, so anything without slashes or whitespace is signable.
const REGION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
function validateRegion(region: string): string | null {
  const trimmed = region.trim();
  if (!trimmed) return 'Region is required';
  if (!REGION_RE.test(trimmed)) return 'Letters, numbers, dots, hyphens; 1–64 chars';
  return null;
}

// Helper to get regions based on provider
function getRegionsForProvider(providerId: string) {
  switch (providerId) {
    case 'aws':
      return AWS_REGIONS;
    case 'gcs':
      return GCS_REGIONS;
    case 'cloudflare':
      return R2_REGIONS;
    case 'digitalocean':
      return DO_REGIONS;
    case 'minio':
    case 'railway':
    case 'custom':
    default:
      return GENERIC_REGIONS;
  }
}

// Provider and region stay native <select> elements rather than the Select
// primitive. This app is mobile-first, and the OS picker is better on touch than
// a custom popup list; a native select is also keyboard and screen-reader
// accessible for free. The classes mirror Input so the two read as one control.
// text-base below sm, not text-sm throughout: iOS zooms the viewport when
// focusing a form control below 16px, which the old .input class handled with a
// media query. The Input primitive already does the same, so the two read as one
// control at every width.
const SELECT_CLASSES = [
  'h-10 w-full min-w-0 appearance-none cursor-pointer rounded-md border border-input bg-transparent',
  'px-2.5 py-1 pr-10 text-base shadow-xs transition-[color,box-shadow] outline-none sm:text-sm',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  'dark:bg-input/30',
].join(' ');

// Dense label used throughout the form, which is a two-column grid rather than
// a stack of full-width fields.
const FIELD_LABEL_CLASSES = 'text-xs font-normal leading-none text-muted-foreground';

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
      const data = await api.listConnections();
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
      const result = await api.testConnection({
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
        await api.updateConnection(editingId, form);
      } else {
        await api.createConnection(form);
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
      await api.deleteConnection(deleteConfirm);
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
      await api.activateConnection(id);
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
            <div className="animate-fade-in">
              <div className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Spinner className="size-5 mr-2" />
                    Loading...
                  </div>
                ) : connections.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => { resetForm(); setView('form'); }}
                    className="group w-full cursor-pointer rounded-md border border-dashed border-border bg-card py-6 text-center transition-all hover:border-primary/30 hover:bg-primary/5"
                  >
                    <Server className="size-8 mx-auto mb-2 text-muted-foreground transition-colors group-hover:text-primary" />
                    <p className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">No connections</p>
                    <p className="mt-1 text-xs text-muted-foreground">Click to add your first connection</p>
                  </button>
                ) : (
                  connections.map((conn) => (
                    // The row is a plain container so the edit and delete buttons
                    // are siblings of the activate button rather than nested
                    // inside it; nesting interactive elements inside a button is
                    // invalid and made the row unreachable by keyboard.
                    <div
                      key={conn.id}
                      className={cn(
                        'group relative flex items-center justify-between overflow-hidden rounded-md bg-muted transition-all',
                        conn.isActive ? 'ring-1 ring-primary' : 'hover:bg-primary/5',
                      )}
                    >
                      {/* Left accent border */}
                      <div className={cn('absolute left-0 top-0 bottom-0 w-1 transition-colors', conn.isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/50')} />

                      <button
                        type="button"
                        onClick={() => handleActivate(conn.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left"
                      >
                        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-md transition-colors', conn.isActive ? 'bg-primary/20 text-primary' : 'bg-accent text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary')}>
                          <Server className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn('truncate text-base font-medium transition-colors sm:text-sm', conn.isActive ? 'text-foreground' : 'text-foreground group-hover:text-primary')}>
                              {conn.name}
                            </span>
                            {conn.isActive && (
                              <Badge className="bg-success/20 text-success">Active</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={conn.endpoint}>
                            {conn.endpoint || 'https://s3.amazonaws.com'}
                            {conn.bucket && <span className="text-primary"> / {conn.bucket}</span>}
                          </p>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-1 pr-3">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => startEdit(conn)}
                          className="text-muted-foreground hover:text-primary"
                          aria-label={`Edit ${conn.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteConfirm(conn.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${conn.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <ChevronRight className="ml-1 size-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {connections.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => { resetForm(); setView('form'); }}
                  className="group mt-3 w-full border-dashed text-sm hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  <Plus className="size-4 transition-transform group-hover:scale-110" />
                  Add Connection
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="space-y-3">
                {/* Provider Selector */}
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="conn-provider" className={FIELD_LABEL_CLASSES}>Provider</FieldLabel>
                  <div className="relative">
                    <select
                      id="conn-provider"
                      value={selectedProvider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className={SELECT_CLASSES}
                    >
                      {PROVIDERS.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </Field>

                {/* Profile Name & Region Row */}
                <div className="grid grid-cols-2 gap-3">
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="conn-name" className={FIELD_LABEL_CLASSES}>Profile Name</FieldLabel>
                    <Input
                      id="conn-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Production…"
                      className="h-10 text-sm"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </Field>
                  <Field className="min-w-0 gap-1.5">
                    <div className="flex h-3 items-center justify-between">
                      <FieldLabel htmlFor="conn-region" className={FIELD_LABEL_CLASSES}>Region</FieldLabel>
                      {customRegion && (
                        <button
                          type="button"
                          onClick={() => handleRegionChange(PROVIDERS.find(p => p.id === selectedProvider)?.defaultRegion || 'us-east-1')}
                          className="text-[11px] leading-none text-muted-foreground transition-colors hover:text-primary"
                        >
                          Use list
                        </button>
                      )}
                    </div>
                    {customRegion ? (
                      <Input
                        id="conn-region"
                        type="text"
                        value={form.region || ''}
                        onChange={(e) => { setRegionTouched(true); setForm({ ...form, region: e.target.value }); }}
                        onBlur={() => setRegionTouched(true)}
                        placeholder="e.g. garage"
                        className="h-10 font-mono text-sm"
                        aria-invalid={!!regionError}
                        autoFocus
                        autoComplete="off"
                        spellCheck="false"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          id="conn-region"
                          value={form.region}
                          onChange={(e) => handleRegionChange(e.target.value)}
                          className={cn(SELECT_CLASSES, 'truncate')}
                        >
                          {getRegionsForProvider(selectedProvider).map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                          <option value={CUSTOM_REGION}>Custom…</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    )}
                    {regionError && (
                      <FieldError className="text-[11px] leading-tight">{regionError}</FieldError>
                    )}
                  </Field>
                </div>

                {/* Endpoint */}
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="conn-endpoint" className={FIELD_LABEL_CLASSES}>S3 Endpoint</FieldLabel>
                  <Input
                    id="conn-endpoint"
                    type="url"
                    value={form.endpoint}
                    onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                    placeholder="https://s3.amazonaws.com…"
                    className="h-9 font-mono text-sm"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </Field>

                {/* Bucket Name - required for single-bucket providers like GCS */}
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="conn-bucket" className={FIELD_LABEL_CLASSES}>
                    Bucket Name {selectedProvider !== 'gcs' && <span className="opacity-50">(optional)</span>}
                  </FieldLabel>
                  <Input
                    id="conn-bucket"
                    type="text"
                    value={form.bucket || ''}
                    onChange={(e) => { setBucketTouched(true); setForm({ ...form, bucket: e.target.value }); }}
                    onBlur={() => setBucketTouched(true)}
                    placeholder={selectedProvider === 'gcs' ? 'my-bucket-name' : 'Leave empty to list all buckets'}
                    className="h-9 text-sm"
                    aria-invalid={!!bucketError}
                    autoComplete="off"
                    spellCheck="false"
                  />
                  {bucketError && (
                    <FieldError className="text-[11px] leading-tight">{bucketError}</FieldError>
                  )}
                </Field>

                {/* Keys Row */}
                <div className="grid grid-cols-2 gap-3">
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="conn-access-key" className={FIELD_LABEL_CLASSES}>Access Key</FieldLabel>
                    <Input
                      id="conn-access-key"
                      type="text"
                      value={form.accessKey}
                      onChange={(e) => setForm({ ...form, accessKey: e.target.value })}
                      placeholder="AKIA…"
                      className="h-10 font-mono text-sm"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="conn-secret-key" className={FIELD_LABEL_CLASSES}>Secret Key</FieldLabel>
                    <Input
                      id="conn-secret-key"
                      type="password"
                      value={form.secretKey}
                      onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
                      placeholder="••••••••"
                      className="h-10 font-mono text-sm"
                      autoComplete="off"
                    />
                  </Field>
                </div>

                {/* Path Style & Test */}
                <div className="flex items-center justify-between">
                  {/* Checkbox and Label are siblings rather than nested: a
                      <button role=checkbox> inside a <label> would activate
                      twice, once from the label and once from the control. */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="conn-path-style"
                      checked={form.forcePathStyle}
                      onCheckedChange={(checked) => setForm({ ...form, forcePathStyle: checked })}
                    />
                    <Label htmlFor="conn-path-style" className="cursor-pointer text-xs leading-none text-muted-foreground transition-colors hover:text-foreground">
                      Path-style URLs
                    </Label>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTest}
                    disabled={testing || !form.endpoint || (!editingId && (!form.accessKey || !form.secretKey))}
                    className="group gap-1.5 px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label="Test connection"
                  >
                    <RefreshCw className={cn('size-3 transition-transform', testing ? 'animate-spin' : 'group-hover:rotate-45')} aria-hidden="true" />
                    {testing ? 'Testing…' : 'Test'}
                  </Button>
                </div>

                {/* Test Result */}
                {testResult && (
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-md border border-border p-3 text-[13px]',
                      testResult.success ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    {testResult.success ? (
                      <Check className="size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    )}
                    {testResult.message}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
                <Button
                  variant="secondary"
                  onClick={() => { setView('list'); setTestResult(null); }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !form.name || !form.endpoint || !!validateBucketName(form.bucket || '', selectedProvider) || !!validateRegion(form.region || '')}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

import { cn } from 'cn';
import { ChevronDown, RefreshCw } from 'lucide-react';
import type { ConnectionConfig } from '@/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CUSTOM_REGION, FIELD_LABEL_CLASSES, getRegionsForProvider, PROVIDERS, SELECT_CLASSES, validateBucketName, validateRegion } from './connectionOptions';
import { ConnectionFormFooter } from './ConnectionFormFooter';

interface ConnectionFormProps {
  selectedProvider: string;
  form: ConnectionConfig;
  customRegion: boolean;
  regionError: string | null;
  bucketError: string | null;
  editingId: number | null;
  testing: boolean;
  saving: boolean;
  testResult: { success: boolean; message: string } | null;
  setForm: (next: ConnectionConfig) => void;
  setBucketTouched: (touched: boolean) => void;
  setRegionTouched: (touched: boolean) => void;
  handleProviderChange: (provider: string) => void;
  handleRegionChange: (region: string) => void;
  handleTest: () => void;
  handleSave: () => void;
  setView: (view: 'list' | 'form') => void;
  setTestResult: (result: { success: boolean; message: string } | null) => void;
}

export function ConnectionForm({
  selectedProvider, form, customRegion, regionError, bucketError, editingId,
  testing, saving, testResult, setForm, setBucketTouched, setRegionTouched, handleProviderChange,
  handleRegionChange, handleTest, handleSave, setView, setTestResult,
}: ConnectionFormProps) {
  return (
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

              </div>

              <ConnectionFormFooter
                testResult={testResult}
                saving={saving}
                canSave={Boolean(form.name && form.endpoint && !validateBucketName(form.bucket || '', selectedProvider) && !validateRegion(form.region || ''))}
                onCancel={() => { setView('list'); setTestResult(null); }}
                onSave={handleSave}
              />
            </div>
  );
}

// Provider Presets
export const PROVIDERS = [
  { id: 'aws', name: 'Amazon S3', defaultRegion: 'us-east-1', defaultEndpoint: '' },
  { id: 'gcs', name: 'Google Cloud Storage', defaultRegion: 'auto', defaultEndpoint: 'https://storage.googleapis.com' },
  { id: 'cloudflare', name: 'Cloudflare R2', defaultRegion: 'auto', defaultEndpoint: 'https://<accountid>.r2.cloudflarestorage.com' },
  { id: 'digitalocean', name: 'DigitalOcean Spaces', defaultRegion: 'nyc3', defaultEndpoint: 'https://nyc3.digitaloceanspaces.com' },
  { id: 'railway', name: 'Railway Buckets', defaultRegion: 'us-west-1', defaultEndpoint: 'http://localhost:4444' },
  { id: 'minio', name: 'MinIO (Self-hosted)', defaultRegion: 'us-east-1', defaultEndpoint: 'http://localhost:9000' },
  { id: 'custom', name: 'Custom', defaultRegion: 'us-east-1', defaultEndpoint: '' },
];

// AWS S3 Regions (Complete list)
export const AWS_REGIONS = [
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
export const R2_REGIONS = [
  { value: 'auto', label: 'Auto (Recommended)' },
  { value: 'wnam', label: 'Western North America' },
  { value: 'enam', label: 'Eastern North America' },
  { value: 'weur', label: 'Western Europe' },
  { value: 'eeur', label: 'Eastern Europe' },
  { value: 'apac', label: 'Asia Pacific' },
];

// Google Cloud Storage Regions
export const GCS_REGIONS = [
  { value: 'auto', label: 'Auto (Recommended)' },
  { value: 'us-east1', label: 'US East (South Carolina)' },
  { value: 'us-central1', label: 'US Central (Iowa)' },
  { value: 'us-west1', label: 'US West (Oregon)' },
  { value: 'europe-west1', label: 'Europe West (Belgium)' },
  { value: 'asia-east1', label: 'Asia East (Taiwan)' },
];

// DigitalOcean Spaces Regions
export const DO_REGIONS = [
  { value: 'nyc3', label: 'New York (NYC3)' },
  { value: 'sfo3', label: 'San Francisco (SFO3)' },
  { value: 'ams3', label: 'Amsterdam (AMS3)' },
  { value: 'sgp1', label: 'Singapore (SGP1)' },
  { value: 'fra1', label: 'Frankfurt (FRA1)' },
  { value: 'syd1', label: 'Sydney (SYD1)' },
  { value: 'blr1', label: 'Bangalore (BLR1)' },
];

// Generic regions for MinIO, Railway, Custom
export const GENERIC_REGIONS = [
  { value: 'us-east-1', label: 'US East 1 (Default)' },
  { value: 'us-west-1', label: 'US West 1' },
  { value: 'eu-west-1', label: 'EU West 1' },
  { value: 'ap-southeast-1', label: 'AP Southeast 1' },
];

// Mirror of server-side isValidBucketName: DNS-safe S3 bucket name rules.
const BUCKET_NAME_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
export function validateBucketName(name: string, providerId: string): string | null {
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
export const CUSTOM_REGION = '__custom__';

// Mirror of server-side isValidRegion. SigV4 only embeds the region in the
// credential scope, so anything without slashes or whitespace is signable.
const REGION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export function validateRegion(region: string): string | null {
  const trimmed = region.trim();
  if (!trimmed) return 'Region is required';
  if (!REGION_RE.test(trimmed)) return 'Letters, numbers, dots, hyphens; 1–64 chars';
  return null;
}

// Helper to get regions based on provider
export function getRegionsForProvider(providerId: string) {
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
export const SELECT_CLASSES = [
  'h-10 w-full min-w-0 appearance-none cursor-pointer rounded-md border border-input bg-transparent',
  'px-2.5 py-1 pr-10 text-base shadow-xs transition-[color,box-shadow] outline-none sm:text-sm',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  'dark:bg-input/30',
].join(' ');

// Dense label used throughout the form, which is a two-column grid rather than
// a stack of full-width fields.
export const FIELD_LABEL_CLASSES = 'text-xs font-normal leading-none text-muted-foreground';


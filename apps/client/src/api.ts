// Compatibility façade during the migration. New code imports focused modules
// or query hooks from `src/api/`; this preserves existing behavior until every
// caller has crossed that boundary.
export * from './api/auth';
export * from './api/buckets';
export * from './api/client';
export * from './api/connections';
export * from './api/objects';
export type { Bucket, S3Object } from './types';

import path from 'node:path';

// Single source of truth for on-disk storage locations.
//
// This was `process.env.DATA_DIR || '/data'` repeated verbatim in three modules
// (db.ts, crypto.ts, routes/objects.ts). Repeating the lookup meant each module
// resolved its own path, so nothing structurally stopped the database and the
// encryption key from ending up in different directories -- which is a failure
// mode you cannot recover from, because credentials in one directory are
// undecryptable with a key from another.
//
// The default stays '/data' on purpose. Every production deployment sets
// DATA_DIR explicitly (Dockerfile ENV, docker-entrypoint.sh, docker-compose.yml),
// and the fail-fast writability check in db.ts turns a missing DATA_DIR into a
// loud, actionable error. Defaulting to './data' in development instead would
// make a bare `node dist/index.js` on a VPS write its database to the current
// working directory, quietly, where the next deploy or `git clean` would take it.
const DEFAULT_DATA_DIR = '/data';

// Resolved to an absolute path so a relative DATA_DIR ('./data', which is what
// the local development docs use) cannot be reinterpreted by whichever module
// happens to import this first, or by a process with a different cwd.
export const DATA_DIR = path.resolve(process.env.DATA_DIR || DEFAULT_DATA_DIR);

/** SQLite database file. WAL mode adds `-wal` and `-shm` siblings next to it. */
export const DB_PATH = path.join(DATA_DIR, 's3explorer.db');

/**
 * 32-byte AES-256-GCM key. Ciphertext in the `connections` table is worthless
 * without it, and it cannot be recovered from the database -- which is why
 * destroying the database and destroying the key are a single operation
 * (see cli/db.ts) rather than two independent ones.
 */
export const KEY_PATH = path.join(DATA_DIR, 'encryption.key');

/** Staging area for multipart uploads in progress. Safe to clear; nothing persists here. */
export const UPLOAD_TEMP_DIR = path.join(DATA_DIR, 'tmp-uploads');

/** Sidecar files SQLite maintains in WAL mode. */
export const DB_SIDECAR_PATHS = [`${DB_PATH}-wal`, `${DB_PATH}-shm`] as const;

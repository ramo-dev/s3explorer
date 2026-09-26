import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Single source of truth for on-disk storage locations.
//
// This was `process.env.DATA_DIR || '/data'` repeated verbatim in three modules
// (db.ts, crypto.ts, routes/objects.ts). Repeating the lookup meant each module
// resolved its own path, so nothing structurally stopped the database and the
// encryption key from ending up in different directories -- which is a failure
// mode you cannot recover from, because credentials in one directory are
// undecryptable with a key from another.

// This file is <package root>/{src,dist}/services/data-dir.*, so two levels up
// is the package root either way -- identical under tsx and after `tsc`. That
// makes the development default independent of the working directory, which is
// the whole point: see below.
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Where the data lives when DATA_DIR is not set.
 *
 * Containers are the only place '/data' is meaningful, and every container
 * deployment sets DATA_DIR explicitly anyway (Dockerfile ENV,
 * docker-entrypoint.sh, docker-compose.yml, all with NODE_ENV=production). So
 * NODE_ENV is the honest signal for "is this a container", and it is already the
 * convention this codebase branches on elsewhere.
 *
 * Development falls back to <package root>/data rather than './data'. A
 * cwd-relative default looks equivalent until you run `node apps/server/dist/
 * index.js` from the repository root, at which point it creates a stray
 * top-level `data/` that no other command knows about. Anchoring to the package
 * root means the location does not move when you cd elsewhere, and it cannot be
 * swept away by a `git clean` run in an unrelated directory.
 */
const defaultDataDir = (): string => (process.env.NODE_ENV === 'production' ? '/data' : path.join(PACKAGE_ROOT, 'data'));

// An explicit DATA_DIR always wins, resolved to an absolute path so a relative
// value ('./data') cannot be reinterpreted by whichever module happens to
// import this first.
export const DATA_DIR = path.resolve(process.env.DATA_DIR || defaultDataDir());

/** True when the data directory was chosen by default rather than configured. */
export const DATA_DIR_IS_DEFAULT = process.env.DATA_DIR === undefined;

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

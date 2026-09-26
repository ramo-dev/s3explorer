// Keeps data access behind src/api/.
//
// The point of the ongoing migration is that adopting TanStack Query later
// should not mean hunting through pages for code that already exists. The old
// root api.ts façade made that boundary unclear, so the mechanical rule is:
// outside src/api/, no module may import the compatibility façade. Focused API
// modules and query hooks are the explicit post-migration seam.
//
// Imports are checked, not call sites. Once src/api.ts is split into
// auth/buckets/objects/connections the binding at the call site is a bare
// function - `listObjects(...)`, not `api.listObjects(...)` - so grepping for
// `api.` would miss precisely the imports this gate exists to catch.
//
// The allowlist is keyed by basename so a caller can be moved without changing
// the gate. It must be empty before the façade can be removed.
//
//   node scripts/check-api-boundary.mjs [srcDir]
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ambiguousAllowlistEntries,
  printRows,
  staleAllowlistEntries,
  walkSrc,
} from "./lib/scan.mjs";

const SRC = path.resolve(process.argv[2] ?? "src");

// The seam, in both shapes it has taken. API_FILE is the pre-migration single
// façade; focused modules under API_DIR are the intended post-migration imports.
const API_FILE = path.join(SRC, "api.ts");
const API_DIR = path.join(SRC, "api");
const QUERIES_FILE = path.join(API_DIR, "queries");

const ALLOWLIST = new Set();

/** Does this resolved path point at the api seam? */
function isApiTarget(p) {
  // `@/api` resolves to the compatibility façade path before extension
  // resolution, while `@/api/objects` resolves inside the focused module tree.
  return p === API_FILE || p === API_DIR;
}

/** Is this resolved path inside the seam, and so allowed to import from it? */
function isInsideApi(p) {
  return p === API_FILE || p.startsWith(API_DIR + path.sep);
}

/** The hook-only public API that components may consume. */
function isQueriesTarget(p) {
  return p === QUERIES_FILE || p === `${QUERIES_FILE}.ts` || p === `${QUERIES_FILE}.tsx`;
}

/** Bare specifiers are npm packages; only relative and @/ alias ones can reach src/. */
function resolveSpecifier(spec, fromFile) {
  if (spec.startsWith("@/")) return path.join(SRC, spec.slice(2));
  if (spec.startsWith(".")) return path.resolve(path.dirname(fromFile), spec);
  return null;
}

// Catches `from "x"`, `import("x")` and `require("x")` in one pass. Erring
// toward over-matching is the right direction for a boundary gate: a false
// positive is a line to read, a false negative is a hole in the boundary.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

const files = walkSrc(SRC);

const stale = staleAllowlistEntries(ALLOWLIST, files);
if (stale.length) {
  console.error("check:api-boundary: allowlist entries matching no file (fix the list):");
  for (const name of stale) console.error(`  ${name}`);
  process.exit(1);
}

const ambiguous = ambiguousAllowlistEntries(ALLOWLIST, files);
if (ambiguous.length) {
  console.error("check:api-boundary: allowlist entries matching more than one file:");
  for (const name of ambiguous) console.error(`  ${name}`);
  process.exit(1);
}

const violations = [];
const grandfathered = [];

for (const file of files) {
  if (isInsideApi(file)) continue;
  const src = readFileSync(file, "utf8");
  const hits = new Set();
  for (const m of src.matchAll(SPECIFIER)) {
    // Type-only imports do not cross the runtime data boundary. Components
    // need domain types such as Connection and S3Object; only transport and
    // runtime API functions must be accessed through hooks/modules.
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    const line = src.slice(lineStart, src.indexOf("\n", m.index) === -1 ? src.length : src.indexOf("\n", m.index));
    if (/\bimport\s+type\b/.test(line)) continue;
    const resolved = resolveSpecifier(m[1], file);
    if (resolved && isApiTarget(resolved) && !isQueriesTarget(resolved)) hits.add(m[1]);
  }
  if (hits.size === 0) continue;
  const row = [hits.size, path.relative(process.cwd(), file)];
  if (ALLOWLIST.has(path.basename(file))) grandfathered.push(row);
  else violations.push(row);
}

console.log(`scanned ${files.length} app source files (ui/ excluded)`);
console.log(`reaching past the api boundary, NOT allowlisted: ${violations.length}`);
printRows(violations);
console.log(`reaching past the api boundary, allowlisted (rewritten in stage 1): ${grandfathered.length}`);
printRows(grandfathered);
console.log(`exemptions left: ${ALLOWLIST.size}`);

process.exit(violations.length ? 1 : 0);

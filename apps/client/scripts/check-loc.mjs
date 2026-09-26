// Enforces the 300-line cap on the app's own source files.
//
// A cap is only worth having if it is enforced from the day it is introduced,
// and the nine files that were already over the line when the rule was written
// cannot be fixed in the same commit. So they are listed in ALLOWLIST rather
// than being given a blanket waiver: each is still reported on every run, and
// is deleted from the list in the same commit that brings it under the cap.
// Anything NOT on the list fails immediately. That makes the cap ratchet - the
// exemption count can only fall, and a file that grows past 300 lines while
// still allowlisted is visible on every run.
//
// The list is keyed by basename (see lib/scan.mjs) so it survives the migration
// moving these files around.
//
//   node scripts/check-loc.mjs [srcDir]
//
// Scoped to .ts/.tsx. index.css is excluded on purpose: 579 of its lines are
// shadcn's token block, not logic, and chopping a stylesheet at an arbitrary
// line would make it harder to read rather than easier.
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ambiguousAllowlistEntries,
  countLines,
  printRows,
  staleAllowlistEntries,
  walkSrc,
} from "./lib/scan.mjs";

const LIMIT = 300;
const srcDir = process.argv[2] ?? "src";

// The nine files over the cap when it was introduced: 4263 of the 7681
// non-vendored lines, App.tsx alone being 1087. Each is split during the
// migration and removed from this list in the same commit. Order is by size.
const ALLOWLIST = new Set([
]);

const files = walkSrc(srcDir);
const rel = (p) => path.relative(process.cwd(), p);

// A stale entry means the list is describing a tree that no longer exists, and
// a file that was split off from an allowlisted one will be failing for real.
const stale = staleAllowlistEntries(ALLOWLIST, files);
if (stale.length) {
  console.error("check:loc: allowlist entries matching no file (fix the list):");
  for (const name of stale) console.error(`  ${name}`);
  process.exit(1);
}

const ambiguous = ambiguousAllowlistEntries(ALLOWLIST, files);
if (ambiguous.length) {
  console.error("check:loc: allowlist entries matching more than one file (use a path key):");
  for (const name of ambiguous) console.error(`  ${name}`);
  process.exit(1);
}

const violations = [];
const grandfathered = [];
for (const file of files) {
  const lines = countLines(readFileSync(file, "utf8"));
  if (lines <= LIMIT) continue;
  const row = [lines, rel(file)];
  if (ALLOWLIST.has(path.basename(file))) grandfathered.push(row);
  else violations.push(row);
}

const bySize = (a, b) => b[0] - a[0];
violations.sort(bySize);
grandfathered.sort(bySize);

console.log(`limit ${LIMIT} lines; scanned ${files.length} app source files (ui/ excluded)`);
console.log(`over limit and NOT allowlisted: ${violations.length}`);
printRows(violations);
console.log(`over limit, allowlisted (ratchet down): ${grandfathered.length}`);
printRows(grandfathered);
console.log(`exemptions left: ${ALLOWLIST.size}`);

if (grandfathered.length === 0 && ALLOWLIST.size === 0) {
  console.log("allowlist is empty - the cap is now unconditional");
}

process.exit(violations.length ? 1 : 0);

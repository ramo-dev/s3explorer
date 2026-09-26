// Shared helpers for the source-scanning gates (check:loc, check:api-boundary).
//
// Both gates need the same three things: a walk of the app's own source that
// skips the vendored shadcn primitives, a line count, and a way to grandfather
// a known set of pre-existing violations. Keeping that in one place means the
// two gates agree on what "our source" means. If they disagreed about the same
// tree, the second one to run would look like it had found something new.
import { readdirSync } from "node:fs";
import path from "node:path";

const SOURCE_EXT = /\.tsx?$/;

/**
 * Every .ts/.tsx file under srcDir, excluding any directory named `ui`.
 *
 * `ui` is the vendored shadcn tree: 61 files, 40 of them unimported, kept
 * byte-identical to upstream so it can be re-synced when a primitive is
 * upgraded. It is not our code, so it is not held to our rules. check:utilities
 * skips it for the same reason.
 */
export function walkSrc(srcDir) {
  const files = [];
  (function walk(dir) {
    for (const entry of readDirSafe(dir)) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (/(^|[\\/])ui$/.test(p)) continue;
        walk(p);
      } else if (SOURCE_EXT.test(entry.name)) {
        files.push(p);
      }
    }
  })(srcDir);
  return files.sort();
}

/** readdirSync that yields nothing for a missing dir, so a gate reports rather than throws. */
function readDirSafe(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Physical line count, matching `wc -l` so every number here can be verified by hand. */
export function countLines(src) {
  if (src === "") return 0;
  const body = src.endsWith("\n") ? src.slice(0, -1) : src;
  return body.split("\n").length;
}

/**
 * Allowlist entries are keyed by basename rather than by path.
 *
 * The migration moves these files repeatedly, and a path-keyed list would need
 * editing on every `git mv` - which is exactly the moment you forget. A
 * basename matching more than one file is ambiguous: grandfathering it would
 * silently exempt both, so the gates report it and refuse to run.
 */
export function ambiguousAllowlistEntries(allowlist, files) {
  const counts = new Map();
  for (const file of files) {
    const name = path.basename(file);
    if (!allowlist.has(name)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n > 1).map(([name]) => name);
}

/**
 * Allowlist entries that no longer match any file.
 *
 * A stale entry is worse than a missing one: the allowlist is the gate's whole
 * memory of what is permitted, so an entry pointing at a file that has been
 * renamed or split away means the gate claims to cover something it can no
 * longer see. The gates fail on these rather than ignoring them.
 */
export function staleAllowlistEntries(allowlist, files) {
  const present = new Set(files.map((f) => path.basename(f)));
  return [...allowlist].filter((name) => !present.has(name));
}

/** Render a count-and-file list the way every other gate in scripts/ does. */
export function printRows(rows, indent = "  ") {
  const width = rows.reduce((w, [n]) => Math.max(w, String(n).length), 0);
  for (const [n, file] of rows) {
    console.log(`${indent}${String(n).padStart(width)}  ${file}`);
  }
}

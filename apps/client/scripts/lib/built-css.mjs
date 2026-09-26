// Locates the built stylesheet that the audit scripts need to read.
//
// Both check:utilities and check:tokens read dist/assets/index-<hash>.css, and
// the hash changes on every build. Passing it by hand meant both npm scripts
// were wired up with no argument and crashed on a missing path, so they resolve
// it themselves and print which file they picked.
import fs from "node:fs";
import path from "node:path";

export function resolveBuiltCss(explicit) {
  if (explicit) return explicit;

  const dir = "dist/assets";
  if (!fs.existsSync(dir)) {
    console.error(`no ${dir}/ found -- run the build first.`);
    process.exit(1);
  }

  const candidates = fs
    .readdirSync(dir)
    .filter((f) => /^index-.*\.css$/.test(f))
    .map((f) => path.join(dir, f))
    // Newest by mtime, not first by name: a stale hash-suffixed file left over
    // from an earlier build would otherwise be read and reported as current.
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (!candidates.length) {
    console.error(`no index-*.css in ${dir}/ -- run the build first.`);
    process.exit(1);
  }
  return candidates[0];
}

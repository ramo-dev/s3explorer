// Cross-checks that every Tailwind utility the app's own components reference
// actually made it into the built stylesheet. Catches tokens that silently
// stop resolving after a config or CSS-variable rename.
//
//   node scripts/check-utilities.mjs [path/to.css] [srcDir]
//
// With no CSS argument it picks the newest dist/assets/index-*.css.
import fs from "node:fs";
import path from "node:path";
import { resolveBuiltCss } from "./lib/built-css.mjs";

const cssFile = resolveBuiltCss(process.argv[2]);
const css = fs.readFileSync(cssFile, "utf8");
const srcDir = process.argv[3] ?? "src";

// Which prefixes may sit in front of a base utility.
const VARIANT =
  /^(?:(?:sm|md|lg|xl|2xl|3xl|4xl|5xl|hover|focus|focus-visible|focus-within|active|disabled|checked|first|last|odd|even|dark|group-hover|group-focus|peer-checked|peer-focus|aria-[a-z-]+|data-\[[^\]]+\]|not-[a-z-]+|max-[a-z]+|supports-[a-z-]+):)*$/;

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    // shadcn primitives are vendored, not ours to audit
    if (entry.isDirectory()) {
      if (/(^|[\\/])ui$/.test(p)) continue;
      walk(p);
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(p);
    }
  }
})(srcDir);

// Pull every quoted / templated className value.
const classValues = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const re = /class(?:Name)?\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\})/g;
  for (const m of src.matchAll(re)) classValues.push([m[1] ?? m[2] ?? "", file]);
}

// Utility families worth checking. Base = the part that follows the variants.
const BASE = new RegExp(
  "^(?:" +
    "(?:bg|text|border|ring|outline|divide|decoration|fill|stroke|from|via|to|shadow|accent|caret|placeholder)-" +
    ")?[a-z0-9-]+$"
);

// Names to skip. Deliberately empty: everything the app now styles with is a
// real Tailwind utility, including the handful declared with @utility in
// index.css, and those do appear in the built stylesheet. A hand-written class
// selector would also satisfy the lookup below -- which is the correct outcome,
// since check:legacy is what reports those. Flagging them here as well would be
// duplicate noise rather than a second signal.
const NOT_TAILWIND = new Set();

const used = new Map();
for (const [value, file] of classValues) {
  // strip template expressions: `text-${x}` contributes nothing checkable
  for (const raw of value.split(/\s+/)) {
    const token = raw.trim();
    if (!token || token.includes("${") || token.includes("`")) continue;
    if (NOT_TAILWIND.has(token)) continue;
    if (!BASE.test(token)) continue;
    const base = token.replace(VARIANT, "");
    if (!base || NOT_TAILWIND.has(base)) continue;
    if (!used.has(base)) used.set(base, file);
  }
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const missing = [];
for (const [util, file] of used) {
  // any rule whose selector contains this utility, variants included
  const needle = "." + escape(util);
  if (css.includes(needle)) continue;
  missing.push([util, file]);
}

console.log(`scanned ${files.length} app source files`);
console.log(`distinct utilities referenced: ${used.size}`);
console.log(`missing from ${cssFile}: ${missing.length}`);
for (const [util, file] of missing) console.log(`   ${util}  <-  ${file}`);
process.exit(missing.length ? 1 : 0);

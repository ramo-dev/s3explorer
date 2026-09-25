// Reports how much of the app still depends on the pre-shadcn styling system:
// the hand-written CSS classes in index.css (.btn, .input, .sidebar-item, ...)
// and the app-only colour tokens that shadcn replaces (--accent-pink,
// --background-secondary, --foreground-muted, ...).
//
// Both lists are derived from index.css rather than hardcoded here, so they
// stay accurate as the CSS is edited. Exits non-zero while anything remains,
// which makes it usable as a CI gate once the migration is done.
//
//   node scripts/legacy-usage.mjs            # human-readable table
//   node scripts/legacy-usage.mjs --files    # only list files with leftovers
import fs from "node:fs";
import path from "node:path";

const srcDir = process.argv[2] ?? "src";
const cssFile = path.join(srcDir, "index.css");
const filesOnly = process.argv.includes("--files");

// ── Colour tokens shadcn owns. Anything else in :root is app-only. ──────────
const SHADCN_TOKENS = new Set([
  "background", "foreground", "card", "card-foreground", "popover",
  "popover-foreground", "primary", "primary-foreground", "secondary",
  "secondary-foreground", "muted", "muted-foreground", "accent",
  "accent-foreground", "destructive", "destructive-foreground", "border",
  "input", "ring", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar", "sidebar-foreground", "sidebar-primary",
  "sidebar-primary-foreground", "sidebar-accent", "sidebar-accent-foreground",
  "sidebar-border", "sidebar-ring",
  "font-sans", "font-serif", "font-mono",
  "radius", "shadow-x", "shadow-y", "shadow-blur", "shadow-spread",
  "shadow-opacity", "shadow-color", "shadow-2xs", "shadow-xs", "shadow-sm",
  "shadow", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl",
  "tracking-normal", "spacing",
  // Not a shadcn token, but a deliberate permanent extension rather than a
  // pre-shadcn holdover, so it must not be reported as pending migration.
  // shadcn has no success colour; the app needs one for "Active" and
  // success toasts. Kept alongside the shadcn set so it is never counted.
  "success",
]);

const css = fs.readFileSync(cssFile, "utf8");

// Custom classes: every top-level class selector in index.css. shadcn's own
// styling comes from Tailwind utilities and [data-slot] selectors, never from a
// bare class here, so this is exactly the hand-written layer.
const customClasses = [
  ...new Set([...css.matchAll(/^\.([a-z][a-z0-9-]*)/gm)].map((m) => m[1])),
];

// App-only colour tokens: those declared in a :root / .dark / [data-theme]
// block that shadcn does not own. Reading only those blocks deliberately skips
// the @theme inline mappings (--color-*, --radius-*, --animate-*), which are the
// plumbing rather than the palette, and skips component-local vars like
// --modal-backdrop-bg that are never used as Tailwind colour utilities.
// The leading anchor is per-line (the m flag) rather than "start of string or
// after a }": a theme block is often preceded by a comment, which an anchor
// keyed on } would skip past. A [^{}]* body cannot cross a brace, so it always
// stops at the matching close of the block the selector opens.
const THEME_BLOCK =
  /^[ \t]*(?::root|\.dark|\[data-theme="dark"\]|\[data-theme="light"\])\s*\{([^{}]*)\}/gm;

const themeTokenNames = new Set();
for (const m of css.matchAll(THEME_BLOCK)) {
  for (const t of m[1].matchAll(/(--[a-z0-9-]+)\s*:/g)) {
    themeTokenNames.add(t[1].replace(/^--/, ""));
  }
}

const legacyTokens = [...themeTokenNames]
  .filter((t) => !SHADCN_TOKENS.has(t))
  .sort();

// Tailwind v4 ships these as built-in utilities, so index.css redefining them is
// pure duplication. Application code referencing the name is therefore already
// migrated -- it resolves to Tailwind's own utility. Counted separately so the
// "legacy references" figure only ever means "needs migrating".
const TAILWIND_DUPLICATES = new Set(["tabular-nums", "animate-spin"]);

// ── Walk app source, skipping the vendored shadcn primitives ────────────────
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/(^|[\\/])ui$/.test(p)) continue; // vendored, not ours to migrate
      walk(p);
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(p);
    }
  }
})(srcDir);

const CLASS_RE = new RegExp(
  `(?:^|[\\s"'\`])(?:[a-z0-9-]+:)*(${customClasses
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?=[\\s"'\`]|$)`,
  "gm",
);

const TOKEN_RE = new RegExp(
  `(?:bg|text|border|from|via|to|fill|stroke|ring|outline|shadow|divide|decoration|accent|caret|placeholder)-(${legacyTokens
    .map((t) => t.replace(/^--/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?![a-z0-9-])`,
  "g",
);

// Strip import statements and comments before scanning. Otherwise prose and
// module specifiers register as usage: a comment reading "a real DOM table" was
// counted as three references to the .table custom class, and an import of
// './ui/input' as a reference to .input. Both invent migration work that does
// not exist, which is the one thing a progress tracker must never do.
const IMPORT_RE = /import\s+[\s\S]*?from\s+['"][^'"]*['"];?/g;
const COMMENT_RE = /\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g;
const stripNonCode = (src) =>
  src.replace(IMPORT_RE, "").replace(COMMENT_RE, "$1");

const rows = [];
let totalClasses = 0;
let totalTokens = 0;

for (const file of files) {
  const src = stripNonCode(fs.readFileSync(file, "utf8"));
  const allClasses = [...src.matchAll(CLASS_RE)].map((m) => m[1]);
  // Split off the names Tailwind already provides; those are not migration work.
  const classes = allClasses.filter((c) => !TAILWIND_DUPLICATES.has(c));
  const tokens = [...src.matchAll(TOKEN_RE)].map((m) => m[1]);
  if (!classes.length && !tokens.length) continue;
  totalClasses += classes.length;
  totalTokens += tokens.length;
  rows.push({ file, classes, tokens });
}

rows.sort(
  (a, b) =>
    b.classes.length + b.tokens.length - (a.classes.length + a.tokens.length),
);

// Which custom classes in the CSS no longer have any caller? The Tailwind
// duplicates are excluded: they are listed separately, and calling them
// "unreferenced" would read as a dangling selector.
const usedClasses = new Set(rows.flatMap((r) => r.classes));
const redundantSet = new Set(TAILWIND_DUPLICATES);
const deadClasses = customClasses.filter(
  (c) => !usedClasses.has(c) && !redundantSet.has(c),
);

// ── Output ──────────────────────────────────────────────────────────────────
const name = (f) => path.relative(process.cwd(), f);

if (rows.length === 0) {
  console.log("No legacy classes or tokens referenced. Migration complete.");
} else if (filesOnly) {
  for (const r of rows) console.log(name(r.file));
} else {
  console.log("Legacy styling still referenced, per file\n");
  console.log(
    "  " + "file".padEnd(34) + "classes".padEnd(9) + "tokens".padEnd(8) + "detail",
  );
  console.log("  " + "-".repeat(96));
  for (const r of rows) {
    const detail = [
      ...new Set(r.classes),
    ].map((c) => `.${c}`).concat([...new Set(r.tokens)].map((t) => `--${t}`)).join(" ");
    console.log(
      "  " +
        name(r.file).padEnd(32) +
        String(r.classes.length).padEnd(9) +
        String(r.tokens.length).padEnd(8) +
        detail.slice(0, 60) +
        (detail.length > 60 ? "…" : ""),
    );
  }
  console.log(
    "\n  totals: " +
      totalClasses +
      " class references, " +
      totalTokens +
      " token references, across " +
      rows.length +
      " files",
  );
}

// The duplicate names Tailwind already ships: still declared in index.css, but
// every caller resolves to the built-in utility, so deleting the CSS is safe.
const redundant = [...TAILWIND_DUPLICATES].filter((c) => customClasses.includes(c));

console.log(
  "\nindex.css: " +
    customClasses.length +
    " custom classes (" +
    deadClasses.length +
    " unreferenced)",
);
if (deadClasses.length) {
  console.log("  unreferenced: " + deadClasses.join(" "));
}
if (redundant.length) {
  console.log(
    "  duplicated by Tailwind, safe to delete: " + redundant.join(" "),
  );
}
console.log(
  "index.css: " +
    legacyTokens.length +
    " app-only tokens: " +
    (legacyTokens.join(" ") || "(none)"),
);

process.exit(totalClasses + totalTokens > 0 ? 1 : 0);

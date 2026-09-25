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

const rows = [];
let totalClasses = 0;
let totalTokens = 0;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const classes = [...src.matchAll(CLASS_RE)].map((m) => m[1]);
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

// Which custom classes in the CSS no longer have any caller?
const usedClasses = new Set(rows.flatMap((r) => r.classes));
const deadClasses = customClasses.filter((c) => !usedClasses.has(c));

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
console.log(
  "index.css: " +
    legacyTokens.length +
    " app-only tokens: " +
    (legacyTokens.join(" ") || "(none)"),
);

process.exit(totalClasses + totalTokens > 0 ? 1 : 0);

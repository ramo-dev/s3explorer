// Dumps the resolved light/dark token values from the built stylesheet, so a
// bad rename or a lost theme block shows up as a wrong value rather than as a
// silently unstyled element.
//
//   node scripts/dump-theme-tokens.mjs [path/to.css]
//
// With no argument it picks the newest dist/assets/index-*.css.
import fs from "node:fs";
import { resolveBuiltCss } from "./lib/built-css.mjs";

const file = resolveBuiltCss(process.argv[2]);
const css = fs.readFileSync(file, "utf8");
console.log(`reading ${file}\n`);

// A theme block is a rule whose body declares --background. Matching on the body
// rather than the full selector is deliberate: the dark selector is now
// `.dark, [data-theme="dark"]`, and the minifier rewrites `[data-theme="dark"]`
// to `[data-theme=dark]`, so pinning the exact selector text would be brittle.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function findBlocks() {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel, body]) => /(^|;)\s*--background\s*:/.test(body))
    .map(([, sel, body]) => ({ sel: sel.trim(), body }));
}

function read(body, key) {
  const m = body.match(new RegExp(`(?:^|;)\\s*${key.replace(/-/g, "\\-")}\\s*:\\s*([^;]+)`));
  return m ? m[1].trim() : "(absent)";
}

const declared = (body) =>
  new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const blocks = findBlocks();
const light = blocks.filter((b) => /:root/.test(b.sel));
const dark = blocks.filter((b) => /\[data-theme=("|')?dark\1?\]|\.dark/.test(b.sel));

console.log(`:root theme blocks ..................... ${light.length}`);
console.log(`dark theme blocks ...................... ${dark.length}`);

if (light.length !== 1) {
  console.log("\n!! expected exactly one :root theme block (CSS would be order-dependent)");
  process.exitCode = 1;
}
if (dark.length !== 1) {
  console.log("\n!! expected exactly one dark theme block (CSS would be order-dependent)");
  process.exitCode = 1;
}
if (dark.length === 1) {
  console.log(`dark selector ......................... ${dark[0].sel}`);
}

const L = light[0]?.body ?? "";
const D = dark[0]?.body ?? "";

// Everything the app's utilities can reference. Checking them by name is the
// point: a typo'd or dropped declaration in one theme block resolves to nothing
// in that theme, and the element renders unstyled in exactly one mode.
const keys = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--popover", "--popover-foreground", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
  "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
  "--border", "--input", "--ring",
  "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5",
  "--sidebar", "--sidebar-foreground", "--sidebar-primary",
  "--sidebar-primary-foreground", "--sidebar-accent",
  "--sidebar-accent-foreground", "--sidebar-border", "--sidebar-ring",
  "--success",
  "--radius", "--spacing", "--tracking-normal",
  "--font-sans", "--font-serif", "--font-mono",
];

console.log("\n  " + "token".padEnd(30) + "dark".padEnd(52) + "light");
console.log("  " + "-".repeat(118));
for (const k of keys) {
  const d = read(D, k);
  const l = read(L, k);
  const flag = d === "(absent)" || l === "(absent)" ? "  <-- MISSING" : "";
  console.log("  " + k.padEnd(28) + d.padEnd(52) + l + flag);
  if (d === "(absent)" || l === "(absent)") process.exitCode = 1;
}

// Parity: a token declared in one theme but not the other is the classic
// half-migrated bug. It still works in one mode, so it is easy to ship and hard
// to notice, which is why it is checked rather than trusted.
if (light.length === 1 && dark.length === 1) {
  const inLight = declared(L);
  const inDark = declared(D);
  const onlyLight = [...inLight].filter((t) => !inDark.has(t));
  const onlyDark = [...inDark].filter((t) => !inLight.has(t));
  console.log(`\ntoken counts: light ${inLight.size}, dark ${inDark.size}`);
  if (onlyLight.length) {
    console.log("  !! declared in :root only: " + onlyLight.join(" "));
    process.exitCode = 1;
  }
  if (onlyDark.length) {
    console.log("  !! declared in the dark block only: " + onlyDark.join(" "));
    process.exitCode = 1;
  }
  if (!onlyLight.length && !onlyDark.length) {
    console.log("ok: both themes declare the same token set.");
  }
}

// Sanity: the default dark background must be dark, and text on it light.
const bg = read(D, "--background");
const fg = read(D, "--foreground");
console.log(`\ndark: --background ${bg} with --foreground ${fg}`);
// minified CSS rewrites oklch(0.145 0 0) as oklch(14.5% 0 0), so normalise both
// forms to a 0..1 lightness before comparing.
const lightness = (token) => {
  const m = token.match(/^oklch\(\s*(?:0\.)?([\d.]+)(%?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === "%" || n > 1 ? n / 100 : n;
};

const bgL = lightness(bg);
const fgL = lightness(fg);

if (bgL !== null && fgL !== null && bgL < 0.3 && fgL > 0.7) {
  console.log(`ok: dark background (L=${bgL}) with light text (L=${fgL}).`);
  console.log('    index.html ships data-theme="dark", so this is what renders.');
} else {
  console.log(`!! dark theme is not a dark-surface/light-text pair (bgL=${bgL}, fgL=${fgL}).`);
  process.exitCode = 1;
}

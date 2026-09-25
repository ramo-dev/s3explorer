// Dumps the resolved light/dark token values from the built stylesheet, so a
// bad rename or a lost theme block shows up as a wrong value rather than as a
// silently unstyled element.
import fs from "node:fs";

const css = fs.readFileSync(process.argv[2], "utf8");

// A theme block is a rule whose selector is exactly `:root` or
// `[data-theme="dark"]` and whose body declares --background. Matching the
// exact selector avoids picking up `dark:...:is([data-theme=dark] *)` rules.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function findBlock(selector) {
  const re = new RegExp(escapeRe(selector) + "\\{([^{}]*)\\}", "g");
  return [...css.matchAll(re)]
    .map((m) => m[1])
    .filter((body) => /(^|;)\s*--background\s*:/.test(body));
}

function read(body, key) {
  const m = body.match(new RegExp(`(?:^|;)\\s*${key.replace(/-/g, "\\-")}\\s*:\\s*([^;]+)`));
  return m ? m[1].trim() : "(absent)";
}

const light = findBlock(":root");
// minifiers drop the quotes around the attribute value, so accept both forms
const dark = [...findBlock('[data-theme="dark"]'), ...findBlock("[data-theme=dark]")];

console.log(`:root blocks with --background .......... ${light.length}`);
console.log(`[data-theme="dark"] blocks with --bg .... ${dark.length}`);

if (light.length !== 1) {
  console.log("\n!! expected exactly one :root theme block (CSS would be order-dependent)");
  process.exitCode = 1;
}
if (dark.length !== 1) {
  console.log("\n!! expected exactly one [data-theme=\"dark\"] theme block (CSS would be order-dependent)");
  process.exitCode = 1;
}

const L = light[0] ?? "";
const D = dark[0] ?? "";
const keys = [
  "--background", "--foreground", "--card", "--muted", "--accent",
  "--border", "--input", "--ring", "--primary", "--destructive",
  "--background-secondary", "--background-tertiary", "--background-hover",
  "--border-hover", "--foreground-secondary", "--foreground-muted",
  "--accent-pink", "--accent-purple",
  "--radius", "--font-sans", "--spacing", "--tracking-normal",
];

console.log("\n  " + "token".padEnd(26) + "dark".padEnd(34) + "light");
console.log("  " + "-".repeat(96));
for (const k of keys) {
  const d = read(D, k);
  const l = read(L, k);
  const flag = d === l && ["--background", "--foreground", "--card", "--muted"].includes(k) ? "  <-- identical" : "";
  console.log("  " + k.padEnd(24) + d.padEnd(34) + l + flag);
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

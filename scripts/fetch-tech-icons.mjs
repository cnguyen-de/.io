// Downloads the brand icons for the technology stack (src/data/stack.ts) from Simple Icons and
// writes their SVG paths to src/data/tech-icons.json, so the site never loads them from a CDN.
//
//   node scripts/fetch-tech-icons.mjs
//
// Run by hand after adding a technology to stack.ts. Icons: Simple Icons, CC0 1.0.
import { readFileSync, writeFileSync } from "node:fs";

const VERSION = "15";
const stack = readFileSync(new URL("../src/data/stack.ts", import.meta.url), "utf8");
const slugs = [...stack.matchAll(/\["([a-z0-9]+)",\s*"/g)].map((m) => m[1]);
if (!slugs.length) throw new Error("No slugs found in src/data/stack.ts");

const icons = {};
for (const slug of slugs) {
  const res = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@${VERSION}/icons/${slug}.svg`);
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
  const path = (await res.text()).match(/<path d="([^"]+)"/)?.[1];
  if (!path) throw new Error(`${slug}: no <path> in the SVG`);
  icons[slug] = path;
}

const out = new URL("../src/data/tech-icons.json", import.meta.url);
writeFileSync(out, JSON.stringify(icons, null, 1) + "\n");
console.log(`Wrote ${slugs.length} icons to src/data/tech-icons.json`);

// Team-name canonicalization through data/name-aliases.json (adopted from
// hostile-territory, where it was validated against cfbfastR/jhowell/CPA).
// Any source name with no alias entry is collected, not silently dropped.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './util.mjs';

const aliasFile = path.join(ROOT, 'data', 'ref', 'name-aliases.json');
const aliasDoc = JSON.parse(fs.readFileSync(aliasFile, 'utf8'));

/** Loose fallback key: lowercase, drop punctuation and common noise words. */
export function slug(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '');
}

const aliasIndex = new Map();
for (const [raw, key] of Object.entries(aliasDoc.aliases)) {
  aliasIndex.set(slug(raw), key);
}
for (const key of Object.keys(aliasDoc.canonical)) aliasIndex.set(slug(key), key);

export const unmatched = new Map();

export function canon(name, source) {
  if (!name) return null;
  const s = slug(name);
  const hit = aliasIndex.get(s);
  if (hit) return hit;
  const key = `${name} [${source}]`;
  unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
  return null;
}

/** canon() without recording a miss. */
export const lookup = (name) => (name ? aliasIndex.get(slug(name)) ?? null : null);

export const display = (key) => aliasDoc.canonical[key] ?? key;

// Prints the names no alias matched, and writes them to
// data/build/unmatched-<label>.json for coverage-report.mjs.
export function reportUnmatched(label) {
  const rows = [...unmatched.entries()].sort((a, b) => b[1] - a[1]);
  const dir = path.join(ROOT, 'data', 'build');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `unmatched-${label}.json`), JSON.stringify(Object.fromEntries(rows), null, 1) + '\n');
  if (!rows.length) return;
  console.error(`\n${label}: ${rows.length} unmatched name(s):`);
  for (const [k, n] of rows) console.error(`  ${nixWidth(n)}  ${k}`);
}

const nixWidth = (n) => String(n).padStart(4);

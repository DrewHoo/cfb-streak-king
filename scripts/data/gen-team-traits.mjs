// Emit data/ref/team-traits.json: each payload team's mascot ruling and its
// school color, for the "vs [mascots]" and "vs [color] schools" chips.
//
//   mascot  CFBD /teams (data/raw/cfbd-teams.json, the gen-team-info call),
//           ruled by data/ref/mascot-classes.json: a name-group (Bulldogs,
//           Devils) and classes (cat/canine/bird imply animal; people, myth,
//           force stand alone). Fails loud on a nickname the rulings miss.
//   color   the school's identity color, ONE word per school: the CFBD
//           primary hex bucketed by hue, overridden by
//           data/ref/color-overrides.json where identity and hex disagree
//           (Auburn is an orange school, whatever the navy hex says).
//
// Run on a dev machine after refreshing cfbd-teams.json or editing a ruling;
// build-current.mjs reads the emitted file, so CI needs no CFBD call.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/util.mjs';
import { canon, slug } from '../lib/names.mjs';

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const cfbd = read('data/raw/cfbd-teams.json');
const payload = read('src/data/payload.json');
const rules = read('data/ref/mascot-classes.json').classes;
const overrides = read('data/ref/color-overrides.json').colors;

// --- join: canonical name first, then the x: slug the build scripts minted ---
const byId = new Map();
const bySlug = new Map();
for (const t of cfbd) {
  const id = canon(t.school, 'cfbd-teams');
  if (id && !byId.has(id)) byId.set(id, t);
  const s = slug(t.school);
  if (!bySlug.has(s)) bySlug.set(s, t);
}
const match = (id) => byId.get(id) ?? bySlug.get(id.startsWith('x:') ? id.slice(2) : id) ?? null;

// --- one color word from a hex: hue buckets, gray/white none, near-black black ---
function colorOf(hex) {
  if (!/^#?[0-9a-f]{6}$/i.test(hex ?? '')) return null;
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.13 || (s < 0.12 && l < 0.25)) return 'black';
  if (s < 0.15 || l > 0.92) return null;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (h < 15) return 'red';
  if (h < 45) return 'orange';
  if (h < 68) return 'gold';
  if (h < 170) return 'green';
  if (h < 258) return 'blue';
  if (h < 318) return 'purple';
  return 'red';
}

const titled = (g) => g.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const IMPLY_ANIMAL = new Set(['cat', 'canine', 'bird']);

const fbsNow = new Set(
  payload.teams.filter((t) => t.major?.some(([a, b]) => a <= payload.currentSeason && b >= payload.currentSeason)).map((t) => t.id),
);

const out = {};
const unmapped = new Set();
const groupFbs = new Map();
for (const t of payload.teams) {
  const c = match(t.id);
  if (!c) continue;
  const row = {};
  if (c.mascot) {
    const rule = rules[c.mascot];
    if (!rule) { unmapped.add(c.mascot); continue; }
    row.m = c.mascot;
    if (rule.g) row.g = rule.g;
    const cls = new Set(rule.c);
    for (const k of rule.c) if (IMPLY_ANIMAL.has(k)) cls.add('animal');
    row.c = [...cls];
    if (rule.g && fbsNow.has(t.id)) groupFbs.set(rule.g, (groupFbs.get(rule.g) ?? 0) + 1);
  }
  const k = t.id in overrides ? overrides[t.id] : colorOf(c.color);
  if (k) row.k = k;
  if (row.m || row.k) out[t.id] = row;
}

if (unmapped.size) {
  console.error(`mascot-classes.json is missing ${unmapped.size} nicknames: ${[...unmapped].sort().join(', ')}`);
  process.exit(1);
}

const groups = [...groupFbs.entries()].filter(([, n]) => n >= 2).map(([g]) => g).sort();
fs.writeFileSync(
  path.join(ROOT, 'data', 'ref', 'team-traits.json'),
  JSON.stringify({
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    groupLabels: Object.fromEntries(groups.map((g) => [g, titled(g)])),
    teams: out,
  }, null, 1),
);

console.log(`team-traits.json: ${Object.keys(out).length} teams (${Object.values(out).filter((r) => r.m).length} with mascot, ${Object.values(out).filter((r) => r.k).length} with a color)`);
console.log(`name-groups with 2+ current-FBS teams (${groups.length}): ${groups.map((g) => `${titled(g)} ${groupFbs.get(g)}`).join(', ')}`);
// the FBS color table, for eyeballing the hue rule and writing overrides
const colorRows = payload.teams
  .filter((t) => fbsNow.has(t.id))
  .map((t) => ({ id: t.id, hex: match(t.id)?.color, k: out[t.id]?.k ?? '—', over: t.id in overrides }))
  .sort((a, b) => String(a.k).localeCompare(String(b.k)) || a.id.localeCompare(b.id));
for (const r of colorRows) console.log(`${String(r.k).padEnd(7)} ${r.id.padEnd(24)} ${r.hex ?? ''}${r.over ? '  (override)' : ''}`);

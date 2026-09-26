// Wikipedia "List of NCAA college football rivalry games" wikitext ->
// data/build/rivalries.json: [{name, a, b}] canonical team pairs, restricted
// to the FBS and FBS-vs-FCS sections. A rivalry chip matches that team pair
// in any season. Rows whose teams don't both canonicalize (pure FCS pairs)
// are dropped, since only FBS teams get leaderboard rows.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir } from '../lib/util.mjs';
import { canon } from '../lib/names.mjs';

const doc = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'raw', 'rivalries-wikitext.json'), 'utf8'),
);
const w = doc.parse.wikitext['*'];

// keep only FBS + FBS/FCS sections
const fbsStart = w.indexOf('==NCAA Division I Football Bowl Subdivision==');
const fcsStart = w.indexOf('==NCAA Division I Football Championship Subdivision==');
const mixStart = w.indexOf('==Rivalries involving FBS and FCS teams==');
const d2Start = w.indexOf('==NCAA Division II==');
const scope = w.slice(fbsStart, fcsStart) + w.slice(mixStart, d2Start);

const rows = scope.match(/\{\{Trophy game\|[\s\S]*?\}\}/g) ?? [];
const out = [];
const dropped = [];
for (const row of rows) {
  const parts = row.slice(2, -2).split('|');
  // {{Trophy game|series|trophy|teamA-link|teamA?|teamB-link|teamB?|first|latest|games}}
  // links are [[target|display]] so split('|') fragments them; re-parse links instead.
  const links = [...row.matchAll(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g)].map(
    (m) => m[2] ?? m[1],
  );
  if (links.length < 3) continue;
  const name = links[0];
  // team display names are the two links that end the row before the years;
  // trophy may be absent (empty field). Take the last two links.
  const a = canon(links[links.length - 2], 'rivalry');
  const b = canon(links[links.length - 1], 'rivalry');
  if (!a || !b || a === b) {
    dropped.push(name);
    continue;
  }
  out.push({ name, a, b });
}

// dedupe pairs (a rivalry can be listed once; keep first name)
const seen = new Set();
const deduped = out.filter(({ a, b }) => {
  const k = [a, b].sort().join('|');
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

ensureDir(path.join(ROOT, 'data', 'build'));
fs.writeFileSync(
  path.join(ROOT, 'data', 'build', 'rivalries.json'),
  JSON.stringify(deduped, null, 1),
);
console.log(`rivalries: ${deduped.length} FBS pairs kept, ${dropped.length} rows dropped (non-FBS or unparsed)`);
console.log('spot checks:',
  ['michigan|ohio-state', 'alabama|auburn', 'army|navy', 'oklahoma|texas']
    .map((k) => `${k}=${seen.has(k)}`)
    .join('  '));

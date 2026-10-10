// What the finished site can't show: how much of the ruling data carries a
// receipt, which rows don't, what the build left unmatched, and whether the
// numbers the build prints are still where they were. Run after
// build-payload.mjs (it reads data/build/build-stats.json and the
// unmatched-*.json files the parsers write). Exits 1 when an assertion fails.
//
//   node scripts/data/coverage-report.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REF = path.join(ROOT, 'data', 'ref');
const BUILD = path.join(ROOT, 'data', 'build');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const failures = [];
const assert = (ok, msg) => { if (!ok) failures.push(msg); };

// ---------- receipts per ruling file ----------
// A claim is any object carrying `receipts`; files without the key are
// listed so a new ruling file that forgets receipts stands out.
function* claims(value, where) {
  if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* claims(value[i], `${where}[${i}]`);
  else if (value && typeof value === 'object') {
    if (Array.isArray(value.receipts)) yield { obj: value, where };
    for (const [k, v] of Object.entries(value)) if (k !== 'receipts') yield* claims(v, where ? `${where}.${k}` : k);
  }
}
const label = (obj) => ['date', 'season', 'team', 'home', 'away', 'visitor'].filter((k) => obj[k] !== undefined && typeof obj[k] !== 'object').map((k) => `${k}=${obj[k]}`).join(' ');
console.log('receipts by ruling file');
const unreceipted = [];
for (const name of fs.readdirSync(REF).filter((n) => n.endsWith('.json')).sort()) {
  const data = read(path.join(REF, name));
  let rows = 0, quoted = 0, votes = 0, none = 0;
  const bare = [];
  for (const { obj, where } of claims(data, '')) {
    rows++;
    const q = obj.receipts.filter((r) => r.url && r.quote).length;
    const v = obj.receipts.filter((r) => r.sources && !r.url).length;
    if (q) quoted++;
    else if (v) votes++;
    else { none++; bare.push(`${where}${label(obj) ? ` (${label(obj)})` : ''}`); }
    // a coach ruling has one segment per coach; count the segments a receipt doesn't name
    if (Array.isArray(obj.segments)) {
      for (const s of obj.segments) {
        if (!obj.receipts.some((r) => r.quote && r.quote.includes(s.coach.split(' ').at(-1)))) bare.push(`${where} segment ${s.coach}`);
      }
    }
  }
  if (!rows) { unreceipted.push(name); continue; }
  console.log(`  ${name}: ${rows} claims — ${quoted} quoted, ${votes} by vote, ${none} with no receipt`);
  for (const b of bare) console.log(`    no receipt: ${b}`);
}
console.log(`  no receipts key at all: ${unreceipted.join(', ')} (rule files and generated tables; nothing to quote)`);

// ---------- names the parsers couldn't match ----------
const um = fs.readdirSync(BUILD).filter((n) => /^unmatched-.*\.json$/.test(n)).sort();
if (!um.length) console.log('\nunmatched names: no unmatched-*.json in data/build — run the parsers first');
else {
  console.log('\nunmatched names (no alias; the team is minted as x:<slug>)');
  for (const n of um) {
    const rows = Object.entries(read(path.join(BUILD, n))).sort((a, b) => b[1] - a[1]);
    console.log(`  ${n.slice(10, -5)}: ${rows.length} names${rows.length ? ` — top: ${rows.slice(0, 5).map(([k, v]) => `${k} ×${v}`).join(', ')}` : ''}`);
  }
}

// ---------- the build's own numbers ----------
const statsPath = path.join(BUILD, 'build-stats.json');
if (!fs.existsSync(statsPath)) console.log('\nbuild stats: no data/build/build-stats.json — run build-payload.mjs first');
else {
  const s = read(statsPath);
  const joinRate = s.join0213.joined / s.join0213.total;
  console.log(`\nbuild ${s.builtAt}: ${s.games} games, ${s.teams} teams (${s.mintedTeams} minted x: ids), ${s.lined} lined`);
  console.log(`  2002-2013 schedule join ${s.join0213.joined}/${s.join0213.total} (${(joinRate * 100).toFixed(1)}%)`);
  console.log(`  unresolved coach seasons ${s.unresolvedCoachSeasons}; extra games ${s.extraGames.added} added, ${s.extraGames.duplicates} already present; Howell score splits ${s.howellScoreSplits}; unmapped conference names ${s.unmappedConferenceNames}`);
  console.log(`  floors ${JSON.stringify(s.floors)}`);
  // 94.0% at the 2026-10-10 build (93.1% at the first); the unjoined games are
  // ones the schedule source has no kickoff hour for. A drop means a parser
  // regression, not missing data, so the floor is the observed value.
  assert(joinRate >= 0.93, `2002-2013 schedule join fell to ${(joinRate * 100).toFixed(1)}% (floor 93.0%)`);
  assert(s.unresolvedCoachSeasons === 0, `${s.unresolvedCoachSeasons} unresolved coach seasons`);
  assert(s.howellScoreSplits === 0, `${s.howellScoreSplits} Howell score splits unruled`);
}

// ---------- open disputes and leads ----------
for (const [file, word] of [['triage.json', 'disputes'], ['leads.json', 'leads']]) {
  const p = path.join(ROOT, 'data', 'research', file);
  if (!fs.existsSync(p)) continue;
  const rows = read(p).rows;
  const open = rows.filter((r) => r.status === 'open');
  console.log(`\n${word}: ${rows.length} recorded, ${open.length} open`);
  for (const r of open) console.log(`  open: ${r.claim}`);
}

if (failures.length) {
  console.error('\nFAIL');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * parse-polls.mjs — parse the cached collegepollarchive.com pages under
 * data/raw/ap-polls/ into data/polls.json.
 *
 * Output: [{ season, id, label, date, ranks: [{ rank, team, raw }] }]
 * sorted by season then date. `team` is the canonical key from
 * data/name-aliases.json; `raw` is the name as printed by CPA (the receipt).
 *
 * The rank cell is the <strong> one — the cell adjacent to the team anchor is
 * the PREVIOUS week's rank (verified against the ESPN rankings API on
 * hostile-territory; see that repo's data/research/rank-disputes.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAW, ROOT } from '../lib/util.mjs';
import { parsePollPage } from '../lib/cpa.mjs';
import { canon, reportUnmatched } from '../lib/names.mjs';
import { FIRST_SEASON } from '../lib/window.mjs';

const FROM = Number(process.env.FROM ?? FIRST_SEASON);
const TO = Number(process.env.TO ?? 2025);

const dir = path.join(RAW, 'ap-polls');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8'));
const out = [];
let pages = 0;
for (const season of manifest) {
  if (season.year < FROM || season.year > TO) continue;
  for (const p of season.polls) {
    const file = path.join(dir, 'polls', `poll-${p.id}.html`);
    if (!fs.existsSync(file)) {
      console.error(`missing page: season ${season.year} poll ${p.id} (${p.label})`);
      continue;
    }
    pages++;
    const parsed = parsePollPage(fs.readFileSync(file, 'utf8'), season.year, p.label);
    if (!parsed.date || parsed.ranks.length === 0) {
      console.error(`unparsed: season ${season.year} poll ${p.id} (${p.label}) date=${parsed.date} ranks=${parsed.ranks.length}`);
      continue;
    }
    out.push({ season: season.year, id: p.id, ...parsed });
  }
}
// The AP's final poll came out before the bowls through 1964 and again in
// 1966-67. CPA doesn't date final polls (parsePollPage puts them on Feb 1),
// so in those seasons date it a week after the last weekly poll: bowls then
// see the final poll, as they did.
const PRE_BOWL_FINAL = (y) => y <= 1964 || y === 1966 || y === 1967;
for (const p of out) {
  if (!/final/i.test(p.label) || !PRE_BOWL_FINAL(p.season)) continue;
  const last = out.filter((q) => q.season === p.season && q !== p && !/final/i.test(q.label)).map((q) => q.date).sort().at(-1);
  if (!last) continue;
  const d = new Date(`${last}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  p.date = d.toISOString().slice(0, 10);
}
out.sort((a, b) => a.season - b.season || a.date.localeCompare(b.date));

fs.writeFileSync(path.join(ROOT, 'data', 'build', 'polls.json'), JSON.stringify(out, null, 1));
const perSeason = new Map();
for (const p of out) perSeason.set(p.season, (perSeason.get(p.season) ?? 0) + 1);
console.log(`parsed ${out.length}/${pages} polls across ${perSeason.size} seasons (${FROM}-${TO})`);
const sizes = out.map((p) => p.ranks.length);
console.log(`poll sizes: min ${Math.min(...sizes)} max ${Math.max(...sizes)}`);
reportUnmatched('parse-polls');

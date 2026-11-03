// The games before the payload's window (FIRST_SEASON, 1936) between two
// teams in FBS now, from jhowell.net's team pages, for the series pages
// (src/lib/series.ts): "Alabama vs Tennessee all-time record" counts from the
// first meeting, and the payload starts in 1936. Nothing else reads it: no
// streak, board or mine sees a game before the window.
//
//   node scripts/data/build-series-early.mjs   writes src/data/series-early.json
//
// Each game is on both teams' pages. '@' marks the visitor; a game at a site
// that's neither team's home is 'vs.' on both, with the city in its own cell.
// A game only one page has (the other team's page starts later) reads from
// that row. Committed, so the site builds without data/raw/.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, decodeEntities, stripTags } from '../lib/util.mjs';
import { canon, lookup, slug } from '../lib/names.mjs';
import { FIRST_SEASON } from '../lib/window.mjs';

const RAW = path.join(ROOT, 'data', 'raw', 'jhowell', 'teams');
const OUT = path.join(ROOT, 'src', 'data', 'series-early.json');
const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'payload.json'), 'utf8'));
const fbs = new Set(payload.teams.filter((t) => (t.major ?? []).some(([, b]) => b >= payload.currentSeason)).map((t) => t.id));

const epOf = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
const oppId = (cell, linked) => {
  const name = cell.replace(/^\*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return (linked ? canon(name, 'jhowell') : lookup(name)) ?? `x:${slug(name)}`;
};

// every pre-window row on a page between two FBS teams, keyed by the game
const rows = new Map();
for (const f of fs.readdirSync(RAW).filter((f) => f.endsWith('.htm'))) {
  const html = fs.readFileSync(path.join(RAW, f), 'latin1');
  const headRe = /<a name=(\d{4})>\d{4}-([^<]+?)\s*\(([^()]*)\)<\/a>/g;
  const heads = [];
  let hm;
  while ((hm = headRe.exec(html))) heads.push({ year: Number(hm[1]), name: hm[2].trim(), at: hm.index });
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    if (h.year >= FIRST_SEASON) continue;
    const team = canon(h.name, 'jhowell') ?? `x:${slug(h.name)}`;
    if (!fbs.has(team)) continue;
    const block = html.slice(h.at, heads[i + 1]?.at ?? html.length);
    for (const tr of block.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const raw = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
      const cells = raw.map((c) => decodeEntities(stripTags(c)).replace(/\s+/g, ' ').trim());
      const md = /^(\d{1,2})\/(\d{1,2})$/.exec(cells[0] ?? '');
      if (!md || cells.length < 6) continue;
      const opp = oppId(cells[2], /<a href/.test(raw[2]));
      if (!fbs.has(opp) || opp === team) continue;
      const pf = Number(cells[4]), pa = Number(cells[5]);
      if (!Number.isFinite(pf) || !Number.isFinite(pa)) continue;
      const [mo, da] = [Number(md[1]), Number(md[2])];
      const date = `${mo <= 2 ? h.year + 1 : h.year}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
      const key = `${date}|${[team, opp].sort().join('|')}`;
      (rows.get(key) ?? rows.set(key, []).get(key)).push({ se: h.year, team, opp, date, at: cells[1] === '@' ? '@' : 'vs.', pf, pa, city: cells[6] ?? '' });
    }
  }
}

// one game per key: the visitor is whoever a page marks '@'; 'vs.' on both
// sides, or one 'vs.' row with a city, is a neutral site
const ids = [...fbs].sort();
const idx = new Map(ids.map((id, i) => [id, i]));
const g = { se: [], ep: [], hi: [], ai: [], hs: [], as: [], fl: [] };
let disagree = 0;
for (const rs of [...rows.values()].sort((a, b) => a[0].date.localeCompare(b[0].date))) {
  const visitor = rs.find((r) => r.at === '@');
  const neutral = !visitor;
  const r = visitor ?? rs[0];
  const home = visitor ? r.opp : r.team, away = visitor ? r.team : r.opp;
  const [hs, as] = visitor ? [r.pa, r.pf] : [r.pf, r.pa];
  if (rs.length > 1) {
    const o = rs.find((x) => x !== r);
    const [ohs, oas] = o.team === home ? [o.pf, o.pa] : [o.pa, o.pf];
    if (ohs !== hs || oas !== as) disagree++;
  }
  // a lone 'vs.' row without a city is the page's own home game
  const fl = neutral && (rs.length > 1 || r.city) ? 1 : 0;
  g.se.push(r.se); g.ep.push(epOf(r.date)); g.hi.push(idx.get(home)); g.ai.push(idx.get(away)); g.hs.push(hs); g.as.push(as); g.fl.push(fl);
}
fs.writeFileSync(OUT, JSON.stringify({ v: 1, before: FIRST_SEASON, source: 'jhowell.net team pages', teams: ids, games: g }) + '\n');
console.log(`series-early: ${g.se.length} games before ${FIRST_SEASON} between FBS teams, ${Math.min(...g.se)}-${Math.max(...g.se)}; ${disagree} whose two pages disagree on the score (the visitor's page kept)`);

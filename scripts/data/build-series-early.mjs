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
import { wikipediaGames } from '../lib/seriesWikipedia.mjs';
import { rivalryAdds } from '../lib/seriesRivalry.mjs';
import { createModel } from '../../src/lib/createModel.ts';

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
const howell = [];
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
  const neutralSite = neutral && (rs.length > 1 || r.city);
  howell.push({ se: r.se, date: r.date, home, away, hs, as, neutral: !!neutralSite, src: 'howell' });
}
console.log(`jhowell.net: ${howell.length} games before ${FIRST_SEASON} between FBS teams; ${disagree} whose two pages disagree on the score (the visitor's page kept)`);

// the payload's games of each pair of FBS teams, as a series page sees them (gamesOf from either
// side): a game of a major team's season can be missing (Nevada's 1993 games against I-AA teams)
const model = createModel(payload);
const payloadPairs = new Map();
const isoOf = (ep) => new Date(ep * 86400000).toISOString().slice(0, 10);
for (const ti of model.fbsNow) for (const r of model.gamesOf(ti)) {
  if (!model.fbsNow.has(r.oppIdx)) continue;
  const [a, b] = [model.teams[ti].id, model.teams[r.oppIdx].id];
  const k = [a, b].sort().join('|');
  const list = payloadPairs.get(k) ?? payloadPairs.set(k, []).get(k);
  if (list.some((g) => g.ep === r.ep)) continue;
  list.push({ ep: r.ep, date: isoOf(r.ep), se: r.se, home: r.neutral ? a : r.home ? a : b, away: r.neutral ? b : r.home ? b : a, hs: r.neutral || r.home ? r.us : r.them, as: r.neutral || r.home ? r.them : r.us });
}
/** The payload has this game of the pair: within a few days, or the same season and score. */
function inPayload(a, b, date, se, ptsOf) {
  return (payloadPairs.get([a, b].sort().join('|')) ?? []).some((g) => Math.abs(g.ep - epOf(date)) <= 4 || (g.se === se && ptsOf && g.hs === ptsOf[g.home] && g.as === ptsOf[g.away]));
}
/** How many games of the pair the payload has in a season. */
const payloadCount = (a, b, se) => (payloadPairs.get([a, b].sort().join('|')) ?? []).filter((g) => g.se === se).length;
const { games: wp0, rulings: wpRulings, report } = wikipediaGames({ fbs, payload, howell, inPayload });
// A source's game is new unless jhowell.net (before 1936) or the payload (since) has it: one of
// theirs within a few days, or in the same season with each team's score. Of the rest, as many as
// the existing games of the pair that season left unmatched are those same games dated or scored
// another way (the Egg Bowl's 1942 game is November 28 in the payload, November 21 in the
// article); only a source with more meetings that season than we have adds one.
const howellPairs = new Map();
for (const h of howell.filter((h) => !report.dropHowell.has(h))) {
  const k = [h.home, h.away].sort().join('|');
  (howellPairs.get(k) ?? howellPairs.set(k, []).get(k)).push({ ep: epOf(h.date), se: h.se, home: h.home, away: h.away, hs: h.hs, as: h.as });
}
const payloadDisagree = [];
function beyondPayload(list) {
  const by = new Map();
  for (const g of list) { const k = `${[g.home, g.away].sort().join('|')}|${g.se}`; (by.get(k) ?? by.set(k, []).get(k)).push(g); }
  const out = [];
  for (const gs of by.values()) {
    const { home, away, se } = gs[0];
    const pk = [home, away].sort().join('|');
    const existing = ((se < 1936 ? howellPairs : payloadPairs).get(pk) ?? []).filter((x) => x.se === se);
    const free = new Set(existing);
    const pts = (x, id) => (x.home === id ? x.hs : x.as);
    const fresh = [];
    for (const g of gs) {
      const m = [...free].find((x) => Math.abs(x.ep - epOf(g.date)) <= 4) ?? [...free].find((x) => pts(x, g.home) === g.hs && pts(x, g.away) === g.as);
      if (m) free.delete(m); else fresh.push(g);
    }
    fresh.forEach((g, i) => (i < free.size ? payloadDisagree.push(g) : out.push(g)));
  }
  return out;
}
const wp = beyondPayload(wp0);
console.log(`Wikipedia season articles: ${wp.length} of ${wp0.length} two-sided games are new to jhowell.net and the payload`);
const g = { se: [], ep: [], hi: [], ai: [], hs: [], as: [], fl: [], src: [] };
const ids = [...fbs].sort();
const idx = new Map(ids.map((id, i) => [id, i]));
const SOURCES = ['jhowell.net team pages', 'Wikipedia season articles', 'Wikipedia rivalry articles'];
const kept = [...howell.filter((h) => !report.dropHowell.has(h)), ...wp];
const riv = rivalryAdds({ fbs, payload, ours: kept, inPayload });
// data/ref/series-rulings.json: a team's seasons that were another school's, and Howell's wrong joins
const rulingsFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ref', 'series-rulings.json'), 'utf8'));
const near = (a, b, days) => Math.abs(epOf(a) - epOf(b)) <= days;
const isPair = (g, a, b) => (g.home === a && g.away === b) || (g.home === b && g.away === a);
const ruledOut = (g) => rulingsFile.programs.some((p) => (g.home === p.team || g.away === p.team) && g.se < p.before
    && !(p.except ?? []).some((e) => isPair(g, p.team, e.opp) && near(g.date, e.date, 7)))
  || rulingsFile.drop.some((d) => isPair(g, d.a, d.b) && near(g.date, d.date, 3));
const replacedPair = (g) => riv.replaced.has([g.home, g.away].sort().join('|'));
// a trusted table's games before 1936 stand in for Howell's, so they aren't checked against his
const merged = [...kept.filter((g) => !replacedPair(g)), ...riv.games.filter((g) => replacedPair(g) && g.se < 1936), ...beyondPayload(riv.games.filter((g) => !(replacedPair(g) && g.se < 1936)))];
fs.writeFileSync(path.join(ROOT, 'data', 'build', 'series-payload-disagree.json'), JSON.stringify(payloadDisagree.map((g) => ({ ...g, existing: ((g.se < 1936 ? howellPairs : payloadPairs).get([g.home, g.away].sort().join('|')) ?? []).filter((x) => x.se === g.se) })), null, 1));
console.log(`${payloadDisagree.length} games a source dates or scores another way than jhowell.net or the payload, in a season they have the pair (data/build/series-payload-disagree.json)`);
// the running season's games are the payload's alone: the scheduled refresh adds them, so one
// here would be counted twice on the live site
const all = merged.filter((g) => !ruledOut(g) && g.se < payload.currentSeason).sort((a, b) => a.date.localeCompare(b.date));
console.log(`rulings: ${merged.filter(ruledOut).length} games out (another school's seasons, Howell's wrong joins)`);
for (const r of all) {
  g.se.push(r.se); g.ep.push(epOf(r.date)); g.hi.push(idx.get(r.home)); g.ai.push(idx.get(r.away)); g.hs.push(r.hs); g.as.push(r.as); g.fl.push(r.neutral ? 1 : 0); g.src.push(r.src === 'howell' ? 0 : r.src === 'rivalry' ? 2 : 1);
}
// the rulings: Wikipedia's marks, then data/ref/series-rulings.json's, which win
const manual = rulingsFile.games;
const ru = { ep: [], a: [], b: [], w: [] };
const allRulings = [...wpRulings, ...riv.rulings.filter((r) => !wpRulings.some((w) => [w.a, w.b].sort().join() === [r.a, r.b].sort().join() && Math.abs(epOf(w.date) - epOf(r.date)) <= 3))];
const sameGame = (x, y) => [x.a, x.b].sort().join() === [y.a, y.b].sort().join() && Math.abs(epOf(x.date) - epOf(y.date)) <= 3;
for (const r of [...manual, ...allRulings.filter((r) => !manual.some((m) => sameGame(m, r)))]) {
  if (r.void) continue;
  ru.ep.push(epOf(r.date)); ru.a.push(idx.get(r.a)); ru.b.push(idx.get(r.b)); ru.w.push(r.w ? idx.get(r.w) : -1);
}
fs.writeFileSync(OUT, JSON.stringify({ v: 2, sources: SOURCES, teams: ids, games: g, rulings: ru }) + '\n');
fs.writeFileSync(path.join(ROOT, 'data', 'research', 'series-rulings-wikipedia.json'), JSON.stringify(allRulings, null, 0).replace(/\},\{/g, '},\n{') + '\n');
fs.writeFileSync(path.join(ROOT, 'data', 'research', 'series-early-wikipedia.json'), JSON.stringify([...wp, ...riv.games].map((r) => ({ date: r.date, home: r.home, away: r.away, score: `${r.hs}-${r.as}`, neutral: r.neutral || undefined, refs: r.refs })), null, 0).replace(/\},\{/g, '},\n{') + '\n');
console.log(`series-early: ${g.se.length} games (${howell.length - report.dropHowell.size} jhowell.net, ${wp.length} Wikipedia season articles, ${riv.games.length} rivalry articles), ${ru.ep.length} rulings, ${Math.min(...g.se)}-${Math.max(...g.se)}`);

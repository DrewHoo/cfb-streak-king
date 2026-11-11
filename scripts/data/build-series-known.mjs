// The series pages' known answers: each Wikipedia rivalry article's infobox
// (first meeting, latest meeting, total meetings, all-time series), for two
// teams in FBS now, with the infobox lines quoted as receipts.
//
//   node scripts/data/build-series-known.mjs
//
// Reads data/raw/wikipedia/rivalries.json (fetch-wp-rivalries.mjs) and writes
// data/ref/series-known.json, which series.known.test.ts checks every series
// page against ("famous numbers match" in CLAUDE.md). Where an infobox gives
// two answers (Florida–Georgia "104 (per Florida) 105 (per Georgia)"), both
// are kept; the series page counts every game either school counts.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/util.mjs';
import { lookup, slug } from '../lib/names.mjs';
import { templates, params, link, dateOf } from '../lib/wpSchedule.mjs';
import { rivalryGames } from '../lib/wpRivalry.mjs';

const RAW = path.join(ROOT, 'data', 'raw', 'wikipedia');
const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'payload.json'), 'utf8'));
const fbs = new Set(payload.teams.filter((t) => (t.major ?? []).some(([, b]) => b >= payload.currentSeason)).map((t) => t.id));
const programs = JSON.parse(fs.readFileSync(path.join(RAW, 'programs.json'), 'utf8'));
const progIdx = new Map(Object.entries(programs).map(([id, p]) => [slug(p.program.replace(/ football$/, '')), id]));

const teamOf = (raw) => {
  const l = link(raw);
  for (const name of [l.target?.replace(/ football$/, ''), l.text, l.plain]) {
    if (!name) continue;
    const id = progIdx.get(slug(name)) ?? lookup(name);
    if (id) return id;
  }
  return null;
};
// the text a reader sees: links and templates flattened, <br> as a line break
const shown = (s) => s.replace(/<br\s*\/?>/gi, ' / ').replace(/\{\{\s*win\s*pct\s*\|\s*(\d+)\s*\|\s*(\d+)\s*(?:\|\s*(\d+))?[^{}]*\}\}/gi, (_, w, l, t) => (t ? `${w}–${l}–${t}` : `${w}–${l}`)).replace(/\{\{\s*(?:winning percentage|Winning percentage)[^{}]*\}\}/g, '').replace(/<ref[\s\S]*?(?:<\/ref>|\/>)/g, '').replace(/\{\{\s*(?:nowrap|nobr|small)\s*\|([^{}|]*)\}\}/gi, '$1').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/\{\{[^{}]*\}\}/g, '').replace(/'''?/g, '').replace(/\s+/g, ' ').trim();
const yearOf = (s) => Number(/\b(1[89]\d\d|20\d\d)\b/.exec(s)?.[1] ?? NaN);

// the table's games since August of the running season, from a's side
function recentOf(text, a, b, f) {
  const from = `${payload.currentSeason}-08-01`;
  const t1 = teamOf(f.team1 ?? '');
  const tables = rivalryGames(text).filter((t) => t.games.length);
  const want = Math.max(0, ...[...shown(f.total_meetings ?? '').matchAll(/\b(\d{1,3})\b/g)].map((m) => Number(m[1])));
  const t = tables.sort((x, y) => Math.abs(x.games.length - want) - Math.abs(y.games.length - want))[0];
  if (!t) return [];
  const aNames = (t1 === b ? t.team2 : t.team1).split(/\s*\/\s*/).map(slug);
  return t.games.filter((g) => g.date && g.date >= from).map((g) => {
    const firstIsA = aNames.some((n) => slug(g.a).startsWith(n) || n.startsWith(slug(g.a))) || lookup(g.a) === a;
    return [g.date, firstIsA ? g.as : g.bs, firstIsA ? g.bs : g.as, g.win];
  });
}

const out = [];
const skipped = [];
for (const p of JSON.parse(fs.readFileSync(path.join(RAW, 'rivalries.json'), 'utf8'))) {
  const ib = templates(p.text, 'Infobox sports rivalry')[0] ?? templates(p.text, 'Infobox college sports rivalry')[0];
  if (!ib) continue;
  const f = params(ib);
  // a football infobox: a multi-sport rivalry's counts aren't football's
  if (f.sport && !/football/i.test(f.sport)) { skipped.push(`${p.title}: sport ${shown(f.sport)}`); continue; }
  const a = teamOf(f.team1 ?? ''), b = teamOf(f.team2 ?? '');
  if (!a || !b || a === b) { skipped.push(`${p.title}: ${f.team1} / ${f.team2}`); continue; }
  if (!fbs.has(a) || !fbs.has(b)) continue;
  // "1900 (track and field) / 1904 (football)": football's part when it says so
  const footballOnly = (q) => (/football/i.test(q) && / \/ /.test(q) ? q.split(' / ').filter((x) => /football/i.test(x)).join(' / ') : q);
  const first = footballOnly(shown(f.first_meeting ?? '')), latest = shown(f.latest_meeting ?? ''), total = footballOnly(shown(f.total_meetings ?? '')), series = footballOnly(shown(f.all_time_series ?? ''));
  const firstDates = [...first.matchAll(/([A-Z][a-z]+\.? \d{1,2}, \d{4})/g)].map((m) => dateOf(m[1], yearOf(m[1])));
  out.push({
    title: p.title,
    url: `https://en.wikipedia.org/w/index.php?oldid=${p.revid}`,
    a, b,
    first: { quote: first, dates: firstDates.length ? firstDates : null, years: [...first.matchAll(/\b(1[89]\d\d|20\d\d)\b/g)].map((m) => Number(m[1])) },
    latest: { quote: latest, date: (() => { const m = /([A-Z][a-z]+\.? \d{1,2}, \d{4})/.exec(latest); return m ? dateOf(m[1], yearOf(m[1])) : null; })() },
    meetings: { quote: total, n: [...total.matchAll(/\b(\d{1,3})\b/g)].map((m) => Number(m[1])) },
    series: { quote: series },
    // the results table's games of the running season, so the test can take off the infobox's
    // numbers the ones after the payload ends: [date, a's points, b's points, winN]
    recent: recentOf(p.text, a, b, f),
  });
}
out.sort((x, y) => x.title.localeCompare(y.title));
// one row per pair: a pair with two articles keeps the first
const seen = new Set();
const rows = out.filter((r) => { const k = [r.a, r.b].sort().join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
fs.writeFileSync(path.join(ROOT, 'data', 'ref', 'series-known.json'), JSON.stringify({ source: 'Wikipedia rivalry articles, infobox lines quoted', rows }, null, 1) + '\n');
console.log(`series-known: ${rows.length} pairs of FBS teams; ${skipped.length} articles whose teams didn't resolve`);
if (skipped.length) console.log(skipped.slice(0, 30).join('\n'));

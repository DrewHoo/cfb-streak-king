// "Famous numbers match" (CLAUDE.md): every series with a Wikipedia rivalry
// article reads the way the article's infobox counts it. data/ref/series-known.json
// holds the infobox lines (scripts/data/build-series-known.mjs). Where an
// infobox gives each school's count, the page has every game either school
// counts, so it matches the larger. A difference we've ruled on is a row in
// data/ref/series-rulings.json's `known`, with its receipt.

import { describe, expect, test } from 'vitest';
import known from '../../data/ref/series-known.json';
import rulings from '../../data/ref/series-rulings.json';
import { teams, fbsNow, gamesOf } from './model.ts';
import { seriesOf } from './series.ts';
import { lookup } from '../../scripts/lib/names.mjs';

const idx = (id: string) => teams.findIndex((t) => t.id === id);
const iso = (ep: number) => new Date(ep * 86400000).toISOString().slice(0, 10);
const ruled = new Map((rulings as { known: { title: string; field: string; ours: string }[] }).known.map((r) => [`${r.title}|${r.field}`, r.ours]));

// "Alabama leads, 60–41–7" / "Series tied 45–45–3": the readings, the one with the most games last
function records(quote: string, a: string, b: string): { rec: [number, number, number] }[] {
  const out: { rec: [number, number, number]; n: number }[] = [];
  for (const m of quote.matchAll(/(?:([A-Z][\w.&' ()–-]*?)(?:\s+leads?,?|:)|tied,?)\s*(\d+)\s*[–-]\s*(\d+)(?:\s*[–-]\s*(\d+))?/g)) {
    const [w, l, t] = [Number(m[2]), Number(m[3]), Number(m[4] ?? 0)];
    const leader = m[1] ? lookup(m[1].replace(/^(?:Series|The series)\s*/i, '').trim()) : null;
    // a leader we can't name ("WMU leads") reads either way round
    const recs: [number, number, number][] = leader === b ? [[l, w, t]] : leader === a ? [[w, l, t]] : [[w, l, t], [l, w, t]];
    for (const rec of recs) out.push({ rec, n: w + l + t });
  }
  // a bare record leading the line ("87–18–3 / Alabama leads 89–17–3 on the field"): no leader named
  const bare = /^\s*(\d+)\s*[–-]\s*(\d+)\s*[–-]\s*(\d+)\b/.exec(quote);
  if (bare) { const [w, l, t] = bare.slice(1).map(Number); out.push({ rec: [w, l, t], n: w + l + t }, { rec: [l, w, t], n: w + l + t }); }
  return out.sort((x, y) => x.n - y.n);
}

const rows = (known as unknown as { rows: { title: string; a: string; b: string; first: { dates: string[] | null; years: number[] }; latest: { date: string | null }; meetings: { n: number[] }; series: { quote: string }; recent: [string, number, number, string | null][] }[] }).rows;
// the payload's last game: an infobox can count a meeting since, which the table's recent games take off
let lastEp = 0;
for (const ti of fbsNow) for (const g of gamesOf(ti)) if (g.ep > lastEp) lastEp = g.ep;
const lastDay = iso(lastEp);

describe('series pages match the rivalry articles', () => {
  const misses: string[] = [];
  for (const k of rows) {
    const s = seriesOf(idx(k.a), idx(k.b));
    if (!s) { misses.push(`${k.title}: no series`); continue; }
    // a Thursday-night game can carry the next day's date in the payload
    // (an infobox's latest meeting can lag its count; the table's newest game says how far it counts)
    const latest = [k.latest.date, ...k.recent.map(([d]) => d)].filter(Boolean).sort().at(-1) as string | undefined;
    const upTo = latest ? iso(Date.parse(`${latest}T00:00:00Z`) / 86400000 + 2) : '9999';
    const games = s.games.filter((g) => iso(g.ep) <= upTo && iso(g.ep) <= lastDay);
    // the meetings since the payload ends, from a's side: [W, L, T] to take off the infobox
    const after = k.recent.filter(([d]) => d > lastDay && d <= upTo);
    const off = [0, 0, 0];
    for (const [, x, y, win] of after) if (!/vacat/i.test(win ?? '')) off[x > y ? 0 : x < y ? 1 : 2]++;
    const check = (field: string, ours: string, theirs: string[]) => {
      if (theirs.length && !theirs.includes(ours) && ruled.get(`${k.title}|${field}`) !== ours) misses.push(`${k.title}: ${field} ours ${ours}, article ${theirs.join(' or ')}`);
    };
    const firstDates = k.first.dates?.filter(Boolean) ?? [];
    // the year of the first meeting: two sources' dates for an 1890s game can differ by days
    const years = firstDates.length ? firstDates.map((d) => d.slice(0, 4)) : k.first.years.map(String);
    check('first', iso(s.games[0].ep).slice(0, 4), years.length ? [years.sort()[0]] : []);
    check('meetings', String(games.length), k.meetings.n.length ? [String(Math.max(...k.meetings.n) - after.length)] : []);
    const recs = records(k.series.quote, k.a, k.b);
    const rec = [0, 0, 0];
    for (const g of games) if (g.ruling !== 'vacated') rec[g.r === 'W' ? 0 : g.r === 'L' ? 1 : 2]++;
    // any reading the infobox gives: the official one, the field one, each school's
    check('record', rec.join('-'), recs.map((r) => r.rec.map((v, i) => v - off[i]).join('-')));
  }
  test(`${rows.length} rivalries`, () => {
    expect(misses).toEqual([]);
  });
});

// The series pages' games that neither jhowell.net nor the payload has: two
// teams in FBS now, in a season when neither was major (before Howell counts
// a school as major, or before its FBS stint), read from the Wikipedia season
// articles scripts/data/fetch-wp-seasons.mjs saves.
//
// A game counts when both teams' articles for the season list it, or when the
// other team has no article with a schedule that season. A game one article
// lists and the other team's schedule leaves out is reported, not counted.
// The same check runs on Howell's games: one that a team's article for the
// season leaves out is reported: a lead for a ruling in data/ref/series-rulings.json
// (Howell's 1904 "Florida" is Florida Agricultural College).

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir } from './util.mjs';
import { lookup, slug } from './names.mjs';
import { scheduleOf } from './wpSchedule.mjs';

const RAW = path.join(ROOT, 'data', 'raw', 'wikipedia');
const DAY = 86400000;
const dayOf = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
const NEAR = 4;
const seasonOf = (iso) => { const [y, m] = iso.split('-').map(Number); return m <= 2 ? y - 1 : y; }; // days two sources' dates may differ by and still be one game

export function wikipediaGames({ fbs, payload, inPayload }) {
  const howell = arguments[0].howell ?? [];
  const majorIn = new Map(payload.teams.map((t) => [t.id, t.major ?? []]));
  const isMajor = (id, se) => (majorIn.get(id) ?? []).some(([a, b]) => se >= a && se <= b);
  // a game the series page already has: before 1936 Howell's, a season either team was major; since,
  // the payload's, from the season a team's latest major stint began (windowStartOf in createModel.ts)
  const windowStart = (id) => Math.max(1936, (majorIn.get(id) ?? []).at(-1)?.[0] ?? 1936);
  const covered = (a, b, se) => (se < 1936 ? isMajor(a, se) || isMajor(b, se) : se >= windowStart(a) || se >= windowStart(b));

  const programs = JSON.parse(fs.readFileSync(path.join(RAW, 'programs.json'), 'utf8'));
  const titleIdx = new Map(); // season article title -> team
  const progIdx = new Map(); // program name slug -> team
  const articles = new Map(); // `${id}|${se}` -> { title, revid, games }
  for (const id of fbs) {
    if (programs[id]) progIdx.set(slug(programs[id].program.replace(/ football$/, '')), id);
    const file = path.join(RAW, 'seasons', `${id}.json`);
    if (!fs.existsSync(file)) continue;
    for (const p of JSON.parse(fs.readFileSync(file, 'utf8'))) {
      const se = Number(p.title.slice(0, 4));
      titleIdx.set(p.title, id);
      const { games } = scheduleOf(p.text, se);
      const key = `${id}|${se}`;
      // a team with two articles in one season (a split program) keeps both schedules
      const prev = articles.get(key);
      articles.set(key, prev ? { ...prev, games: [...prev.games, ...games.map((g) => ({ ...g, title: p.title, revid: p.revid }))] } : { title: p.title, revid: p.revid, games: games.map((g) => ({ ...g, title: p.title, revid: p.revid })) });
    }
  }
  const missingTeams = [...fbs].filter((id) => !programs[id] || !fs.existsSync(path.join(RAW, 'seasons', `${id}.json`)));

  const clean = (s) => s.replace(/^(?:at|vs\.?|@)\s+/i, '').replace(/^(?:no\.\s*)?#?\d+\s+/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  // which FBS team a schedule row's opponent is, or null
  function oppOf(opp) {
    if (opp.target) {
      if (titleIdx.has(opp.target)) return titleIdx.get(opp.target);
      const m = /^\d{4}(?:[–-]\d{2,4})? (.+?) football team$/.exec(opp.target);
      const name = m ? m[1] : opp.target.replace(/ football$/, '');
      return progIdx.get(slug(name)) ?? lookup(name) ?? lookup(clean(opp.text));
    }
    return lookup(clean(opp.text));
  }

  // every row between two FBS teams, from each article
  const rows = [];
  let undated = 0;
  for (const [key, art] of articles) {
    const [id, seS] = key.split('|');
    const se = Number(seS);
    for (const g of art.games) {
      const opp = oppOf(g.opp);
      if (!opp || opp === id || !fbs.has(opp)) continue;
      rows.push({ ...g, team: id, opp, se });
    }
  }

  // forfeits and vacated wins, from either side's article: { date, a, b, w } with
  // w the forfeit's winner or null for a vacated win
  const rulings = [];
  for (const r of rows) {
    if (!r.ruling) continue;
    const w = r.ruling === 'vacated' ? null : r.wl === 'w' ? r.team : r.wl === 'l' ? r.opp : null;
    if (r.ruling === 'forfeit' && !w) continue;
    const dup = rulings.find((x) => [x.a, x.b].sort().join() === [r.team, r.opp].sort().join() && Math.abs(dayOf(x.date) - dayOf(r.date)) <= NEAR);
    if (dup) { dup.refs.push(`${r.title}@${r.revid}`); continue; }
    rulings.push({ date: r.date, a: r.team, b: r.opp, w, refs: [`${r.title}@${r.revid}`] });
  }

  // pair the two sides' rows into games
  const byPair = new Map();
  for (const r of rows) {
    // by pair, not season: a February game is in one school's article for the season before
    const k = [r.team, r.opp].sort().join('|');
    (byPair.get(k) ?? byPair.set(k, []).get(k)).push(r);
  }
  const games = [];
  const report = { oneSided: [], scoreDisagree: [], undated, missingTeams, howellMissing: [], dropHowell: new Set(), suspect: [] };
  const hasSchedule = (id, se) => (articles.get(`${id}|${se}`)?.games.length ?? 0) > 0;
  const wpGames = []; // every two-team game Wikipedia has, for the Howell check
  for (const rs of byPair.values()) {
    const used = new Set();
    for (const r of rs) {
      if (used.has(r)) continue;
      used.add(r);
      const o = rs.find((x) => !used.has(x) && x.team === r.opp && x.date && r.date && Math.abs(dayOf(x.date) - dayOf(r.date)) <= NEAR)
        ?? rs.find((x) => !used.has(x) && x.team === r.opp && x.us === r.them && x.them === r.us && Math.abs(x.se - r.se) <= 1 && (!x.date || !r.date || Math.abs(dayOf(x.date) - dayOf(r.date)) <= 60 || Math.abs(Math.abs(dayOf(x.date) - dayOf(r.date)) - 365) <= 2));
      if (o) used.add(o);
      // a row without a readable date takes the other article's, or can only confirm a game
      // a spring game with no year in its article: the season before's reading is the right one, so the earlier date
      const date = r.date && o?.date ? (r.date < o.date ? r.date : o.date) : r.date ?? o?.date;
      if (!date) { undated++; wpGames.push({ se: r.se, date: null, home: r.site === 'away' ? r.opp : r.team, away: r.site === 'away' ? r.team : r.opp, hs: r.site === 'away' ? r.them : r.us, as: r.site === 'away' ? r.us : r.them }); continue; }
      const home = r.site === 'away' ? r.opp : r.team, away = home === r.team ? r.opp : r.team;
      const [hs, as] = home === r.team ? [r.us, r.them] : [r.them, r.us];
      const game = { se: r.se, date, home, away, hs, as, neutral: r.site === 'neutral', refs: [`${r.title}@${r.revid}`, ...(o ? [`${o.title}@${o.revid}`] : [])] };
      if (o) {
        const [ohs, oas] = home === o.team ? [o.us, o.them] : [o.them, o.us];
        if (ohs !== hs || oas !== as) report.scoreDisagree.push({ ...game, other: `${ohs}-${oas}` });
      }
      wpGames.push(game);
      // the other article's row that day with the mirror score confirms it, however it names the
      // opponent (Utah's 1909 article has "Utah Agricultural" as plain text)
      const mirror = (se) => (articles.get(`${r.opp}|${se}`)?.games ?? []).some((x) => x.date && Math.abs(dayOf(x.date) - dayOf(date)) <= NEAR && x.us === r.them && x.them === r.us);
      if (!o && !mirror(r.se) && !mirror(seasonOf(date)) && (hasSchedule(r.opp, r.se) || hasSchedule(r.opp, seasonOf(date)))) { report.oneSided.push(game); continue; }
      // a candidate: build-series-early keeps it unless jhowell.net or the payload already has it
      games.push({ ...game, src: 'wikipedia' });
    }
  }

  // Howell's games against Wikipedia's
  const wpBy = new Map();
  for (const g of wpGames) {
    const k = [g.home, g.away].sort().join('|');
    (wpBy.get(k) ?? wpBy.set(k, []).get(k)).push(g);
  }
  for (const h of howell) {
    const k = [h.home, h.away].sort().join('|');
    // the same game: within a few days, or the same season and each team's score (Howell's and
    // Wikipedia's dates for an 1900s game can be weeks apart)
    const pts = (g, id) => (g.home === id ? g.hs : g.as);
    const near = (wpBy.get(k) ?? []).some((g) => (g.date && Math.abs(dayOf(g.date) - dayOf(h.date)) <= NEAR)
      || (g.se === h.se && pts(g, h.home) === h.hs && pts(g, h.away) === h.as));
    if (near) continue;
    // a team whose article for the season has a schedule and lists no game with the other
    const silent = [h.home, h.away].filter((id) => hasSchedule(id, h.se));
    // a lead for a ruling, not a drop: the article may name the school another way (Howell's
    // 1911 "Springfield Normal" is Missouri State) or score the game another way
    if (silent.length) report.suspect.push({ ...h, silent });
    else report.howellMissing.push(h);
  }

  ensureDir(path.join(ROOT, 'data', 'build'));
  fs.writeFileSync(path.join(ROOT, 'data', 'build', 'series-wikipedia-report.json'), JSON.stringify({ ...report, dropHowell: undefined }, null, 1));
  console.log(`Wikipedia: ${articles.size} season articles, ${rows.length} rows between FBS teams, ${games.length} games neither source had, ${rulings.length} forfeits or vacated wins; ${report.oneSided.length} one-sided (left out), ${report.scoreDisagree.length} whose two articles disagree on the score, ${undated} undated rows; ${report.suspect.length} jhowell.net games an article for the season leaves out (data/build/series-wikipedia-report.json's suspect), ${report.howellMissing.length} with no article to check; no articles for ${missingTeams.join(', ') || 'none'}`);
  return { games, rulings, report };
}

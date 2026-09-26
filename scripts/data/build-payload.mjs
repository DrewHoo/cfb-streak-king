// Join every parsed source into the static payload.
//   data/payload-base.json  — seasons 1978-2025, teams, rivalries, conf table.
//                             Committed; CI never needs the raw sources.
//   (build-current.mjs layers the in-progress season on top at build time.)
//
// Payload shape (columnar; one index per completed game):
//   teams:   [{ id, name, fbs:[[a,b]...]|null, st?, tz?, conf?:[[year,confIdx]...] }]
//   confs:   ["SEC", ...]
//   rivals:  [{ n, a, b }]           (a/b = team indices)
//   games:   { se, ep, hi, ai, hs, as, fl, sp, hr, ar, hh, rv }  parallel arrays
//     se season; ep epoch day (UTC) of the local game date; hi/ai team idx;
//     hs/as final scores; fl bits: 1 neutral, 2 confGame, 4 postseason;
//     sp homeSpread*2 (negative = home favored) or 9999 unlined;
//     hr/ar AP rank 1-25 at kickoff, 0 unranked; hh local start hour, 31 unknown;
//     rv 1+rivalry idx, 0 none.
// Known-answer checks at the end assert famous streaks reproduce.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir } from '../lib/util.mjs';
import { display } from '../lib/names.mjs';
import { currentStreak } from '../../src/lib/streaks.js';

const BUILD = path.join(ROOT, 'data', 'build');
const load = (f) => JSON.parse(fs.readFileSync(path.join(BUILD, f), 'utf8'));
const loadRef = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ref', f), 'utf8'));

const spine = load('spine-1978-2013.json');
const sched = load('schedules-2002-2026.json');
const { conf: jhConf, confGames: jhMarks } = load('jhowell.json');
const fbsSpans = load('fbs-spans.json');
const rivalries = load('rivalries.json');
const polls = load('polls.json');
const teamInfo = loadRef('team-info.json').teams;
const linesCfbd = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ref', 'lines-cfbd.json'), 'utf8'));

const LAST_BASE_SEASON = 2025;

// ---------- helpers ----------
const epochDay = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const isFbs = (id, season) => (fbsSpans[id] ?? []).some(([a, b]) => a <= season && b >= season);

// conference name normalization
const CONF_MAP = new Map(Object.entries({
  'SEC': 'SEC', 'Southeastern': 'SEC',
  'Big Ten': 'Big Ten', 'Big 10': 'Big Ten',
  'Big 12': 'Big 12', 'Big XII': 'Big 12',
  'Big 8': 'Big 8', 'Big Eight': 'Big 8',
  'SWC': 'SWC', 'Southwest': 'SWC',
  'ACC': 'ACC', 'Atlantic Coast': 'ACC',
  'Pac-12': 'Pac-12', 'Pac-10': 'Pac-12', 'Pac 10': 'Pac-12', 'Pac 12': 'Pac-12', 'Pac-8': 'Pac-12', 'Pacific 10': 'Pac-12', 'Pacific-10': 'Pac-12', 'Pacific 8': 'Pac-12', 'Pacific Coast': 'Pac-12',
  'Big East': 'Big East',
  'American Athletic': 'American', 'American': 'American', 'AAC': 'American',
  'WAC': 'WAC', 'Western Athletic': 'WAC',
  'Mountain West': 'Mountain West', 'MWC': 'Mountain West',
  'Conference USA': 'C-USA', 'C-USA': 'C-USA', 'CUSA': 'C-USA',
  'MAC': 'MAC', 'Mid-American': 'MAC',
  'Sun Belt': 'Sun Belt',
  'Big West': 'Big West', 'PCAA': 'Big West', 'Pacific Coast Athletic': 'Big West',
  'Missouri Valley': 'MVC', 'MVC': 'MVC',
  'Independent': 'Independent', 'FBS Independents': 'Independent', 'Independents': 'Independent', 'I-A Independents': 'Independent', 'Division I-A Independents': 'Independent',
  'Southern': 'Southern', 'Ivy League': 'Ivy', 'Ivy': 'Ivy', 'Southland': 'Southland',
}));
const confMisses = new Map();
function normConf(name) {
  if (!name) return null;
  const hit = CONF_MAP.get(name.trim());
  if (hit) return hit;
  confMisses.set(name, (confMisses.get(name) ?? 0) + 1);
  return name.trim();
}

// conference by (team, season): schedules columns 2006+, jhowell before
const confBy = new Map(); // `${id}|${season}` -> conf display
for (const [id, byYear] of Object.entries(jhConf))
  for (const [y, c] of Object.entries(byYear)) confBy.set(`${id}|${y}`, normConf(c));
for (const r of sched) {
  if (r.season < 2006) continue;
  if (r.homeConf) confBy.set(`${r.home}|${r.season}`, normConf(r.homeConf));
  if (r.awayConf) confBy.set(`${r.away}|${r.season}`, normConf(r.awayConf));
}
const confOf = (id, season) => confBy.get(`${id}|${season}`) ?? null;

// polls: per season, ascending by date -> [epochDay, Map(team->rank)]
const pollsBySeason = new Map();
for (const p of polls) {
  const arr = pollsBySeason.get(p.season) ?? [];
  arr.push([epochDay(p.date), new Map(p.ranks.map((r) => [r.team, r.rank]))]);
  pollsBySeason.set(p.season, arr);
}
for (const arr of pollsBySeason.values()) arr.sort((a, b) => a[0] - b[0]);
function rankOf(id, season, ep) {
  const arr = pollsBySeason.get(season);
  if (!arr) return 0;
  let cur = null;
  for (const [d, m] of arr) {
    if (d > ep) break;
    cur = m;
  }
  return cur?.get(id) ?? 0;
}

// local kickoff (date + hour) from a UTC instant using the home team's zone
const dtfCache = new Map();
function localParts(utcIso, tz) {
  const zone = tz ?? 'America/Chicago';
  let dtf = dtfCache.get(zone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hour12: false,
    });
    dtfCache.set(zone, dtf);
  }
  const parts = Object.fromEntries(dtf.formatToParts(new Date(utcIso)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}

// lines-cfbd join map for 2014+ spreads
const lineBy = new Map();
for (const l of linesCfbd) {
  if (l.homeSpread == null) continue;
  const ep = epochDay(l.date);
  for (const d of [ep - 1, ep, ep + 1]) lineBy.set(`${l.home}|${l.away}|${d}`, l.homeSpread);
}

// schedules join map (2002-2013 enrichment of the repole spine)
const schedBy = new Map();
for (const r of sched) {
  if (!r.completed || !r.start) continue;
  const { date, hour } = localParts(r.start, teamInfo[r.home]?.tz);
  r._localDate = date;
  r._localHour = r.timeKnown ? hour : 31;
  const ep = epochDay(date);
  for (const d of [ep - 1, ep, ep + 1]) {
    const k = `${r.home}|${r.away}|${d}`;
    if (!schedBy.has(k) || d === ep) schedBy.set(k, r);
  }
}

// ESPN ids (for logos): latest id seen per team in the schedules
const espnBy = new Map();
for (const r of sched) {
  if (r.espnHome) espnBy.set(r.home, r.espnHome);
  if (r.espnAway) espnBy.set(r.away, r.espnAway);
}

// jhowell conference-game marks: `${year}|${team}|${M/D}|${opp}` (both orders)
const jhMarkSet = new Set(jhMarks);
function jhConfGame(season, dateIso, home, away) {
  const md = `${+dateIso.slice(5, 7)}/${+dateIso.slice(8, 10)}`;
  return jhMarkSet.has(`${season}|${home}|${md}|${away}`) || jhMarkSet.has(`${season}|${away}|${md}|${home}`);
}

// ---------- assemble completed games ----------
const teamsIdx = new Map(); // id -> idx
const teams = [];
function teamIdx(id, rawName) {
  let i = teamsIdx.get(id);
  if (i !== undefined) return i;
  i = teams.length;
  teamsIdx.set(id, i);
  teams.push({
    id,
    name: id.startsWith('x:') ? rawName : display(id),
    fbs: fbsSpans[id] ?? null,
    st: teamInfo[id]?.state,
    espn: espnBy.get(id) ?? null,
  });
  return i;
}

const cols = { se: [], ep: [], hi: [], ai: [], hs: [], as: [], fl: [], sp: [], hr: [], ar: [], hh: [], rv: [] };
const rivalByPair = new Map(rivalries.map((r, i) => [[r.a, r.b].sort().join('|'), i]));
let joined0213 = 0;
let total0213 = 0;

function pushGame({ season, dateIso, home, away, homeRaw, awayRaw, hs, as, neutral, postseason, confGame, homeSpread, startHour }) {
  const ep = epochDay(dateIso);
  cols.se.push(season);
  cols.ep.push(ep);
  cols.hi.push(teamIdx(home, homeRaw));
  cols.ai.push(teamIdx(away, awayRaw));
  cols.hs.push(hs);
  cols.as.push(as);
  cols.fl.push((neutral ? 1 : 0) | (confGame ? 2 : 0) | (postseason ? 4 : 0));
  cols.sp.push(homeSpread == null ? 9999 : Math.round(homeSpread * 2));
  cols.hr.push(rankOf(home, season, ep));
  cols.ar.push(rankOf(away, season, ep));
  cols.hh.push(startHour ?? 31);
  const rv = rivalByPair.get([home, away].sort().join('|'));
  cols.rv.push(rv === undefined ? 0 : rv + 1);
}

// 1978-2013 from repole, enriched from schedules 2002+
for (const g of spine) {
  if (!isFbs(g.home, g.season) && !isFbs(g.away, g.season)) continue;
  let startHour = 31;
  if (g.season >= 2002) {
    total0213++;
    const ep = epochDay(g.date);
    const s = schedBy.get(`${g.home}|${g.away}|${ep}`);
    if (s) {
      joined0213++;
      startHour = s._localHour;
    }
  }
  const confGame =
    g.season <= 2008
      ? jhConfGame(g.season, g.date, g.home, g.away)
      : (schedBy.get(`${g.home}|${g.away}|${epochDay(g.date)}`)?.confGameRaw ??
         jhConfGame(g.season, g.date, g.home, g.away));
  pushGame({
    season: g.season, dateIso: g.date, home: g.home, away: g.away,
    homeRaw: g.homeRaw, awayRaw: g.awayRaw, hs: g.homeScore, as: g.awayScore,
    neutral: g.neutral, postseason: g.seasonType === 'postseason',
    confGame, homeSpread: g.homeSpread, startHour,
  });
}

// 2014+ from schedules
for (const r of sched) {
  if (r.season < 2014 || r.season > LAST_BASE_SEASON || !r.completed) continue;
  if (!isFbs(r.home, r.season) && !isFbs(r.away, r.season)) continue;
  if (!Number.isFinite(r.homeScore) || !Number.isFinite(r.awayScore)) continue;
  const dateIso = r._localDate ?? r.start.slice(0, 10);
  const ep = epochDay(dateIso);
  pushGame({
    season: r.season, dateIso, home: r.home, away: r.away,
    homeRaw: r.homeRaw, awayRaw: r.awayRaw, hs: r.homeScore, as: r.awayScore,
    neutral: r.neutral, postseason: r.seasonType === 'postseason',
    confGame: r.confGameRaw,
    homeSpread: lineBy.get(`${r.home}|${r.away}|${ep}`) ?? null,
    startHour: r._localHour ?? 31,
  });
}

// sort all columns by epoch day
const order = cols.ep.map((_, i) => i).sort((a, b) => cols.ep[a] - cols.ep[b] || a - b);
for (const k of Object.keys(cols)) cols[k] = order.map((i) => cols[k][i]);

// conference intervals per team (run-length over seasons)
const confs = [];
const confIdx = new Map();
const cIdx = (name) => {
  if (!confIdx.has(name)) {
    confIdx.set(name, confs.length);
    confs.push(name);
  }
  return confIdx.get(name);
};
for (const t of teams) {
  if (!t.fbs) continue;
  const runs = [];
  for (let y = 1978; y <= 2026; y++) {
    const c = confOf(t.id, y);
    if (!c) continue;
    const ci = cIdx(c);
    const last = runs.at(-1);
    if (last && last[1] === ci && last[2] === y - 1) last[2] = y;
    else runs.push([y, ci, y]);
  }
  t.conf = runs.map(([start, ci, end]) => [start, end, ci]);
}

const payload = {
  v: 1,
  builtAt: new Date().toISOString().slice(0, 10),
  lastBaseSeason: LAST_BASE_SEASON,
  floors: { night: 2002, spread: 1978 },
  confs,
  teams,
  rivals: rivalries.map((r) => ({ n: r.name, a: teamsIdx.get(r.a) ?? -1, b: teamsIdx.get(r.b) ?? -1 })),
  games: cols,
};

ensureDir(path.join(ROOT, 'data'));
fs.writeFileSync(path.join(ROOT, 'data', 'payload-base.json'), JSON.stringify(payload));

// ---------- report ----------
const n = cols.se.length;
const lined = cols.sp.filter((s) => s !== 9999).length;
console.log(`payload-base: ${n} games 1978-${LAST_BASE_SEASON}, ${teams.length} teams (${teams.filter((t) => t.fbs).length} FBS-ever), ${lined} lined (${((lined / n) * 100).toFixed(1)}%)`);
console.log(`2002-2013 schedule join: ${joined0213}/${total0213} (${((joined0213 / total0213) * 100).toFixed(1)}%)`);
console.log(`size: ${(fs.statSync(path.join(ROOT, 'data', 'payload-base.json')).size / 1e6).toFixed(2)} MB`);
if (confMisses.size) {
  console.log('unmapped conference names:');
  for (const [k, v] of [...confMisses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${v}  ${k}`);
}

// ---------- known-answer checks ----------
function gamesFor(teamId, filter) {
  const ti = teamsIdx.get(teamId);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (cols.hi[i] !== ti && cols.ai[i] !== ti) continue;
    const isHome = cols.hi[i] === ti;
    const us = isHome ? cols.hs[i] : cols.as[i];
    const them = isHome ? cols.as[i] : cols.hs[i];
    const g = {
      i, season: cols.se[i], ep: cols.ep[i], isHome,
      neutral: !!(cols.fl[i] & 1), confGame: !!(cols.fl[i] & 2), post: !!(cols.fl[i] & 4),
      oppRank: isHome ? cols.ar[i] : cols.hr[i],
      r: us > them ? 'W' : us < them ? 'L' : 'T',
      opp: teams[isHome ? cols.ai[i] : cols.hi[i]].id,
      date: new Date(cols.ep[i] * 86400000).toISOString().slice(0, 10),
      score: `${us}-${them}`,
    };
    if (!filter || filter(g)) out.push(g);
  }
  return out;
}

// 1. Alabama beat 100 straight unranked opponents, ended 2021-10-09 by Texas A&M.
{
  const g = gamesFor('alabama', (x) => x.oppRank === 0);
  const upTo = g.filter((x) => x.date <= '2021-10-09');
  const s = currentStreak(upTo.slice(0, -1));
  const ender = upTo.at(-1);
  console.log(`\ncheck Alabama vs unranked: ${s.len}W entering 2021-10-09, ender ${ender.opp} ${ender.score} (${ender.r}) — expect 100W, texas-am, L`);
  if (s.len !== 100 || ender.opp !== 'texas-am' || ender.r !== 'L') throw new Error('Alabama check failed');
}
// 2. Kansas lost 46 straight true road games, ended 2018-09-15 at Central Michigan.
{
  const g = gamesFor('kansas', (x) => !x.isHome && !x.neutral);
  const upTo = g.filter((x) => x.date <= '2018-09-16');
  const s = currentStreak(upTo.slice(0, -1));
  const ender = upTo.at(-1);
  console.log(`check Kansas road: ${s.len}L entering 2018-09-15, ender ${ender.opp} ${ender.score} (${ender.r}) — expect 46L, central-michigan, W`);
  if (s.len !== 46 || ender.r !== 'W') throw new Error('Kansas check failed');
}
// 3. Vanderbilt lost 26 straight SEC games, snapped by Kentucky (2022-11-12).
{
  const g = gamesFor('vanderbilt', (x) => x.confGame);
  const upTo = g.filter((x) => x.date <= '2022-11-12');
  const s = currentStreak(upTo.slice(0, -1));
  const ender = upTo.at(-1);
  console.log(`check Vanderbilt SEC: ${s.len}L entering 2022-11-12, ender ${ender.opp} (${ender.r}) — expect 26L, kentucky, W`);
  if (s.len !== 26 || ender.opp !== 'kentucky' || ender.r !== 'W') throw new Error('Vanderbilt check failed');
}
// 4. LSU home night games under the lights: 2002-2008 Saturday-night run (soft check).
{
  const g = gamesFor('lsu', (x) => x.isHome && !x.neutral && !x.post);
  const night = g.filter((x) => {
    const i = x.i;
    return cols.hh[i] !== 31 && cols.hh[i] >= 18 && x.season >= 2002 && x.season <= 2008;
  });
  const losses = night.filter((x) => x.r === 'L');
  console.log(`check LSU home night 2002-2008: ${night.length} games, ${losses.length} losses (report says 28-0 through Oct 2008)`);
}

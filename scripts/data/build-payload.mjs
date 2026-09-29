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
//     rv 1+rivalry idx, 0 none; ot overtime periods, -1 unknown (2001+).
// Known-answer checks at the end assert famous streaks reproduce.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir } from '../lib/util.mjs';
import { display } from '../lib/names.mjs';
import { buildStints, markInterim } from '../lib/coach.mjs';
import { currentStreak } from '../../src/lib/streaks.js';

const BUILD = path.join(ROOT, 'data', 'build');
const load = (f) => JSON.parse(fs.readFileSync(path.join(BUILD, f), 'utf8'));
const loadRef = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ref', f), 'utf8'));

const spine = load('spine-1978-2013.json');
const sched = load('schedules-2002-2026.json');
const { conf: jhConf, confGames: jhMarks, games: jhGames } = load('jhowell.json');
const fbsSpans = load('fbs-spans.json');
const coachSeasonsByTeam = load('coaches.json');
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
    // a poll dated the day of the game already reflects that game (a Monday
    // opener, a Labor Day game): the one in effect at kickoff is the previous
    if (d >= ep) break;
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

// halftime + possession join map (data/build/boxes.json; 2001+/2004+)
const boxBy = new Map();
for (const b of load('boxes.json')) {
  for (const d of [b.ep - 1, b.ep, b.ep + 1]) {
    const k = `${b.home}|${b.away}|${d}`;
    if (!boxBy.has(k) || d === b.ep) boxBy.set(k, b);
  }
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

// Howell's games, keyed by unordered pair + epoch day (±1), oriented to a
// home team: { home, away, hs, as, campus }. campus is false when either
// page names a site city, and Howell's home designation is trusted only on
// campus games (both pages say "vs." for a bowl).
const pairKey = (a, b, ep) => `${[a, b].sort().join('|')}|${ep}`;
const howellBy = new Map();
for (const r of jhGames) {
  const ep = epochDay(r.date);
  const visitor = r.at === '@';
  const row = {
    home: visitor ? r.opp : r.team, away: visitor ? r.team : r.opp,
    hs: visitor ? r.pa : r.pf, as: visitor ? r.pf : r.pa,
    campus: !r.city,
  };
  for (const d of [ep - 1, ep, ep + 1]) {
    const k = pairKey(r.team, r.opp, d);
    const prev = howellBy.get(k);
    // the two pages must agree on the score; a city on either marks it off-campus
    if (!prev || d === ep) howellBy.set(k, prev && d === ep ? { ...row, campus: row.campus && prev.campus } : row);
    else prev.campus = prev.campus && row.campus;
  }
}

// Score and home-team resolution for the Repole spine. Three sources can
// speak: Repole, Howell, and (2002+) the cfbfastR schedules. Majority wins;
// with two sources split, Howell wins (in the 2001-2013 overlap Howell was
// never the odd one out against CFBD, while Repole has ~50 typos and two
// row-swapped pairs, and its 2011 file stops mid-bowl-season with blank
// scores). Home team flips only on a campus game where Howell puts the
// designated home on the road and no third source says otherwise.
const resolved = { scores: [], homes: [], filled: 0, dropped: [] };
function resolveSpine(g) {
  const ep = epochDay(g.date);
  const hw = howellBy.get(pairKey(g.home, g.away, ep));
  const sc = schedBy.get(`${g.home}|${g.away}|${ep}`) ?? null;
  const scRev = sc ? null : schedBy.get(`${g.away}|${g.home}|${ep}`) ?? null;
  // candidates oriented as (home = g.home): [hs, as]
  const votes = [];
  if (g.homeScore !== null) votes.push({ src: 'repole', v: [g.homeScore, g.awayScore] });
  if (hw) votes.push({ src: 'howell', v: hw.home === g.home ? [hw.hs, hw.as] : [hw.as, hw.hs] });
  if (sc && Number.isFinite(sc.homeScore)) votes.push({ src: 'cfbfastr', v: [sc.homeScore, sc.awayScore] });
  if (scRev && Number.isFinite(scRev.homeScore)) votes.push({ src: 'cfbfastr', v: [scRev.awayScore, scRev.homeScore] });
  if (!votes.length) { resolved.dropped.push(`${g.date} ${g.away}@${g.home}`); return null; }
  const tally = new Map();
  for (const { src, v } of votes) {
    const k = v.join('-');
    const t = tally.get(k) ?? { v, srcs: [] };
    t.srcs.push(src);
    tally.set(k, t);
  }
  const rank = (t) => t.srcs.length * 10 + (t.srcs.includes('howell') ? 2 : t.srcs.includes('cfbfastr') ? 1 : 0);
  const win = [...tally.values()].sort((a, b) => rank(b) - rank(a))[0];
  let [hs, as] = win.v;
  if (g.homeScore === null) resolved.filled++;
  else if (!win.srcs.includes('repole')) resolved.scores.push(`${g.date} ${g.away}@${g.home} repole ${g.awayScore}-${g.homeScore} -> ${as}-${hs} (${win.srcs.join('+')})`);
  // home team
  let { home, away, homeRaw, awayRaw } = g;
  const flip = hw && hw.campus && hw.home === g.away && !g.neutral && !sc && (!scRev || scRev.home === g.away);
  if (flip) {
    resolved.homes.push(`${g.date} ${g.away}@${g.home} -> ${g.home}@${g.away}${scRev ? ' (howell+cfbfastr)' : ' (howell)'}`);
    [home, away, homeRaw, awayRaw, hs, as] = [g.away, g.home, g.awayRaw, g.homeRaw, as, hs];
  }
  return { home, away, homeRaw, awayRaw, hs, as };
}
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

const cols = { se: [], ep: [], hi: [], ai: [], hs: [], as: [], fl: [], sp: [], hr: [], ar: [], hh: [], rv: [], vs: [], hf: [], af: [], hp: [], ap: [], ot: [] };
// venue state: campus games take the home team's state; pre-2014 neutrals
// take the state code off Repole's "@ City ST" tag; 2014+ neutrals unknown.
const states = [''];
const stateIdx = new Map([['', 0]]);
function venueStateIdx(code) {
  if (!code) return 0;
  let i = stateIdx.get(code);
  if (i === undefined) {
    i = states.length;
    stateIdx.set(code, i);
    states.push(code);
  }
  return i;
}
const rivalByPair = new Map(rivalries.map((r, i) => [[r.a, r.b].sort().join('|'), i]));
let joined0213 = 0;
let total0213 = 0;

function pushGame({ season, dateIso, home, away, homeRaw, awayRaw, hs, as, neutral, postseason, confGame, homeSpread, startHour, info }) {
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
  let st = null;
  if (!neutral) st = teamInfo[home]?.state ?? null;
  else if (info) {
    const m = /\b([A-Z]{2})$/.exec(info.trim());
    if (m) st = m[1];
  }
  cols.vs.push(venueStateIdx(st));
  // halftime points and possession seconds; -1 = unknown
  const box = boxBy.get(`${home}|${away}|${ep}`);
  cols.hf.push(box?.h1h ?? -1);
  cols.af.push(box?.h1a ?? -1);
  cols.hp.push(box?.tph ?? -1);
  cols.ap.push(box?.tpa ?? -1);
  cols.ot.push(box?.otp ?? -1);
}

// 1978-2013 from repole, enriched from schedules 2002+
for (const g of spine) {
  if (!isFbs(g.home, g.season) && !isFbs(g.away, g.season)) continue;
  const rs = resolveSpine(g);
  if (!rs) continue;
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
    season: g.season, dateIso: g.date, home: rs.home, away: rs.away,
    homeRaw: rs.homeRaw, awayRaw: rs.awayRaw, hs: rs.hs, as: rs.as,
    neutral: g.neutral, postseason: g.seasonType === 'postseason',
    confGame, homeSpread: rs.home === g.home ? g.homeSpread : (g.homeSpread == null ? null : -g.homeSpread),
    startHour, info: g.info,
  });
}
console.log(`spine resolution: ${resolved.filled} blank scores filled, ${resolved.scores.length} Repole scores overruled, ${resolved.homes.length} home teams flipped, ${resolved.dropped.length} games with no score in any source`);
for (const l of resolved.scores) console.log(`  score ${l}`);
for (const l of resolved.homes) console.log(`  home  ${l}`);
for (const l of resolved.dropped) console.log(`  drop  ${l}`);

// Games Repole never listed, from Howell: the 1992-93 Big West seasons are
// mostly absent (Nevada has 2 of 12 games in cfb1992lines), plus a few dozen
// others. Both teams must be major that season; no spread, no kickoff time.
const altHome = loadRef('alt-home.json').pairs;
const spineKeys = new Set();
for (const g of spine) {
  const e = epochDay(g.date);
  for (const d of [e - 1, e, e + 1]) spineKeys.add(pairKey(g.home, g.away, d));
}
const filledBySeason = {};
const filled = []; // written to data/build/howell-fill-in.json for export-errata.mjs
for (const r of jhGames) {
  if (r.se < 1978 || r.se > 2013) continue;
  if (!isFbs(r.team, r.se) || !isFbs(r.opp, r.se)) continue;
  // an unaliased name can slug differently in the two sources, so only
  // canonical pairs are safe from being added twice
  if (r.team.startsWith('x:') || r.opp.startsWith('x:')) continue;
  const ep = epochDay(r.date);
  const k = pairKey(r.team, r.opp, ep);
  if (spineKeys.has(k)) continue;
  for (const d of [ep - 1, ep, ep + 1]) spineKeys.add(pairKey(r.team, r.opp, d));
  const hw = howellBy.get(k);
  const homeName = hw.home === r.team ? r.teamName : r.oppName;
  const awayName = hw.home === r.team ? r.oppName : r.teamName;
  const city = r.city.replace(/^@\s*/, '').replace(/,/g, '').trim();
  const neutral = !!city && !(altHome[hw.home] ?? []).includes(city);
  filledBySeason[r.se] = (filledBySeason[r.se] ?? 0) + 1;
  filled.push({ season: r.se, date: r.date, visitor: awayName, home: homeName, score: `${hw.as}-${hw.hs}`, neutral, site: r.city || null, note: r.note || null });
  pushGame({
    season: r.se, dateIso: r.date, home: hw.home, away: hw.away, homeRaw: homeName, awayRaw: awayName,
    hs: hw.hs, as: hw.as, neutral, postseason: /\bbowl\b|championship game|playoff/i.test(r.note) && !/conference|kickoff/i.test(r.note),
    confGame: jhConfGame(r.se, r.date, hw.home, hw.away), homeSpread: null, startHour: 31, info: r.city || null,
  });
}
console.log(`howell fill-in: ${Object.values(filledBySeason).reduce((a, b) => a + b, 0)} games Repole lacked: ${JSON.stringify(filledBySeason)}`);
fs.writeFileSync(path.join(BUILD, 'howell-fill-in.json'), JSON.stringify(filled, null, 1));

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

// games no source lists (New Mexico State's spring 2021 schedule)
const extraGames = loadRef('extra-games.json').games;
for (const x of extraGames) {
  pushGame({
    season: x.season, dateIso: x.date, home: x.home, away: x.away,
    homeRaw: x.home, awayRaw: x.away, hs: x.hs, as: x.as,
    neutral: x.neutral, postseason: false, confGame: false,
    homeSpread: null, startHour: 31, info: x.info,
  });
}
console.log(`extra games: ${extraGames.length}`);

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

// ---------- coach stints ----------
// Per team: CFBD coach-season rows resolved against our own result sequence
// (scripts/lib/coach.mjs). Encoded as t.hc = [[ci, startSe, startOrd, interim]]
// with ci indexing coachNames/coachIds; ci -1 = unresolved multi-coach season.
const resultsBySeason = new Map(); // `${ti}|${se}` -> ['W','L',...] in ep order
const epsBySeason = new Map(); // `${ti}|${se}` -> [epochDay,...] in ep order
for (let i = 0; i < cols.se.length; i++) {
  const se = cols.se[i];
  const r = cols.hs[i] > cols.as[i] ? 'W' : cols.hs[i] < cols.as[i] ? 'L' : 'T';
  const flip = r === 'W' ? 'L' : r === 'L' ? 'W' : 'T';
  for (const [ti, res] of [[cols.hi[i], r], [cols.ai[i], flip]]) {
    const k = `${ti}|${se}`;
    const arr = resultsBySeason.get(k);
    if (arr) { arr.push(res); epsBySeason.get(k).push(cols.ep[i]); }
    else { resultsBySeason.set(k, [res]); epsBySeason.set(k, [cols.ep[i]]); }
  }
}
// Researched rulings for seasons CFBD's rows can't resolve (double-credited
// co-coached bowls, misattributed rows, non-contiguous tenures). Keyed
// `${teamId}|${season}`; segments name the coach and the 0-based ordinal of
// their first game that season. Names resolve against the CFBD coach pool.
const coachOverrides = loadRef('coach-overrides.json');
const kByName = new Map(); // name -> Set of cfbd coach ids
for (const byYear of Object.values(coachSeasonsByTeam)) {
  for (const rows of Object.values(byYear)) {
    for (const r of rows) {
      const set = kByName.get(r.n) ?? new Set();
      set.add(r.k);
      kByName.set(r.n, set);
    }
  }
}
function overrideK(name) {
  const set = kByName.get(name);
  // a coach CFBD dropped from every season (interims, mostly) gets an id of
  // his own; the name is the id, so a second ruling naming him joins up
  if (!set) return `x:${name}`;
  if (set.size !== 1) throw new Error(`coach override name '${name}' resolves to ${set.size} CFBD coaches`);
  return [...set][0];
}

const coachNames = [];
const coachIds = [];
const coachIdxByK = new Map();
const coachIdx = (k, n) => {
  let i = coachIdxByK.get(k);
  if (i === undefined) { i = coachNames.length; coachIdxByK.set(k, i); coachNames.push(n); coachIds.push(k); }
  return i;
};
let stintCount = 0;
let unresolved = 0;
for (const [id, byYear] of Object.entries(coachSeasonsByTeam)) {
  const ti = teamsIdx.get(id);
  if (ti === undefined) continue;
  const nameByK = new Map();
  const seasons = new Map();
  for (const [y, rows] of Object.entries(byYear)) {
    const year = Number(y);
    if (year > LAST_BASE_SEASON) continue;
    seasons.set(year, rows);
    for (const r of rows) nameByK.set(r.k, r.n);
  }
  if (!seasons.size) continue;
  const resolved = new Map();
  const forcedInterim = [];
  for (const [key, segs] of Object.entries(coachOverrides)) {
    const [oid, oy] = key.split('|');
    if (oid !== id) continue;
    resolved.set(Number(oy), segs.map((s) => {
      const k = overrideK(s.coach);
      nameByK.set(k, s.coach);
      // 'start' (the date of the coach's first game) beats a raw ordinal:
      // it survives games missing from or restored to the spine.
      let startOrd = s.startOrd ?? 0;
      if (s.start) {
        const eps = epsBySeason.get(`${ti}|${oy}`) ?? [];
        const ord = eps.findIndex((ep) => ep >= epochDay(s.start));
        if (ord === -1) throw new Error(`coach override ${key}: no game on/after ${s.start}`);
        startOrd = ord;
      }
      if (s.interim !== undefined) forcedInterim.push({ year: Number(oy), startOrd, k, interim: s.interim });
      return { k, startOrd };
    }));
  }
  const res = new Map([...seasons.keys()].map((y) => [y, resultsBySeason.get(`${ti}|${y}`) ?? null]));
  const stints = markInterim(buildStints(seasons, res, (year, rows) => {
    unresolved++;
    console.log(`  unresolved coach split: ${id} ${year} (${rows.map((r) => `${r.n} ${r.w}-${r.l}${r.t ? '-' + r.t : ''}`).join(', ')})`);
  }, resolved));
  for (const f of forcedInterim) {
    const s = stints.find((x) => x.startSe === f.year && x.startOrd === f.startOrd && x.k === f.k);
    if (s) s.interim = f.interim;
  }
  if (!stints.length) continue;
  teams[ti].hc = stints.map((s) => [s.k == null ? -1 : coachIdx(s.k, nameByK.get(s.k)), s.startSe, s.startOrd, s.interim ? 1 : 0]);
  stintCount += stints.length;
}
console.log(`coaches: ${coachNames.length} coaches, ${stintCount} stints, ${unresolved} unresolved seasons`);

const payload = {
  v: 1,
  builtAt: new Date().toISOString().slice(0, 10),
  lastBaseSeason: LAST_BASE_SEASON,
  floors: { night: 2002, spread: 1978 },
  confs,
  states,
  coachNames,
  coachIds,
  teams,
  rivals: rivalries.map((r) => ({ n: r.name, a: teamsIdx.get(r.a) ?? -1, b: teamsIdx.get(r.b) ?? -1 })),
  games: cols,
};

ensureDir(path.join(ROOT, 'data'));
fs.writeFileSync(path.join(ROOT, 'data', 'payload-base.json'), JSON.stringify(payload));

// ---------- report ----------
const n = cols.se.length;
const lined = cols.sp.filter((s) => s !== 9999).length;
const halved = cols.hf.filter((v) => v >= 0).length;
const clocked = cols.hp.filter((v) => v >= 0).length;
console.log(`payload-base: ${n} games 1978-${LAST_BASE_SEASON}, ${teams.length} teams (${teams.filter((t) => t.fbs).length} FBS-ever), ${lined} lined (${((lined / n) * 100).toFixed(1)}%), ${halved} with halftime, ${clocked} with possession`);
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
// 3b. The 2011 title game (Repole's file has blank scores): Alabama 21, LSU 0.
{
  const g = gamesFor('lsu', (x) => x.date === '2012-01-09');
  console.log(`check 2011 title game: LSU ${g[0]?.score} vs ${g[0]?.opp} (${g[0]?.r}) — expect 0-21, alabama, L`);
  if (g.length !== 1 || g[0].score !== '0-21' || g[0].opp !== 'alabama') throw new Error('2011 title game check failed');
}
// 3c. Repole reversed the whole row: Colorado State 48, Arkansas State 3, at Fort Collins (1994-11-12).
{
  const g = gamesFor('colorado-state', (x) => x.date === '1994-11-12');
  console.log(`check 1994 CSU-ASU: ${g[0]?.score} home=${g[0]?.isHome} — expect 48-3, home`);
  if (g.length !== 1 || g[0].score !== '48-3' || !g[0].isHome) throw new Error('1994 CSU check failed');
}
// 4. Nebraska 2022: Frost fired after 3 games (1-2), Joseph interim for the rest.
{
  const hc = teams[teamsIdx.get('nebraska')].hc ?? [];
  const j = hc.findIndex(([, se, ord]) => se === 2022 && ord > 0);
  const seg = (x) => (x ? `${coachNames[x[0]]}@${x[1]}:${x[2]}${x[3] ? ' (interim)' : ''}` : 'none');
  console.log(`check Nebraska 2022 coach split: ${seg(hc[j - 1])} -> ${seg(hc[j])} — expect Scott Frost -> Mickey Joseph@2022:3 (interim)`);
  const ok = j > 0 && coachNames[hc[j][0]] === 'Mickey Joseph' && hc[j][2] === 3 && hc[j][3] === 1
    && coachNames[hc[j - 1][0]] === 'Scott Frost';
  if (!ok) throw new Error('Nebraska 2022 coach check failed');
}
// 5. Louisville 2018: Petrino fired after game 10 (2-8), Lorenzo Ward interim (0-2).
//    CFBD misfiles Petrino's season under WKU; the override supplies the split.
{
  const hc = teams[teamsIdx.get('louisville')].hc ?? [];
  const j = hc.findIndex(([, se, ord]) => se === 2018 && ord > 0);
  const ok = j > 0 && coachNames[hc[j][0]] === 'Lorenzo Ward' && hc[j][2] === 10 && hc[j][3] === 1
    && coachNames[hc[j - 1][0]] === 'Bobby Petrino';
  console.log(`check Louisville 2018 coach split: ${ok ? 'Bobby Petrino -> Lorenzo Ward@2018:10 (interim)' : JSON.stringify(hc.filter((s) => s[1] >= 2014))} — expect Petrino -> Ward@2018:10 (interim)`);
  if (!ok) throw new Error('Louisville 2018 coach check failed');
}
// 6. LSU home night games under the lights: 2002-2008 Saturday-night run (soft check).
{
  const g = gamesFor('lsu', (x) => x.isHome && !x.neutral && !x.post);
  const night = g.filter((x) => {
    const i = x.i;
    return cols.hh[i] !== 31 && cols.hh[i] >= 18 && x.season >= 2002 && x.season <= 2008;
  });
  const losses = night.filter((x) => x.r === 'L');
  console.log(`check LSU home night 2002-2008: ${night.length} games, ${losses.length} losses (report says 28-0 through Oct 2008)`);
}

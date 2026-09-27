// Layer the in-progress season onto data/payload-base.json and emit
// public/data/payload.json. Self-contained for CI: fetches the current
// cfbfastR schedule CSV and the CPA poll pages fresh (CACHE=1 uses local
// copies under data/raw/ for offline runs). No other raw source is needed,
// so the deploy workflow works from the committed base alone.
//
// Adds: completed current-season games (same columnar arrays), an `upcoming`
// block for the This Week panel / on-the-line markers, and current-season
// polls for rank chips. Spreads for the current season are 9999 (no free
// bulk source yet; a CFBD key would fill them — see the spec).

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir, parseCsv, sleep, readIfExists } from '../lib/util.mjs';
import { parsePollPage, parseSeasonPolls } from '../lib/cpa.mjs';
import { mapScheduleRow } from '../lib/sched.mjs';
import { canon, slug } from '../lib/names.mjs';
import { resolveSeason } from '../lib/coach.mjs';

const SEASON = 2026;
const CACHE = process.env.CACHE === '1';
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'payload-base.json'), 'utf8'));
const teamInfo = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'ref', 'team-info.json'), 'utf8'),
).teams;

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'cfb-streak-king build (drewhoover.com)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// --- inputs ---
let schedCsv;
let pollPages = []; // [{id, label, html}]
if (CACHE) {
  schedCsv = fs.readFileSync(path.join(ROOT, 'data', 'raw', 'cfbfastr', `cfb_schedules_${SEASON}.csv`), 'utf8');
  const dir = path.join(ROOT, 'data', 'raw', 'ap-polls');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8'));
  const season = manifest.find((s) => s.year === SEASON);
  for (const p of season?.polls ?? []) {
    const f = path.join(dir, 'polls', `poll-${p.id}.html`);
    if (fs.existsSync(f)) pollPages.push({ id: p.id, label: p.label, html: fs.readFileSync(f, 'utf8') });
  }
} else {
  schedCsv = await fetchText(
    `https://raw.githubusercontent.com/sportsdataverse/cfbfastR-data/main/schedules/csv/cfb_schedules_${SEASON}.csv`,
  );
  // The season page displays only the newest poll, with a "<" nav link to the
  // previous appollid. Parse the page itself as a poll, then walk ids downward
  // until the parse falls out of this season (the preseason poll parses with
  // no heading date; take it and stop).
  const seasonPage = await fetchText(
    `https://www.collegepollarchive.com/football/ap/seasons.cfm?seasonid=${SEASON}`,
  );
  pollPages.push({ id: 0, label: 'Current', html: seasonPage });
  const prev = parseSeasonPolls(seasonPage)[0]?.id;
  if (prev) {
    for (let id = prev, steps = 0; id > prev - 25 && steps < 25; id--, steps++) {
      await sleep(700);
      const html = await fetchText(`https://www.collegepollarchive.com/football/ap/seasons.cfm?appollid=${id}`);
      const probe = parsePollPage(html, SEASON, '');
      if (probe.ranks.length < 20) break;
      if (!probe.date) {
        pollPages.push({ id, label: 'Preseason', html });
        break; // preseason is the season's first poll
      }
      const inSeason = probe.date >= `${SEASON}-08-01` && probe.date <= `${SEASON + 1}-02-01`;
      if (!inSeason) break;
      pollPages.push({ id, label: '', html });
    }
  }
}

// --- polls ---
const polls = [];
for (const p of pollPages) {
  const parsed = parsePollPage(p.html, SEASON, p.label);
  if (parsed.date && parsed.ranks.length) polls.push({ season: SEASON, id: p.id, ...parsed });
}
polls.sort((a, b) => a.date.localeCompare(b.date));
const epochDay = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const pollTimeline = polls.map((p) => [epochDay(p.date), new Map(p.ranks.map((r) => [r.team, r.rank]))]);
function rankOf(id, ep) {
  let cur = null;
  for (const [d, m] of pollTimeline) {
    if (d > ep) break;
    cur = m;
  }
  return cur?.get(id) ?? 0;
}

// --- teams index over the base (append new opponents as needed) ---
const teams = base.teams;
const teamsIdx = new Map(teams.map((t, i) => [t.id, i]));
function teamIdx(id, rawName) {
  let i = teamsIdx.get(id);
  if (i !== undefined) return i;
  i = teams.length;
  teamsIdx.set(id, i);
  teams.push({ id, name: id.startsWith('x:') ? rawName : rawName, fbs: null, st: teamInfo[id]?.state });
  return i;
}
const rivalByPair = new Map(
  base.rivals.map((r, i) => [[teams[r.a]?.id, teams[r.b]?.id].sort().join('|'), i]),
);

// --- local kickoff parts ---
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

// --- CFBD layer: current-season spreads + coach changes (optional) ---
// Runs with CFBD_API_KEY (CI secret / .env); CACHE=1 reads local copies.
// Failures log and continue: the season layer still builds without them.
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}
const CFBD_KEY = process.env.CFBD_API_KEY;
async function cfbd(pathq, cacheFile) {
  const f = path.join(ROOT, 'data', 'raw', cacheFile);
  if (CACHE) {
    const t = readIfExists(f);
    return t ? JSON.parse(t) : null;
  }
  if (!CFBD_KEY) return null;
  try {
    const res = await fetch(`https://api.collegefootballdata.com${pathq}`, {
      headers: { Authorization: `Bearer ${CFBD_KEY}` },
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const j = await res.json();
    fs.writeFileSync(f, JSON.stringify(j));
    return j;
  } catch (e) {
    console.error(`cfbd ${pathq} failed: ${e.message} (continuing without)`);
    return null;
  }
}
const linesRaw = await cfbd(`/lines?year=${SEASON}`, `cfbd-lines-${SEASON}.json`);
let coachesRaw = await cfbd(`/coaches?year=${SEASON}`, `cfbd-coaches-${SEASON}.json`);
if (!coachesRaw && CACHE) {
  const full = readIfExists(path.join(ROOT, 'data', 'raw', 'cfbd-coaches.json'));
  if (full) coachesRaw = JSON.parse(full);
}
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const lineByKey = new Map();
for (const l of linesRaw ?? []) {
  const spreads = (l.lines ?? []).map((x) => Number(x.spread)).filter(Number.isFinite);
  if (!spreads.length || !l.startDate) continue;
  const h = canon(l.homeTeam, 'cfbd-lines') ?? `x:${slug(l.homeTeam)}`;
  const a = canon(l.awayTeam, 'cfbd-lines') ?? `x:${slug(l.awayTeam)}`;
  const ep = epochDay(String(l.startDate).slice(0, 10));
  for (const d of [ep - 1, ep, ep + 1]) lineByKey.set(`${h}|${a}|${d}`, median(spreads));
}

// --- current-season games ---
const rows = parseCsv(schedCsv).map(mapScheduleRow).filter(Boolean);
const res26 = new Map(); // ti -> ['W','L','T'...] in date order, for coach splits
const cols = base.games;
const upcoming = { ep: [], hi: [], ai: [], fl: [], hr: [], ar: [], hh: [], rv: [], wk: [], vs: [] };
const stateIdxOf = (code) => {
  if (!code) return 0;
  const i = base.states.indexOf(code);
  return i === -1 ? 0 : i;
};
let added = 0;
for (const r of rows.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))) {
  const anyFbs = r.homeDiv === 'fbs' || r.awayDiv === 'fbs';
  if (!anyFbs) continue;
  const { date, hour } = localParts(r.start, teamInfo[r.home]?.tz);
  const ep = epochDay(date);
  const hh = r.timeKnown ? hour : 31;
  const hi = teamIdx(r.home, r.homeRaw);
  const ai = teamIdx(r.away, r.awayRaw);
  const fl =
    (r.neutral ? 1 : 0) | (r.confGameRaw ? 2 : 0) | (r.seasonType === 'postseason' ? 4 : 0);
  const rv = rivalByPair.get([r.home, r.away].sort().join('|'));
  if (r.completed && Number.isFinite(r.homeScore)) {
    cols.se.push(SEASON);
    cols.ep.push(ep);
    cols.hi.push(hi);
    cols.ai.push(ai);
    cols.hs.push(r.homeScore);
    cols.as.push(r.awayScore);
    cols.fl.push(fl);
    const spv = lineByKey.get(`${r.home}|${r.away}|${ep}`);
    cols.sp.push(spv == null ? 9999 : Math.round(spv * 2));
    const rr = r.homeScore > r.awayScore ? 'W' : r.homeScore < r.awayScore ? 'L' : 'T';
    for (const [ti, rv2] of [[hi, rr], [ai, rr === 'W' ? 'L' : rr === 'L' ? 'W' : 'T']]) {
      const arr = res26.get(ti);
      if (arr) arr.push(rv2); else res26.set(ti, [rv2]);
    }
    cols.hr.push(rankOf(r.home, ep));
    cols.ar.push(rankOf(r.away, ep));
    cols.hh.push(hh);
    cols.rv.push(rv === undefined ? 0 : rv + 1);
    cols.vs.push(r.neutral ? 0 : stateIdxOf(teamInfo[r.home]?.state));
    added++;
  } else if (!r.completed) {
    upcoming.vs.push(r.neutral ? 0 : stateIdxOf(teamInfo[r.home]?.state));
    upcoming.ep.push(ep);
    upcoming.hi.push(hi);
    upcoming.ai.push(ai);
    upcoming.fl.push(fl);
    upcoming.hr.push(rankOf(r.home, ep));
    upcoming.ar.push(rankOf(r.away, ep));
    upcoming.hh.push(hh);
    upcoming.rv.push(rv === undefined ? 0 : rv + 1);
    upcoming.wk.push(r.week);
  }
}

// --- layer current-season coach changes onto the base stints ---
const coachNames = base.coachNames ?? [];
const coachIds = base.coachIds ?? [];
if (coachesRaw) {
  const ciOf = new Map(coachIds.map((k, i) => [k, i]));
  const idx = (row) => {
    let i = ciOf.get(row.k);
    if (i === undefined) { i = coachNames.length; coachNames.push(row.n); coachIds.push(row.k); ciOf.set(row.k, i); }
    return i;
  };
  const rowsByTeam = new Map();
  for (const c of coachesRaw) {
    for (const s of c.seasons ?? []) {
      if (s.year !== SEASON || !s.school) continue;
      const id = canon(s.school, 'cfbd-coaches') ?? `x:${slug(s.school)}`;
      const ti = teamsIdx.get(id);
      if (ti === undefined) continue;
      const arr = rowsByTeam.get(ti) ?? [];
      arr.push({ k: c.id, n: `${c.firstName} ${c.lastName}`.trim(), g: s.games, w: s.wins, l: s.losses, t: s.ties });
      rowsByTeam.set(ti, arr);
    }
  }
  let changes = 0;
  let unresolved26 = 0;
  for (const [ti, crows] of rowsByTeam) {
    const t = teams[ti];
    const hc = (t.hc ??= []);
    while (hc.length && hc.at(-1)[1] === SEASON) hc.pop(); // idempotent relayering
    const prev = hc.at(-1);
    const prevK = prev && prev[0] >= 0 ? coachIds[prev[0]] : null;
    const nonzero = crows.filter((r) => r.g > 0);
    const single = crows.length === 1 ? crows[0] : nonzero.length === 1 ? nonzero[0] : null;
    if (single) {
      if (single.k !== prevK) { hc.push([idx(single), SEASON, 0, 0]); changes++; }
    } else if (nonzero.length > 1) {
      const segs = resolveSeason(res26.get(ti) ?? [], nonzero, prevK);
      if (!segs) {
        unresolved26++;
        hc.push([-1, SEASON, 0, 0]);
      } else {
        let lk = prevK;
        for (const s of segs) {
          if (s.k === lk) continue;
          hc.push([idx(nonzero.find((r) => r.k === s.k)), SEASON, s.startOrd, 0]);
          lk = s.k;
          changes++;
        }
      }
    }
  }
  console.log(`coaches ${SEASON}: ${changes} stint changes layered${unresolved26 ? `, ${unresolved26} unresolved` : ''}`);
}

const out = {
  ...base,
  coachNames,
  coachIds,
  currentSeason: SEASON,
  builtAt: new Date().toISOString(),
  upcoming,
  games: cols,
  teams,
};
ensureDir(path.join(ROOT, 'src', 'data'));
fs.writeFileSync(path.join(ROOT, 'src', 'data', 'payload.json'), JSON.stringify(out));
const lined26 = cols.sp.filter((s, i) => cols.se[i] === SEASON && s !== 9999).length;
console.log(
  `payload: +${added} completed ${SEASON} games (${lined26} lined), ${upcoming.ep.length} upcoming, ${polls.length} ${SEASON} polls (latest ${polls.at(-1)?.date}), total ${cols.se.length} games, ${(fs.statSync(path.join(ROOT, 'src', 'data', 'payload.json')).size / 1e6).toFixed(2)} MB`,
);

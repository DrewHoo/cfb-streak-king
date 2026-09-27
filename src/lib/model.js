// Decode the payload once (module scope, so SSR and the client share it) and
// expose: team game lists, the chip catalog, board evaluation, and upcoming-
// game qualification. Streak semantics live in streaks.js.

import payload from '../data/payload.json';
import { currentStreak } from './streaks.js';

export const P = payload;
export const teams = P.teams;
export const confs = P.confs;
const g = P.games;
const N = g.se.length;

export const fbsNow = new Set();
teams.forEach((t, i) => {
  if (t.fbs?.some(([a, b]) => a <= P.currentSeason && b >= P.currentSeason)) fbsNow.add(i);
});

export const confOf = (teamIdx, season) => {
  const runs = teams[teamIdx]?.conf;
  if (!runs) return null;
  for (const [a, b, ci] of runs) if (season >= a && season <= b) return confs[ci];
  return null;
};

const monthOf = (ep) => {
  const m = new Date(ep * 86400000).getUTCMonth() + 1;
  return m === 8 ? 9 : m; // week 0 folds into September
};

// --- coach stints ---
// t.hc = [[ci, startSe, startOrd, interim]] sorted; ci indexes P.coachNames,
// -1 = unresolved multi-coach season. A stint runs until the next one starts.
// Ordinals are a team's game count within a season (the global arrays are in
// ep order), tracked for every team so opponents resolve too.
const N0 = N;
const hOrd = new Int32Array(N0);
const aOrd = new Int32Array(N0);
{
  const cnt = new Map();
  for (let i = 0; i < N0; i++) {
    let k = g.hi[i] * 64 + (g.se[i] - 1978);
    hOrd[i] = cnt.get(k) ?? 0;
    cnt.set(k, hOrd[i] + 1);
    k = g.ai[i] * 64 + (g.se[i] - 1978);
    aOrd[i] = cnt.get(k) ?? 0;
    cnt.set(k, aOrd[i] + 1);
  }
}
function stintAt(ti, se, ord) {
  const hc = teams[ti]?.hc;
  if (!hc) return null;
  let cur = null;
  for (const s of hc) {
    if (s[1] < se || (s[1] === se && s[2] <= ord)) cur = s;
    else break;
  }
  return cur;
}
const lastStint = (ti) => teams[ti]?.hc?.at(-1) ?? null;
const curCoach = (ti) => {
  const s = lastStint(ti);
  return s && s[0] >= 0 ? s[0] : null;
};

// --- per-team game lists (current-FBS teams only; ascending) ---
const byTeam = new Map();
for (const ti of fbsNow) byTeam.set(ti, []);
for (let i = 0; i < N; i++) {
  for (const side of [0, 1]) {
    const ti = side === 0 ? g.hi[i] : g.ai[i];
    const list = byTeam.get(ti);
    if (!list) continue;
    const home = side === 0;
    const us = home ? g.hs[i] : g.as[i];
    const them = home ? g.as[i] : g.hs[i];
    const spRaw = g.sp[i];
    const oppIdx = home ? g.ai[i] : g.hi[i];
    const st = stintAt(ti, g.se[i], home ? hOrd[i] : aOrd[i]);
    const ost = stintAt(oppIdx, g.se[i], home ? aOrd[i] : hOrd[i]);
    const cc = curCoach(ti);
    // a mid-season taker's "first season" is his first season opener
    const firstSe = (s) => (s[2] === 0 ? s[1] : s[1] + 1);
    list.push({
      hcCur: !!st && st[0] >= 0 && cc != null && st[0] === cc,
      hcNew: !!st && st[0] >= 0 && !st[3] && firstSe(st) === g.se[i],
      vsNew: !!ost && ost[0] >= 0 && !ost[3] && firstSe(ost) === g.se[i],
      i,
      ep: g.ep[i],
      se: g.se[i],
      home,
      neutral: !!(g.fl[i] & 1),
      conf: !!(g.fl[i] & 2),
      post: !!(g.fl[i] & 4),
      us,
      them,
      r: us > them ? 'W' : us < them ? 'L' : 'T',
      margin: Math.abs(us - them),
      total: us + them,
      oppIdx: home ? g.ai[i] : g.hi[i],
      oppRank: home ? g.ar[i] : g.hr[i],
      ownRank: home ? g.hr[i] : g.ar[i],
      sp: spRaw === 9999 ? null : (home ? spRaw : -spRaw) / 2, // + = we were underdogs
      hh: g.hh[i],
      rv: g.rv[i],
      vst: P.states[g.vs[i]] || null,
      month: monthOf(g.ep[i]),
    });
  }
}
for (const [ti, list] of byTeam) {
  list.sort((a, b) => a.ep - b.ep);
  // context fields need the team's own timeline
  let prev = null;
  const bySeason = new Map();
  for (const game of list) {
    game.prevR = prev && prev.se >= game.se - 1 ? prev.r : null;
    game.rest = prev ? game.ep - prev.ep : null;
    prev = game;
    if (!game.post) {
      const s = bySeason.get(game.se) ?? { first: game, last: game };
      if (game.ep < s.first.ep) s.first = game;
      if (game.ep > s.last.ep) s.last = game;
      bySeason.set(game.se, s);
    }
  }
  for (const [se, s] of bySeason) {
    s.first.opener = true;
    // a finale in the running season isn't known until the season ends
    if (se < P.currentSeason) s.last.finale = true;
  }
}
export const gamesOf = (ti) => byTeam.get(ti) ?? [];

// upcoming: does this team still have a scheduled regular-season game?
const upc = P.upcoming;
const upcomingByTeam = new Map();
for (let i = 0; i < upc.ep.length; i++) {
  for (const side of [0, 1]) {
    const ti = side === 0 ? upc.hi[i] : upc.ai[i];
    if (!fbsNow.has(ti)) continue;
    const home = side === 0;
    const oppIdx = home ? upc.ai[i] : upc.hi[i];
    const own = lastStint(ti);
    const opp = lastStint(oppIdx);
    const entry = {
      i,
      // upcoming games are by definition under both teams' current coaches;
      // "first season" of a mid-season taker starts at his first opener
      hcCur: !!own && own[0] >= 0,
      hcNew: !!own && own[0] >= 0 && !own[3] && (own[2] === 0 ? own[1] : own[1] + 1) === P.currentSeason,
      vsNew: !!opp && opp[0] >= 0 && !opp[3] && (opp[2] === 0 ? opp[1] : opp[1] + 1) === P.currentSeason,
      ep: upc.ep[i],
      wk: upc.wk[i],
      home,
      neutral: !!(upc.fl[i] & 1),
      conf: !!(upc.fl[i] & 2),
      post: !!(upc.fl[i] & 4),
      oppIdx: home ? upc.ai[i] : upc.hi[i],
      oppRank: home ? upc.ar[i] : upc.hr[i],
      ownRank: home ? upc.hr[i] : upc.ar[i],
      hh: upc.hh[i],
      rv: upc.rv[i],
      vst: P.states[upc.vs?.[i] ?? 0] || null,
      month: monthOf(upc.ep[i]),
      sp: null,
    };
    const arr = upcomingByTeam.get(ti) ?? [];
    arr.push(entry);
    upcomingByTeam.set(ti, arr);
  }
}
for (const arr of upcomingByTeam.values()) arr.sort((a, b) => a.ep - b.ep);
// openers/finales for upcoming rows
for (const [ti, arr] of upcomingByTeam) {
  const played = gamesOf(ti).filter((x) => x.se === P.currentSeason);
  if (!played.length && arr.length) arr[0].opener = true;
  const regs = arr.filter((x) => !x.post);
  if (regs.length) regs[regs.length - 1].finale = true;
}
export const upcomingOf = (ti) => upcomingByTeam.get(ti) ?? [];

// --- chip catalog ---
// test(g) filters completed games; pre(u) decides an upcoming game (null =
// not knowable before kickoff, which keeps the chip out of the This Week
// panel). floor = first season the underlying fact exists.
const sameState = (a, b) => a != null && a === b;

export const CHIPS = [
  { key: 'home', label: 'at home', group: 'site', x: true, test: (x) => x.home && !x.neutral, pre: (x) => x.home && !x.neutral },
  { key: 'road', label: 'in hostile territory', group: 'site', x: true, test: (x) => !x.home && !x.neutral, pre: (x) => !x.home && !x.neutral },
  { key: 'neutral', label: 'neutral site', group: 'site', x: true, test: (x) => x.neutral, pre: (x) => x.neutral },
  { key: 'away', label: 'not at home', group: 'site', x: true, test: (x) => !(x.home && !x.neutral), pre: (x) => !(x.home && !x.neutral) },
  { key: 'state', label: 'in state\u2026', group: 'site', param: 'state', test: (x, p) => x.vst === p, pre: (x, p) => x.vst === p },
  { key: 'ranked', label: 'vs ranked', group: 'opp rank', x: true, test: (x) => x.oppRank > 0, pre: (x) => x.oppRank > 0 },
  { key: 'top10', label: 'vs top 10', group: 'opp rank', x: true, test: (x) => x.oppRank >= 1 && x.oppRank <= 10, pre: (x) => x.oppRank >= 1 && x.oppRank <= 10 },
  { key: 'top5', label: 'vs top 5', group: 'opp rank', x: true, test: (x) => x.oppRank >= 1 && x.oppRank <= 5, pre: (x) => x.oppRank >= 1 && x.oppRank <= 5 },
  { key: 'unranked', label: 'vs unranked', group: 'opp rank', x: true, test: (x) => x.oppRank === 0, pre: (x) => x.oppRank === 0 },
  { key: 'whileranked', label: 'while ranked', group: 'own rank', x: true, test: (x) => x.ownRank > 0, pre: (x) => x.ownRank > 0 },
  { key: 'whileunranked', label: 'while unranked', group: 'own rank', x: true, test: (x) => x.ownRank === 0, pre: (x) => x.ownRank === 0 },
  { key: 'fav', label: 'as favorite', group: 'betting', x: true, test: (x) => x.sp != null && x.sp < 0, pre: null, note: 'lines through 2025' },
  { key: 'dog', label: 'as underdog', group: 'betting', x: true, test: (x) => x.sp != null && x.sp > 0, pre: null, note: 'lines through 2025' },
  { key: 'dog7', label: 'as 7+ pt dog', group: 'betting', x: true, test: (x) => x.sp != null && x.sp >= 7, pre: null, note: 'lines through 2025' },
  { key: 'dog14', label: 'as 14+ pt dog', group: 'betting', x: true, test: (x) => x.sp != null && x.sp >= 14, pre: null, note: 'lines through 2025' },
  { key: 'close', label: 'close spread (≤ 3)', group: 'betting', x: true, test: (x) => x.sp != null && Math.abs(x.sp) <= 3, pre: null, note: 'lines through 2025' },
  { key: 'confgame', label: 'conference game', group: 'conference', x: true, test: (x) => x.conf, pre: (x) => x.conf },
  { key: 'nonconf', label: 'non-conference', group: 'conference', x: true, test: (x) => !x.conf, pre: (x) => !x.conf },
  { key: 'vsconf', label: 'vs conference…', group: 'conference', param: 'conf', test: (x, p) => confOf(x.oppIdx, x.se) === p, pre: (x, p) => confOf(x.oppIdx, P.currentSeason) === p },
  { key: 'vsteam', label: 'vs team…', group: 'opponent', param: 'team', test: (x, p) => x.oppIdx === p, pre: (x, p) => x.oppIdx === p },
  { key: 'rivalry', label: 'rivalry game', group: 'opponent', test: (x) => x.rv > 0, pre: (x) => x.rv > 0 },
  { key: 'instate', label: 'in-state opponent', group: 'opponent', test: (x, _p, ownState) => sameState(teams[x.oppIdx]?.st, ownState), pre: (x, _p, ownState) => sameState(teams[x.oppIdx]?.st, ownState) },
  { key: 'curcoach', label: 'under current head coach', group: 'coach', test: (x) => !!x.hcCur, pre: (x) => !!x.hcCur },
  { key: 'newcoach', label: 'in a coach’s first season', group: 'coach', test: (x) => !!x.hcNew, pre: (x) => !!x.hcNew },
  { key: 'vsnewcoach', label: 'vs a first-year head coach', group: 'coach', test: (x) => !!x.vsNew, pre: (x) => !!x.vsNew },
  { key: 'month', label: 'in month…', group: 'calendar', param: 'month', test: (x, p) => x.month === p, pre: (x, p) => x.month === p },
  { key: 'opener', label: 'season opener', group: 'calendar', test: (x) => !!x.opener, pre: (x) => !!x.opener },
  { key: 'finale', label: 'reg-season finale', group: 'calendar', test: (x) => !!x.finale, pre: (x) => !!x.finale },
  { key: 'postseason', label: 'bowls + playoff', group: 'calendar', x: true, test: (x) => x.post, pre: (x) => x.post },
  { key: 'afterloss', label: 'after a loss', group: 'context', x: true, test: (x) => x.prevR === 'L', pre: null },
  { key: 'afterwin', label: 'after a win', group: 'context', x: true, test: (x) => x.prevR === 'W', pre: null },
  { key: 'afterbye', label: 'after a bye', group: 'context', test: (x) => x.rest != null && x.rest >= 13, pre: null },
  { key: 'onescore', label: 'one-score game', group: 'shape', x: true, test: (x) => x.margin <= 8, pre: null },
  // bounds are one standard deviation from the all-time mean total (51.0, σ 18.1): ~15% of games in each tail
  { key: 'shootout', label: 'shootout (70+ pts)', group: 'shape', x: true, test: (x) => x.total >= 70, pre: null },
  { key: 'struggle', label: 'defensive struggle (≤ 33)', group: 'shape', x: true, test: (x) => x.total <= 33, pre: null },
  { key: 'night', label: 'night game (6pm+)', group: 'kickoff', test: (x) => x.hh !== 31 && x.hh >= 18, pre: (x) => x.hh !== 31 && x.hh >= 18, floor: 2002 },
];
export const chipByKey = new Map(CHIPS.map((c) => [c.key, c]));

/** active: [{key, param?}]. Returns filter fn for a team's games. */
function makeFilter(active, ownState) {
  const fns = active.map(({ key, param }) => {
    const c = chipByKey.get(key);
    return (x) => c.test(x, param, ownState);
  });
  return (x) => fns.every((f) => f(x));
}

export function panelReady(active) {
  return active.every(({ key }) => chipByKey.get(key).pre);
}

function makePre(active, ownState) {
  const fns = active.map(({ key, param }) => {
    const c = chipByKey.get(key);
    return c.pre ? (x) => c.pre(x, param, ownState) : null;
  });
  if (fns.some((f) => !f)) return null;
  return (x) => fns.every((f) => f(x));
}

/**
 * The leaderboard. dir 'W'|'L'; sort 'games'|'since'.
 * Rows: { ti, streak, todayEp } with streak from currentStreak plus
 * onTheLine (next scheduled game qualifies).
 */
export function board(active, dir, sort, todayEp) {
  const rows = [];
  for (const ti of fbsNow) {
    const ownState = teams[ti].st;
    const filter = makeFilter(active, ownState);
    const qual = gamesOf(ti).filter(filter);
    if (!qual.length) continue;
    const s = currentStreak(qual);
    if (s.dir !== dir || s.len === 0) continue;
    const pre = makePre(active, ownState);
    let onTheLine = false;
    let next = null;
    if (pre) {
      next = upcomingOf(ti).find((u) => u.ep >= todayEp && pre(u)) ?? null;
      onTheLine = !!next && next.ep - todayEp <= 8;
    }
    rows.push({ ti, s, qual, next, onTheLine });
  }
  rows.sort((a, b) => {
    if (sort === 'since') {
      const ae = a.s.atEdge ? -1 : a.s.ender.ep;
      const be = b.s.atEdge ? -1 : b.s.ender.ep;
      return ae - be || b.s.len - a.s.len;
    }
    const ae = a.s.atEdge ? -1 : a.s.ender.ep;
    const be = b.s.atEdge ? -1 : b.s.ender.ep;
    return b.s.len - a.s.len || ae - be;
  });
  return rows;
}

/** This Week: qualifying upcoming games (next 8 days) with a streak at stake. */
export function thisWeek(active, dir, todayEp) {
  const out = [];
  for (const ti of fbsNow) {
    const ownState = teams[ti].st;
    const pre = makePre(active, ownState);
    if (!pre) return null; // a post-hoc chip is active
    const filter = makeFilter(active, ownState);
    const qual = gamesOf(ti).filter(filter);
    if (!qual.length) continue;
    const s = currentStreak(qual);
    if (s.dir !== dir || s.len === 0) continue;
    const u = upcomingOf(ti).find((x) => x.ep >= todayEp && x.ep - todayEp <= 8 && pre(x));
    if (u) out.push({ ti, s, u });
  }
  out.sort((a, b) => b.s.len - a.s.len);
  return out;
}

export const fmtDate = (ep) => {
  const d = new Date(ep * 86400000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
};
export const todayEpochDay = () => Math.floor(Date.now() / 86400000);

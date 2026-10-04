// What a team page and a matchup show about one team: its season record, its
// rank, its next game, and its current streaks under every single condition,
// each with its place in the field.
//
// The streaks are every team's at once (one pass per condition over the
// crowns miner's bitmasks), kept per day, so a second team costs nothing. A
// team's list adds the multi-condition streaks it is king of (its crowns) and
// orders the whole list the way the King-of list is ordered: by crownRank's
// score, how far the run sits past what chance would produce.

import type { Crown, Dir, GameRow, UpcomingRow } from './types.ts';
import { P, teams, fbsNow, gamesOf, upcomingOf } from './model.ts';
import { PLAIN_CHIPS, conflicts, fitsDir, qualifiesPregame } from './chips.ts';
import type { PregameChip } from './chips.ts';
import { teamData, walkActive, spreadWalk, nearUniversalChips } from './crowns.ts';
import type { Run } from './crowns.ts';
import { crownScore, chanceOf } from './crownRank.ts';
import { ordinal } from './sentence.ts';
import { spreadText } from './format.ts';

export interface SeasonRecord { w: number; l: number; t: number; cw: number; cl: number; cp: number }

/** This season straight up and against the spread. */
export function seasonRecord(ti: number): SeasonRecord {
  const r = { w: 0, l: 0, t: 0, cw: 0, cl: 0, cp: 0 };
  for (const g of gamesOf(ti)) {
    if (g.se !== P.currentSeason) continue;
    if (g.r === 'W') r.w++; else if (g.r === 'L') r.l++; else r.t++;
    if (g.cover === 'W') r.cw++; else if (g.cover === 'L') r.cl++; else if (g.cover === 'P') r.cp++;
  }
  return r;
}
const wlt = (w: number, l: number, t: number) => `${w}–${l}${t ? `–${t}` : ''}`;
export const recordText = (r: SeasonRecord) => wlt(r.w, r.l, r.t);
export const atsText = (r: SeasonRecord) => wlt(r.cw, r.cl, r.cp);

/** The team's next scheduled game: the first one no build has recorded a result for, whatever its date. */
export const nextGameOf = (ti: number, _todayEp: number): UpcomingRow | null => upcomingOf(ti)[0] ?? null;

/** The team's scheduled game against `opp`, else its next game: a matchup link read after that game was played still lands on one. */
export function gameVs(ti: number, opp: number | null, _todayEp: number): UpcomingRow | null {
  const ahead = upcomingOf(ti);
  return (opp != null ? ahead.find((u) => u.oppIdx === opp) : null) ?? ahead[0] ?? null;
}

/** AP rank in the poll in effect: 0 unranked, null when no poll is. Read off the next game, else the last one. */
export function apRank(ti: number, todayEp: number): number | null {
  const next = nextGameOf(ti, todayEp);
  if (next) return next.ownRank;
  return gamesOf(ti).at(-1)?.ownRank ?? null;
}

/** The last time the two met, from ti's side. */
export const lastMeeting = (ti: number, opp: number): GameRow | null => gamesOf(ti).findLast((g) => g.oppIdx === opp) ?? null;

/** One of a team's current streaks, with its place among every team's under the same definition. */
export interface TeamStreak {
  chips: string[];
  /** Set when the run is head-to-head: the opponent the chips' "vsteam" means. */
  vs?: number;
  dir: Dir;
  len: number;
  atEdge: boolean;
  /** 1 = the longest; teams level on length share a rank. */
  rank: number;
  tied: number;
  field: number;
  /** The next scheduled game that qualifies; null when none does, or when a condition can't be known before kickoff. */
  next: UpcomingRow | null;
  /** The season the run started in. */
  since: number;
  /** The chance some team's streak reaches this length under the definition by luck alone, 0–1. */
  chance: number;
  score: number;
}

/** A run shorter than this stays off a team's list unless the team alone leads the field with it (the crowns' floor). */
export const LEN_FLOOR = 4;
export const worthShowing = (s: Pick<TeamStreak, 'len' | 'rank' | 'tied'>) => s.len >= LEN_FLOOR || (s.rank === 1 && s.tied === 1);

// the outcomes a team's sheet reads: every team is on one side of each pair
const SHEET_DIRS: Dir[] = ['W', 'L', 'C', 'N'];

// how many definitions have each chip count, the cost crownRank charges a definition
export const DEFS = (() => {
  const M = [0, 0, 0, 0, 0];
  (function walk(start: number, chosen: number[]) {
    M[chosen.length]++;
    if (chosen.length === 4) return;
    for (let i = start; i < PLAIN_CHIPS.length; i++) {
      if (chosen.some((j) => conflicts(PLAIN_CHIPS[j], PLAIN_CHIPS[i]))) continue;
      walk(i + 1, [...chosen, i]);
    }
  })(0, []);
  return M;
})();

const plainIdx = new Map(PLAIN_CHIPS.map((c, i) => [c.key, i]));
const popcount = (x: number) => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};
const countAnd = (a: Uint32Array, b: Uint32Array) => { let n = 0; for (let w = 0; w < a.length; w++) n += popcount(a[w] & b[w]); return n; };

/**
 * Every team's current streaks under one definition of plain chips, one per
 * outcome the definition can define, scored. Walks the crowns miner's
 * bitmasks; the lengths and fields are activeBoard's (team.test.ts holds
 * them to it).
 */
function streaksUnder(chips: string[], todayEp: number): Map<number, TeamStreak[]> {
  const cs = chips.map((k) => PLAIN_CHIPS[plainIdx.get(k)!]);
  const dirs = SHEET_DIRS.filter((d) => cs.every((c) => fitsDir(c, d)));
  const pre = cs.every((c) => c.pregame) ? (u: UpcomingRow) => cs.every((c) => qualifiesPregame(c as PregameChip, u)) : null;
  const data = teamData();
  const runs: Partial<Record<Dir, Run>>[] = [];
  // the definition's outcome rates over every team's games: [qualifying, won, lost, lined, covered, missed]
  const pooled = [0, 0, 0, 0, 0, 0];
  for (const td of data) {
    const q = new Uint32Array(td.words);
    // past the last game the bits stay clear, so a count is a count of games
    for (let i = 0; i < td.n; i++) q[i >> 5] |= 1 << (i & 31);
    for (const k of chips) { const m = td.masks[plainIdx.get(k)!]; for (let w = 0; w < td.words; w++) q[w] &= m[w]; }
    const r: Partial<Record<Dir, Run>> = walkActive(td, q);
    const c = spreadWalk(td, q, td.covered, 'active');
    if (c) r.C = c;
    const n = spreadWalk(td, q, td.missed, 'active');
    if (n) r.N = n;
    runs.push(r);
    for (let w = 0; w < td.words; w++) pooled[0] += popcount(q[w]);
    pooled[1] += countAnd(q, td.won);
    pooled[2] += countAnd(q, td.lost);
    pooled[3] += countAnd(q, td.lined);
    pooled[4] += countAnd(q, td.covered);
    pooled[5] += countAnd(q, td.missed);
  }
  const [g, won, lost, lined, cov, miss] = pooled;
  const ctx = { M: DEFS, teams: fbsNow.size };
  const out = new Map<number, TeamStreak[]>();
  for (const dir of dirs) {
    const [hit, n] = dir === 'W' ? [won, g] : dir === 'L' ? [lost, g] : dir === 'C' ? [cov, lined] : [miss, lined];
    const lens = runs.map((r) => r[dir]?.len ?? 0);
    const field = lens.filter(Boolean).length;
    data.forEach((td, t) => {
      const run = runs[t][dir];
      if (!run) return;
      const mined = {
        chips, dir, scope: 'active' as const, len: run.len, atEdge: run.atEdge, field, live: true, also: 0,
        startSe: td.gs[run.startIdx].se, endSe: td.gs[run.lastIdx].se, p: n ? hit / n : 1, n,
      };
      const s: TeamStreak = {
        chips, dir, len: run.len, atEdge: run.atEdge, field,
        rank: 1 + lens.filter((l) => l > run.len).length,
        tied: lens.filter((l) => l === run.len).length,
        next: pre ? upcomingOf(td.ti).find((u) => u.ep >= todayEp && pre(u)) ?? null : null,
        since: mined.startSe,
        chance: chanceOf(mined, ctx),
        score: crownScore(mined, ctx),
      };
      const list = out.get(td.ti);
      if (list) list.push(s); else out.set(td.ti, [s]);
    });
  }
  return out;
}

let cache: { todayEp: number; byTeam: Map<number, TeamStreak[]> } | null = null;

/**
 * Every team's current streaks under no condition and under each single one.
 * A chip that keeps nearly every game ("on a weekend") barely filters, so it
 * never names a crown; it names no row here either.
 */
function singleStreaks(todayEp: number): Map<number, TeamStreak[]> {
  if (cache?.todayEp === todayEp) return cache.byTeam;
  const byTeam = new Map<number, TeamStreak[]>([...fbsNow].map((ti) => [ti, []]));
  const loose = nearUniversalChips();
  for (const c of [null, ...PLAIN_CHIPS.filter((_, i) => !loose.has(i))]) {
    for (const [ti, list] of streaksUnder(c ? [c.key] : [], todayEp)) byTeam.get(ti)!.push(...list);
  }
  cache = { todayEp, byTeam };
  return byTeam;
}

/** The most surprising first: the King-of list's order. */
const byInterest = (a: TeamStreak, b: TeamStreak) => b.score - a.score || b.len - a.len;

// the same run told with more words: a slice of it under fewer conditions is already on the list
const sliceOf = (c: TeamStreak, s: TeamStreak) => s.dir === c.dir && s.len === c.len && s.since === c.since
  && s.chips.length < c.chips.length && s.chips.every((k) => c.chips.includes(k));

/**
 * A team's current streaks worth reading, best first: its single-condition
 * ones of LEN_FLOOR or more games, or that it alone leads, plus the
 * multi-condition ones it is king of (`crowns`, its active crowns; null
 * while they load) that aren't a single-condition run retold.
 */
export function teamStreaks(ti: number, todayEp: number, crowns: Crown[] | null = null): TeamStreak[] {
  const singles = (singleStreaks(todayEp).get(ti) ?? []).filter(worthShowing);
  const list = [...singles];
  for (const cr of crowns ?? []) {
    if (cr.scope !== 'active' || cr.chips.length < 2 || !SHEET_DIRS.includes(cr.dir)) continue;
    const s = streaksUnder(cr.chips, todayEp).get(ti)?.find((x) => x.dir === cr.dir);
    if (s && !singles.some((x) => sliceOf(s, x))) list.push(s);
  }
  return list.sort(byInterest);
}

/** The streaks a scheduled game puts on the line: the ones whose next qualifying game it is. */
export const streaksOn = (list: TeamStreak[], game: UpcomingRow): TeamStreak[] => list.filter((s) => s.next?.i === game.i);

// --- head-to-head: the team's run against one exact opponent ---

let pooledRates: { W: number; L: number } | null = null;
/**
 * How often `dir` happens to a team playing `opp`: the opponent's own record
 * mirrored (losing to them is what they do to everyone), or the pooled rate
 * over every team's games when the opponent is below FBS. Clamped: a
 * perfect record would make any run against it free or impossible.
 */
export function h2hRate(opp: number, dir: 'W' | 'L'): number {
  const gs = gamesOf(opp);
  let p: number;
  if (gs.length) {
    p = gs.filter((g) => g.r === (dir === 'W' ? 'L' : 'W')).length / gs.length;
  } else {
    if (!pooledRates) {
      let n = 0, w = 0, l = 0;
      for (const ti of fbsNow) for (const g of gamesOf(ti)) { n++; if (g.r === 'W') w++; else if (g.r === 'L') l++; }
      pooledRates = { W: w / n, L: l / n };
    }
    p = pooledRates[dir];
  }
  return Math.min(0.995, Math.max(0.05, p));
}

/**
 * The team's current head-to-head run against a scheduled game's opponent,
 * when it's worth telling: LEN_FLOOR or more straight wins or losses across
 * their meetings. Scored like any streak, with the meetings' span counted,
 * so an 18-year reign over a rival outranks a 4-game run.
 */
export function h2hStreakOn(ti: number, game: UpcomingRow): TeamStreak | null {
  const ms = gamesOf(ti).filter((g) => g.oppIdx === game.oppIdx);
  const last = ms.at(-1);
  if (!last || last.r === 'T') return null;
  const dir = last.r;
  let i = ms.length - 1;
  while (i >= 0 && ms[i].r === dir) i--;
  const len = ms.length - 1 - i;
  if (len < LEN_FLOOR) return null;
  const first = ms[i + 1];
  const mined = {
    chips: ['vsteam'], dir: dir as Dir, scope: 'active' as const, len, atEdge: i < 0, field: 2, live: true, also: 0,
    startSe: first.se, endSe: last.se, p: h2hRate(game.oppIdx, dir), n: ms.length,
  };
  const ctx = { M: DEFS, teams: fbsNow.size };
  return {
    chips: ['vsteam'], vs: game.oppIdx, dir, len, atEdge: i < 0, rank: 1, tied: 1, field: 2,
    next: game, since: first.se, chance: chanceOf(mined, ctx), score: crownScore(mined, ctx),
  };
}

/** "T-3rd": the rank, marked when shared. */
export const rankText = (s: Pick<TeamStreak, 'rank' | 'tied'>) => (s.tied > 1 ? 'T-' : '') + ordinal(s.rank);

/** Current FBS teams, by name, for the team picker. */
export const teamList = () => [...fbsNow].sort((a, b) => teams[a].name.localeCompare(teams[b].name));

/** One scheduled game, once, whichever side it was read from. */
export interface ScheduledGame {
  i: number;
  ep: number;
  wk: number;
  home: number;
  away: number;
  neutral: boolean;
  hh: number;
  homeRank: number | null;
  awayRank: number | null;
  /** The line from the home side, + = home underdog; null when unlined. */
  sp: number | null;
  /** The game from each FBS side. */
  sides: { ti: number; row: UpcomingRow }[];
}

let scheduled: ScheduledGame[] | null = null;
/** Every scheduled game with an FBS side, by date, then kickoff (unknown last), then home team. */
export function scheduledGames(): ScheduledGame[] {
  if (scheduled) return scheduled;
  const byI = new Map<number, ScheduledGame>();
  for (const ti of fbsNow) {
    for (const u of upcomingOf(ti)) {
      const g = byI.get(u.i);
      if (g) { g.sides.push({ ti, row: u }); continue; }
      byI.set(u.i, {
        i: u.i, ep: u.ep, wk: u.wk, neutral: u.neutral, hh: u.hh,
        home: u.home ? ti : u.oppIdx, away: u.home ? u.oppIdx : ti,
        homeRank: u.home ? u.ownRank : u.oppRank, awayRank: u.home ? u.oppRank : u.ownRank,
        sp: u.sp == null ? null : u.home ? u.sp : -u.sp,
        sides: [{ ti, row: u }],
      });
    }
  }
  const hour = (h: number) => (h === 31 ? 99 : h);
  scheduled = [...byI.values()].sort((a, b) => a.ep - b.ep || hour(a.hh) - hour(b.hh) || teams[a.home].name.localeCompare(teams[b.home].name));
  return scheduled;
}

/** "Georgia -25", "PK", or null when the game has no line. */
export function lineText(g: Pick<ScheduledGame, 'home' | 'away' | 'sp'>): string | null {
  if (g.sp == null) return null;
  if (g.sp === 0) return 'PK';
  return `${teams[g.sp < 0 ? g.home : g.away].name} ${spreadText(-Math.abs(g.sp))}`;
}

/** The streak either side puts most on the line in the game: the highest score among them, with its team. */
export function topOnLine(g: ScheduledGame, todayEp: number): { ti: number; s: TeamStreak } | null {
  let best: { ti: number; s: TeamStreak } | null = null;
  for (const { ti, row } of g.sides) {
    for (const s of streaksOn(teamStreaks(ti, todayEp), row)) {
      if (!best || s.score > best.s.score) best = { ti, s };
    }
    const h = h2hStreakOn(ti, row);
    if (h && (!best || h.score > best.s.score)) best = { ti, s: h };
  }
  return best;
}

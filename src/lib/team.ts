// What a team page and a matchup show about one team: its season record, its
// rank, its next game, and its current streaks under every single condition,
// each with its place in the field.
//
// The streaks are every team's at once (one pass per condition over the
// crowns miner's bitmasks), kept per day, so a second team costs nothing. A team's list adds
// the multi-condition streaks it is king of (its crowns) and sorts streaks
// with a qualifying game still on the schedule first, then by crownRank's
// score: how far the run sits past what chance would produce.

import type { Crown, Dir, GameRow, UpcomingRow } from './types.ts';
import { P, teams, fbsNow, gamesOf, upcomingOf } from './model.ts';
import { PLAIN_CHIPS, conflicts, fitsDir, qualifiesPregame } from './chips.ts';
import type { PregameChip } from './chips.ts';
import { teamData, walkActive, spreadWalk } from './crowns.ts';
import type { Run } from './crowns.ts';
import { crownScore, chanceOf } from './crownRank.ts';
import { ordinal } from './sentence.ts';

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

/** The team's next scheduled game. */
export const nextGameOf = (ti: number, todayEp: number): UpcomingRow | null => upcomingOf(ti).find((u) => u.ep >= todayEp) ?? null;

/** The team's scheduled game against `opp`, else its next game: a matchup link read after that game was played still lands on one. */
export function gameVs(ti: number, opp: number | null, todayEp: number): UpcomingRow | null {
  const ahead = upcomingOf(ti).filter((u) => u.ep >= todayEp);
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
const DEFS = (() => {
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

/** Every team's current streaks under no condition and under each single one. */
function singleStreaks(todayEp: number): Map<number, TeamStreak[]> {
  if (cache?.todayEp === todayEp) return cache.byTeam;
  const byTeam = new Map<number, TeamStreak[]>([...fbsNow].map((ti) => [ti, []]));
  for (const c of [null, ...PLAIN_CHIPS]) {
    for (const [ti, list] of streaksUnder(c ? [c.key] : [], todayEp)) byTeam.get(ti)!.push(...list);
  }
  cache = { todayEp, byTeam };
  return byTeam;
}

/** Streaks with a scheduled qualifying game first, then the most surprising. */
const byInterest = (a: TeamStreak, b: TeamStreak) => Number(!!b.next) - Number(!!a.next) || b.score - a.score || b.len - a.len;

/**
 * A team's current streaks worth reading, best first: its single-condition
 * ones of LEN_FLOOR or more games, or that it alone leads, plus the
 * multi-condition ones it is king of (`crowns`, its active crowns; null
 * while they load).
 */
export function teamStreaks(ti: number, todayEp: number, crowns: Crown[] | null = null): TeamStreak[] {
  const list = (singleStreaks(todayEp).get(ti) ?? []).filter(worthShowing);
  for (const cr of crowns ?? []) {
    if (cr.scope !== 'active' || cr.chips.length < 2 || !SHEET_DIRS.includes(cr.dir)) continue;
    const s = streaksUnder(cr.chips, todayEp).get(ti)?.find((x) => x.dir === cr.dir);
    if (s) list.push(s);
  }
  return list.sort(byInterest);
}

/** The streaks a scheduled game puts on the line: the ones whose next qualifying game it is. */
export const streaksOn = (list: TeamStreak[], game: UpcomingRow): TeamStreak[] => list.filter((s) => s.next?.i === game.i);

/** "T-3rd": the rank, marked when shared. */
export const rankText = (s: Pick<TeamStreak, 'rank' | 'tied'>) => (s.tied > 1 ? 'T-' : '') + ordinal(s.rank);

/** Current FBS teams, by name, for the team picker. */
export const teamList = () => [...fbsNow].sort((a, b) => teams[a].name.localeCompare(teams[b].name));

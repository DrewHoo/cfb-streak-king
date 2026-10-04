// The streaks broken in the last completed week: the runs that were alive
// under the empty definition or a single plain condition (the team page's
// space) until a result that week ended them, plus head-to-head runs against
// the opponents actually played ("Michigan had won 18 straight vs
// Minnesota"). Each is scored like a crown — how far past chance the run
// sat — with one telling kept per broken run, the field it ranked in as the
// week began, and the game that broke it. The schedule shows the digest.
//
// Weeks are the schedule's: cfbfastR's week runs Tuesday through Monday, so
// the Labor Day Monday game ends week 1. The scheduled games carry wk, and
// one offset turns a date into a week number; the last completed week is the
// one holding the latest recorded current-season game.

import type { Dir, GameRow } from './types.ts';
import { P, teams, fbsNow, gamesOf } from './model.ts';
import { FLAG } from './schema.ts';
import { PLAIN_CHIPS, chipByKey, fitsDir } from './chips.ts';
import { matches } from './streaks.ts';
import { teamData, nearUniversalChips } from './crowns.ts';
import { crownScore, chanceOf } from './crownRank.ts';
import type { MinedCrown } from './crownRank.ts';
import { DEFS, LEN_FLOOR, fitsSite, h2hRate } from './team.ts';
import type { H2hSite } from './team.ts';

/** One run a result last week ended. */
export interface BrokenStreak {
  ti: number;
  chips: string[];
  /** Set when the run is head-to-head: the opponent "vsteam" means. */
  vs?: number;
  dir: Dir;
  len: number;
  atEdge: boolean;
  /** Entering the week: 1 = the definition's longest, among `field` teams holding one. */
  rank: number;
  tied: number;
  field: number;
  /** The season the run started in. */
  since: number;
  /** The game that broke it, from ti's side. */
  ender: GameRow;
  chance: number;
  score: number;
  /** The run's board: the all-time row starting at `run` (its first game's epoch day). */
  scope: 'all';
  run: number;
}

export interface BrokenWeek {
  /** The schedule's number for the week; null when no scheduled game pins one down. */
  wk: number | null;
  /** The week's first and last completed game. */
  lo: number;
  hi: number;
  /** The runs worth telling, the furthest past chance first. */
  list: BrokenStreak[];
}

export const BROKEN_CAP = 12;
/** A broken run scoring under this isn't news. */
export const BROKEN_CUTOFF = -2.5;

// 1970-01-06, a Tuesday; weeks run Tuesday through Monday
const TUE = 5;
const weekIdx = (ep: number) => Math.floor((ep - TUE) / 7);

/** One completed week of the running season: its grid index, its schedule number, and its games' span. */
export interface CompletedWeek { w: number; wk: number | null; lo: number; hi: number }

let weekList: CompletedWeek[] | null = null;
/** Every completed week of the running season, in order. Empty before any result. */
export function completedWeeks(): CompletedWeek[] {
  if (weekList) return weekList;
  // the offset the scheduled games agree on turns a grid index into the schedule's week number
  const counts = new Map<number, number>();
  const u = P.upcoming;
  for (let i = 0; i < (u?.ep.length ?? 0); i++) {
    if (u.fl[i] & FLAG.post) continue;
    const k = u.wk[i] - weekIdx(u.ep[i]);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const K = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const { se, ep } = P.games;
  const out: CompletedWeek[] = [];
  for (let i = se.length - 1; i >= 0 && se[i] === P.currentSeason; i--) {
    const w = weekIdx(ep[i]);
    const cur = out[0];
    if (cur && cur.w === w) cur.lo = Math.min(cur.lo, ep[i]);
    else out.unshift({ w, wk: K == null ? null : w + K, lo: ep[i], hi: ep[i] });
  }
  return (weekList = out);
}

const DIRS: Dir[] = ['W', 'L', 'C', 'N'];
const bit = (m: Uint32Array, i: number) => (m[i >> 5] & (1 << (i & 31))) !== 0;

// Every run under the empty definition or one plain chip that a week-`w`
// game ended: walk each team's qualifying games split at the week's Tuesday,
// take the trailing run entering the week, extend it through the week's
// games until one misses.
function minePlain(w: number): BrokenStreak[] {
  const data = teamData();
  const loose = nearUniversalChips(data);
  const ctx = { M: DEFS, teams: fbsNow.size };
  const wlo = w * 7 + TUE;
  const out: BrokenStreak[] = [];
  for (const ci of [null, ...PLAIN_CHIPS.map((_, i) => i).filter((i) => !loose.has(i))]) {
    const chip = ci == null ? null : PLAIN_CHIPS[ci];
    const chips = chip ? [chip.key] : [];
    const dirs = DIRS.filter((d) => !chip || fitsDir(chip, d));
    // the definition's qualifying games per team and its pooled outcome rates
    const pooled = [0, 0, 0, 0, 0, 0]; // [games, won, lost, lined, covered, missed]
    const perTeam = data.map((td) => {
      const mask = ci == null ? null : td.masks[ci];
      const all: number[] = [];
      const lined: number[] = [];
      for (let i = 0; i < td.n; i++) {
        if (mask && !bit(mask, i)) continue;
        const g = td.gs[i];
        all.push(i);
        pooled[0]++;
        if (g.r === 'W') pooled[1]++; else if (g.r === 'L') pooled[2]++;
        if (g.cover != null) { lined.push(i); pooled[3]++; if (g.cover === 'W') pooled[4]++; else if (g.cover === 'L') pooled[5]++; }
      }
      return { td, all, lined };
    });
    const [g, won, lost, ln, cov, miss] = pooled;
    for (const dir of dirs) {
      const spread = dir === 'C' || dir === 'N';
      const [hit, n] = dir === 'W' ? [won, g] : dir === 'L' ? [lost, g] : dir === 'C' ? [cov, ln] : [miss, ln];
      // each team's trailing run as the week began; their lengths are the field
      const entries = perTeam.map(({ td, all, lined }) => {
        const q = spread ? lined : all;
        let cut = q.length;
        while (cut > 0 && td.gs[q[cut - 1]].ep >= wlo) cut--;
        let i = cut - 1;
        while (i >= 0 && matches(dir, td.gs[q[i]])) i--;
        return { td, q, cut, pre: cut - 1 - i, start: i + 1 };
      });
      const lens = entries.map((e) => e.pre);
      const field = lens.filter(Boolean).length;
      for (const e of entries) {
        let len = e.pre;
        let ender: GameRow | null = null;
        let last = e.cut - 1;
        for (let k = e.cut; k < e.q.length; k++) {
          const row = e.td.gs[e.q[k]];
          if (row.ep > wlo + 6) break; // a run that survives the whole week isn't broken
          if (matches(dir, row)) { len++; last = k; } else { ender = row; break; }
        }
        if (!ender || len < LEN_FLOOR) continue;
        const first = e.td.gs[e.q[e.start]];
        const mined: MinedCrown = {
          chips, dir, scope: 'active', len, atEdge: e.start === 0, field, live: false, also: 0,
          startSe: first.se, endSe: e.td.gs[e.q[last]].se, p: n ? hit / n : 1, n,
        };
        out.push({
          ti: e.td.ti, chips, dir, len, atEdge: e.start === 0, field,
          rank: 1 + lens.filter((l) => l > len).length, tied: Math.max(1, lens.filter((l) => l === len).length),
          since: first.se, ender, chance: chanceOf(mined, ctx), score: crownScore(mined, ctx), scope: 'all', run: first.ep,
        });
      }
    }
  }
  return out;
}

// Head-to-head runs a week-`w` meeting ended: for each game that week, the
// trailing run of straight wins or losses across the pair's meetings —
// every meeting, and only the meetings at the game's site ("18 straight at
// Minnesota" survives a home loss in between). One telling per broken run,
// the best-scoring. A broken losing run is the winner's side of the same
// story, so it only stands when the other side isn't told (the winner was
// below FBS).
function mineH2H(w: number): BrokenStreak[] {
  const ctx = { M: DEFS, teams: fbsNow.size };
  const out: BrokenStreak[] = [];
  for (const ti of fbsNow) {
    const gs = gamesOf(ti);
    for (let i = gs.length - 1; i >= 0 && gs[i].se === P.currentSeason; i--) {
      const x = gs[i];
      if (weekIdx(x.ep) !== w) continue;
      const gameSite: H2hSite = x.neutral ? null : x.home ? 'home' : 'road';
      for (const dir of ['W', 'L'] as const) {
        if (matches(dir, x)) continue;
        for (const site of gameSite ? [null, gameSite] : [null]) {
          let len = 0;
          let start = i;
          let endSe: number | null = null;
          let atEdge = true;
          for (let j = i - 1; j >= 0; j--) {
            if (gs[j].oppIdx !== x.oppIdx || !fitsSite(site, gs[j])) continue;
            if (!matches(dir, gs[j])) { atEdge = false; break; }
            len++;
            start = j;
            endSe ??= gs[j].se; // the run's last meeting, nearest the ender
          }
          if (len < LEN_FLOOR) continue;
          const first = gs[start];
          const chips = site ? [site, 'vsteam'] : ['vsteam'];
          const mined: MinedCrown = {
            chips, dir, scope: 'active', len, atEdge, field: 2, live: false, also: 0,
            startSe: first.se, endSe: endSe!, p: h2hRate(x.oppIdx, dir, site), n: len + 1,
          };
          out.push({
            ti, chips, vs: x.oppIdx, dir, len, atEdge, rank: 1, tied: 1, field: 2,
            since: first.se, ender: x, chance: chanceOf(mined, ctx), score: crownScore(mined, ctx), scope: 'all', run: first.ep,
          });
        }
      }
    }
  }
  const told = out.filter((b) => b.dir === 'W'
    || !out.some((o) => o.dir === 'W' && o.ti === b.vs && o.vs === b.ti && o.ender.i === b.ender.i));
  const best = new Map<string, BrokenStreak>();
  for (const b of told) {
    const k = `${b.ti}|${b.dir}|${b.ender.i}`;
    const cur = best.get(k);
    if (!cur || b.score > cur.score) best.set(k, b);
  }
  return [...best.values()];
}

const cache = new Map<number, BrokenWeek>();

function digest(win: CompletedWeek): BrokenWeek {
  const got = cache.get(win.w);
  if (got) return got;
  const best = new Map<string, BrokenStreak>();
  for (const b of minePlain(win.w)) {
    const k = `${b.ti}|${b.dir}|${b.ender.i}`;
    const cur = best.get(k);
    if (!cur || b.score > cur.score) best.set(k, b);
  }
  const list = [...best.values(), ...mineH2H(win.w)]
    .filter((b) => b.score >= BROKEN_CUTOFF)
    .sort((a, b) => b.score - a.score || b.len - a.len)
    .slice(0, BROKEN_CAP);
  const out = { wk: win.wk, lo: win.lo, hi: win.hi, list };
  cache.set(win.w, out);
  return out;
}

/**
 * The digest of one completed week, by its schedule number: the streaks
 * broken that week worth telling, best first, one telling per run — a team,
 * a direction and the game that broke it keep only their highest-scoring
 * definition. Null for a week with no results yet (or whose number nothing
 * scheduled pins down).
 */
export function brokenWeek(wk: number): BrokenWeek | null {
  const win = completedWeeks().find((x) => x.wk === wk);
  return win ? digest(win) : null;
}

/** The digest of the last completed week. Null before any current-season game has a result. */
export function brokenLastWeek(): BrokenWeek | null {
  const win = completedWeeks().at(-1);
  return win ? digest(win) : null;
}

/** The claim a broken run makes, in plain words: "Michigan had won 18 straight on the road vs Minnesota". */
export function brokenClaim(b: BrokenStreak): string {
  const verb = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' }[b.dir as 'W' | 'L' | 'C' | 'N'];
  const words = b.chips.map((k) => (k === 'vsteam' && b.vs != null ? `vs ${teams[b.vs]?.name ?? '?'}` : chipByKey.get(k)?.label ?? k)).join(' ');
  return `${teams[b.ti]?.name} ${verb} ${b.len}${b.atEdge ? '+' : ''} straight${words ? ` ${words}` : ''}`;
}

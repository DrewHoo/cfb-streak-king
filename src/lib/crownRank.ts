// Which of a team's crowns to show, and in what order. Pure: crowns.ts mines
// the crowns with each definition's pooled rate, this scores and filters them.
//
// The score is how far the king sits past where chance would put the pack's
// leader, in bits, less the cost of the definition:
//
//   len·log2(1/p)          each game of the run, weighted by how rare it is
//   − chance               log2 of the teams in the field (active), or of
//                          every place a run could start (all-time)
//   − chipW·log2(M[k])     M[k] = how many k-chip definitions the miner walks
//   − postBits per chip read from the game's own play
//   + span·log2(seasons)   a run across decades is a story in itself
//
// p is the outcome's rate over every current FBS team's qualifying games
// (createModel's baseRate). Then a team's list drops a crown when:
//   - a crown with a subset of its chips, same outcome and overlapping
//     seasons, scores as well (a slice of the same run)
//   - it's an undefeated run identical to a winning one
//   - (all-time) it retells a better crown's era: same outcome, one
//     definition inside the other, most of the seasons shared
//   - it scores under the cutoff, unless it has no chips
// and shows its top `fallback` when nothing is left. The weights were set by
// eye with the crown tuner (scripts/tuner/), which reads them from here.

import type { Crown, Dir } from './types.ts';
import { chipByKey } from './chips.ts';

export const RANK = {
  chanceW: 1,
  chipW: 0.75,
  postBits: 7,
  spanA: 0.75,
  spanAll: 1.75,
  cutoff: -6.5,
  fallback: 3,
  /** Percent of the shorter run's seasons two all-time runs share to be one era. */
  eraOv: 50,
};

/**
 * Chips read from the game's own play. The catalog's pregame flag is wider:
 * the previous-result and betting chips are post() there because a scheduled
 * game can't be decided by them, not because they describe how it went.
 */
export const IN_GAME_GROUPS = new Set(['half', 'possession', 'shape']);

/** A mined crown with its definition's pooled rate and qualifying-game count, before its chance is worked out. */
export type MinedCrown = Omit<Crown, 'chance'> & { p: number; n: number };
export interface RankContext {
  /** Definitions with each chip count, 0–4. */
  M: number[];
  /** Teams that can hold a streak. */
  teams: number;
}

const P_MAX = 0.995;
const seasons = (c: Omit<Crown, 'chance'>) => (c.startSe != null && c.endSe != null ? c.endSe - c.startSe + 1 : 1);
const inGame = (c: Omit<Crown, 'chance'>) => c.chips.filter((k) => IN_GAME_GROUPS.has(chipByKey.get(k)?.group ?? '')).length;

/**
 * How likely chance alone makes a streak this long under the definition: each
 * of the places a run could start (every team, for an active streak; every
 * non-matching game, all-time) gets p^len, as independent tries.
 */
export function chanceOf(c: MinedCrown, ctx: RankContext): number {
  const p = Math.min(c.p, P_MAX);
  const tries = c.scope === 'active' ? ctx.teams : Math.max(1, c.n * (1 - p));
  return -Math.expm1(tries * Math.log1p(-(p ** c.len)));
}

export function crownScore(c: MinedCrown, ctx: RankContext, w = RANK): number {
  const p = Math.min(c.p, P_MAX);
  const chance = c.scope === 'active' ? Math.log2(ctx.teams) : Math.log2(Math.max(2, c.n * (1 - p)));
  const span = c.scope === 'active' ? w.spanA : w.spanAll;
  return c.len * Math.log2(1 / p)
    - w.chanceW * chance
    - w.chipW * Math.log2(ctx.M[c.chips.length])
    - w.postBits * inGame(c)
    + span * Math.log2(seasons(c));
}

const finish = (c: MinedCrown, ctx: RankContext): Crown => { const { p: _p, n: _n, ...rest } = c; return { ...rest, chance: chanceOf(c, ctx) }; };

/** One team's crowns in one scope: the ones worth showing, best first. */
export function rankCrowns(list: MinedCrown[], ctx: RankContext, w = RANK): Crown[] {
  const score = new Map(list.map((c) => [c, crownScore(c, ctx, w)]));
  const subsetOf = (a: Omit<Crown, 'chance'>, b: Omit<Crown, 'chance'>) => a.chips.length < b.chips.length && a.chips.every((k) => b.chips.includes(k));
  const overlap = (a: Omit<Crown, 'chance'>, b: Omit<Crown, 'chance'>) => !(a.endSe! < b.startSe! || b.endSe! < a.startSe!);
  const sameRun = (a: Omit<Crown, 'chance'>, b: Omit<Crown, 'chance'>) => a.len === b.len && a.startSe === b.startSe && a.endSe === b.endSe
    && a.chips.length === b.chips.length && a.chips.every((k) => b.chips.includes(k));
  let kept = list.filter((c) => (
    !list.some((o) => o.dir === c.dir && subsetOf(o, c) && overlap(o, c) && score.get(o)! >= score.get(c)!)
    && !(c.dir === 'U' && list.some((o) => o.dir === 'W' && sameRun(o, c)))
  ));
  kept.sort((a, b) => score.get(b)! - score.get(a)!);
  if (kept[0]?.scope === 'all') {
    const eras: MinedCrown[] = [];
    for (const c of kept) {
      const same = eras.some((e) => {
        // unrelated definitions in the same years are different stories
        if (e.dir !== c.dir || !(subsetOf(e, c) || subsetOf(c, e))) return false;
        const shared = Math.min(e.endSe!, c.endSe!) - Math.max(e.startSe!, c.startSe!) + 1;
        return shared > 0 && shared / Math.min(seasons(e), seasons(c)) >= w.eraOv / 100;
      });
      if (!same) eras.push(c);
    }
    kept = eras;
  }
  const pass = kept.filter((c) => score.get(c)! >= w.cutoff || c.chips.length === 0);
  return (pass.length ? pass : kept.slice(0, w.fallback)).map((c) => finish(c, ctx));
}


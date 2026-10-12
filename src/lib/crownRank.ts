// Which of a team's streaks to show, and in what order. Pure: crowns.ts
// mines every team's run under every definition with the definition's
// pooled rate and the run's place in the field, this scores and filters.
//
// The score is how far the run sits past what chance would produce, in
// bits, less the cost of the definition's words:
//
//   len·log2(1/p)          each game of the run, weighted by how rare it is
//   + gapW·gap·log2(1/p)   gap = the run's lead over the longest any other
//                          team holds; negative for a run that doesn't lead,
//                          so a sole leader outranks a longer run that sits
//                          2nd (fans want what their team is the best at).
//                          `gapFloor` caps the term from below when set.
//   − chance               log2 of the teams in the field (active), or of
//                          every place a run could start (all-time)
//   − Σ word cost          each chip costs by tier: what fans say unprompted
//                          (at home, vs Georgia) is cheap, plain qualifiers
//                          more, almanac trivia (vs orange schools, in
//                          November) dear, and a chip read from the game's
//                          own play dearest; plus log2 of the chip's choices,
//                          since "vs Tennessee" is one of 288 opponents the
//                          walk tried (vsteam 1 + 8.2 bits, state 9 + 5.6)
//   + span·log2(seasons)   a run across decades is a story in itself
//
// p is the outcome's rate over every current FBS team's qualifying games
// (createModel's baseRate). Then a team's list drops a run when:
//   - it's an undefeated run identical to a winning one, or a winning or
//     losing run identical to one told by its margin ("won 12 straight by
//     10+" says "won 12 straight" and more)
//   - (all-time) it retells a better run's era: same outcome, one
//     definition inside the other, most of the seasons shared
//   - it scores under the cutoff, unless it has no chips
// and shows its top `fallback` when nothing is left. A run the team tells
// at least as long under a subset of its conditions ("at home at night, 5"
// beside "at night, 10") is a shorter telling, kept but flagged `dup`
// (markDups) and shown on request; with `olderStands`, a shorter telling
// that started before the longer run stands on its own. The weights were
// set by eye on the crown score review (claude.ai/artifact/XpW5iUtEUGnVJVWJPz3k2v).

import type { Crown, Dir, Scope } from './types.ts';
import { baseDir, isMargin } from './outcome.ts';
import { baseKey, choicesOf } from './minedChips.ts';

export type Tier = 'brag' | 'plain' | 'trivia' | 'ingame';

export const RANK = {
  chanceW: 1,
  /** Bits a chip of each tier costs. */
  tiers: { brag: 1, plain: 3, trivia: 9, ingame: 12 } as Record<Tier, number>,
  gapW: 0.75,
  /** The gap term's floor, in games; null lets a trailing run pay its full gap. */
  gapFloor: null as number | null,
  spanA: 0.75,
  spanAll: 1.75,
  cutoff: -6.5,
  fallback: 3,
  /** Percent of the shorter run's seasons two all-time runs share to be one era. */
  eraOv: 50,
  /** A shorter telling that started before the longer run under fewer conditions is not a dup. */
  olderStands: true,
};

// each catalog chip's tier; a derived chip ("vsteam:alabama") goes by its catalog key
const TIERS: Record<Tier, string[]> = {
  brag: ['home', 'road', 'confgame', 'ranked', 'top10', 'top5', 'rivalry', 'postseason', 'night', 'dog', 'dog7', 'dog14', 'afterloss', 'vsteam', 'vsconf'],
  plain: ['unranked', 'whileranked', 'whileunranked', 'nonconf', 'power', 'member', 'instate', 'neutral', 'away', 'fav', 'close', 'curcoach', 'newcoach', 'opener', 'finale', 'leadhalf', 'trailhalf'],
  trivia: ['fullmoon', 'weekday', 'weekend', 'vsnewcoach', 'afterbye', 'afterwin', 'vscolor', 'vsmascot', 'month', 'state'],
  ingame: ['wonpos', 'lostpos', 'onescore', 'shootout', 'struggle', 'overtime'],
};
const tierByKey = new Map<string, Tier>();
for (const [tier, keys] of Object.entries(TIERS) as [Tier, string[]][]) for (const k of keys) tierByKey.set(k, tier);
/** A mined key's tier; a chip the table doesn't name costs as a plain one. */
export const tierOf = (key: string): Tier => tierByKey.get(baseKey(key)) ?? 'plain';

/** A mined run with its definition's pooled rate and qualifying-game count, before its chance, score and dup flag are worked out. */
export type MinedCrown = Omit<Crown, 'chance' | 'score' | 'dup'> & { p: number; n: number };

type Telling = { chips: readonly string[]; dir: Dir; len: number; scope?: Scope; startSe?: number; endSe?: number };
const subsetOf = (a: Telling, b: Telling) => a.chips.length < b.chips.length && a.chips.every((k) => b.chips.includes(k));
const overlap = (a: Telling, b: Telling) => a.endSe == null || b.endSe == null || a.startSe == null || b.startSe == null || !(a.endSe < b.startSe || b.endSe < a.startSe);
/**
 * Whether `r` is a shorter telling among `rows` (one team's, one list): some
 * row of the same outcome under a strict subset of its conditions runs at
 * least as long (and, all-time, overlaps it in seasons), unless `olderStands`
 * and `r` started first.
 */
export function isDup(r: Telling, rows: readonly Telling[], w = RANK): boolean {
  return rows.some((o) => o !== r && o.dir === r.dir && subsetOf(o, r) && o.len >= r.len
    && (r.scope !== 'all' || overlap(o, r))
    && !(w.olderStands && r.startSe != null && o.startSe != null && r.startSe < o.startSe));
}
/** Each row with its `dup` flag set against the others. */
export const markDups = <T extends Telling>(rows: T[], w = RANK): (T & { dup: boolean })[] => rows.map((r) => ({ ...r, dup: isDup(r, rows, w) }));
export interface RankContext {
  /** Teams that can hold a streak. */
  teams: number;
}

const P_MAX = 0.995;
const seasons = (c: Pick<Crown, 'startSe' | 'endSe'>) => (c.startSe != null && c.endSe != null ? c.endSe - c.startSe + 1 : 1);

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

/** The words' cost in bits: each chip by its tier, plus the choice it is among its kind. */
export const wordCost = (chips: readonly string[], w = RANK) => chips.reduce((a, k) => a + w.tiers[tierOf(k)] + Math.log2(choicesOf(k)), 0);

export function crownScore(c: MinedCrown, ctx: RankContext, w = RANK): number {
  const p = Math.min(c.p, P_MAX);
  const b = Math.log2(1 / p);
  const chance = c.scope === 'active' ? Math.log2(ctx.teams) : Math.log2(Math.max(2, c.n * (1 - p)));
  const span = c.scope === 'active' ? w.spanA : w.spanAll;
  const gap = w.gapFloor == null ? c.len - c.second : Math.max(w.gapFloor, c.len - c.second);
  return c.len * b
    + w.gapW * gap * b
    - w.chanceW * chance
    - wordCost(c.chips, w)
    + span * Math.log2(seasons(c));
}

const finish = (c: MinedCrown, ctx: RankContext, w: typeof RANK): Omit<Crown, 'dup'> => {
  const { p: _p, n: _n, ...rest } = c;
  return { ...rest, chance: chanceOf(c, ctx), score: crownScore(c, ctx, w) };
};

/** One team's runs in one scope: the ones worth showing, best first. */
export function rankCrowns(list: MinedCrown[], ctx: RankContext, w = RANK): Crown[] {
  const score = new Map(list.map((c) => [c, crownScore(c, ctx, w)]));
  const sameRun = (a: MinedCrown, b: MinedCrown) => a.len === b.len && a.startSe === b.startSe && a.endSe === b.endSe
    && a.chips.length === b.chips.length && a.chips.every((k) => b.chips.includes(k));
  let kept = list.filter((c) => (
    !(c.dir === 'U' && list.some((o) => o.dir === 'W' && sameRun(o, c)))
    && !((c.dir === 'W' || c.dir === 'L') && list.some((o) => isMargin(o.dir) && baseDir(o.dir) === c.dir && sameRun(o, c)))
  ));
  kept.sort((a, b) => score.get(b)! - score.get(a)! || b.len - a.len);
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
  return markDups((pass.length ? pass : kept.slice(0, w.fallback)).map((c) => finish(c, ctx, w)), w);
}

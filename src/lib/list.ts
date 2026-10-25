// The list rule: the one algorithm behind every list of streaks on the site.
// Every view (a team page, a game page, the week's at-risk and broken
// digests, the breakers) is this rule over the mine, filtered to the view's
// slice; a view filters and may weight (at-risk by the chance the game ends
// the run, breakers by points), and never admits, re-words or re-includes.
// Pure: crowns.ts mines every team's run under every definition with its
// pooled rate and its place in the field; this decides, at page time, from
// the inputs a crowns file carries, with the knobs in LIST.
//
// A run is a set of games. The mine keeps each run under two definitions at
// most: the one with the fewest conditions, and the one the team places
// highest under, when that is a different definition (`highest`). A placing
// is the run under one of those definitions: the definition's conditions,
// the team's place in that field, and the rates the score reads.
//
//   admit  which runs are on any list: the team's place under either placing
//          is `admit.rank` or better (ties included); a broken run also when
//          it is the all-time longest under its definition. A list is one
//          part (`Part`): simple, the runs whose picked definition has at most
//          `admit.maxConditions` conditions (a margin outcome counts as one)
//          and no trivia chip (trivia.ts's list), or trivia, every other admitted run
//   pick   which definition a run is shown under: the fewest-conditions
//          placing that admits it, a simple one before a trivia one
//          (`pick: 'fewest'`), or the one the team
//          places highest under (`'highest'`); the other placing is kept on
//          the row as `other`
//   order  the score, in bits:
//            len·b                  each game of the run, by its rarity b
//            + leadW·lead·b         lead = the run's length past the longest
//                                   other team's run; negative for a run that
//                                   trails, so a sole leader outranks a longer
//                                   run that sits 2nd (fans want what their
//                                   team is best at)
//            − chance               log2 of the teams in the field (active), or
//                                   of every place a run could start (all-time)
//            − Σ condition cost     each chip by tier (brag 1, plain 3, trivia 9,
//                                   in-game 12) plus log2 of its choices ("vs
//                                   Tennessee" is one of 288 opponents the walk
//                                   tried; a rival's chip is one of the team's
//                                   rivals, by `rivalChoice`)
//            − sparseW·log2(games ÷ qualifying games)
//                                   a definition that keeps a sliver of the
//                                   team's schedule (11 of Alabama's 1,066 games)
//                                   pays for it; one that keeps every game pays
//                                   nothing
//            − marginCost           a by-10 outcome is a condition too
//            + rarityW·b            a hard definition gets a fixed lift, so four
//                                   wins on the road vs ranked teams sit nearer
//                                   thirty easy ones
//            + span·log2(seasons)   a run across decades is a story in itself
//          where b mixes the field's rate (p over every FBS team's qualifying
//          games) with the team's own under the definition by `rate`: at 0 a
//          run is measured against the field, at 1 against what this team
//          usually does, so a condition that only picks easy games for a
//          strong team stops looking rare. `bucket` > 0 sorts by score band
//          first, then rarity.
//   group  a row is a sub-streak (`subStreak`) when a strict subset of its
//          conditions has a run at least as long, unless it started first
//          (`olderStands`); the UI groups it under that row. All-time only,
//          the same-years rule drops a run that repeats another run of the
//          same years: same outcome, nested definitions, most seasons shared,
//          and (`sameYears.directed`) only the run with fewer conditions and
//          at least as many games can replace the other.
//
// The weights were set by eye on the crown score review, then the tuner
// (?tune=1 on any list; Tuner.jsx). list.test.ts pins the orderings that
// matter (golden orderings) and that every view nests in the rule.

import type { Crown, Dir, MinedCrown, Scope, Placing } from './types.ts';
import { baseDir, isMargin } from './outcome.ts';
import { baseKey, choicesOf } from './minedChips.ts';
import { fbsNow } from './model.ts';
import { MAX_SIMPLE, isTrivia } from './trivia.ts';

export type Tier = 'brag' | 'plain' | 'trivia' | 'ingame';
export type PickRule = 'fewest' | 'highest';
/** Which part of the admitted runs a list shows: the simple ones (every list but trivia), the trivia, or both (`any`). */
export type Part = 'simple' | 'trivia' | 'any';

export const LIST = {
  /**
   * The worst place a run may hold, under either placing, and be on a list; 1 is the field's leader, 3 the medal rule.
   * A simple run has at most `maxConditions` conditions (a margin counts as one) and, with `triviaChips`, no trivia chip (trivia.ts); the rest are trivia.
   */
  admit: { rank: 1, maxConditions: MAX_SIMPLE, triviaChips: true },
  /** Which of a run's placings a list shows: the fewest-conditions that admits, or the best-placed. */
  pick: 'fewest' as PickRule,
  /** How much a run is measured against the team's own rate under the definition (0 the field's, 1 the team's). */
  rate: 0.5,
  /** Games of prior toward the field's rate, so a team with few qualifying games stays near it. */
  rateShrink: 20,
  chanceW: 1,
  /** Bits a chip of each tier costs. */
  tiers: { brag: 1, plain: 3, trivia: 9, ingame: 12 } as Record<Tier, number>,
  leadW: 0.75,
  /** The gap term's floor, in games; null lets a trailing run pay its full gap. */
  leadFloor: null as number | null,
  spanA: 0.75,
  spanAll: 1.75,
  /** Bits a by-10 outcome costs, as a condition would. */
  marginCost: 3,
  /** Bits per doubling of how few of the team's games the definition keeps: log2(games ÷ qualifying games). */
  sparseW: 1,
  /** How much of the opponent chip's choice cost a rival gets back: at 1 "vs Auburn" is priced as one of Alabama's rivals, at 0 as one of 288 opponents. */
  rivalChoice: 1,
  /** A bonus of rarityW·b per run, whatever its length: a hard definition's fixed lift. */
  rarityW: 2.5,
  /** Score band width; rows sort by band, then rarity, then length. 0 is pure score. */
  bucket: 0,
  /** The same-years rule (all-time): only a simpler, longer run absorbs (`directed`); percent of the shorter run's seasons shared to be one story. */
  sameYears: { directed: true, overlap: 50 },
  /** A sub-streak that started before the longer run under fewer conditions is not a subStreak. */
  olderStands: true,
};
export type Knobs = typeof LIST;

// each catalog chip's tier; a derived chip ("vsteam:alabama") goes by its catalog key.
// The tiers are prices, and the miner's keep floor reads them (crowns.ts), so
// moving a chip between tiers re-mines; which chips make a streak trivia is
// trivia.ts's list, not the trivia tier.
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

export interface RankContext {
  /** Teams that can hold a streak. */
  teams: number;
}
/** The site's field: every current FBS team. */
export const CTX: RankContext = { teams: fbsNow.size };

const P_MAX = 0.995;
const seasons = (c: Pick<MinedCrown, 'startSe' | 'endSe'>) => (c.startSe != null && c.endSe != null ? c.endSe - c.startSe + 1 : 1);

/**
 * The conditions' cost in bits: each chip by its tier, plus the choice it is
 * among its kind. An opponent chip naming one of the team's `rivals` is a
 * choice among them, by `rivalChoice`, instead of among every opponent.
 */
export const conditionCost = (chips: readonly string[], w = LIST, rivals?: number) => chips.reduce((a, k) => {
  const choice = Math.log2(choicesOf(k));
  const rival = rivals && k.startsWith('vsteam:') ? w.rivalChoice * (choice - Math.log2(Math.max(1, rivals))) : 0;
  return a + w.tiers[tierOf(k)] + choice - rival;
}, 0);

/** A run's per-game rarity in bits: the field's rate and the team's own, shrunk toward the field, mixed by `rate`. */
export function rateOf(c: Placing, w = LIST): { pF: number; pT: number; b: number } {
  const pF = Math.min(c.p, P_MAX);
  const pT = Math.min((c.hT + w.rateShrink * pF) / (c.nT + w.rateShrink), P_MAX);
  const b = (1 - w.rate) * Math.log2(1 / pF) + w.rate * Math.log2(1 / Math.max(pT, 1e-9));
  return { pF, pT, b };
}

/**
 * How likely chance alone makes a streak this long under the definition, at
 * the field's rate: each of the places a run could start (every team, for an
 * active streak; every non-matching game, all-time) gets p^len, as
 * independent tries.
 */
export function chanceOf(c: MinedCrown, ctx: RankContext = CTX): number {
  const p = Math.min(c.p, P_MAX);
  const tries = c.scope === 'active' ? ctx.teams : Math.max(1, c.n * (1 - p));
  return -Math.expm1(tries * Math.log1p(-(p ** c.len)));
}

/** The score's terms, in bits, so a row can say why it sits where it does. */
export interface ScoreParts { b: number; pF: number; pT: number; length: number; lead: number; chance: number; conditions: number; margin: number; sparse: number; rarity: number; span: number; total: number }

export function scoreParts(c: MinedCrown, ctx: RankContext = CTX, w = LIST): ScoreParts {
  const { pF, pT, b } = rateOf(c, w);
  const chance = c.scope === 'active' ? Math.log2(ctx.teams) : Math.log2(Math.max(2, c.n * (1 - pF)));
  const span = c.scope === 'active' ? w.spanA : w.spanAll;
  const gap = w.leadFloor == null ? c.len - c.second : Math.max(w.leadFloor, c.len - c.second);
  const parts = {
    b, pF, pT,
    length: c.len * b,
    lead: w.leadW * gap * b,
    chance: -w.chanceW * chance,
    conditions: -conditionCost(c.chips, w, c.rivals),
    margin: isMargin(c.dir) ? -w.marginCost : 0,
    sparse: c.gT > 0 && c.nT > 0 ? -w.sparseW * Math.log2(c.gT / c.nT) || 0 : 0, // `|| 0`: a definition that keeps every game is 0, not -0
    rarity: w.rarityW * b,
    span: span * Math.log2(seasons(c)),
  };
  return { ...parts, total: parts.length + parts.lead + parts.chance + parts.conditions + parts.margin + parts.sparse + parts.rarity + parts.span };
}

export const crownScore = (c: MinedCrown, ctx: RankContext = CTX, w = LIST): number => scoreParts(c, ctx, w).total;

// --- group ---

type Words = { chips: readonly string[]; dir: Dir; len: number; scope?: Scope; startSe?: number; endSe?: number };
const subsetOf = (a: Words, b: Words) => a.chips.length < b.chips.length && a.chips.every((k) => b.chips.includes(k));
const overlap = (a: Words, b: Words) => a.endSe == null || b.endSe == null || a.startSe == null || b.startSe == null || !(a.endSe < b.startSe || b.endSe < a.startSe);
/**
 * Whether `r` is a sub-streak among `rows` (one team's, one list): some
 * row of the same outcome under a strict subset of its conditions runs at
 * least as long (and, all-time, overlaps it in seasons), unless `olderStands`
 * and `r` started first.
 */
export function isSubStreak(r: Words, rows: readonly Words[], w = LIST): boolean {
  return rows.some((o) => o !== r && o.dir === r.dir && subsetOf(o, r) && o.len >= r.len
    && (r.scope !== 'all' || overlap(o, r))
    && !(w.olderStands && r.startSe != null && o.startSe != null && r.startSe < o.startSe));
}
/** Each row with its `subStreak` flag set against the others. */
export const markSubStreaks = <T extends Words>(rows: T[], w = LIST): (T & { subStreak: boolean })[] => rows.map((r) => ({ ...r, subStreak: isSubStreak(r, rows, w) }));
/** Each team's rows flagged against its own (`ti` names the team; `groupOf` narrows a team's group further, a game at a time for broken runs). */
export function markSubStreaksByTeam<T extends Words & { ti: number }>(rows: T[], w = LIST, groupOf: (r: T) => string | number = (r) => r.ti): (T & { subStreak: boolean })[] {
  const byTeam = new Map<string | number, T[]>();
  for (const r of rows) (byTeam.get(groupOf(r)) ?? byTeam.set(groupOf(r), []).get(groupOf(r))!).push(r);
  const out: (T & { subStreak: boolean })[] = [];
  for (const list of byTeam.values()) out.push(...markSubStreaks(list, w));
  return out;
}

// --- admit and pick ---

/** A placing admits a run of `len` games: the place it holds is `admit.rank` or better, or (a broken run) it is the all-time longest under the definition. */
export const admits = (t: Pick<Placing, 'rank' | 'everLen'>, len: number, w = LIST) => t.rank <= w.admit.rank || (t.everLen != null && len >= t.everLen);
/** A run is on a list when either of its placings admits it. */
export const admitted = (c: MinedCrown, w = LIST) => admits(c, c.len, w) || (!!c.highest && admits(c.highest, c.len, w));
/** A definition is simple: at most `admit.maxConditions` conditions, a margin counting as one, and (`admit.triviaChips`) no trivia chip. */
export const isSimple = (d: { chips: readonly string[]; dir: Dir }, w = LIST) => !isTrivia(d, w.admit.maxConditions, w.admit.triviaChips);
/**
 * A list's part of its rows, judged on the definition each is shown under.
 * Flag sub-streaks over every admitted row first: a trivia row that is a
 * sub-streak of a simple one is that row's story, so the trivia part leaves
 * it out.
 */
export function partOf<T extends Words & { subStreak: boolean }>(rows: T[], part: Part, w = LIST): T[] {
  if (part === 'any') return rows;
  const simple = rows.filter((r) => isSimple(r, w));
  if (part === 'simple') return simple;
  return rows.filter((r) => !isSimple(r, w) && !(r.subStreak && isSubStreak(r, simple, w)));
}
/** How many rows of a list stand (a sub-streak counts with its run): what "and N trivia streaks" counts. */
export const standingCount = (rows: readonly { subStreak?: boolean }[]) => rows.reduce((n, r) => n + (r.subStreak ? 0 : 1), 0);

const PLACING_KEYS = ['chips', 'field', 'rank', 'tied', 'second', 'p', 'n', 'hT', 'nT', 'unsure', 'live', 'rivals', 'everLen', 'everN'] as const;
const placingOf = (c: Placing): Placing => {
  const t = {} as Record<string, unknown>;
  for (const k of PLACING_KEYS) if (c[k] !== undefined) t[k] = c[k];
  return t as unknown as Placing;
};
/** The run worded under one of its placings, the other as `alt`. */
const under = <T extends MinedCrown>(c: T, shown: Placing, other: Placing | null): Omit<T, 'highest'> & { other?: Placing } => {
  const { highest: _h, ...rest } = c;
  return { ...rest, ...placingOf(shown), ...(other ? { other: placingOf(other) } : {}) };
};
/**
 * The placing a list shows: with `pick: 'fewest'` the run's fewest-conditions
 * placing when it admits, else its highest, and the highest when both admit
 * and only it is simple (a run fewest-worded as trivia stays on the simple
 * list under its simple words); with `'highest'` the highest whenever it
 * places higher.
 */
export function pick<T extends MinedCrown>(c: T, w = LIST): Omit<T, 'highest'> & { other?: Placing } {
  const plain = placingOf(c);
  if (!c.highest) return under(c, plain, null);
  const both = admits(c, c.len, w) && admits(c.highest, c.len, w);
  const useHighest = w.pick === 'highest' ? c.highest.rank < c.rank
    : both ? !isSimple(c, w) && isSimple({ chips: c.highest.chips, dir: c.dir }, w) : admits(c.highest, c.len, w);
  return useHighest ? under(c, c.highest, plain) : under(c, plain, c.highest);
}

// --- order ---

type Scored = { score: number; bits: number; len: number };
/** The list's order: by score, then length; with a bucket, by score band, then rarity, then length. */
export const byOrder = (w = LIST) => (a: Scored, b: Scored): number => {
  if (w.bucket > 0) {
    const band = Math.floor(b.score / w.bucket) - Math.floor(a.score / w.bucket);
    if (band) return band;
    if (b.bits !== a.bits) return b.bits - a.bits;
    return b.len - a.len;
  }
  return b.score - a.score || b.len - a.len;
};

/** A run under its picked definition, with its chance, score and rarity worked out. */
export const finish = <T extends Omit<MinedCrown, 'highest'>>(c: T, ctx: RankContext = CTX, w = LIST): T & { chance: number; score: number; bits: number } => {
  const parts = scoreParts(c as unknown as MinedCrown, ctx, w);
  return { ...c, chance: chanceOf(c as unknown as MinedCrown, ctx), score: parts.total, bits: parts.b };
};

// --- the rule ---

type Run = Pick<MinedCrown, 'dir' | 'len' | 'startSe' | 'endSe' | 'chips'> & { ti?: number };
const sameRun = (a: Run, b: Run) => a.ti === b.ti && a.len === b.len && a.startSe === b.startSe && a.endSe === b.endSe
  && a.chips.length === b.chips.length && a.chips.every((k) => b.chips.includes(k));
/**
 * Whether another row of the same team covers `c` with a stricter outcome:
 * an undefeated run identical to a winning one, or a plain win or loss run
 * identical to one by its margin ("won 12 straight by 10+" says "won 12
 * straight" and more). Every list of runs drops these the same way.
 */
export const coveredByStricterOutcome = (c: Run, rows: readonly Run[]) => (
  (c.dir === 'U' && rows.some((o) => o.dir === 'W' && sameRun(o, c)))
  || ((c.dir === 'W' || c.dir === 'L') && rows.some((o) => isMargin(o.dir) && baseDir(o.dir) === c.dir && sameRun(o, c)))
);

/**
 * One team's runs in one scope, as its page lists them: the admitted ones,
 * each under its picked definition, best first, sub-streaks flagged. An
 * undefeated run identical to a winning one, and a plain win or loss run
 * identical to one by its margin, are dropped ("won 12 straight by 10+" says
 * "won 12 straight" and more); all-time, a run that repeats another run of
 * the same years goes too.
 */
export function listCrowns(list: readonly MinedCrown[], ctx: RankContext = CTX, w = LIST, part: Part = 'simple'): Crown[] {
  const rows = list.filter((c) => admitted(c, w)).map((c) => finish(pick(c, w), ctx, w));
  let kept = rows.filter((c) => !coveredByStricterOutcome(c, rows));
  kept.sort(byOrder(w));
  if (kept[0]?.scope === 'all') {
    const firsts: typeof kept = [];
    for (const c of kept) {
      const same = firsts.some((e) => {
        // unrelated definitions in the same years are different stories
        if (e.dir !== c.dir || !(subsetOf(e, c) || subsetOf(c, e))) return false;
        if (w.sameYears.directed && !(subsetOf(e, c) && e.len >= c.len)) return false;
        if (w.olderStands && c.startSe != null && e.startSe != null && c.startSe < e.startSe) return false;
        const shared = Math.min(e.endSe!, c.endSe!) - Math.max(e.startSe!, c.startSe!) + 1;
        return shared > 0 && shared / Math.min(seasons(e), seasons(c)) >= w.sameYears.overlap / 100;
      });
      if (!same) firsts.push(c);
    }
    kept = firsts;
  }
  return partOf(markSubStreaks(kept, w), part, w);
}

/**
 * Rows of many teams' runs (a week's broken runs, a game's, a breaker's):
 * the admitted ones under their picked definition, scored, flagged against
 * each team's own, best first. `order` replaces the score order when a view weights the rows.
 */
export function listRuns<T extends MinedCrown & { ti: number }>(rows: readonly T[], ctx: RankContext = CTX, w = LIST, order?: (a: Omit<T, 'highest'> & Crown, b: Omit<T, 'highest'> & Crown) => number, part: Part = 'simple'): (Omit<T, 'highest'> & Crown)[] {
  const shown = rows.filter((c) => admitted(c, w)).map((c) => finish(pick(c, w), ctx, w)) as unknown as (Omit<T, 'highest'> & Omit<Crown, 'subStreak'>)[];
  const out = markSubStreaksByTeam(shown, w) as unknown as (Omit<T, 'highest'> & Crown)[];
  return partOfByTeam(out, part, w).sort(order ?? byOrder(w));
}

/** `partOf` a team at a time (`groupOf` as markSubStreaksByTeam's), for rows of many teams. */
export function partOfByTeam<T extends Words & { ti: number; subStreak: boolean }>(rows: T[], part: Part, w = LIST, groupOf: (r: T) => string | number = (r) => r.ti): T[] {
  if (part !== 'trivia') return partOf(rows, part, w);
  const byTeam = new Map<string | number, T[]>();
  for (const r of rows) (byTeam.get(groupOf(r)) ?? byTeam.set(groupOf(r), []).get(groupOf(r))!).push(r);
  const keep = new Set<T>();
  for (const list of byTeam.values()) for (const r of partOf(list, part, w)) keep.add(r);
  return rows.filter((r) => keep.has(r));
}

/** The knobs with overrides laid over LIST, a path at a time ("tiers.brag", "admit.rank"). */
export function withKnobs(over: Record<string, unknown>): Knobs {
  const out: Knobs = { ...LIST, admit: { ...LIST.admit }, tiers: { ...LIST.tiers }, sameYears: { ...LIST.sameYears } };
  for (const [path, v] of Object.entries(over)) {
    const [a, b] = path.split('.');
    const o = out as unknown as Record<string, unknown>;
    if (b != null) (o[a] as Record<string, unknown>)[b] = v; else o[a] = v;
  }
  return out;
}

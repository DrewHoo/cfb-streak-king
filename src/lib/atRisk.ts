// The streaks most at risk in a week: every streak a scheduled game puts on
// the line, ranked by what the game can take away. A streak's crown score
// says how far past chance it sits; the line says how likely the game is to
// end it; the stake is the product, the bits of streak expected to die.
// Alabama's run at home as a 38-point favorite scores well and risks nothing,
// so it sinks; a run carried into a pick'em floats. The build keeps the rows
// (digests.ts); the page scores and orders them with the list rule, which
// the stake weights.
//
// The chance comes from the line alone: our margin is normal around the
// negated spread with SPREAD_SIGMA points of noise, the usual figure for a
// college game. A covering or not-covering streak is a coin flip by
// construction. A game without a line can't be ranked and stays out.

import type { Dir, MinedCrown, UpcomingRow } from './types.ts';
import { baseDir, marginOf } from './outcome.ts';
import { teamStreaks, streaksOn } from './team.ts';
import type { ScheduledGame, TeamRun, TeamStreak } from './team.ts';
import { digestOf } from './broken.ts';
import { CTX, LIST, admitted, finish, coveredByStricterOutcome, markSubStreaksByTeam, partOfByTeam, pick } from './list.ts';
import type { Knobs, RankContext } from './list.ts';

export const SPREAD_SIGMA = 13.5;
export const AT_RISK_CAP = 6;

// Abramowitz–Stegun 7.1.26, good to 1.5e-7
const erf = (x: number) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
/** The standard normal CDF. */
export const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/**
 * The chance a game breaks a streak of `dir`, from our line (`sp`, + when
 * we're the underdog): the chance our margin lands outside what the outcome
 * needs. Null without a line.
 */
export function pBreak(dir: Dir, sp: number | null): number | null {
  if (sp == null) return null;
  const mu = -sp;
  const b = baseDir(dir);
  const by = marginOf(dir);
  const below = (x: number) => Phi((x - mu) / SPREAD_SIGMA);
  switch (b) {
    case 'C': case 'N': return 0.5;
    case 'W': return below(by ? by - 0.5 : 0.5);       // short of the margin, or no win at all
    case 'U': return below(-0.5);                      // a loss
    case 'L': return 1 - below(by ? -by + 0.5 : -0.5); // closer than the margin, or no loss at all
  }
}

/** One streak a lined game puts on the line, as the build keeps it. */
export interface AtRiskInput {
  ti: number;
  s: TeamRun;
  game: ScheduledGame;
  /** The game from the team's side. */
  row: UpcomingRow;
  /** The chance the game ends the streak. */
  p: number;
}
/** The same on the page: scored, with what the game can take. */
export interface AtRisk extends Omit<AtRiskInput, 's'> {
  s: TeamStreak;
  /** score × p: the bits of streak the game is expected to take. */
  stake: number;
  /** The streak's own flag: a sub-streak of one of the team's other runs at risk. */
  subStreak: boolean;
}

export interface AtRiskRows { rows: AtRiskInput[] }
export interface AtRiskWeek {
  list: AtRisk[];
  more: AtRisk[];
  /** The sub-streaks (subStreak), behind their own button. */
  subStreaks: AtRisk[];
  /** The trivia streaks on the line (list.ts Part), folded into one line that opens them. */
  trivia: AtRisk[];
}

/**
 * The streaks on the line in these games, as the build keeps them: every run
 * a crowns file carries that a lined game puts on the line, once (a team's
 * run appears once, with its game). `crownsOf` is each team's runs from its
 * file.
 */
export function atRiskRows(games: ScheduledGame[], todayEp: number, crownsOf: (ti: number) => MinedCrown[] | null): AtRiskRows {
  const rows: AtRiskInput[] = [];
  const seen = new Set<string>();
  for (const game of games) {
    for (const { ti, row } of game.sides) {
      for (const s of streaksOn(teamStreaks(ti, todayEp, crownsOf(ti)), row)) {
        const p = pBreak(s.dir, row.sp);
        if (p == null) continue;
        // a run once, whichever of the team's games this week it rides on: the same games, under the same words
        const k = `${ti}|${s.dir}|${s.len}|${s.startSe}|${s.endSe}|${s.chips.join('+')}`;
        if (seen.has(k)) continue;
        seen.add(k);
        rows.push({ ti, s, game, row, p });
      }
    }
  }
  return { rows };
}

/**
 * The week's at-risk digest from its rows: the admitted runs under their picked definition,
 * scored by the list rule, the most at stake first, the top AT_RISK_CAP in
 * `list`, one per team, and the rest in `more` (no floor).
 */
export function atRiskWeek(at: AtRiskRows, ctx: RankContext = CTX, w: Knobs = LIST): AtRiskWeek {
  const all = at.rows.filter((r) => admitted(r.s, w)).map((r) => ({ ...r, s: finish(pick(r.s, w), ctx, w) }));
  // what a team's own list drops too: a run another of its rows covers with a stricter outcome (undefeated by winning, plain by its margin)
  const runs = all.map((r) => ({ ...r.s, ti: r.ti }));
  const shown = all.filter((r) => !coveredByStricterOutcome({ ...r.s, ti: r.ti }, runs));
  // the group reads the streak's words: each team's rows flagged against its own
  const flags = markSubStreaksByTeam(shown.map((r, i) => ({ i, ti: r.ti, chips: r.s.chips, dir: r.s.dir, len: r.s.len, scope: r.s.scope, startSe: r.s.startSe, endSe: r.s.endSe })), w);
  const subOf = new Map(flags.map((f) => [f.i, f.subStreak]));
  // the simple runs are the digest, the trivia ones a folded line (list.ts Part)
  const simple = new Set(partOfByTeam(flags, 'simple', w).map((f) => f.i));
  const trivia = new Set(partOfByTeam(flags, 'trivia', w).map((f) => f.i));
  const rows = shown.map((r, i): AtRisk & { i: number } => { const subStreak = subOf.get(i)!; return { ...r, i, s: { ...r.s, subStreak }, stake: r.s.score * r.p, subStreak }; });
  rows.sort((a, b) => b.stake - a.stake || b.s.len - a.s.len);
  const strip = ({ i: _i, ...r }: AtRisk & { i: number }): AtRisk => r;
  return { ...digestOf(rows.filter((r) => simple.has(r.i)).map(strip), () => true, AT_RISK_CAP), trivia: rows.filter((r) => trivia.has(r.i)).map(strip) };
}

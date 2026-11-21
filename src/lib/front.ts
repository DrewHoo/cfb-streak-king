// The front page (specs/front-page.spec.md): the active streaks this
// week's games put on the line, each team's best, by the score.
//
// A view of the list rule: every FBS team's Active section as its team page
// lists it (simple, sub-streaks with their runs), less the runs whose last
// game was more than `FRONT.seasons` seasons ago (Boise State's 73 over
// unranked WAC opponents, last played 2011), and (`FRONT.onLine`) less the
// runs the team's next game doesn't put on the line, so a long run no game
// tests doesn't sit atop the page week after week. Each team's best row, by
// the score: the first `FRONT.top` show, and the rest page behind "see more",
// as every long list on the site does. The page shows a place, never the
// score.

import type { Dir, MinedCrown, UpcomingRow } from './types.ts';
import { P, teams, upcomingOf } from './model.ts';
import { CTX, LIST, admitted, finish, listCrowns, pick } from './list.ts';
import type { Knobs, RankContext } from './list.ts';
import { teamStreaks } from './team.ts';
import type { TeamStreak } from './team.ts';
import { chipByKey } from './chips.ts';
import { inSlate, slateWeek } from './game.ts';
import { baseKey } from './minedChips.ts';
import { fromCrownRow, toCrownRow } from './crownsFile.ts';
import type { CrownRow } from './crownsFile.ts';

export const FRONT = {
  /** The rows the page shows before "see more" (Drew, 2026-11-14). */
  top: 10,
  /** A run is current when its last game was this many seasons ago or fewer. */
  seasons: 1,
  /** Rows per team the build keeps, so the tuner has rows to reorder. */
  keep: 3,
  /** Only the runs the team's next game puts on the line (Drew, 2026-11-14). */
  onLine: true,
};
export type FrontKnobs = typeof FRONT;

/** A team's next game is "the upcoming game" within this many days, the builder's `onTheLine` window. */
export const SOON = 8;

/** A row of the page; `pinned` when Drew put it there by hand (`PINS`) and the list rule didn't. */
export interface FrontRow { ti: number; s: TeamStreak; pinned?: true }

/**
 * A run Drew put on the page by hand, for one week: readers were arriving for
 * it and the list rule doesn't admit it, since its team isn't first in its
 * field. It is the one place a view shows a run the rule leaves out, so each
 * one is his call, with its date. It leads the page under its own words, takes
 * its team's row, and still has to be on the line in its team's next game. It
 * is on no other list. The season and week keep it from coming back the next
 * time its team meets such an opponent.
 */
export interface Pin { team: string; dir: Dir; chips: string[]; season: number; week: number }
export const PINS: Pin[] = [
  // Drew, 2026-11-21: Nebraska's 31 straight losses to ranked opponents, second to Rutgers's 46, with Ohio State in
  // Lincoln and readers arriving for it
  { team: 'nebraska', dir: 'L', chips: ['ranked'], season: 2026, week: 12 },
];

const key = (c: Pick<MinedCrown, 'dir' | 'len' | 'startSe' | 'endSe' | 'chips'>) => `${c.dir}|${c.len}|${c.startSe}|${c.endSe}|${c.chips.join('+')}`;
const isCurrent = (s: Pick<MinedCrown, 'endSe'>, f: FrontKnobs) => s.endSe != null && s.endSe >= P.currentSeason - f.seasons;

/** A team's current streaks as its Active section lists them, best first, sub-streaks left with their runs. */
export function currentStreaks(ti: number, list: readonly MinedCrown[], todayEp: number, ctx: RankContext = CTX, w: Knobs = LIST, f: FrontKnobs = FRONT): TeamStreak[] {
  return teamStreaks(ti, todayEp, listCrowns(list, ctx, w)).filter((s) => !s.subStreak && isCurrent(s, f));
}

const sameChips = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((k) => b.includes(k));
/** The pin `c` is this week, if any: its team's run under the pin's own words, in the pin's season and week. */
const pinOf = (ti: number, c: Pick<MinedCrown, 'dir' | 'chips' | 'scope'>): Pin | undefined => PINS.find((p) => (
  p.team === teams[ti]?.id && p.season === P.currentSeason && p.week === slateWeek() && c.scope === 'active' && p.dir === c.dir && sameChips(p.chips, c.chips)
));

/** A team's pinned run as a row, when its next game puts it on the line this week; null otherwise. */
export function pinnedStreak(ti: number, list: readonly MinedCrown[], todayEp: number, ctx: RankContext = CTX, w: Knobs = LIST): TeamStreak | null {
  const run = list.find((c) => pinOf(ti, c));
  if (!run) return null;
  // under the pin's own words, whatever the rule would pick
  const { highest: _h, ...own } = run;
  const [s] = teamStreaks(ti, todayEp, [{ ...finish(own, ctx, w), subStreak: false }]);
  return s && nextIsIt(ti, s) && inSlate(s.next!.wk) && frontNext(ti, s, todayEp).kind === 'on' ? s : null;
}

/** Whether the team's next scheduled game is the one that puts the run on the line, whatever the date. */
const nextIsIt = (ti: number, s: Pick<TeamStreak, 'next'>) => s.next != null && s.next.i === upcomingOf(ti)[0]?.i;

/** The week the page is about, the at-risk page's (its heading says "On the line in Week 10"): `slateWeek`. */
export const frontWeek = (): number | null => slateWeek();

/**
 * The runs the page can show for a team: its current streaks, and with
 * `onLine` only the ones its upcoming game puts on the line, in the page's
 * week: a team off that week waits for the next payload, though its next game
 * falls within `SOON` days.
 */
export function frontStreaks(ti: number, list: readonly MinedCrown[], todayEp: number, ctx: RankContext = CTX, w: Knobs = LIST, f: FrontKnobs = FRONT): TeamStreak[] {
  const cur = currentStreaks(ti, list, todayEp, ctx, w, f);
  return f.onLine ? cur.filter((s) => nextIsIt(ti, s) && inSlate(s.next!.wk) && frontNext(ti, s, todayEp).kind === 'on') : cur;
}

/**
 * The mined runs behind a team's best `keep` current streaks: what the build
 * keeps for the page. Listing them gives the same rows: a kept row wasn't a
 * sub-streak or covered by another row, and dropping rows can't make it one.
 */
export function frontRuns(ti: number, list: readonly MinedCrown[], todayEp: number, ctx: RankContext = CTX, w: Knobs = LIST, f: FrontKnobs = FRONT): MinedCrown[] {
  // on the line by the schedule, not the date: the page reads the date, the build only keeps the rows
  const cur = currentStreaks(ti, list, todayEp, ctx, w, f);
  const want = new Set((f.onLine ? cur.filter((s) => nextIsIt(ti, s)) : cur).slice(0, f.keep).map(key));
  return list.filter((c) => (admitted(c, w) && want.has(key(pick(c, w)))) || pinOf(ti, c));
}

/** Every team's best streak the page can show, best first, after the week's pinned rows. */
export function frontBest(runs: Iterable<[number, readonly MinedCrown[]]>, todayEp: number, ctx: RankContext = CTX, w: Knobs = LIST, f: FrontKnobs = FRONT): FrontRow[] {
  const best: FrontRow[] = [];
  const pinned: FrontRow[] = [];
  for (const [ti, list] of runs) {
    const pin = pinnedStreak(ti, list, todayEp, ctx, w);
    const s = pin ?? frontStreaks(ti, list, todayEp, ctx, w, f)[0];
    if (pin) pinned.push({ ti, s: pin, pinned: true });
    else if (s) best.push({ ti, s });
  }
  return [...pinned, ...best.sort((a, b) => b.s.score - a.s.score || b.s.len - a.s.len)];
}

/** The front page: the first `top` rows, and the rest behind "see more". */
export function frontPage(runs: Iterable<[number, readonly MinedCrown[]]>, todayEp: number, ctx: RankContext = CTX, w: Knobs = LIST, f: FrontKnobs = FRONT): { list: FrontRow[]; more: FrontRow[] } {
  const best = frontBest(runs, todayEp, ctx, w, f);
  return { list: best.slice(0, f.top), more: best.slice(f.top) };
}

/** The front page's first rows, before "see more". */
export const frontList = (runs: Iterable<[number, readonly MinedCrown[]]>, todayEp: number, ctx: RankContext = CTX, w: Knobs = LIST, f: FrontKnobs = FRONT): FrontRow[] => frontPage(runs, todayEp, ctx, w, f).list;

/** What the team's next game does to a streak. */
export type FrontNext =
  /** The upcoming game counts; `likely` when it read the line, which moves until kickoff. */
  | { kind: 'on'; game: UpcomingRow; likely: boolean }
  /** The upcoming game counts only if it goes a certain way (`ifs`: the conditions settled during it). */
  | { kind: 'maybe'; game: UpcomingRow; ifs: string[] }
  /** The upcoming game (if any) doesn't count; `then` does. */
  | { kind: 'later'; game: UpcomingRow | null; then: UpcomingRow }
  /** Which game counts next depends on games not played yet (after a loss, the line). */
  | { kind: 'unknown'; game: UpcomingRow | null }
  /** No scheduled game counts. */
  | { kind: 'none'; game: UpcomingRow | null };

const SETTLED_BEFORE = new Set(['context', 'betting']);

export function frontNext(ti: number, s: Pick<TeamStreak, 'chips' | 'next' | 'how' | 'maybe'>, todayEp: number): FrontNext {
  const soon = (u: UpcomingRow) => u.ep - todayEp <= SOON;
  const up = upcomingOf(ti)[0] ?? null;
  const game = up && soon(up) ? up : null;
  // only the team's next game can be on the line: a later one waits on the games before it, recorded or not
  if (s.next && game && s.next.i === game.i) return { kind: 'on', game: s.next, likely: s.how === 'likely' };
  if (s.maybe && game && s.maybe.i === game.i) {
    const ifs = s.chips.filter((k) => { const c = chipByKey.get(baseKey(k)); return c && !c.pregame && !SETTLED_BEFORE.has(c.group); });
    return { kind: 'maybe', game: s.maybe, ifs };
  }
  const then = s.next ?? s.maybe;
  if (then) return { kind: 'later', game, then };
  const reads = s.chips.some((k) => { const c = chipByKey.get(baseKey(k)); return c && !c.pregame && SETTLED_BEFORE.has(c.group); });
  return reads && up ? { kind: 'unknown', game } : { kind: 'none', game };
}

// --- the file: dist/front.json, embedded on the root ---

export interface FrontFile { v: 1; builtAt: string; rows: [number, CrownRow][] }
export const encodeFront = (runs: Iterable<[number, readonly MinedCrown[]]>): FrontFile => {
  const rows: [number, CrownRow][] = [];
  for (const [ti, list] of runs) for (const c of list) rows.push([ti, toCrownRow(c)]);
  return { v: 1, builtAt: P.builtAt, rows };
};
export const decodeFront = (f: FrontFile): Map<number, MinedCrown[]> => {
  const out = new Map<number, MinedCrown[]>();
  const of = fromCrownRow('active');
  for (const [ti, row] of f.rows) (out.get(ti) ?? out.set(ti, []).get(ti)!).push(of(row));
  return out;
};

let loading: Promise<Map<number, MinedCrown[]>> | null = null;
/** The rows for the page: the build's file, or (the dev server without a build) every team's runs mined here. */
export function loadFront(): Promise<Map<number, MinedCrown[]>> {
  return (loading ??= fetch(`${import.meta.env.BASE_URL}front.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(decodeFront)
    .catch(async () => (await import('./crowns.ts')).mineCrowns('active')));
}

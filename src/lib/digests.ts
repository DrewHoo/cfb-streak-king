// The schedule's digests, built once at build time from the mined crowns
// and shipped as dist/games/digests.json: every completed week's broken
// runs (broken.ts), the first scheduled week's runs at risk (atRisk.ts),
// and the streak most on the line in each scheduled game, with how many it
// puts on the line. The rows carry the list rule's inputs and no score: the
// page tells, scores and orders them (list.ts), so a knob turns the digests
// too; the streak on the line in each game is the build's pick under the
// shipped knobs. The games pages embed the file so the first render has it;
// opening the schedule from the board fetches it. The dev server has no
// build output, so there it falls back to mining in the page. This is the
// file's encoding.

import type { Crown, MinedCrown } from './types.ts';
import { P, upcomingOf } from './model.ts';
import type { BrokenWeekRows } from './broken.ts';
import { brokenWeeks } from './broken.ts';
import { atRiskRows } from './atRisk.ts';
import type { AtRiskInput } from './atRisk.ts';
import { scheduledGames, topOnLine } from './team.ts';
import type { TeamRun } from './team.ts';
import { toCrownRow, fromCrownRow } from './crownsFile.ts';
import type { CrownRow } from './crownsFile.ts';
import { encodeBroken, decodeBroken } from './seasonFile.ts';
import type { BrokenRow } from './seasonFile.ts';
import type { BrokenInput } from './broken.ts';

export interface Digests {
  builtAt: string;
  /** Every completed week's broken runs, by the schedule's week number. */
  broken: Record<number, BrokenWeekRows>;
  /** The first scheduled week's runs at risk; null when no game has a line. */
  atRisk: { wk: number; lo: number; hi: number; rows: AtRiskInput[] } | null;
  /** The streak most on the line in each scheduled game (the build's pick), and how many it puts on the line, by the game's id. */
  onLine: Record<number, { ti: number; s: TeamRun; n: number }>;
}

/** Each team's active runs as the build has them: the file's raw rows, or the list rule's rows. */
export type CrownsOf<T extends MinedCrown = MinedCrown> = (ti: number) => T[] | null;

/** The digests from the mined runs: what the prerender writes, and the dev server works out in the page. `listed` is the rule's rows, for the pick per game. */
export function buildDigests(todayEp: number, mined: Parameters<typeof brokenWeeks>[0], crownsOf: CrownsOf, listed: CrownsOf<Crown>): Digests {
  const games = scheduledGames();
  const wk = games[0]?.wk;
  const week = games.filter((g) => g.wk === wk);
  const risk = week.length ? atRiskRows(week, todayEp, crownsOf) : null;
  const onLine: Digests['onLine'] = {};
  for (const g of games) {
    const top = topOnLine(g, todayEp, listed);
    if (top) {
      const { chance: _c, score: _s, bits: _b, subStreak: _d, other: _a, ...s } = top.s;
      onLine[g.i] = { ti: top.ti, s, n: top.n };
    }
  }
  return {
    builtAt: P.builtAt,
    broken: Object.fromEntries(brokenWeeks(mined)),
    atRisk: risk && risk.rows.length ? { wk, lo: week[0].ep, hi: week[week.length - 1].ep, rows: risk.rows } : null,
    onLine,
  };
}

// --- the file ---

// a streak at risk: [team, crown, next game id, p]
type RiskRow = [number, CrownRow, number, number];
export interface DigestsFile {
  v: 2;
  builtAt: string;
  broken: Record<number, { wk: number | null; lo: number; hi: number; rows: BrokenRow[] }>;
  atRisk: { wk: number; lo: number; hi: number; rows: RiskRow[] } | null;
  onLine: Record<number, [number, CrownRow, number]>;
}

const toStreak = (ti: number, s: TeamRun, gameI: number): [number, CrownRow, number] => [ti, toCrownRow(s), gameI];
const fromStreak = (ti: number, c: CrownRow, gameI: number): TeamRun => {
  const crown = fromCrownRow('active')(c);
  return { ...crown, next: upcomingOf(ti).find((u) => u.i === gameI) ?? null, since: crown.startSe ?? P.currentSeason };
};
const toRisk = (r: AtRiskInput): RiskRow => [...toStreak(r.ti, r.s, r.game.i), +r.p.toFixed(3)];
const fromRisk = ([ti, c, gameI, p]: RiskRow): AtRiskInput | null => {
  const game = scheduledGames().find((g) => g.i === gameI);
  const side = game?.sides.find((x) => x.ti === ti);
  if (!game || !side) return null;
  return { ti, s: fromStreak(ti, c, gameI), game, row: side.row, p };
};

export function encodeDigests(d: Digests): DigestsFile {
  return {
    v: 2,
    builtAt: d.builtAt,
    broken: Object.fromEntries(Object.entries(d.broken).map(([wk, w]) => [wk, { wk: w.wk, lo: w.lo, hi: w.hi, rows: w.rows.map(encodeBroken) }])),
    atRisk: d.atRisk ? { wk: d.atRisk.wk, lo: d.atRisk.lo, hi: d.atRisk.hi, rows: d.atRisk.rows.map(toRisk) } : null,
    onLine: Object.fromEntries(Object.entries(d.onLine).map(([i, { ti, s, n }]) => [i, [ti, toCrownRow(s), n]])),
  };
}

export function decodeDigests(f: DigestsFile): Digests {
  return {
    builtAt: f.builtAt,
    broken: Object.fromEntries(Object.entries(f.broken).map(([wk, w]) => [wk, { wk: w.wk, lo: w.lo, hi: w.hi, rows: w.rows.map(decodeBroken).filter((b): b is BrokenInput => b != null) }])),
    atRisk: f.atRisk ? { wk: f.atRisk.wk, lo: f.atRisk.lo, hi: f.atRisk.hi, rows: f.atRisk.rows.map(fromRisk).filter((r): r is AtRiskInput => r != null) } : null,
    onLine: Object.fromEntries(Object.entries(f.onLine).map(([i, [ti, c, n]]) => [i, { ti, s: fromStreak(ti, c, Number(i)), n: n ?? 1 }])),
  };
}

// --- in the browser ---

let loading: Promise<Digests> | null = null;

async function buildHere(): Promise<Digests> {
  const [{ mineRaw, mineCrowns }, { listCrowns }] = await Promise.all([import('./crowns.ts'), import('./list.ts')]);
  const [mined, active] = await Promise.all([mineRaw(), mineCrowns('active')]);
  const today = Math.floor(Date.now() / 86400000);
  const cache = new Map<number, Crown[]>();
  const listed = (ti: number) => cache.get(ti) ?? cache.set(ti, listCrowns(active.get(ti) ?? [])).get(ti)!;
  return buildDigests(today, mined, (ti) => active.get(ti) ?? [], listed);
}

/** The digests: the build's file, once; the dev server mines them in the page instead. */
export function loadDigests(): Promise<Digests> {
  return (loading ??= fetch(`${import.meta.env.BASE_URL}games/digests.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(decodeDigests)
    .catch(() => buildHere()));
}

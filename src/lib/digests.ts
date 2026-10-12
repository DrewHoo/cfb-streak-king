// The schedule's digests, built once at build time from the mined crowns
// and shipped as dist/games/digests.json: every completed week's broken
// streaks (broken.ts), the first scheduled week's at-risk streaks
// (atRisk.ts), and the streak most on the line in each scheduled game. The
// games pages embed the file so the first render has it; opening the
// schedule from the board fetches it. The dev server has no build output,
// so there it falls back to mining in the page. This is the file's encoding.

import type { Crown, Dir } from './types.ts';
import { P, gamesOf, upcomingOf } from './model.ts';
import type { BrokenWeek, BrokenStreak } from './broken.ts';
import { brokenWeeks } from './broken.ts';
import { atRiskWeek } from './atRisk.ts';
import type { AtRisk, AtRiskWeek } from './atRisk.ts';
import { scheduledGames, topOnLine } from './team.ts';
import type { TeamStreak } from './team.ts';

export interface Digests {
  builtAt: string;
  /** Every completed week's broken digest, by the schedule's week number. */
  broken: Record<number, BrokenWeek>;
  /** The first scheduled week's at-risk streaks; null when no game has a line. */
  atRisk: (AtRiskWeek & { wk: number; lo: number; hi: number }) | null;
  /** The streak most on the line in each scheduled game, by the game's id. */
  onLine: Record<number, { ti: number; s: TeamStreak }>;
}

/** Each team's active crowns, as the build has them. */
export type CrownsOf = (ti: number) => Crown[] | null;

/** The digests from the mined runs: what the prerender writes, and the dev server works out in the page. */
export function buildDigests(todayEp: number, mined: Parameters<typeof brokenWeeks>[0], crownsOf: CrownsOf): Digests {
  const games = scheduledGames();
  const wk = games[0]?.wk;
  const week = games.filter((g) => g.wk === wk);
  const risk = week.length ? atRiskWeek(week, todayEp, crownsOf) : null;
  const onLine: Digests['onLine'] = {};
  for (const g of games) {
    const top = topOnLine(g, todayEp, crownsOf);
    if (top) onLine[g.i] = top;
  }
  return {
    builtAt: P.builtAt,
    broken: Object.fromEntries(brokenWeeks(mined)),
    atRisk: risk && risk.list.length ? { ...risk, wk, lo: week[0].ep, hi: week[week.length - 1].ep } : null,
    onLine,
  };
}

// --- the file ---

// a crown: [chips joined by '+', dir, len, atEdge, field, rank, tied, second, startSe, endSe, live, also, chance, score, dup]
type CrownRow = [string, Dir, number, 0 | 1, number, number, number, number, number | null, number | null, 0 | 1, number, number, number, 0 | 1];
// a broken run: [team, crown, since, ender game id, run start]
type BrokenRow = [number, CrownRow, number, number, number];
// a streak at risk: [team, crown, next game id, p]
type RiskRow = [number, CrownRow, number, number];
export interface DigestsFile {
  v: 1;
  builtAt: string;
  broken: Record<number, { wk: number | null; lo: number; hi: number; list: BrokenRow[]; more: BrokenRow[]; dups: BrokenRow[] }>;
  atRisk: { wk: number; lo: number; hi: number; list: RiskRow[]; more: RiskRow[]; dups: RiskRow[] } | null;
  onLine: Record<number, [number, CrownRow]>;
}

const toCrown = (c: Crown): CrownRow => [
  c.chips.join('+'), c.dir, c.len, c.atEdge ? 1 : 0, c.field, c.rank, c.tied, c.second, c.startSe ?? null, c.endSe ?? null, c.live ? 1 : 0, c.also, +c.chance.toPrecision(2), +c.score.toFixed(2) || 0, c.dup ? 1 : 0, // a score that rounds to -0 is 0
];
const fromCrown = (scope: 'active' | 'all') => ([chips, dir, len, atEdge, field, rank, tied, second, startSe, endSe, live, also, chance, score, dup]: CrownRow): Crown => ({
  chips: chips ? chips.split('+') : [], dir, scope, len, atEdge: !!atEdge, field, rank, tied, second,
  ...(startSe != null ? { startSe } : {}), ...(endSe != null ? { endSe } : {}),
  live: !!live, also, chance, score, dup: !!dup,
});
const toBroken = (b: BrokenStreak): BrokenRow => [b.ti, toCrown(b), b.since, b.ender.i, b.run];
const fromBroken = ([ti, c, since, enderI, run]: BrokenRow): BrokenStreak => ({
  ...fromCrown('all')(c), scope: 'all', ti, since, run,
  ender: gamesOf(ti).find((g) => g.i === enderI)!,
});
const toStreak = (ti: number, s: TeamStreak, gameI: number): [number, CrownRow, number] => [ti, toCrown(s), gameI];
const fromStreak = (ti: number, c: CrownRow, gameI: number): TeamStreak => {
  const crown = fromCrown('active')(c);
  return { ...crown, next: upcomingOf(ti).find((u) => u.i === gameI) ?? null, since: crown.startSe ?? P.currentSeason };
};
const toRisk = (r: AtRisk): RiskRow => [...toStreak(r.ti, r.s, r.game.i), +r.p.toFixed(3)];
const fromRisk = ([ti, c, gameI, p]: RiskRow): AtRisk | null => {
  const game = scheduledGames().find((g) => g.i === gameI);
  const side = game?.sides.find((x) => x.ti === ti);
  if (!game || !side) return null;
  const s = fromStreak(ti, c, gameI);
  return { ti, s, game, row: side.row, p, stake: s.score * p, dup: s.dup };
};

export function encodeDigests(d: Digests): DigestsFile {
  return {
    v: 1,
    builtAt: d.builtAt,
    broken: Object.fromEntries(Object.entries(d.broken).map(([wk, w]) => [wk, { wk: w.wk, lo: w.lo, hi: w.hi, list: w.list.map(toBroken), more: w.more.map(toBroken), dups: w.dups.map(toBroken) }])),
    atRisk: d.atRisk ? { wk: d.atRisk.wk, lo: d.atRisk.lo, hi: d.atRisk.hi, list: d.atRisk.list.map(toRisk), more: d.atRisk.more.map(toRisk), dups: d.atRisk.dups.map(toRisk) } : null,
    onLine: Object.fromEntries(Object.entries(d.onLine).map(([i, { ti, s }]) => [i, [ti, toCrown(s)]])),
  };
}

export function decodeDigests(f: DigestsFile): Digests {
  const risks = (rows: RiskRow[]) => rows.map(fromRisk).filter((r): r is AtRisk => r != null);
  return {
    builtAt: f.builtAt,
    broken: Object.fromEntries(Object.entries(f.broken).map(([wk, w]) => [wk, { wk: w.wk, lo: w.lo, hi: w.hi, list: w.list.map(fromBroken), more: w.more.map(fromBroken), dups: (w.dups ?? []).map(fromBroken) }])),
    atRisk: f.atRisk ? { wk: f.atRisk.wk, lo: f.atRisk.lo, hi: f.atRisk.hi, list: risks(f.atRisk.list), more: risks(f.atRisk.more), dups: risks(f.atRisk.dups ?? []) } : null,
    onLine: Object.fromEntries(Object.entries(f.onLine).map(([i, [ti, c]]) => [i, { ti, s: fromStreak(ti, c, Number(i)) }])),
  };
}

// --- in the browser ---

let loading: Promise<Digests> | null = null;

async function buildHere(): Promise<Digests> {
  const { mineRaw, mineCrowns } = await import('./crowns.ts');
  const [mined, active] = await Promise.all([mineRaw(), mineCrowns('active')]);
  return buildDigests(Math.floor(Date.now() / 86400000), mined, (ti) => active.get(ti) ?? []);
}

/** The digests: the build's file, once; the dev server mines them in the page instead. */
export function loadDigests(): Promise<Digests> {
  return (loading ??= fetch(`${import.meta.env.BASE_URL}games/digests.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(decodeDigests)
    .catch(() => buildHere()));
}

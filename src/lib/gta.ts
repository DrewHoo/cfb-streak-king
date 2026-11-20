// GTA release weeks, for the "in a GTA release week" chip. A game counts when
// it's played in the seven days that start on the day a mainline Grand Theft
// Auto game first came out (data/ref/gta-releases.json, each date with its
// receipt). A team with no game that week skips that release; a release in
// the offseason (Grand Theft Auto IV, April 2008) has no games at all.

import releases from '../../data/ref/gta-releases.json';

export const GTA_WEEK_DAYS = 7;
/** Each mainline release, its title and first day as an epoch day, oldest first. */
export const GTA_TITLES: { game: string; ep: number }[] = (releases as { rows: { game: string; date: string }[] }).rows
  .map((r) => ({ game: r.game, ep: Date.parse(`${r.date}T00:00:00Z`) / 86400000 }))
  .sort((a, b) => a.ep - b.ep);
/** Each mainline release's first day, as an epoch day, ascending. */
export const GTA_RELEASES: number[] = GTA_TITLES.map((t) => t.ep);
/** The first season a game can be played in a release week. */
export const GTA_BEGINS = new Date(GTA_RELEASES[0] * 86400000).getUTCFullYear();

/** Whether a game on this epoch day is played in a GTA release week. */
export const inGtaWeek = (ep: number) => GTA_RELEASES.some((r) => ep >= r && ep < r + GTA_WEEK_DAYS);

/** A game as the ledger reads it: played (with a result) or still to play. */
export interface LedgerGame { ep: number; oppIdx: number; home: boolean; neutral: boolean; r?: 'W' | 'L' | 'T'; us?: number; them?: number }
export interface LedgerRow {
  game: string;
  releaseEp: number;
  /** The team's first game on or after release day, played or scheduled; null when there's none. */
  next: LedgerGame | null;
  /** Days from release to that game. */
  days: number | null;
  /** That game falls in this release's week, so the chip counts it. */
  inWeek: boolean;
}

/**
 * One team's game after each release, two ways at once: its next game
 * whenever it came (the loose count), and whether that game falls in the
 * release week (ours). The popover on the GTA boards draws it.
 */
export function gtaLedger(games: LedgerGame[]): LedgerRow[] {
  const sorted = [...games].sort((a, b) => a.ep - b.ep);
  return GTA_TITLES.map(({ game, ep }) => {
    const next = sorted.find((g) => g.ep >= ep) ?? null;
    return { game, releaseEp: ep, next, days: next ? next.ep - ep : null, inWeek: !!next && next.ep - ep < GTA_WEEK_DAYS };
  });
}

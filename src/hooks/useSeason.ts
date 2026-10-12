import { useEffect, useState } from 'react';
import type { Season } from '../lib/seasonFile.ts';
import { loadSeason } from '../lib/seasonFile.ts';

/**
 * A season's game rows (what each game ended and who it made a leader),
 * loaded once per season when a page needs it: a game page for its game's
 * season, the schedule for the selected year. A prerendered page arrives
 * with a slice of its season in `initial.seasonRows` (its own game's rows, its week's),
 * so the prerender and the hydrate agree; a slice serves until a page needs
 * a game it lacks (`need`: the keys the page shows), and then the season's
 * file replaces it. Null while loading.
 */
export function useSeason(season: number | null, need: readonly string[], initial?: { seasonRows?: Season | null }): Season | null {
  const [seasons, setSeasons] = useState<Record<number, Season>>(() => (initial?.seasonRows ? { [initial.seasonRows.season]: initial.seasonRows } : {}));
  const have = season == null ? null : seasons[season] ?? null;
  const enough = !!have && (have.complete || need.every((k) => have.games.has(k)));
  useEffect(() => {
    if (season == null || enough) return;
    let live = true;
    loadSeason(season).then((s) => { if (live) setSeasons((cur) => ({ ...cur, [season]: s })); });
    return () => { live = false; };
  }, [season, enough]);
  return enough ? have : null;
}

import { useEffect, useState } from 'react';
import type { Season } from '../lib/seasonFile.ts';
import { loadSeason } from '../lib/seasonFile.ts';

/**
 * A season's game rows (what each game ended and who it made a leader),
 * loaded once per season when a page needs it: a game page for its game's
 * season, the schedule for the selected year. A prerendered game page
 * arrives with its own season's rows in `initial` (so the prerender and the
 * hydrate agree). Null while loading.
 */
export function useSeason(season: number | null, initial?: { season?: Season | null }): Season | null {
  const [seasons, setSeasons] = useState<Record<number, Season>>(() => (initial?.season ? { [initial.season.season]: initial.season } : {}));
  useEffect(() => {
    if (season == null || seasons[season]) return;
    let live = true;
    loadSeason(season).then((s) => { if (live) setSeasons((cur) => ({ ...cur, [season]: s })); });
    return () => { live = false; };
  }, [season, seasons]);
  return season == null ? null : seasons[season] ?? null;
}

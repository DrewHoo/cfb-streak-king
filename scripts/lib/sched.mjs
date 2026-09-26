// cfbfastR schedule CSV row -> normalized game row, shared by
// parse-schedules.mjs (bulk 2002-2026) and build-current.mjs (fresh 2026).

import { canon, slug } from './names.mjs';

export function mapScheduleRow(r) {
  const home = r.home_team && (canon(r.home_team, 'cfbfastr') ?? `x:${slug(r.home_team)}`);
  const away = r.away_team && (canon(r.away_team, 'cfbfastr') ?? `x:${slug(r.away_team)}`);
  if (!home || !away) return null;
  const completed = r.completed === 'TRUE';
  const start = r.start_date; // UTC instant
  // Placeholders: exact T00:00:00Z is ambiguous with a real 8pm-ET kick in
  // 2002-2013 (no tbd flag those years) -> conservatively unknown; the 2001
  // file's T04:00:00Z placeholder style also shows up in a few early years.
  const season = Number(r.season);
  const timeKnown =
    !!start &&
    r.start_time_tbd !== 'TRUE' &&
    !/T00:00:00/.test(start) &&
    !(season <= 2005 && /T04:00:00/.test(start));
  return {
    season,
    week: Number(r.week),
    seasonType: r.season_type === 'postseason' ? 'postseason' : 'regular',
    start,
    timeKnown,
    neutral: r.neutral_site === 'TRUE',
    confGameRaw: r.conference_game === 'TRUE',
    home,
    away,
    homeRaw: r.home_team,
    awayRaw: r.away_team,
    homeConf: r.home_conference || null,
    awayConf: r.away_conference || null,
    homeDiv: r.home_division || null,
    awayDiv: r.away_division || null,
    homeScore: completed ? Number(r.home_points) : null,
    awayScore: completed ? Number(r.away_points) : null,
    espnHome: r.home_id || null,
    espnAway: r.away_id || null,
    completed,
    venue: r.venue || null,
    gameId: r.game_id,
  };
}

// cfbfastR schedule CSVs -> data/build/schedules-2002-2026.json.
// Serves three roles downstream:
//   - the game spine for 2014+ (dates, scores, neutral flags are clean there)
//   - night-game + conference enrichment joined onto the Repole spine 2002-2013
//   - upcoming (completed=false) rows for the This Week panel
// start_date is a UTC instant; local kickoff derives later from the home
// team's timezone. Rows with the 2001-style midnight placeholder or
// start_time_tbd are marked timeKnown=false.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseCsv, ensureDir } from '../lib/util.mjs';
import { canon, slug, reportUnmatched } from '../lib/names.mjs';

const RAW = path.join(ROOT, 'data', 'raw', 'cfbfastr');
const rows = [];
const seasons = [];
for (let y = 2002; y <= 2026; y++) {
  const f = path.join(RAW, `cfb_schedules_${y}.csv`);
  if (!fs.existsSync(f)) continue;
  seasons.push(y);
  for (const r of parseCsv(fs.readFileSync(f, 'utf8'))) {
    const home = r.home_team && (canon(r.home_team, 'cfbfastr') ?? `x:${slug(r.home_team)}`);
    const away = r.away_team && (canon(r.away_team, 'cfbfastr') ?? `x:${slug(r.away_team)}`);
    if (!home || !away) continue;
    const completed = r.completed === 'TRUE';
    const start = r.start_date; // UTC instant, e.g. 2024-08-24T16:00:00.000Z
    // Placeholders: exact T00:00:00Z is ambiguous with a real 8pm-ET kick in
    // 2002-2013 (no tbd flag those years) -> conservatively unknown; the 2001
    // file's T04:00:00Z placeholder style also shows up in a few early years.
    const season = Number(r.season);
    const timeKnown =
      !!start &&
      r.start_time_tbd !== 'TRUE' &&
      !/T00:00:00/.test(start) &&
      !(season <= 2005 && /T04:00:00/.test(start));
    rows.push({
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
    });
  }
}

ensureDir(path.join(ROOT, 'data', 'build'));
fs.writeFileSync(
  path.join(ROOT, 'data', 'build', 'schedules-2002-2026.json'),
  JSON.stringify(rows),
);
const done = rows.filter((r) => r.completed).length;
const upcoming = rows.filter((r) => !r.completed && r.season === 2026).length;
console.log(
  `schedules: ${rows.length} rows over ${seasons.length} seasons (${seasons[0]}-${seasons.at(-1)}), ${done} completed, ${upcoming} upcoming in 2026`,
);
reportUnmatched('cfbfastr');

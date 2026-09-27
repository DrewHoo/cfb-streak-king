// CFBD box pulls -> data/build/boxes.json rows
//   { home, away, ep, h1h, h1a, tph, tpa }
// h1h/h1a: halftime points (sum of the first two line scores). tph/tpa:
// possession seconds. Missing fields are simply absent; build-payload writes
// -1 sentinels. Joined to the spine by canon ids + epoch day (±1 for TZ).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir } from '../lib/util.mjs';
import { canon, slug, reportUnmatched } from '../lib/names.mjs';

const GAMES = path.join(ROOT, 'data', 'raw', 'cfbd-games');
const STATS = path.join(ROOT, 'data', 'raw', 'cfbd-teamstats');
const epochDay = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const mmss = (s) => {
  const m = /^(\d+):(\d\d)$/.exec(s ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const byId = new Map(); // game id -> row
let half = 0;
for (const f of fs.readdirSync(GAMES)) {
  for (const g of JSON.parse(fs.readFileSync(path.join(GAMES, f), 'utf8'))) {
    if (!g.completed || !g.startDate) continue;
    const home = canon(g.homeTeam, 'cfbd-games') ?? `x:${slug(g.homeTeam)}`;
    const away = canon(g.awayTeam, 'cfbd-games') ?? `x:${slug(g.awayTeam)}`;
    const row = { home, away, ep: epochDay(String(g.startDate)) };
    if (g.homeLineScores?.length >= 2 && g.awayLineScores?.length >= 2) {
      row.h1h = (g.homeLineScores[0] ?? 0) + (g.homeLineScores[1] ?? 0);
      row.h1a = (g.awayLineScores[0] ?? 0) + (g.awayLineScores[1] ?? 0);
      half++;
    }
    byId.set(g.id, row);
  }
}
// the 2014-2022 postseason pull predates cfbd-games/ and also carries line scores
const postF = path.join(ROOT, 'data', 'raw', 'cfbd-postseason.json');
if (fs.existsSync(postF)) {
  for (const g of JSON.parse(fs.readFileSync(postF, 'utf8'))) {
    if (byId.has(g.id) || !g.completed || !g.startDate) continue;
    const home = canon(g.homeTeam, 'cfbd-games') ?? `x:${slug(g.homeTeam)}`;
    const away = canon(g.awayTeam, 'cfbd-games') ?? `x:${slug(g.awayTeam)}`;
    const row = { home, away, ep: epochDay(String(g.startDate)) };
    if (g.homeLineScores?.length >= 2 && g.awayLineScores?.length >= 2) {
      row.h1h = (g.homeLineScores[0] ?? 0) + (g.homeLineScores[1] ?? 0);
      row.h1a = (g.awayLineScores[0] ?? 0) + (g.awayLineScores[1] ?? 0);
      half++;
    }
    byId.set(g.id, row);
  }
}

let top = 0;
let noGame = 0;
for (const f of fs.existsSync(STATS) ? fs.readdirSync(STATS) : []) {
  for (const r of JSON.parse(fs.readFileSync(path.join(STATS, f), 'utf8'))) {
    const row = byId.get(r.id);
    if (!row) { noGame++; continue; }
    for (const tm of r.teams ?? []) {
      const sec = mmss(tm.stats?.find((s) => s.category === 'possessionTime')?.stat);
      if (sec == null) continue;
      if (tm.homeAway === 'home') row.tph = sec;
      else row.tpa = sec;
    }
    if (row.tph != null && row.tpa != null) top++;
  }
}

const rows = [...byId.values()].filter((r) => r.h1h != null || r.tph != null);
ensureDir(path.join(ROOT, 'data', 'build'));
fs.writeFileSync(path.join(ROOT, 'data', 'build', 'boxes.json'), JSON.stringify(rows));
const withHalf = rows.filter((r) => r.h1h != null).length;
const withTop = rows.filter((r) => r.tph != null && r.tpa != null).length;
console.log(`boxes: ${rows.length} rows (${withHalf} with halftime, ${withTop} with possession), ${noGame} teamstat rows without a game`);
reportUnmatched('parse-boxes');

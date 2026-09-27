// One-time: CFBD /lines postseason 2014-2025 -> appended to
// data/ref/lines-cfbd.json (per-game median across books, home perspective,
// negative = home favored — the same shape the regular-season rows carry).
// The cfbfastR betting CSV that seeded that file lacks bowls, like its
// schedule CSVs. Needs CFBD_API_KEY. Idempotent: dedupes on gameId.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, sleep } from '../lib/util.mjs';
import { canon, slug } from '../lib/names.mjs';

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}
const key = process.env.CFBD_API_KEY;
if (!key) throw new Error('CFBD_API_KEY required');

const file = path.join(ROOT, 'data', 'ref', 'lines-cfbd.json');
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const have = new Set(rows.map((r) => String(r.gameId)));

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

let added = 0;
for (let y = 2014; y <= 2025; y++) {
  const res = await fetch(`https://api.collegefootballdata.com/lines?year=${y}&seasonType=postseason`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${y}: ${res.status}`);
  const games = await res.json();
  for (const g of games) {
    if (have.has(String(g.id))) continue;
    const spreads = (g.lines ?? []).map((l) => Number(l.spread)).filter(Number.isFinite);
    if (!spreads.length) continue;
    rows.push({
      gameId: String(g.id),
      season: g.season,
      week: g.week,
      seasonType: 'postseason',
      date: String(g.startDate).slice(0, 10),
      neutral: true,
      home: canon(g.homeTeam, 'cfbd-lines') ?? `x:${slug(g.homeTeam)}`,
      away: canon(g.awayTeam, 'cfbd-lines') ?? `x:${slug(g.awayTeam)}`,
      homeRaw: g.homeTeam,
      awayRaw: g.awayTeam,
      homeScore: g.homeScore ?? null,
      awayScore: g.awayScore ?? null,
      homeSpread: median(spreads),
      books: spreads.length,
    });
    added++;
  }
  console.log(`${y}: +${added} total so far`);
  await sleep(400);
}
fs.writeFileSync(file, JSON.stringify(rows));
console.log(`lines-cfbd.json: ${rows.length} rows (+${added} postseason)`);

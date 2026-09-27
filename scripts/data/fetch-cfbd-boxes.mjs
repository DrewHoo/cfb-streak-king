// One-time CFBD pulls for the halftime and possession chips:
//   /games per year 2001-2025 (line scores; halftime = q1+q2) -> data/raw/cfbd-games/
//   /games/teams per year+week 2004-2025 (possessionTime)     -> data/raw/cfbd-teamstats/
// Line scores exist from 2001 (solid 2003+); possessionTime from 2004.
// ~420 calls, inside the free tier. Idempotent: existing files are skipped.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir, sleep } from '../lib/util.mjs';

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}
const key = process.env.CFBD_API_KEY;
if (!key) throw new Error('CFBD_API_KEY required');

const GAMES = path.join(ROOT, 'data', 'raw', 'cfbd-games');
const STATS = path.join(ROOT, 'data', 'raw', 'cfbd-teamstats');
ensureDir(GAMES);
ensureDir(STATS);

let calls = 0;
async function q(u) {
  calls++;
  const res = await fetch(`https://api.collegefootballdata.com${u}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${u}`);
  await sleep(350);
  return res.json();
}

for (let y = 2001; y <= 2025; y++) {
  const f = path.join(GAMES, `${y}.json`);
  if (fs.existsSync(f)) continue;
  const reg = await q(`/games?year=${y}`);
  const post = await q(`/games?year=${y}&seasonType=postseason`);
  fs.writeFileSync(f, JSON.stringify([...reg, ...post]));
  console.log(`games ${y}: ${reg.length}+${post.length}`);
}

for (let y = 2004; y <= 2025; y++) {
  const f = path.join(STATS, `${y}.json`);
  if (fs.existsSync(f)) continue;
  const all = [];
  for (let w = 1; w <= 16; w++) {
    const rows = await q(`/games/teams?year=${y}&week=${w}`);
    if (!rows.length && w > 14) break;
    all.push(...rows);
  }
  const post = await q(`/games/teams?year=${y}&seasonType=postseason&week=1`);
  all.push(...post);
  fs.writeFileSync(f, JSON.stringify(all));
  console.log(`teamstats ${y}: ${all.length} game rows`);
}
console.log(`done; ${calls} API calls`);

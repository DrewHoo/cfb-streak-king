// CFBD /coaches -> data/build/coaches.json:
//   { [teamId]: { [year]: [{ k, n, g, w, l, t }] } }
// k is CFBD's coach id (identity across name collisions and return stints),
// n the display name. Fetches the raw pull once if data/raw/cfbd-coaches.json
// is absent (needs CFBD_API_KEY in the env or .env).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, RAW, ensureDir } from '../lib/util.mjs';
import { canon, slug, reportUnmatched } from '../lib/names.mjs';
import { FIRST_SEASON } from '../lib/window.mjs';

// the raw pull is named by its first season, so widening the window re-fetches
const rawFile = path.join(RAW, `cfbd-coaches-from-${FIRST_SEASON}.json`);
if (!fs.existsSync(rawFile)) {
  try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}
  const key = process.env.CFBD_API_KEY;
  if (!key) throw new Error('no raw coaches pull and no CFBD_API_KEY');
  const res = await fetch(`https://api.collegefootballdata.com/coaches?minYear=${FIRST_SEASON}&maxYear=2026`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`cfbd coaches: ${res.status}`);
  ensureDir(RAW);
  fs.writeFileSync(rawFile, await res.text());
}

const coaches = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
const out = {};
let rows = 0;
for (const c of coaches) {
  const name = `${c.firstName} ${c.lastName}`.trim();
  for (const s of c.seasons ?? []) {
    if (!s.school || !s.year) continue;
    const id = canon(s.school, 'cfbd-coaches') ?? `x:${slug(s.school)}`;
    const byYear = (out[id] ??= {});
    (byYear[s.year] ??= []).push({ k: c.id, n: name, g: s.games, w: s.wins, l: s.losses, t: s.ties });
    rows++;
  }
}

ensureDir(path.join(ROOT, 'data', 'build'));
fs.writeFileSync(path.join(ROOT, 'data', 'build', 'coaches.json'), JSON.stringify(out));

const teamsN = Object.keys(out).length;
let multi = 0, seasons = 0;
const minYearByTeam = [];
for (const byYear of Object.values(out)) {
  const ys = Object.keys(byYear).map(Number);
  minYearByTeam.push(Math.min(...ys));
  for (const rs of Object.values(byYear)) { seasons++; if (rs.length > 1) multi++; }
}
console.log(`coaches: ${rows} coach-seasons, ${teamsN} teams, ${seasons} team-seasons (${multi} multi-coach)`);
console.log(`earliest coverage: ${Math.min(...minYearByTeam)}; teams starting after 1978: ${minYearByTeam.filter((y) => y > 1978).length}`);
reportUnmatched('parse-coaches');

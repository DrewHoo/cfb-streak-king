// Repole Sunshine Forecast XML -> the 1978-2013 game spine.
// One row per game: date, designated visitor/home, scores, neutral flag,
// homeSpread (negative = home favored; Repole's per-team <line> is already
// negative-when-favored, so homeSpread is the home team's own line).
// Regular-season files: <site>V|H</site> on campus games; off-campus games
// instead carry info="@ City ST" or a championship-game name. Bowl files
// carry info="<Bowl Name>" and are always neutral. Off-campus games are
// neutral unless (home team, city) is ruled a home site in data/ref/alt-home.json.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir } from '../lib/util.mjs';
import { canon, slug, reportUnmatched } from '../lib/names.mjs';

const RAW = path.join(ROOT, 'data', 'raw', 'repole');
const errata = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ref', 'repole-errata.json'), 'utf8')).rows;
const errataBy = new Map(errata.map((e) => [`${e.date}|${e.visitor}|${e.home}`, e]));
const errataHit = new Set();
const altHome = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'ref', 'alt-home.json'), 'utf8'),
).pairs;

const games = [];
let unscored = 0;
const cityPairs = new Map(); // "team|city" -> count, for the review report
const infoOddities = new Map();

function teamId(raw) {
  return canon(raw, 'repole') ?? `x:${slug(raw)}`;
}

function parseFile(file, season, seasonType) {
  const xml = fs.readFileSync(file, 'latin1');
  const dateRe = /<date day="(\d{4}-\d{2}-\d{2})">([\s\S]*?)<\/date>/g;
  let dm;
  while ((dm = dateRe.exec(xml))) {
    const [, date, block] = dm;
    const gameRe = /<game([^>]*)>([\s\S]*?)<\/game>/g;
    let gm;
    while ((gm = gameRe.exec(block))) {
      const info = /info="([^"]*)"/.exec(gm[1])?.[1]?.trim() ?? null;
      const teams = [];
      const teamRe = /<team tnum="(\d)">([\s\S]*?)<\/team>/g;
      let tm;
      while ((tm = teamRe.exec(gm[2]))) {
        const t = tm[2];
        teams.push({
          tnum: Number(tm[1]),
          name: /<name>([^<]*)<\/name>/.exec(t)?.[1]?.trim(),
          // a blank <score> </score> (Repole's 2011 file stops mid-bowl-season)
          // is null, never 0: Number(' ') is 0
          score: (() => {
            const v = /<score>([^<]*)<\/score>/.exec(t)?.[1];
            return v === undefined || v.trim() === '' ? null : Number(v);
          })(),
          site: /<site>([^<]*)<\/site>/.exec(t)?.[1] ?? null,
          line: (() => {
            const l = /<line>([^<]*)<\/line>/.exec(t)?.[1];
            return l === undefined || l === '' ? null : Number(l);
          })(),
        });
      }
      if (teams.length !== 2) continue;
      teams.sort((a, b) => a.tnum - b.tnum);
      let [v, h] = teams;
      // data/ref/repole-errata.json: audited fixes to the file itself
      const fix = errataBy.get(`${date}|${v.name}|${h.name}`);
      if (fix) {
        errataHit.add(`${date}|${v.name}|${h.name}`);
        if (fix.score) [v.score, h.score] = fix.score.split('-').map(Number);
        if (fix.homeSpread != null) { h.line = fix.homeSpread; v.line = -fix.homeSpread; }
        if (fix.swapHome) [v, h] = [h, v];
      }
      const gameDate = fix?.newDate ?? date;
      if (!v.name || !h.name) continue;
      if ([v.score, h.score].some((x) => x !== null && !Number.isFinite(x))) continue;
      // one blank score blanks both; build-payload fills the game from Howell / cfbfastR
      if (v.score === null || h.score === null) { v.score = null; h.score = null; unscored++; }

      // Site sanity: when site tags exist they must agree with tnum order.
      if (v.site && v.site !== 'V') infoOddities.set(`site mismatch V ${season} ${date} ${v.name}`, 1);
      if (h.site && h.site !== 'H') infoOddities.set(`site mismatch H ${season} ${date} ${h.name}`, 1);

      const home = teamId(h.name);
      let neutral = false;
      if (seasonType === 'postseason') neutral = true;
      else if (info) {
        const city = info.startsWith('@') ? info.replace(/^@\s*/, '') : null;
        if (city) {
          cityPairs.set(`${home}|${city}`, (cityPairs.get(`${home}|${city}`) ?? 0) + 1);
          neutral = !(altHome[home] ?? []).includes(city);
        } else {
          // championship games, kickoff classics named without '@'
          infoOddities.set(info, (infoOddities.get(info) ?? 0) + 1);
          neutral = true;
        }
      }

      // homeSpread: home team's own line (negative = home favored).
      let homeSpread = h.line;
      if (homeSpread === null && v.line !== null) homeSpread = -v.line;

      games.push({
        season,
        seasonType,
        date: gameDate,
        away: teamId(v.name),
        home,
        awayRaw: v.name,
        homeRaw: h.name,
        awayScore: v.score,
        homeScore: h.score,
        neutral,
        homeSpread,
        info,
      });
    }
  }
}

for (let season = 1978; season <= 2013; season++) {
  const reg =
    [`ncaa${season}lines.xml`, `cfb${season}lines.xml`]
      .map((f) => path.join(RAW, 'cfblines', f))
      .find(fs.existsSync);
  if (!reg) throw new Error(`no regular-season xml for ${season}`);
  parseFile(reg, season, 'regular');
  const bowl = path.join(RAW, 'bowllines', `bowl${season}lines.xml`);
  if (fs.existsSync(bowl)) parseFile(bowl, season, 'postseason');
}

const stale = errata.filter((e) => !errataHit.has(`${e.date}|${e.visitor}|${e.home}`));
if (stale.length) throw new Error(`repole-errata: ${stale.length} entries matched no row: ${stale.map((e) => `${e.date} ${e.visitor}@${e.home}`).join(', ')}`);
console.log(`repole-errata: ${errataHit.size} corrections applied`);

games.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

ensureDir(path.join(ROOT, 'data', 'build'));
fs.writeFileSync(
  path.join(ROOT, 'data', 'build', 'spine-1978-2013.json'),
  JSON.stringify(games),
);

const lined = games.filter((g) => g.homeSpread !== null).length;
const neutral = games.filter((g) => g.neutral).length;
console.log(`spine 1978-2013: ${games.length} games, ${lined} lined, ${neutral} neutral, ${unscored} with blank scores (filled downstream)`);

console.log('\n(home team, city) pairs by count — review any HOME-looking site into alt-home.json:');
const pairs = [...cityPairs.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, n] of pairs.slice(0, 40)) {
  const [team, city] = k.split('|');
  const ruled = (altHome[team] ?? []).includes(city) ? '  <- ruled HOME' : '';
  console.log(`  ${String(n).padStart(4)}  ${team} @ ${city}${ruled}`);
}
console.log(`  (${pairs.length} distinct pairs total)`);

console.log('\nnon-city info values (championships etc.):');
for (const [k, n] of [...infoOddities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}

reportUnmatched('repole');

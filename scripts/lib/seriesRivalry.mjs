// The meetings a rivalry article's "Game results" table has and the other
// sources don't: the famous count's own list (the Holy War's 1896–98 games
// against Brigham Young Academy, which Utah counts and BYU doesn't). Drew's
// superset ruling: a game either school counts is a meeting.
//
// A table whose count is its infobox's is the famous list itself, so its
// games are the pair's early games in place of Howell's and the season
// articles'. Another table only adds the games we don't have: one of ours
// within a few days, or in the same season with the same score, is the same
// game. In a season since 1936 when either team was major the payload has it. Each added game's
// home team is the one whose games at that city the pair's other games say,
// else the team whose campus is there, else a neutral site.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './util.mjs';
import { lookup, slug } from './names.mjs';
import { rivalryGames } from './wpRivalry.mjs';

const DAY = 86400000;
const dayOf = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
const NEAR = 4;
const seasonOf = (iso) => { const [y, m] = iso.split('-').map(Number); return m <= 2 ? y - 1 : y; };
const city = (s) => slug(String(s).split(',')[0].replace(/\(.*?\)/g, ''));

export function rivalryAdds({ fbs, payload, ours, inPayload }) {
  const RAW = path.join(ROOT, 'data', 'raw', 'wikipedia');
  const majorIn = new Map(payload.teams.map((t) => [t.id, t.major ?? []]));
  const isMajor = (id, se) => (majorIn.get(id) ?? []).some(([a, b]) => se >= a && se <= b);
  // a game the series page already has: before 1936 Howell's, a season either team was major; since,
  // the payload's, from the season a team's latest major stint began (windowStartOf in createModel.ts)
  const windowStart = (id) => Math.max(1936, (majorIn.get(id) ?? []).at(-1)?.[0] ?? 1936);
  const covered = (a, b, se) => (se < 1936 ? isMajor(a, se) || isMajor(b, se) : se >= windowStart(a) || se >= windowStart(b));
  const known = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ref', 'series-known.json'), 'utf8')).rows;
  const articles = new Map(JSON.parse(fs.readFileSync(path.join(RAW, 'rivalries.json'), 'utf8')).map((p) => [p.title, p]));
  const programs = JSON.parse(fs.readFileSync(path.join(RAW, 'programs.json'), 'utf8'));
  const cfbd = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'raw', 'cfbd-teams.json'), 'utf8'));
  const campus = new Map();
  for (const c of cfbd) { const id = lookup(c.school); if (id && fbs.has(id) && c.location?.city && !campus.has(id)) campus.set(id, city(c.location.city)); }

  const oursBy = new Map();
  for (const g of ours) {
    const k = [g.home, g.away].sort().join('|');
    (oursBy.get(k) ?? oursBy.set(k, []).get(k)).push(g);
  }

  const games = [], rulings = [], replaced = new Set(), report = { tables: 0, trusted: 0, unread: [], unnamed: [], typos: [], rescored: [], howellGap: [] };
  for (const k of known) {
    const p = articles.get(k.title);
    if (!p) continue;
    // football's table: a basketball one's games fall January to March
    const offSeason = (t) => t.games.filter((g) => g.date && [3, 4, 5, 6, 7].includes(Number(g.date.slice(5, 7)))).length + t.games.filter((g) => g.date && Number(g.date.slice(5, 7)) <= 2 && Number(g.date.slice(8, 10)) > 15).length;
    // and a basketball score: a football table's median total is far under 100
    const median = (xs) => xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? 0;
    const tables = rivalryGames(p.text).filter((t) => t.games.length && offSeason(t) <= Math.max(2, t.games.length * 0.05) && median(t.games.map((g) => g.as + g.bs)) < 90);
    if (!tables.length) { report.unread.push(k.title); continue; }
    // the football table: a multi-sport article has several; take the one nearest the infobox's count
    const want = Math.max(0, ...k.meetings.n);
    const t = tables.sort((x, y) => Math.abs(x.games.length - want) - Math.abs(y.games.length - want))[0];
    report.tables++;
    // which of the pair each name in the table is: team1's and team2's spellings ("BYU / BYA")
    const names = (s) => s.split(/\s*\/\s*/).map((x) => slug(x)).filter(Boolean);
    const sideOf = new Map();
    const t1 = names(t.team1), t2 = names(t.team2);
    const id1 = t1.map((n) => lookup(n)).find(Boolean) ?? t1.map((n) => [...Object.entries(programs)].find(([, pr]) => slug(pr.program).startsWith(n))?.[0]).find(Boolean);
    const [A, B] = id1 === k.b ? [k.b, k.a] : [k.a, k.b];
    for (const n of t1) sideOf.set(n, A);
    for (const n of t2) sideOf.set(n, B);
    const who = (name) => {
      const s = slug(name);
      if (sideOf.has(s)) return sideOf.get(s);
      for (const [n, id] of sideOf) if (s.startsWith(n) || n.startsWith(s)) return id;
      const id = lookup(name);
      return id === A || id === B ? id : null;
    };
    const pairKey = [A, B].sort().join('|');
    const mine = oursBy.get(pairKey) ?? [];
    // the home team at each city, from the pair's games we have
    const cityHome = new Map();
    for (const tg of t.games) {
      if (!tg.date) continue;
      const g = mine.find((g) => Math.abs(dayOf(g.date) - dayOf(tg.date)) <= NEAR);
      if (g) cityHome.set(city(tg.site), g.neutral ? null : g.home);
    }
    // a table whose count is the infobox's is the famous list itself: its games are the pair's
    // early games, in place of Howell's and the season articles' (which can date one game weeks
    // apart or score it another way). Otherwise the table only adds what we don't have.
    const rows = [];
    for (const tg of t.games) {
      if (!tg.date) { rows.push(null); continue; }
      const tie = /^tie$/i.test(tg.a) || /^tie$/i.test(tg.b) || tg.as === tg.bs;
      let ta = tie ? A : who(tg.a), tb = tie ? B : who(tg.b);
      if (!tie && ta && !tb) tb = ta === A ? B : A;
      if (!tie && tb && !ta) ta = tb === A ? B : A;
      // "Baylor | 28 | Baylor | 14": the winner's column is right and the loser's is a typo
      if (ta && ta === tb && tg.as > tg.bs) { tb = ta === A ? B : A; report.typos.push(`${k.title} ${tg.date}`); }
      if (!ta || !tb || ta === tb) { report.unnamed.push(`${k.title} ${tg.date} ${tg.a} / ${tg.b}`); rows.push(null); continue; }
      rows.push({ tg, se: seasonOf(tg.date), scoreOf: { [ta]: tg.as, [tb]: tg.bs } });
    }
    const trusted = want > 0 && t.games.length === want && rows.every(Boolean);
    if (trusted) { replaced.add(pairKey); report.trusted++; }
    const used = new Set();
    for (const row of rows) {
      if (!row) continue;
      const { tg, se, scoreOf } = row;
      // the ruling: winN names a forfeit's winner, or says vacated
      if (tg.win) {
        if (/vacat/i.test(tg.win)) rulings.push({ date: tg.date, a: A, b: B, w: null, refs: [`${p.title}@${p.revid}`] });
        else { const w = who(tg.win); if (w) rulings.push({ date: tg.date, a: A, b: B, w, refs: [`${p.title}@${p.revid}`] }); }
      }
      // our game of it: within a few days, else the same season and score
      const match = mine.find((g) => !used.has(g) && Math.abs(dayOf(g.date) - dayOf(tg.date)) <= NEAR)
        ?? mine.find((g) => !used.has(g) && g.se === se && g.hs === scoreOf[g.home] && g.as === scoreOf[g.away]);
      if (match) used.add(match);
      // a score the table has another way, before the payload: the table is the famous list (Howell
      // has Utah's 1907 game against the Aggies as a 24–10 loss; Utah and the table, a 10–0 win)
      if (match && !trusted && se < 1936 && (match.hs !== scoreOf[match.home] || match.as !== scoreOf[match.away])) {
        report.rescored.push(`${k.title} ${match.date} ${match.hs}-${match.as} -> ${scoreOf[match.home]}-${scoreOf[match.away]}`);
        match.hs = scoreOf[match.home]; match.as = scoreOf[match.away];
      }
      if (se >= 1936 && inPayload(A, B, tg.date, se, scoreOf)) continue; // the payload has it
      if (!trusted && match) continue;
      const c = city(tg.site);
      const home = match ? (match.neutral ? null : match.home) : cityHome.has(c) ? cityHome.get(c) : campus.get(A) === c ? A : campus.get(B) === c ? B : null;
      const [h, a] = home === B ? [B, A] : [A, B];
      const g = { se, date: tg.date, home: h, away: a, hs: scoreOf[h], as: scoreOf[a], neutral: home == null, src: 'rivalry', refs: [`${p.title}@${p.revid}`] };
      games.push(g);
      if (!trusted && (isMajor(A, se) || isMajor(B, se))) report.howellGap.push(`${k.title} ${tg.date} ${tg.a} ${tg.as}, ${tg.b} ${tg.bs}`);
    }
  }
  fs.writeFileSync(path.join(ROOT, 'data', 'build', 'series-rivalry-report.json'), JSON.stringify(report, null, 1));
  console.log(`rivalry articles: ${report.tables} results tables (${report.trusted} with the infobox's count, whose early games are the table's), ${games.length} games, ${rulings.length} forfeits or vacated wins; ${report.unread.length} articles without a table, ${report.unnamed.length} rows whose teams didn't read, ${report.howellGap.length} added in a season Howell has either team`);
  return { games, rulings, replaced, report };
}

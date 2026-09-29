// jhowell.net pages -> conference-by-season, conference-game marks, and
// FBS ("major school") membership year spans.
//   byconf.htm: "<a href='Team.htm'>Team Name (1916-1986, 1989-present)</a>"
//   team pages: season header "<a name=1985>1985-Alabama (SEC)</a>", then one
//   row per game: M/D | '@'|'vs.' | [*]Opponent link | W/L/T | pf | pa | [@ City, ST]
//   '*' before the opponent marks a conference game.
// Output:
//   data/build/fbs-spans.json    { slug: [[start,end],...] }  (9999 = present)
//   data/build/jhowell.json      { conf: {slug: {year: "SEC"}}, confGames: ["year|team|MM/DD|opp",...],
//                                  games: [{ se, team, teamName, opp, oppName, date, at, pf, pa, city, note }] }
//   games: one row per team page row (so every game appears twice, once per
//   side). at is '@' (team was the visitor) or 'vs.'; city is the '@ City, ST'
//   cell, blank for a campus game. build-payload votes Howell's scores and
//   campus home teams against Repole's.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir, decodeEntities, stripTags } from '../lib/util.mjs';
import { canon, slug, reportUnmatched } from '../lib/names.mjs';

const RAW = path.join(ROOT, 'data', 'raw', 'jhowell');

// --- byconf: FBS spans ---
const byconf = fs.readFileSync(path.join(RAW, 'byconf.htm'), 'latin1');
const fbsSpans = {};
const linkRe = /<a href="([^"#]+\.htm)">([\s\S]*?)<\/a>/g;
let m;
while ((m = linkRe.exec(byconf))) {
  const text = decodeEntities(stripTags(m[2])).replace(/\s+/g, ' ').trim();
  const nm = /^(.*?)\s*\(([\d\s,\-present]+)\)\s*$/.exec(text);
  if (!nm) continue;
  const id = canon(nm[1], 'byconf') ?? `x:${slug(nm[1])}`;
  const spans = [];
  for (const part of nm[2].split(',')) {
    const p = part.trim();
    const range = /^(\d{4})\s*-\s*(\d{4}|present)$/.exec(p);
    if (range) spans.push([Number(range[1]), range[2] === 'present' ? 9999 : Number(range[2])]);
    else if (/^\d{4}$/.test(p)) spans.push([Number(p), Number(p)]);
  }
  if (!spans.length) continue;
  // same team can appear under several conference sections; keep the union
  fbsSpans[id] = [...(fbsSpans[id] ?? []), ...spans];
}
// a gap made only of seasons in fbs-span-bridges.json (seasons a team sat
// out) doesn't end its span
const bridges = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ref', 'fbs-span-bridges.json'), 'utf8')).teams;
const bridged = (id) => new Set((bridges[id] ?? []).flatMap((b) => b.seasons));
const bridgesUsed = [];
for (const id of Object.keys(fbsSpans)) {
  const sat = bridged(id);
  const merged = [];
  for (const s of fbsSpans[id].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    let gapBridged = !!last;
    for (let y = (last?.[1] ?? 0) + 1; gapBridged && y < s[0]; y++) gapBridged = sat.has(y);
    if (last && gapBridged) {
      if (s[0] > last[1] + 1) bridgesUsed.push(`${id} ${last[1] + 1}-${s[0] - 1}`);
      last[1] = Math.max(last[1], s[1]);
    } else merged.push([...s]);
  }
  fbsSpans[id] = merged;
}
for (const id of Object.keys(bridges)) {
  if (!fbsSpans[id]) throw new Error(`fbs-span-bridges.json: no byconf spans for ${id}`);
}

// --- team pages: conference per season + conference-game marks ---
const conf = {};
const confGames = new Set();
const games = [];
const oppId = (cell, linked) => {
  // "*Kansas State (11-4)" / "Idaho (non-IA)": drop the conf mark and the parenthetical
  const name = cell.replace(/^\*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  // an opponent with no page of its own was never a major school; slug it
  // without swelling the unmatched-name report
  if (!linked) return `x:${slug(name)}`;
  return canon(name, 'jhowell') ?? `x:${slug(name)}`;
};
const files = fs.readdirSync(path.join(RAW, 'teams')).filter((f) => f.endsWith('.htm'));
for (const f of files) {
  const html = fs.readFileSync(path.join(RAW, 'teams', f), 'latin1');
  // the conference is the last parenthetical: "2001-Miami (Florida) (Big East)"
  const headRe = /<a name=(\d{4})>\d{4}-([^<]+?)\s*\(([^()]*)\)<\/a>/g;
  const heads = [];
  let hm;
  while ((hm = headRe.exec(html))) {
    heads.push({ year: Number(hm[1]), name: hm[2].trim(), confName: hm[3].trim(), at: hm.index });
  }
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    if (h.year < 1978) continue;
    const id = canon(h.name, 'jhowell') ?? `x:${slug(h.name)}`;
    (conf[id] ??= {})[h.year] = h.confName;
    const block = html.slice(h.at, heads[i + 1]?.at ?? html.length);
    const trRe = /<tr>([\s\S]*?)<\/tr>/g;
    let tr;
    while ((tr = trRe.exec(block))) {
      const raw = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
      const cells = raw.map((c) => decodeEntities(stripTags(c)).replace(/\s+/g, ' ').trim());
      const md = /^(\d{1,2})\/(\d{1,2})$/.exec(cells[0] ?? '');
      if (!md || cells.length < 6) continue;
      const [mo, da] = [Number(md[1]), Number(md[2])];
      const y = mo <= 2 ? h.year + 1 : h.year; // bowls run into January
      const pf = Number(cells[4]);
      const pa = Number(cells[5]);
      if (!Number.isFinite(pf) || !Number.isFinite(pa)) continue;
      games.push({
        se: h.year, team: id, teamName: h.name, opp: oppId(cells[2], /<a href/.test(raw[2])),
        oppName: cells[2].replace(/^\*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim(),
        date: `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`,
        at: cells[1] === '@' ? '@' : 'vs.', pf, pa, city: cells[6] ?? '', note: cells[7] ?? '',
      });
    }
    const rowRe = /<td[^>]*>(\d{1,2}\/\d{1,2})<\/td><td[^>]*>(@|vs\.)<\/td><td[^>]*><a href="[^"]*">(\*?)([\s\S]*?)<\/a>/g;
    let rm;
    while ((rm = rowRe.exec(block))) {
      if (rm[3] !== '*') continue;
      const opp = decodeEntities(stripTags(rm[4])).replace(/\s+/g, ' ').trim();
      const oppId = canon(opp, 'jhowell') ?? `x:${slug(opp)}`;
      confGames.add(`${h.year}|${id}|${rm[1]}|${oppId}`);
    }
  }
}

ensureDir(path.join(ROOT, 'data', 'build'));
fs.writeFileSync(path.join(ROOT, 'data', 'build', 'fbs-spans.json'), JSON.stringify(fbsSpans, null, 1));
fs.writeFileSync(
  path.join(ROOT, 'data', 'build', 'jhowell.json'),
  JSON.stringify({ conf, confGames: [...confGames], games }),
);

const fbs2026 = Object.entries(fbsSpans).filter(([, s]) => s.some(([a, b]) => a <= 2026 && b >= 2026));
const fbs1985 = Object.entries(fbsSpans).filter(([, s]) => s.some(([a, b]) => a <= 1985 && b >= 1985));
console.log(
  `byconf: ${Object.keys(fbsSpans).length} teams with spans; ${fbs2026.length} FBS in 2026, ${fbs1985.length} in 1985`,
);
console.log(`span bridges: ${bridgesUsed.join(', ') || 'none'}`);
console.log(`team pages: ${files.length} files, ${Object.keys(conf).length} teams with 1978+ seasons, ${confGames.size} conference-game marks, ${games.length} game rows`);
const unkFbs = fbs2026.filter(([id]) => id.startsWith('x:')).map(([id]) => id);
if (unkFbs.length) console.log('2026 FBS teams with no canonical name:', unkFbs.join(', '));
reportUnmatched('jhowell');

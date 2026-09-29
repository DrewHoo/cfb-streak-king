// Export the Repole corrections for the public repo DrewHoo/repole-errata.
//   node scripts/data/export-errata.mjs <checkout of repole-errata>
// Writes repole-errata.csv/.json and missing-games.csv/.json there. Run it
// after data/ref/repole-errata.json changes (and after build-payload.mjs, which
// writes data/build/howell-fill-in.json), then commit and push that repo.
//
// Each errata row goes out with the file's published values beside the fix,
// read from the raw XML by the same date|visitor|home key parse-repole.mjs uses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'data', 'raw', 'repole');
const OUT = process.argv[2];
if (!OUT || !fs.existsSync(OUT)) throw new Error('usage: export-errata.mjs <existing output dir>');

const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ref', 'repole-errata.json'), 'utf8'));
const by = new Map(src.rows.map((e) => [`${e.date}|${e.visitor}|${e.home}`, e]));
const fill = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'build', 'howell-fill-in.json'), 'utf8'))
  .sort((a, b) => a.date.localeCompare(b.date) || a.home.localeCompare(b.home));

// the published values, scanned from the raw XML
const rows = [];
const seen = new Set();
function scan(file) {
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
          score: (/<score>([^<]*)<\/score>/.exec(t)?.[1] ?? '').trim(),
          line: (/<line>([^<]*)<\/line>/.exec(t)?.[1] ?? '').trim(),
        });
      }
      if (teams.length !== 2) continue;
      teams.sort((a, b) => a.tnum - b.tnum);
      const [v, h] = teams;
      const k = `${date}|${v.name}|${h.name}`;
      const e = by.get(k);
      if (!e) continue;
      if (seen.has(k)) throw new Error(`errata key matched twice: ${k}`);
      seen.add(k);
      rows.push({ file: path.basename(file), ...e, published: { score: `${v.score}-${h.score}`, visitorLine: v.line, homeLine: h.line, info } });
    }
  }
}
for (let s = 1978; s <= 2013; s++) {
  const reg = [`ncaa${s}lines.xml`, `cfb${s}lines.xml`].map((f) => path.join(RAW, 'cfblines', f)).find(fs.existsSync);
  if (!reg) throw new Error(`no regular-season xml for ${s}`);
  scan(reg);
  const bowl = path.join(RAW, 'bowllines', `bowl${s}lines.xml`);
  if (fs.existsSync(bowl)) scan(bowl);
}
const missed = src.rows.filter((e) => !seen.has(`${e.date}|${e.visitor}|${e.home}`));
if (missed.length) throw new Error(`${missed.length} errata rows matched no XML row: ${missed.map((e) => `${e.date} ${e.visitor}@${e.home}`).join(', ')}`);

const q = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = (cols, rs) => [cols.join(','), ...rs.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n') + '\n';
const blank = (r) => r.published.score.startsWith('-') || r.published.score.endsWith('-');
const kind = (r) => [
  blank(r) ? 'blank score' : r.score ? 'wrong score' : null,
  r.swapHome ? 'reversed home' : null,
  r.homeSpread != null ? 'wrong spread' : null,
  r.newDate ? 'wrong date' : null,
].filter(Boolean).join(' + ');

const flat = rows.map((r) => ({
  file: r.file, date: r.date, visitor: r.visitor, home: r.home, fix: kind(r),
  published_score: blank(r) ? '' : r.published.score, corrected_score: r.score ?? '',
  published_home_line: r.published.homeLine, corrected_home_line: r.homeSpread ?? '',
  swap_home: r.swapHome ? 'yes' : '', corrected_date: r.newDate ?? '', confirmed_by: r.source, note: r.note ?? '',
}));
fs.writeFileSync(path.join(OUT, 'repole-errata.csv'), csv(Object.keys(flat[0]), flat));
fs.writeFileSync(path.join(OUT, 'repole-errata.json'), JSON.stringify({
  version: src.version,
  updated: src.updated,
  note: "Corrections to Warren Repole's Sunshine Forecast files, keyed by file, date, visitor and home exactly as the file names them. 'score' is the corrected visitor-home score; 'swapHome' means the file lists the true home team as the visitor; 'homeSpread' is the corrected home line (negative = home favored); 'newDate' is the corrected date. 'published' holds what the file says. See README.md.",
  rows,
}, null, 1));

const fo = fill.map((f) => ({ date: f.date, visitor: f.visitor, home: f.home, score: f.score, neutral: f.neutral ? 'yes' : '', site: f.site ?? '', note: f.note ?? '' }));
fs.writeFileSync(path.join(OUT, 'missing-games.csv'), csv(Object.keys(fo[0]), fo));
fs.writeFileSync(path.join(OUT, 'missing-games.json'), JSON.stringify({
  updated: src.updated,
  note: "FBS-vs-FBS games absent from Repole's files, with scores from James Howell's pages. 'score' is visitor-home.",
  rows: fill,
}, null, 1));

const n = (k) => flat.filter((r) => r.fix.includes(k)).length;
console.log(`export-errata: ${flat.length} rows (${n('wrong score')} wrong scores, ${n('blank')} blank, ${n('reversed')} reversed homes, ${n('spread')} lines, ${n('date')} dates), ${fill.length} missing games -> ${OUT}`);
console.log('update the counts in that README.md if these changed');

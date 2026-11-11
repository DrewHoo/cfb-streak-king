// Every Wikipedia season article ("1893 Alabama Crimson Tide football team")
// of every team in FBS now, for the series pages' games before the payload's
// sources reach them: a season before Howell counts the school as major, or
// before its FBS stint (specs/series-first-meetings.spec.md).
//
//   node scripts/data/fetch-wp-seasons.mjs [team-id ...]
//
// Only the seasons the series pages can need: before 1936, or a season the
// team wasn't major (the payload has the rest). Wikipedia throttles hard by
// IP, so it asks for 50 articles at a time and waits out a 429.
//
// FULL=1 fetches the rest of every team's seasons into the same files: the
// forfeits and vacated wins of the payload's games, and a check of its scores.
//
// Writes data/raw/wikipedia/programs.json (each team's program article and
// season category) and data/raw/wikipedia/seasons/<id>.json, one
// { title, revid, text } per article. A team already fetched is skipped;
// delete its file to refetch. build-series-early.mjs reads them.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir } from '../lib/util.mjs';
import { lookup } from '../lib/names.mjs';

const OUT = path.join(ROOT, 'data', 'raw', 'wikipedia');
const SEASONS = path.join(OUT, 'seasons');
ensureDir(SEASONS);
const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'cfb-series-research/1.0 (static site build)';

const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'payload.json'), 'utf8'));
const fbs = payload.teams.filter((t) => (t.major ?? []).some(([, b]) => b >= payload.currentSeason));
// a program article CFBD's school and mascot don't name
const PROGRAMS = { 'appalachian-state': 'Appalachian State Mountaineers football', 'miami-oh': 'Miami RedHawks football' };
const isMajor = (t, se) => (t.major ?? []).some(([a, b]) => se >= a && se <= b);
const FULL = !!process.env.FULL;
const needed = (t, title) => { const se = Number(title.slice(0, 4)); return FULL || se < 1936 || !isMajor(t, se); };
const cfbd = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'raw', 'cfbd-teams.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`;
  for (let tries = 0; ; tries++) {
    await sleep(3000);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 && tries < 30) { await sleep(1000 * (Number(res.headers.get('retry-after') ?? 30) + 2)); continue; }
    if (res.ok) {
      const j = await res.json();
      if (!j.error) return j;
      if (j.error.code !== 'maxlag' || tries > 5) throw new Error(`${j.error.code}: ${j.error.info}`);
    } else if (tries > 5) throw new Error(`${res.status} ${url}`);
    await sleep(2000 * (tries + 1));
  }
}

// a program article per team: "<school> <mascot> football", following redirects
const progFile = path.join(OUT, 'programs.json');
const programs = fs.existsSync(progFile) ? JSON.parse(fs.readFileSync(progFile, 'utf8')) : {};
const want = new Set(process.argv.slice(2));
const todo = fbs.filter((t) => (!want.size || want.has(t.id)) && !programs[t.id]);
const guess = new Map();
for (const t of todo) {
  if (PROGRAMS[t.id]) { guess.set(t.id, PROGRAMS[t.id]); continue; }
  const c = cfbd.find((c) => lookup(c.school) === t.id && c.classification === 'fbs') ?? cfbd.find((c) => lookup(c.school) === t.id);
  if (!c) { console.warn(`no CFBD team for ${t.id}`); continue; }
  guess.set(t.id, `${c.school} ${c.mascot} football`.replace(/Hawai'i/, 'Hawaii'));
}
for (let i = 0; i < todo.length; i += 50) {
  const batch = todo.slice(i, i + 50).filter((t) => guess.has(t.id));
  const j = await api({ action: 'query', redirects: '1', titles: batch.map((t) => guess.get(t.id)).join('|') });
  const norm = new Map((j.query.normalized ?? []).map((n) => [n.from, n.to]));
  const redir = new Map((j.query.redirects ?? []).map((r) => [r.from, r.to]));
  const exists = new Set(j.query.pages.filter((p) => !p.missing).map((p) => p.title));
  for (const t of batch) {
    let title = guess.get(t.id);
    title = norm.get(title) ?? title;
    title = redir.get(title) ?? title;
    if (exists.has(title)) programs[t.id] = { program: title, category: `Category:${title.replace(/#.*/, '')} seasons` };
    else console.warn(`no program article for ${t.id} (${guess.get(t.id)})`);
  }
}
fs.writeFileSync(progFile, JSON.stringify(programs, null, 1));

for (const t of fbs) {
  if (want.size && !want.has(t.id)) continue;
  const file = path.join(SEASONS, `${t.id}.json`);
  if (!programs[t.id]) continue;
  const have = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (have && !FULL) continue;
  const got = new Set((have ?? []).map((p) => p.title));
  const titles = [];
  let cont = {};
  do {
    const j = await api({ action: 'query', list: 'categorymembers', cmtitle: programs[t.id].category, cmnamespace: '0', cmlimit: '500', ...cont });
    titles.push(...j.query.categorymembers.map((m) => m.title));
    cont = j.continue ?? null;
  } while (cont);
  const seasons = titles.filter((s) => /^\d{4} /.test(s) && needed(t, s) && !got.has(s));
  if (have && !seasons.length) continue;
  const pages = [...(have ?? [])];
  for (let i = 0; i < seasons.length; i += 50) {
    const j = await api({ action: 'query', prop: 'revisions', rvprop: 'ids|content', rvslots: 'main', titles: seasons.slice(i, i + 50).join('|') });
    for (const p of j.query.pages) if (p.revisions) pages.push({ title: p.title, revid: p.revisions[0].revid, text: p.revisions[0].slots.main.content });
  }
  pages.sort((a, b) => a.title.localeCompare(b.title));
  fs.writeFileSync(file, JSON.stringify(pages));
  console.log(`${new Date().toISOString().slice(11, 19)} ${t.id}: ${pages.length} of ${titles.length} seasons (${programs[t.id].category})`);
}

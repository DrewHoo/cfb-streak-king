// The Wikipedia article of every rivalry on the "List of NCAA college football
// rivalry games" (data/raw/rivalries-wikitext.json), for the series pages'
// known answers: the infobox's first meeting, meetings and record.
//
//   node scripts/data/fetch-wp-rivalries.mjs
//
// Writes data/raw/wikipedia/rivalries.json, one { title, revid, text } per
// article, redirects followed (`from` is the list's link).

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir } from '../lib/util.mjs';

const OUT = path.join(ROOT, 'data', 'raw', 'wikipedia');
ensureDir(OUT);
const UA = 'cfb-series-research/1.0 (static site build)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const w = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'raw', 'rivalries-wikitext.json'), 'utf8')).parse.wikitext['*'];
const titles = [...new Set((w.match(/\{\{Trophy game\|[\s\S]*?\}\}/g) ?? []).map((row) => /\[\[([^\]|#]+)/.exec(row)?.[1].trim()).filter(Boolean))];

const pages = [];
for (let i = 0; i < titles.length; i += 20) {
  const params = new URLSearchParams({ format: 'json', formatversion: '2', action: 'query', redirects: '1', prop: 'revisions', rvprop: 'ids|content', rvslots: 'main', titles: titles.slice(i, i + 20).join('|') });
  for (let tries = 0; ; tries++) {
    await sleep(1500);
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { headers: { 'User-Agent': UA } });
    if (res.status === 429 && tries < 8) { await sleep(1000 * Number(res.headers.get('retry-after') ?? 30)); continue; }
    if (!res.ok) throw new Error(`${res.status}`);
    const j = await res.json();
    const back = new Map();
    for (const r of [...(j.query.normalized ?? []), ...(j.query.redirects ?? [])]) back.set(r.to, back.get(r.from) ?? r.from);
    for (const p of j.query.pages) if (p.revisions) pages.push({ title: p.title, from: back.get(p.title) ?? p.title, revid: p.revisions[0].revid, text: p.revisions[0].slots.main.content });
    break;
  }
}
fs.writeFileSync(path.join(OUT, 'rivalries.json'), JSON.stringify(pages));
console.log(`${pages.length} of ${titles.length} rivalry articles`);

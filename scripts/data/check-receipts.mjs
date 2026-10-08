// Check every receipt in a ruling file against its page: the quote must
// appear, whitespace-collapsed, in the fetched page's text. A row whose quote
// can't be found is printed as FAIL and the script exits 1, so a hallucinated
// or paraphrased receipt can't ship. Usage:
//
//   node scripts/data/check-receipts.mjs data/ref/unplayed-postseasons.json [--only team-id]
//
// Reads any JSON whose rows live under "rows" (or any top-level array) and
// carry receipts: [{ url, quote, note?, retrieved? }]. Pages are fetched
// once each and cached in data/build/receipt-pages/ (gitignored) so a re-run
// costs nothing; delete a cached file to refetch it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = path.join(ROOT, 'data', 'build', 'receipt-pages');
fs.mkdirSync(CACHE, { recursive: true });

const file = process.argv[2];
if (!file) throw new Error('usage: check-receipts.mjs <ruling file> [--only team-id]');
const onlyAt = process.argv.indexOf('--only');
const only = onlyAt > 0 ? process.argv[onlyAt + 1] : null;
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = Array.isArray(data) ? data : data.rows ?? [];

// the same normalization on both sides: whitespace collapsed, curly quotes
// straightened, Wikipedia's "[12]" citation markers dropped, and no space
// before punctuation (a tag boundary before a period leaves one)
const collapse = (s) => s
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ')
  .replace(/\[\d+\]/g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s+([.,;:!?)\]])/g, '$1')
  .replace(/([(\[])\s+/g, '$1')
  .trim();
const textOf = (html) => collapse(
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))),
);

async function pageText(url) {
  const key = Buffer.from(url).toString('base64url').slice(0, 180);
  const cached = path.join(CACHE, key + '.txt');
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');
  const res = await fetch(url, { headers: { 'user-agent': 'cfb-streak-king receipt check (drewhoover.com)' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  const text = /<html|<body|<div/i.test(raw) ? textOf(raw) : collapse(raw);
  fs.writeFileSync(cached, text);
  return text;
}

let pass = 0, fail = 0, skipped = 0;
const failures = [];
for (const row of rows) {
  if (only && row.team !== only) continue;
  const label = `${row.team ?? '?'} ${row.season ?? ''}`.trim();
  for (const r of row.receipts ?? []) {
    if (!r.url || !r.quote) { failures.push(`${label}: receipt without url or quote`); fail++; continue; }
    let text;
    try { text = await pageText(r.url); } catch (e) {
      failures.push(`${label}: ${r.url} — ${e.message}`); skipped++; continue;
    }
    if (text.includes(collapse(r.quote))) pass++;
    else { fail++; failures.push(`${label}: quote not on page ${r.url}\n    "${r.quote.slice(0, 120)}"`); }
  }
}
console.log(`receipts: ${pass} pass, ${fail} fail, ${skipped} unfetchable`);
for (const f of failures) console.log('  FAIL ' + f);
if (fail) process.exit(1);

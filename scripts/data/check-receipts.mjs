// The hallucination gate for the ruling files. Walks JSON for any object
// carrying receipts: [...] and requires each receipt's quote to appear,
// whitespace-collapsed, in the text of its url. A row whose quote is not on
// its page is printed as MISS and the script exits 1, so a hallucinated or
// paraphrased receipt can't ship.
//
//   node scripts/data/check-receipts.mjs [--offline] [--pages DIR] FILE.json|DIR ...
//
// A directory argument means every *.json in it (data/ref). Page text is
// saved gzipped under data/research/pages/<sha1(url)>.txt.gz with an
// index.json beside it, and that directory is committed: a receipt can be
// re-checked after the page changes, moves behind a wall, or vanishes, and CI
// runs this with --offline against the committed pages. Delete a saved page
// to refetch it; drop a .txt.gz there by hand for a page a script can't fetch.
//
// Receipt forms (the receipts-research skill's claims.md):
//   { url, quote, note?, retrieved? }   checked here
//   { sources: [...], note? }           a vote across named datasets; skipped

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = { offline: false, pages: path.join(ROOT, 'data', 'research', 'pages'), files: [] };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--offline') opt.offline = true;
  else if (args[i] === '--pages') opt.pages = path.resolve(args[++i]);
  else opt.files.push(args[i]);
}
if (!opt.files.length) throw new Error('usage: check-receipts.mjs [--offline] [--pages DIR] FILE.json|DIR ...');
const files = opt.files.flatMap((f) => (fs.statSync(f).isDirectory() ? fs.readdirSync(f).filter((n) => n.endsWith('.json')).sort().map((n) => path.join(f, n)) : [f]));

fs.mkdirSync(opt.pages, { recursive: true });
const indexPath = path.join(opt.pages, 'index.json');
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : {};
const sha1 = (s) => createHash('sha1').update(s).digest('hex');

// the same normalization on both sides: whitespace collapsed, curly quotes
// straightened, Wikipedia's "[12]" citation markers dropped, and no space
// before punctuation (a tag boundary before a period leaves one; a schedule
// table's non-conference "*" sits in its own element)
const collapse = (s) => s
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ')
  .replace(/\[\d+\]/g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s+([.,;:!?)\]*])/g, '$1')
  .replace(/([(\[])\s+/g, '$1')
  .trim();
const textOf = (html) => collapse(
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // a tag ends at the first '>' outside a quoted attribute: Wikipedia's
    // Parsoid HTML carries wikitext in data-mw attributes, '>' included
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))),
);

const cache = new Map();
async function pageText(url) {
  if (cache.has(url)) return cache.get(url);
  const file = path.join(opt.pages, `${sha1(url)}.txt.gz`);
  let result;
  // collapsed again on read, so a .txt.gz dropped in by hand (a PDF's text) matches too
  if (fs.existsSync(file)) result = { text: collapse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) };
  else if (opt.offline) result = { error: 'no saved page; run without --offline to fetch it' };
  else {
    try {
      // Wikipedia rate-limits a few hundred quick fetches; back off and retry
      let res;
      for (let attempt = 0; ; attempt++) {
        res = await fetch(url, { headers: { 'user-agent': 'cfb-streak-king check-receipts (github.com/DrewHoo/cfb-streak-king)' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
        if (res.status !== 429 || attempt === 3) break;
        await new Promise((r) => setTimeout(r, 15000 * (attempt + 1)));
      }
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok) result = { error: `HTTP ${res.status}` };
      else if (/pdf/i.test(type)) result = { error: `PDF; extract its text to ${path.relative(ROOT, file)}` };
      else {
        const body = await res.text();
        const text = /html/i.test(type) || /^\s*</.test(body) ? textOf(body) : collapse(body);
        fs.writeFileSync(file, zlib.gzipSync(text));
        index[sha1(url)] = url;
        fs.writeFileSync(indexPath, JSON.stringify(Object.fromEntries(Object.entries(index).sort((a, b) => a[1].localeCompare(b[1]))), null, 1) + '\n');
        result = { text };
      }
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      result = { error: e.name === 'TimeoutError' ? 'timeout' : e.message };
    }
  }
  cache.set(url, result);
  return result;
}

function* claims(value, where) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* claims(value[i], `${where}[${i}]`);
  } else if (value && typeof value === 'object') {
    if (Array.isArray(value.receipts)) yield { obj: value, where };
    for (const [k, v] of Object.entries(value)) if (k !== 'receipts') yield* claims(v, where ? `${where}.${k}` : k);
  }
}
const label = (obj) => ['date', 'season', 'team', 'home', 'away', 'visitor', 'coach'].filter((k) => obj[k] !== undefined && typeof obj[k] !== 'object').map((k) => `${k}=${obj[k]}`).join(' ');

let failed = 0;
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const t = { total: 0, ok: 0, miss: 0, err: 0, vote: 0 };
  const lines = [];
  for (const { obj, where } of claims(data, '')) {
    for (let i = 0; i < obj.receipts.length; i++) {
      const r = obj.receipts[i];
      t.total++;
      const at = `${where || '<root>'}.receipts[${i}]${label(obj) ? ` (${label(obj)})` : ''}`;
      if (r?.sources && !r.url) { t.vote++; continue; }
      if (!r?.url || !r?.quote) { t.err++; lines.push(`ERR  ${at}: needs url and quote, or the sources form`); continue; }
      const page = await pageText(r.url);
      if (page.error) { t.err++; lines.push(`ERR  ${at}: ${page.error}\n       ${r.url}`); continue; }
      if (page.text.includes(collapse(r.quote))) t.ok++;
      else { t.miss++; lines.push(`MISS ${at}\n       ${r.url}\n       "${r.quote.length > 120 ? r.quote.slice(0, 117) + '...' : r.quote}"`); }
    }
  }
  if (!t.total) continue;
  console.log(`${path.relative(ROOT, file)}: ${t.total} receipts — ${t.ok} ok, ${t.miss} miss, ${t.err} unfetched, ${t.vote} votes`);
  for (const l of lines) console.log('  ' + l);
  failed += t.miss + t.err;
}
process.exit(failed ? 1 : 0);

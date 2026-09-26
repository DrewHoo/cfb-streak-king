// Shared helpers for the games/polls pipeline. No dependencies outside Node core.

import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
export const RAW = path.join(ROOT, 'data', 'raw');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Minimal RFC4180-ish CSV parser. cfbfastR quotes any field containing a comma
 * and doubles embedded quotes, which is all we need to handle.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (c !== '\r') field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#160': ' ',
};

export function stripTags(html) {
  return html.replace(/<[^>]*>/g, '');
}

export function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code) => {
    if (ENTITIES[code] !== undefined) return ENTITIES[code];
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
}

export function cellText(html) {
  return decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim();
}

/** Every <tr>…</tr> in `html`, each as an array of cell strings. */
export function tableRows(html) {
  const out = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html))) {
    const cells = [];
    const tdRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c;
    while ((c = tdRe.exec(m[1]))) cells.push(cellText(c[1]));
    out.push(cells);
  }
  return out;
}

export function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** "September 12, 1995" -> "1995-09-12" */
export function parseLongDate(s) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(s || '');
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase()];
  if (!mo) return null;
  return isoDate(Number(m[3]), mo, Number(m[2]));
}

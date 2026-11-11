// Reads a Wikipedia rivalry article's "Game results" table, the
// {{Sports rivalry series table}}: one row per meeting, "date | site | team |
// points | team | points", with `winN=` naming a forfeit's winner or
// "vacated". The list a rivalry's famous count is made from.

import { templates, params, link, dateOf } from './wpSchedule.mjs';

// split on top-level pipes: not inside [[ ]] or {{ }}
function fields(line) {
  const out = [];
  let depth = 0, cur = '';
  for (let i = 0; i < line.length; i++) {
    const two = line.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; cur += two; i++; continue; }
    if (line[i] === '|' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += line[i];
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

const plain = (s) => link(s.replace(/<ref[\s\S]*?(?:<\/ref>|\/>)/g, '').replace(/<sup>[\s\S]*?<\/sup>/g, '')).plain.replace(/[†‡§*^#]/g, (c) => (c === '#' ? '#' : '')).replace(/^\((?:FCS|FBS|I-AA|D-II)\)\s*/i, '').replace(/^(?:#|No\.\s*)\d+\s*/i, '').replace(/\s*\(\d+\)\s*$/, '').trim();
const yearOf = (s) => Number(/\b(1[89]\d\d|20\d\d)\b/.exec(s)?.[1] ?? NaN);

/**
 * The games in a rivalry article: { team1, team2, games: [{ date, site, a, as, b, bs, win }] }
 * with a/b the names as the row spells them, `win` the winN value when there is one.
 */
export function rivalryGames(text) {
  const out = [];
  for (const call of templates(text, 'sports rivalry series table')) {
    const p = params(call);
    const body = call.slice(2, -2).replace(/<!--[\s\S]*?-->/g, '');
    // the positional fields in order; a row starts at a date and runs to the next one, on one
    // line or several: date, site (unless no_location), team, points, team, points, notes
    const toks = fields(body).slice(1).filter((f) => !/^[a-z_]+\d*\s*=/i.test(f))
      .map((f) => f.replace(/\{\{\s*(?:dow tooltip|tooltip|nowrap|nobr)\s*\|([^|{}]*)[^{}]*\}\}/gi, '$1'));
    const isDate = (t) => /\{\{\s*dts\s*\|/i.test(t) || /[A-Z][a-z]+\.?\s+\d{1,2},?\s+\d{4}/.test(plain(t)) || /^\s*(1[89]\d\d|20\d\d)\s*$/.test(plain(t));
    const isNum = (t) => t != null && /^\s*\d+\s*$/.test(plain(t).replace(/[^\d\s]/g, ''))  && /\d/.test(plain(t));
    const rows = [];
    for (const t of toks) {
      if (isDate(t)) rows.push([t]);
      else if (rows.length) rows[rows.length - 1].push(t);
    }
    const games = [];
    for (const r of rows) {
      // the four fields "team | points | team | points"
      let k = 1;
      while (k + 3 < r.length && !(isNum(r[k + 1]) && isNum(r[k + 3]) && !isNum(r[k]))) k++;
      if (k + 3 >= r.length) continue;
      const dts = /\{\{\s*dts\s*\|\s*(\d{4})/i.exec(r[0]);
      const dateText = dts ? r[0] : plain(r[0]);
      const y = dts ? Number(dts[1]) : yearOf(dateText);
      if (!y) continue;
      const date = /[A-Za-z]/.test(plain(r[0])) || dts ? dateOf(dateText, y) : null;
      const as = Number(/\d+/.exec(plain(r[k + 1]))[0]), bs = Number(/\d+/.exec(plain(r[k + 3]))[0]);
      games.push({ date, year: y, site: k > 1 ? plain(r[1]) : '', a: plain(r[k]), as, b: plain(r[k + 2]), bs, win: null });
    }
    // a winN on its own line names the Nth row
    for (const [k, v] of Object.entries(p)) {
      const m = /^win(\d+)$/.exec(k);
      if (m && games[Number(m[1]) - 1]) games[Number(m[1]) - 1].win = plain(v);
    }
    out.push({ team1: plain(p.team1 ?? ''), team2: plain(p.team2 ?? ''), games });
  }
  return out;
}

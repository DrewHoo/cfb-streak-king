// Reads the games out of a Wikipedia season article's schedule: the
// {{CFB schedule entry}} rows of its {{CFB schedule}} table. Each row is from
// the article team's side; `opponent` is a link or plain text.

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** The template calls in `text` named `name`, each as a string, nested ones included whole. */
export function templates(text, name) {
  const out = [];
  const re = new RegExp(`\\{\\{\\s*${name}\\s*[|}]`, 'gi');
  let m;
  while ((m = re.exec(text))) {
    let depth = 0, i = m.index;
    for (; i < text.length - 1; i++) {
      if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; }
      else if (text[i] === '}' && text[i + 1] === '}') { depth--; i++; if (!depth) break; }
    }
    out.push(text.slice(m.index, i + 1));
    re.lastIndex = i + 1;
  }
  return out;
}

/** Top-level `| key = value` params of a template call. */
export function params(call) {
  const body = call.slice(2, -2);
  const parts = [];
  let depth = 0, cur = '';
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; cur += two; i++; continue; }
    if (body[i] === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += body[i];
  }
  parts.push(cur);
  const out = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    out[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>/g, '').trim();
  }
  return out;
}

/** The first wikilink in `s`: { target, text }, or the plain text. */
export function link(s) {
  // {{cfb link|year=1917|team=Birmingham Panthers|title=Birmingham}} links the season article
  const cfb = /\{\{\s*cfb link\s*(\|[^{}]*)\}\}/i.exec(s);
  if (cfb && !/\[\[/.test(s.slice(0, cfb.index))) {
    const p = params(`{{x${cfb[1]}}}`);
    const target = p.year && p.team ? `${p.year} ${p.team} football team` : null;
    const text = (p.title ?? p.team ?? '').trim();
    return { target, text, plain: text };
  }
  const m =/\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/.exec(s);
  const plain = s.replace(/\{\{[^{}]*\}\}/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?|<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return m ? { target: m[1].trim(), text: (m[2] ?? m[1]).trim(), plain } : { target: null, text: plain, plain };
}

const flag = (v) => /^(y|yes|true|1)$/i.test(String(v ?? '').trim());

/** The date of a schedule row in season `se`, as YYYY-MM-DD, or null. */
export function dateOf(raw, se) {
  const s = raw
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{\s*dts\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})[^{}]*\}\}/gi, (_, y, m, d) => `${Object.keys(MONTHS)[m - 1]} ${d} ${y}`)
    .replace(/\{\{\s*(?:dow tooltip|tooltip|abbr|nowrap|small|nobr)\s*\|([^|{}]*)[^{}]*\}\}/gi, '$1')
    .replace(/\{\{[^{}]*\}\}|\[\[|\]\]/g, ' ').replace(/,/g, ' ').toLowerCase();
  const m = /([a-z]+)\.?\s+(\d{1,2})(?:[.\s]+(\d{4}))?/.exec(s);
  if (!m || !MONTHS[m[1]]) return null;
  const mo = MONTHS[m[1]], da = Number(m[2]);
  const yr = m[3] ? Number(m[3]) : mo <= 3 ? se + 1 : se;
  return `${yr}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}

/**
 * Every game in a season article: { date, opp: {target,text}, site: 'home'|'away'|'neutral',
 * us, them, wl, ruling } from the article team's side: `wl` the official result, `ruling`
 * 'forfeit' or 'vacated' when that isn't the score as played. A row without a score
 * (canceled, not played) is left out and counted in `skipped`.
 */
export function scheduleOf(text, se) {
  const games = [], skipped = [];
  for (const call of templates(text, 'CFB schedule entry')) {
    const p = params(call);
    const score = /(\d+)\s*[–\-−—]\s*(\d+)/.exec(p.score ?? '');
    const mark = String(p['w/l'] ?? '').trim().toLowerCase();
    const wl = mark.slice(0, 1);
    if (!score || !mark || !'wltfv'.includes(wl) || mark.length > 1) { skipped.push({ date: p.date, opponent: p.opponent, score: p.score, wl: p['w/l'] }); continue; }
    const [a, b] = [Number(score[1]), Number(score[2])];
    // `f` is the article team's forfeit and `v` its vacated win; a forfeit's
    // score is as played, the article team's first
    const forfeit = wl === 'f' || /forfeit/i.test(p.score ?? '');
    const [us, them] = forfeit || wl === 'v' || wl === 't' ? [a, b] : wl === 'w' ? [Math.max(a, b), Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)];
    games.push({
      date: dateOf(p.date ?? '', se),
      opp: link(p.opponent ?? ''),
      site: flag(p.neutral) ? 'neutral' : flag(p.away) ? 'away' : 'home',
      us, them,
      // the official result: a forfeit's, and a vacated win stays a win the ruling takes out
      wl: wl === 'f' ? 'l' : wl === 'v' ? 'w' : wl,
      ruling: forfeit ? 'forfeit' : wl === 'v' ? 'vacated' : null,
      note: p.gamename ? link(p.gamename).text : '',
    });
  }
  if (!games.length) for (const call of templates(text, 'CFB schedule')) positional(call, se, games, skipped);
  return { games, skipped };
}

// split on top-level pipes, outside [[ ]], {{ }} and <ref>…</ref>
function fieldsOf(line) {
  const out = [];
  let depth = 0, cur = '';
  const clean = line.replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (let i = 0; i < clean.length; i++) {
    const two = clean.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; cur += two; i++; continue; }
    if (clean[i] === '|' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += clean[i];
  }
  out.push(cur.trim());
  return out;
}

const MARK = /^(?:at|@|vs\.?|n|neutral)?$/i;
const RESULT = /^\s*(?:'+|<[^>]+>)*\s*([WLTwlt])\b\.?\s*(\d+)\s*[–\-−—]\s*(\d+)/;
/**
 * The older {{CFB schedule}} form: one row per line, "|date|at|opponent|stadium|city|W 17-0|…",
 * its columns set by the template's flags. The result is the field shaped "W 17–0"; the
 * opponent is the first named field after the date that isn't a mark, a rank or a time.
 */
function positional(call, se, games, skipped) {
  const body = call.slice(2, -2);
  // a row begins on a line starting with a pipe; a ref can run onto the next lines
  const rows = [];
  for (const line of body.split('\n')) {
    if (/^\s*\|/.test(line)) rows.push(line.trim().slice(1));
    else if (rows.length) rows[rows.length - 1] += ' ' + line;
  }
  for (const row of rows) {
    if (/^\s*[a-z_]+\s*=/i.test(row)) continue; // the template's flags
    const f = fieldsOf(row);
    const flat = (x) => x.replace(/\{\{[^{}]*\}\}/g, '');
    const ri = f.findIndex((x, i) => i > 0 && RESULT.test(flat(x)));
    if (ri < 0) { if (f.length > 3 && /\d/.test(f[0])) skipped.push({ date: f[0], row: row.slice(0, 80) }); continue; }
    const res = RESULT.exec(flat(f[ri]));
    const wl = res[1].toLowerCase(), a = Number(res[2]), b = Number(res[3]);
    let mark = 'home', opp = null;
    for (let i = 1; i < ri; i++) {
      const v = f[i].replace(/<[^>]+>/g, '').trim();
      if (MARK.test(v)) { if (i <= 3) mark = /^(?:at|@)$/i.test(v) ? 'away' : /^(?:vs\.?|n|neutral)$/i.test(v) ? 'neutral' : mark; continue; }
      if (/^(?:no\.\s*)?#?\d+$/i.test(v) || /\d{1,2}:\d{2}|[ap]\.m\.|^TBA$|^noon$/i.test(v)) continue;
      opp = f[i].replace(/<[^>]+>/g, '');
      break;
    }
    if (!opp) { skipped.push({ date: f[0], row: row.slice(0, 80) }); continue; }
    const forfeit = /forfeit/i.test(f[ri]);
    const [us, them] = forfeit || wl === 't' ? [a, b] : wl === 'w' ? [Math.max(a, b), Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)];
    games.push({ date: dateOf(f[0], se), opp: link(opp), site: mark, us, them, wl, ruling: forfeit ? 'forfeit' : null, note: '' });
  }
}

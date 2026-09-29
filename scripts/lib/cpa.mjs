// collegepollarchive.com page parsing, shared by parse-polls.mjs (bulk cache)
// and build-current.mjs (fresh in-season fetch).
// The rank cell is the <strong> one — the cell adjacent to the team anchor is
// the PREVIOUS week's rank (verified against the ESPN rankings API on
// hostile-territory; see that repo's data/research/rank-disputes.md).

import { cellText, decodeEntities, stripTags, parseLongDate, isoDate } from './util.mjs';
import { canon, slug } from './names.mjs';

export function parsePollPage(html, seasonYear, label) {
  const heading =
    (/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html)?.[1] ?? '') +
    ' ' +
    (/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '');
  let date = parseLongDate(cellText(heading));
  if (!date) {
    if (/preseason/i.test(label)) date = isoDate(seasonYear, 8, 1);
    else if (/final/i.test(label)) date = isoDate(seasonYear + 1, 2, 1);
  }

  const ranks = [];
  const seen = new Set();
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html))) {
    const row = m[1];
    const rankM = /<td[^>]*>\s*<strong>\s*(\d{1,2})\s*<\/strong>\s*<\/td>/i.exec(row);
    const teamM = /teamid=\d+"[^>]*>([\s\S]*?)<\/a>/i.exec(row);
    if (!rankM || !teamM) continue;
    const rank = Number(rankM[1]);
    if (!(rank >= 1 && rank <= 25)) continue;
    const raw = decodeEntities(stripTags(teamM[1])).trim();
    // an unmatched name (a wartime service team) keeps Howell's x:<slug> form
    const team = canon(raw, 'ap') ?? `x:${slug(raw)}`;
    if (seen.has(team)) continue;
    seen.add(team);
    ranks.push({ rank, team, raw });
  }
  ranks.sort((a, b) => a.rank - b.rank);
  return { label, date, ranks };
}

/** Poll links on a CPA season page: [{ id, label }] in page order, deduped. */
export function parseSeasonPolls(html) {
  const out = [];
  const seen = new Set();
  const re = /appollid=(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const id = Number(m[1]);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: decodeEntities(stripTags(m[2])).trim() });
  }
  return out;
}

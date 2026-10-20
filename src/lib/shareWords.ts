// The share text for a board or matchup URL, built without the model: the
// Cloudflare worker (workers/share) rewrites <head> per definition, and it
// can't carry the 3.8MB payload, so the words come from the chip catalog
// (pure) plus a small table file the prerender publishes
// (dist/share/meta.json: site title, team names, mascot and color tables).
//
// The wording mirrors definition.ts (chipWord/PARAMS) and the share texts in
// App.jsx; shareWords.test.ts holds the two in agreement. Anything this
// can't word honestly returns null and the worker leaves the page alone.

import { chipByKey } from './chips.ts';
import type { Chip } from './chips.ts';
import { dirWord, stateName } from './format.ts';
import { parseDir } from './outcome.ts';
import { landingFromPath } from './landing.ts';
import { asFromPath, asBoardTitle } from './asTeam.ts';

/** dist/share/meta.json, as the prerender writes it. */
export interface ShareMeta {
  site: string;
  /** Every ever-major team, id -> name: the "vs [team]" choices and matchup names. */
  teams: Record<string, string>;
  /** Every other team the payload knows (a never-major opponent), id -> name: a game address can name one. */
  others?: Record<string, string>;
  mascots: string[];
  colors: string[];
}
/** A team's name by id, major or not; null for an id the meta doesn't know. */
export const teamName = (meta: ShareMeta, id: string): string | null => meta.teams[id] ?? meta.others?.[id] ?? null;

export interface ShareText {
  title: string;
  description: string;
}

// definition.ts owns these; the test pins each copy to its original
const DEFAULT_WORDS = ['vs unranked opponents'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MASCOT_CLASS_WORDS: Record<string, string> = {
  animal: 'animal mascots', people: 'human mascots', bird: 'bird mascots', cat: 'cat mascots',
  canine: 'dog & wolf mascots', myth: 'mythical mascots', force: 'forces of nature',
};
const mascotKey = (entry: string) => entry.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// one chip as a word, or null when its choice can't be worded from the meta
function word(c: Chip, raw: string | undefined, meta: ShareMeta): string | null {
  if (!c.param) return c.label;
  if (raw == null || raw === '') return null;
  switch (c.param) {
    case 'month': { const n = Number(raw); return MONTH_NAMES[n - 1] ? `in ${MONTH_NAMES[n - 1]}` : null; }
    case 'hmargin': { const n = Number(raw); return Number.isFinite(n) ? (n > 1 ? `${c.label} by ${n}+` : c.label) : null; }
    case 'state': return `in ${stateName(raw)}`;
    case 'conf': return `vs the ${raw}`;
    case 'team': return meta.teams[raw] ? `vs ${meta.teams[raw]}` : null;
    case 'mascot': { const m = meta.mascots.find((x) => mascotKey(x) === raw); return m ? `vs ${MASCOT_CLASS_WORDS[m] ?? m}` : null; }
    case 'color': return meta.colors.includes(raw) ? `vs ${raw} schools` : null;
  }
}

/** The definition's words from the `c` param: null = the URL's default, [] = no constraints. */
export function defWords(c: string | null, meta: ShareMeta): string[] | null {
  if (c == null) return null;
  if (c === 'all') return [];
  const out: string[] = [];
  for (const part of c.split(',').slice(0, 4)) {
    const [key, ...rest] = part.split(':');
    const chip = chipByKey.get(key);
    if (!chip) continue; // decodeChips drops what it can't read; so do we
    const w = word(chip, rest.length ? rest.join(':') : undefined, meta);
    if (w) out.push(w);
  }
  return out;
}

/** The payload tables decodeRefs resolves choices against. */
export interface RefTables {
  /** teams[i].id, in payload order, so a team choice decodes to its index. */
  teamIds: string[];
  mascots: string[];
  colors: string[];
}

/**
 * The `c` param as ChipRefs the model can evaluate, mirroring
 * definition.ts's decodeChips: parts it can't read drop out, four chips at
 * most. Null when `c` is absent (the caller applies the URL's default).
 */
export function decodeRefs(c: string | null, t: RefTables): { key: string; param?: string | number }[] | null {
  if (c == null) return null;
  if (c === 'all') return [];
  const out: { key: string; param?: string | number }[] = [];
  for (const part of c.split(',')) {
    const [key, ...rest] = part.split(':');
    const chip = chipByKey.get(key);
    if (!chip) continue;
    if (!chip.param) { out.push({ key }); continue; }
    const raw = rest.join(':');
    let param: string | number | undefined;
    switch (chip.param) {
      case 'month': case 'hmargin': { const n = Number(raw); if (raw !== '' && Number.isFinite(n)) param = n; break; }
      case 'state': case 'conf': if (raw) param = raw; break;
      case 'team': { const i = t.teamIds.indexOf(raw); if (i >= 0) param = i; break; }
      case 'mascot': { const i = t.mascots.findIndex((x) => mascotKey(x) === raw); if (i >= 0) param = i; break; }
      case 'color': { const i = t.colors.indexOf(raw); if (i >= 0) param = i; break; }
    }
    if (param !== undefined) out.push({ key, param });
  }
  return out.slice(0, 4);
}

/** A game's address, /game/<date>/<away>-at-<home>/ (-vs- neutral), as the ids it names; null when it names no two teams the meta knows (either side may be a never-major team). */
export function gameFromShare(pathname: string, meta: ShareMeta): { date: string; away: string; home: string; neutral: boolean; key: string } | null {
  const m = /\/game\/(\d{4}-\d{2}-\d{2})\/([a-z0-9:-]+)\/?$/.exec(pathname);
  if (!m) return null;
  const re = /-(at|vs)-/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(m[2]))) {
    const away = m[2].slice(0, x.index), home = m[2].slice(x.index + x[0].length);
    if (teamName(meta, away) && teamName(meta, home)) return { date: m[1], away, home, neutral: x[1] === 'vs', key: `${m[1]}/${m[2]}` };
  }
  return null;
}

const PAST = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed', U: 'was undefeated in' } as Record<string, string>;
const marginOfDir = (dir: string) => { const by = Number(dir.slice(1)); return by ? ` by ${by}+ points` : ''; };
/** One row of a season file's game: the fields the words need. */
export interface GameRowWords { team: string; chips: string; dir: string; len: number; atEdge: boolean; rank: number; tied?: number; field: number; since: number; leader?: boolean; everLen?: number; everN?: number }

/** A season-file row's run in words: "14 straight by 10+ points at home · vs ranked opponents" (the file joins chips with '+'). */
export function rowWords(r: GameRowWords, meta: ShareMeta): string {
  const w = defWords(r.chips ? r.chips.split('+').join(',') : 'all', meta) ?? [];
  return `${r.len}${r.atEdge ? '+' : ''} straight${marginOfDir(r.dir)}${w.length ? ` ${w.join(' · ')}` : ''}`;
}

/**
 * Title and description for a game's page, from the season file's rows for
 * it: the score when played, the top runs it ended and the leaders it made.
 */
export function gameText(g: NonNullable<ReturnType<typeof gameFromShare>>, meta: ShareMeta, score: { home: number; away: number } | null, rows: GameRowWords[]): ShareText {
  const away = teamName(meta, g.away) ?? g.away, home = teamName(meta, g.home) ?? g.home;
  const at = g.neutral ? 'vs' : 'at';
  const when = longDate(g.date);
  const title = score
    ? `${score.home > score.away ? `${home} ${score.home}, ${away} ${score.away}` : `${away} ${score.away}, ${home} ${score.home}`} (${when}) · ${meta.site}`
    : `${away} ${at} ${home}, ${when}: streaks on the line · ${meta.site}`;
  const words = (r: GameRowWords) => rowWords(r, meta);
  const ended = rows.filter((r) => !r.leader).slice(0, 3).map((r) => `${teamName(meta, r.team) ?? r.team} ${PAST[r.dir[0]] ?? 'had won'} ${words(r)}`);
  const led = rows.filter((r) => r.leader).slice(0, 2).map((r) => `${teamName(meta, r.team) ?? r.team} now leads: ${words(r)}`);
  const parts = [...ended, ...led];
  const description = score
    ? (parts.length ? `${parts.join('. ')}. Every streak this college football game ended, and every field it handed a new leader.` : `${away} ${at} ${home}, ${when}: no streak that led its field ended in this college football game.`)
    : `Every streak on the line when ${away} play ${at} ${home}, ${when}.`;
  return { title, description };
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Oct 28, 2023" from "2023-10-28". */
export const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1] ?? m} ${d}, ${y}`;
};

/** A past season's schedule head, /games/<season>/ or /games/<season>/week/<n>/ (the prerender writes these pages; this words one the origin lacks). */
export function pastWeekText(season: number, wk: number | null, meta: ShareMeta): ShareText {
  return wk != null
    ? { title: `Week ${wk}, ${season} college football: the games and the streaks they broke · ${meta.site}`, description: `Every Week ${wk} game of the ${season} college football season with a current FBS team, and every streak each one ended.` }
    : { title: `${season} college football season: every week's games and the streaks they broke · ${meta.site}`, description: `The ${season} college football season week by week: every game with a current FBS team, and the streaks each one ended.` };
}

const SCOPE = (q: URLSearchParams) => (q.get('scope') === 'active' ? 'active' : 'all-time');
const DIR = (q: URLSearchParams) => dirWord(parseDir(q.get('dir')) ?? 'W');

/**
 * Title and description for a shared URL, or null for a page whose
 * prerendered head is already right (the bare board, team pages, the
 * schedule and its weeks).
 */
export function shareText(pathname: string, q: URLSearchParams, meta: ShareMeta): ShareText | null {
  // a matchup: /team/<id>/?vs=<id>|next
  const team = /\/team\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1];
  if (team) {
    const vs = q.get('vs');
    if (!vs || !meta.teams[team]) return null;
    const name = meta.teams[team];
    const opp = vs === 'next' ? null : meta.teams[vs];
    if (vs !== 'next' && !opp) return null;
    const title = opp ? `${name} vs ${opp} · ${meta.site}` : `${name}’s next game · ${meta.site}`;
    return { title, description: `Every streak either side puts on the line in the game, with the line and both teams’ records.` };
  }

  // a team's by-opponent page (asTeam.ts) is prerendered with its own head; a column open on one (?t=) is worded from its definition
  const asPage = asFromPath(pathname);
  if (asPage) {
    if (!meta.teams[asPage.id] || !q.has('t')) return null;
    q = new URLSearchParams(q);
    q.set('as', asPage.id);
    q.set('dir', asPage.dir);
    q.delete('c');
    q.delete('scope');
  }
  // the board: only its base path, and only when the URL says something
  if (!asPage && (!/\/$/.test(pathname) || /\/(team|games)\//.test(pathname) || /\/games\/?$/.test(pathname))) return null;
  // a named definition's page (landing.ts) is prerendered with its own head; a panel open on it reads from its definition
  const landing = landingFromPath(pathname);
  if (landing) {
    if (!['t', 'run', 'week'].some((k) => q.has(k))) return null;
    q = new URLSearchParams(q);
    q.set('c', landing.c);
    q.set('dir', landing.dir);
    q.set('scope', landing.scope);
  }
  if (!['c', 'dir', 'scope', 't', 'run', 'week', 'as'].some((k) => q.has(k))) return null;
  // the by-opponent board: one team's streaks against each opponent; its default definition has no conditions
  const as = q.get('as');
  if (as != null) {
    const name = meta.teams[as];
    if (!name) return null;
    const w = defWords(q.get('c') ?? 'all', meta) ?? [];
    const t = q.get('t');
    const opp = t ? teamName(meta, t) : null;
    return {
      title: `${opp ? `${name} vs ${opp} — ` : ''}${asBoardTitle(name, SCOPE(q), DIR(q), w)} · ${meta.site}`,
      description: `${name}’s longest ${SCOPE(q)} ${DIR(q)} streak against each opponent it has played${w.length ? ` ${w.join(', ')}` : ''}, ranked since 1936. Open a column for every game in the run.`,
    };
  }
  const words = defWords(q.get('c'), meta) ?? DEFAULT_WORDS;
  const t = q.get('t');
  const who = t && meta.teams[t] ? `${meta.teams[t]} — ` : '';
  const tail = words.length ? ` · ${words.join(' · ')}` : '';
  return {
    title: `${who}Longest ${SCOPE(q)} ${DIR(q)} streaks${tail} · ${meta.site}`,
    description: `Every current FBS team’s longest ${SCOPE(q)} ${DIR(q)} streak${words.length ? ` ${words.join(', ')}` : ''}, ranked since 1936. Open a column for every game in the run.`,
  };
}

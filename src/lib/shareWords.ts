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

/** dist/share/meta.json, as the prerender writes it. */
export interface ShareMeta {
  site: string;
  /** Every ever-major team, id -> name: the "vs [team]" choices and matchup names. */
  teams: Record<string, string>;
  mascots: string[];
  colors: string[];
}

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

const SCOPE = (q: URLSearchParams) => (q.get('scope') === 'active' ? 'active' : 'all-time');
const DIR = (q: URLSearchParams) => {
  const d = q.get('dir');
  return dirWord(d === 'L' || d === 'U' || d === 'C' || d === 'N' ? d : 'W');
};

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

  // the board: only its base path, and only when the URL says something
  if (!/\/$/.test(pathname) || /\/(team|games)\//.test(pathname) || /\/games\/?$/.test(pathname)) return null;
  if (!['c', 'dir', 'scope', 't', 'run', 'week'].some((k) => q.has(k))) return null;
  const words = defWords(q.get('c'), meta) ?? DEFAULT_WORDS;
  const t = q.get('t');
  const who = t && meta.teams[t] ? `${meta.teams[t]} — ` : '';
  const tail = words.length ? ` · ${words.join(' · ')}` : '';
  return {
    title: `${who}Longest ${SCOPE(q)} ${DIR(q)} streaks${tail} · ${meta.site}`,
    description: `Every current FBS team’s longest ${SCOPE(q)} ${DIR(q)} streak${words.length ? ` ${words.join(', ')}` : ''}, ranked since 1936. Open a column for every game in the run.`,
  };
}

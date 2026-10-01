// The one sentence the site says about a streak. Used for the claim above the
// ledger, the share text and the OG alt, so they can't drift apart.
//
// The sentence is assembled from slots in a fixed order, and every chip maps
// to exactly one slot:
//
//   {Team} has {won|lost} {N} straight [KIND…] {NOUN} [SELF] [BET] [COACH]
//   [CTX] [OPP] [SITE] [WHEN] [HALF] [POS], since {Mon YYYY}.
//
//   Everything that describes the subject team (SELF, BET, COACH, CTX) reads
//   before "against", so "as the favorite" can't attach to the opponent.
//
//   KIND   adjectives before the noun: "one-score rivalry night games"
//   NOUN   "games" unless a chip replaces it: "season openers", "shootouts".
//          Only one chip may take the noun; a second noun chip is demoted to
//          a trailing WHEN clause ("in bowl games").
//   OPP    one "against …" clause. Rank, conference and in-state chips are
//          adjectives on the noun ("against unranked conference opponents"); a team or a
//          conference replaces the noun ("against Auburn", "against SEC
//          opponents"); a first-year opposing coach hangs off the end ("led
//          by first-year head coaches"). Two opponent chips never produce two
//          "against"s.
//   SITE   "at home" / "on the road" / "in Texas"
//   SELF   "while ranked"
//   BET    "as a 14+ point underdog"
//   COACH  "under the current head coach" / "in a coach’s first season"
//   WHEN   "in November"
//   CTX    "coming off a loss"
//   HALF   "when leading at half by 7+"
//   POS    "when winning the possession battle"
//
// Adding a chip means adding one row to SLOTS. Anything missing falls back
// to the chip's label so a new chip never breaks the sentence.

import type { BoardRow, ChipRef, Crown, Dir } from './types.ts';
import { teams } from './model.ts';
import { chipByKey } from './chips.ts';
import { dirWord, stateName } from './format.ts';

type Frag = string | ((p: any) => string);
type SlotRow = [slot: string, frag: Frag, demoted?: string];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map((m) => m.slice(0, 3));
// what describes the subject team comes before "against", so "as the
// favorite" can't attach to the opponent
const ORDER = ['self', 'bet', 'coach', 'opp', 'site', 'when', 'half', 'pos'];
// the context clause ("coming off a bye") trails everything, after a comma

// slot + fragment per chip. `adj` chips modify the opponent noun, `noun`
// chips replace "games", `kind` chips precede it; the rest are clauses.
export const SLOTS: Record<string, SlotRow> = {
  home: ['site', 'at home'],
  road: ['site', 'on the road'],
  neutral: ['site', 'at neutral sites'],
  away: ['site', 'away from home'],
  state: ['site', (p) => `in ${stateName(p)}`],
  ranked: ['adj', 'ranked'],
  top10: ['adj', 'top-10'],
  top5: ['adj', 'top-5'],
  unranked: ['adj', 'unranked'],
  instate: ['adj', 'in-state'],
  vsteam: ['oppnoun', (p) => teams[p]?.name ?? '?'],
  vsconf: ['oppnoun', (p) => `${p} opponents`],
  vsnewcoach: ['oppcoach', 'first-year head coach'],
  whileranked: ['self', 'while ranked'],
  whileunranked: ['self', 'while unranked'],
  fav: ['bet', 'as the favorite'],
  dog: ['bet', 'as an underdog'],
  dog7: ['bet', 'as a 7+ point underdog'],
  dog14: ['bet', 'as a 14+ point underdog'],
  close: ['bet', 'with a spread of 3 or less'],
  confgame: ['adj', 'conference'],
  nonconf: ['adj', 'non-conference'],
  rivalry: ['kind', 'rivalry'],
  onescore: ['kind', 'one-score'],
  night: ['kind', 'night'],
  fullmoon: ['kind', 'werewolf'],
  weekend: ['when', 'on weekends'],
  weekday: ['when', 'on weekdays'],
  overtime: ['kind', 'overtime'],
  shootout: ['noun', 'shootouts', 'in shootouts'],
  struggle: ['noun', 'rock fights', 'in rock fights'],
  opener: ['noun', 'season openers', 'in season openers'],
  finale: ['noun', 'regular-season finales', 'in regular-season finales'],
  postseason: ['noun', 'bowl and playoff games', 'in bowl and playoff games'],
  curcoach: ['coach', 'under the current head coach'],
  newcoach: ['coach', 'in a coach’s first season'],
  month: ['when', (p) => `in ${MONTHS[p - 1] ?? p}`],
  afterloss: ['ctx', 'coming off a loss'],
  afterwin: ['ctx', 'coming off a win'],
  afterbye: ['ctx', 'coming off a bye'],
  leadhalf: ['half', (p) => (p > 1 ? `when leading at half by ${p}+` : 'when leading at half')],
  trailhalf: ['half', (p) => (p > 1 ? `when trailing at half by ${p}+` : 'when trailing at half')],
  wonpos: ['pos', 'when winning the possession battle'],
  lostpos: ['pos', 'when losing the possession battle'],
};
// adjectives read in this order: "one-score rivalry werewolf night games"
const KIND_ORDER = ['onescore', 'overtime', 'rivalry', 'fullmoon', 'night'];
// opponent adjectives read rank, then conference, then in-state
const ADJ_ORDER = ['ranked', 'top10', 'top5', 'unranked', 'confgame', 'nonconf', 'instate'];

const frag = (f: Frag, p: unknown) => (typeof f === 'function' ? f(p) : f);

/** The constraint tail: "one-score games against ranked opponents on the road". */
export function definitionPhrase(active: ChipRef[]): string {
  const by = new Map<string, string[]>(); // slot -> fragments
  const push = (slot: string, text: string) => by.set(slot, [...(by.get(slot) ?? []), text]);
  let noun: Frag | null = null;
  for (const a of active) {
    const row = SLOTS[a.key];
    if (!row) { push('when', chipByKey.get(a.key)?.label ?? a.key); continue; }
    const [slot, f, demoted] = row;
    if (slot === 'noun') {
      if (noun) push('when', demoted!);
      else noun = f;
    } else if (slot === 'kind' || slot === 'adj' || slot === 'oppnoun' || slot === 'oppcoach') {
      push(slot, a.key === 'vsteam' || a.key === 'vsconf' || a.key === 'state' || a.key === 'month' ? frag(f, a.param) : f as string);
    } else {
      push(slot, frag(f, a.param));
    }
  }

  // the noun phrase: "[one-score conference] games"
  const kindWords = active.filter((a) => SLOTS[a.key]?.[0] === 'kind').sort((x, y) => KIND_ORDER.indexOf(x.key) - KIND_ORDER.indexOf(y.key)).map((a) => SLOTS[a.key][1]);
  const head = [...kindWords, (noun as string | null) ?? 'games'].join(' ');

  // one "against" clause
  const adjs = active.filter((a) => SLOTS[a.key]?.[0] === 'adj').sort((x, y) => ADJ_ORDER.indexOf(x.key) - ADJ_ORDER.indexOf(y.key)).map((a) => SLOTS[a.key][1]);
  const oppNoun = by.get('oppnoun')?.[0];
  const coach = by.get('oppcoach')?.[0];
  let opp = '';
  if (adjs.length || oppNoun || coach) {
    const specific = active.some((a) => a.key === 'vsteam');
    const n = oppNoun ?? 'opponents';
    const np = specific ? n : [...adjs, n].join(' ');
    const led = coach ? (specific ? ` while led by a ${coach}` : ` led by ${coach}es`) : '';
    opp = `against ${np}${led}`;
  }

  // two "when" clauses share one "when": "when leading at half and winning the possession battle"
  const whens = [...(by.get('half') ?? []), ...(by.get('pos') ?? [])].map((w) => w.replace(/^when /, ''));
  if (whens.length > 1) { by.set('half', [`when ${whens.join(' and ')}`]); by.delete('pos'); }

  const tail = ORDER.flatMap((slot) => (slot === 'opp' ? (opp ? [opp] : []) : by.get(slot) ?? []));
  const ctx = by.get('ctx') ?? [];
  const main = [head, ...tail].join(' ');
  if (!ctx.length) return main;
  return tail.length ? `${main}, ${ctx.join(' and ')}` : `${main} ${ctx.join(' and ')}`;
}

const monYear = (ep: number) => {
  const d = new Date(ep * 86400000);
  return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const year = (ep: number) => new Date(ep * 86400000).getUTCFullYear();

/**
 * "Rutgers has lost 44 straight games against ranked opponents, since Nov 2009."
 * row: a board() or allTimeBoard() row. Ended all-time runs read in the past
 * tense with a year span.
 */
// a streak of one: "1 straight game", not "games"
const SINGULAR: Record<string, string> = { games: 'game', shootouts: 'shootout', 'rock fights': 'rock fight', 'season openers': 'season opener', 'regular-season finales': 'regular-season finale', 'bowl and playoff games': 'bowl or playoff game' };
const singular = (phrase: string) => phrase.replace(/^(bowl and playoff games|regular-season finales|season openers|rock fights|shootouts|games)/, (m) => SINGULAR[m]);

// "has won" / "won", by outcome and tense
const VERBS: Record<Dir, [live: string, ended: string]> = {
  W: ['has won', 'won'],
  L: ['has lost', 'lost'],
  U: ['is undefeated in', 'went undefeated in'],
  C: ['has covered', 'covered'],
  N: ['has failed to cover', 'failed to cover'],
};
const span = (y0: number, y1: number) => (y0 === y1 ? ` in ${y0}` : `, ${y0}–${y1}`);

export function claim(row: BoardRow, active: ChipRef[], dir: Dir): string {
  const t = teams[row.ti];
  const phrase = definitionPhrase(active);
  const n = `${row.s.len}${row.s.atEdge ? '+' : ''} straight ${row.s.len === 1 && !row.s.atEdge ? singular(phrase) : phrase}`;
  const live = row.live ?? true;
  if (!live) {
    // "in 2012" for a run inside one year, "2007–2021" across years
    return `${t.name} ${VERBS[dir][1]} ${n}${span(year(row.s.start!.ep), year(row.s.end!.ep))}.`;
  }
  const first = row.qual[row.qual.length - row.s.len];
  const since = row.s.atEdge ? '' : `, since ${monYear(first.ep)}`;
  return `${t.name} ${VERBS[dir][0]} ${n}${since}.`;
}

/** A team with no streak under the definition. */
export function noClaim(ti: number, active: ChipRef[], dir: Dir): string {
  return `${teams[ti].name} has no active ${dirWord(dir)} streak in ${definitionPhrase(active)}.`;
}

/** The sentence for one streak a team is king of (its share text). */
export function crownClaim(ti: number, cr: Crown): string {
  const live = cr.scope === 'active' || cr.live;
  const when = !live && cr.startSe != null && cr.endSe != null ? span(cr.startSe, cr.endSe) : '';
  const chips = cr.chips.map((key) => ({ key }));
  return `${teams[ti].name} ${VERBS[cr.dir][live ? 0 : 1]} ${cr.len}${cr.atEdge ? '+' : ''} straight ${definitionPhrase(chips)}${when}.`;
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

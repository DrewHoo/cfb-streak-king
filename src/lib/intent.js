// Free text -> a streak definition. Two parsers with one output shape,
// { chips: [{ key, param?, p }], dir: 'W'|'L'|null }:
//   parseLocal: phrase table + longest match + small typo tolerance. Instant,
//     offline, and the fallback when the Worker is down.
//   parseRemote: the Worker (worker/) asks TypeSafe's Jev the questions from
//     buildQuestions() and fromJev() maps the answers back to chips.
// resolve() applies the same rules as the picker: one chip per exclusive
// group, at most four.

import { teams, CHIPS, chipByKey, MONTHS, HMARGINS, STATE_OPTIONS, CONF_OPTIONS } from './model.js';

// set after `npm run deploy` in worker/; null keeps the input local-only
export const PARSE_URL = null;

// every team that has ever been FBS, the same list the opponent picker shows
const oppTeams = teams.map((t, i) => ({ t, i })).filter(({ t }) => t.fbs);

// ---------------------------------------------------------------------------
// Jev questions

// what each chip means, written for the model. Rank chips say whose rank.
const HINTS = {
  home: "games in the team's own home stadium",
  road: "true road games at the opponent's stadium",
  neutral: 'neutral-site games',
  away: 'any game not at home (road or neutral site)',
  ranked: 'the OPPONENT is ranked in the AP top 25',
  top10: 'the OPPONENT is AP top 10',
  top5: 'the OPPONENT is AP top 5',
  unranked: 'the OPPONENT is unranked',
  whileranked: 'the team itself is AP ranked at kickoff ("while ranked", "when they are ranked")',
  whileunranked: 'the team itself is unranked at kickoff',
  fav: 'the team was the betting favorite',
  dog: 'the team was the betting underdog',
  dog7: 'the team was an underdog by 7+ points',
  dog14: 'the team was an underdog by 14+ points',
  close: 'the point spread was 3 or less either way',
  confgame: 'conference games',
  nonconf: 'non-conference (out of conference) games',
  rivalry: 'rivalry games',
  instate: 'the opponent is from the same state as the team',
  curcoach: "games under the team's current head coach",
  newcoach: "games in a head coach's first season",
  vsnewcoach: 'games against a first-year head coach',
  opener: 'season openers',
  finale: 'regular-season finales',
  postseason: 'bowl games and playoff games',
  afterloss: 'games right after a loss',
  afterwin: 'games right after a win',
  afterbye: 'games after a bye week',
  leadhalf: 'the team led at halftime',
  trailhalf: 'the team trailed at halftime',
  wonpos: 'the team won time of possession',
  dompos: 'the team had 60%+ of time of possession',
  onescore: 'one-score games, decided by 8 or fewer',
  shootout: 'shootouts: 70+ combined points and decided by under 10',
  struggle: 'defensive struggles: 33 or fewer combined points',
  night: 'night games, kickoff 6pm or later',
  ot: 'games that went to overtime',
};

const qid = (group) => 'g_' + group.replace(/\W+/g, '_');

// exclusive groups with 2+ chips become one choice; everything else without
// a parameter is its own yes/no
const choiceGroups = new Map();
for (const c of CHIPS) {
  if (!c.x) continue;
  if (!choiceGroups.has(c.group)) choiceGroups.set(c.group, []);
  choiceGroups.get(c.group).push(c);
}
for (const [g, list] of choiceGroups) if (list.length < 2) choiceGroups.delete(g);
const nouls = CHIPS.filter((c) => !c.param && !(c.x && choiceGroups.has(c.group)));

export const STATE_CONTEXT =
  'A college football site ranks every FBS team by its current winning or losing streak in the games that '
  + 'match a filter. The user typed a filter description into a search box. A named team is always the '
  + 'opponent, because the board already covers every team. The user typed: ';

export function buildQuestions() {
  const q = {};
  q.dir = {
    type: 'choice',
    instructions: 'Is the user asking about winning streaks or losing streaks?',
    criteria: {
      W: 'winning streaks: wins, beating, unbeaten, dominance',
      L: 'losing streaks: losses, losing to, winless, futility',
      none: 'direction not stated',
    },
  };
  for (const [g, list] of choiceGroups) {
    const criteria = {};
    for (const c of list) criteria[c.key] = HINTS[c.key];
    criteria.none = `no ${g} condition mentioned`;
    q[qid(g)] = { type: 'choice', instructions: `Which ${g} condition should games be filtered to, if any?`, criteria };
  }
  for (const c of nouls) {
    q['c_' + c.key] = {
      type: 'noul',
      instructions: `Does the user want to count only ${HINTS[c.key]}?`,
      criteria: { true: `asks for ${HINTS[c.key]}`, false: 'not mentioned' },
    };
  }
  const team = {};
  for (const { t } of oppTeams) team[t.id] = t.name;
  team.none = 'no specific opponent named';
  q.team = { type: 'choice', instructions: 'Which specific opponent, if any, is named?', criteria: team };
  const conf = {};
  for (const o of CONF_OPTIONS) conf[o] = `opponents from the ${o}`;
  conf.none = 'no opponent conference named';
  q.conf = { type: 'choice', instructions: 'Is the user filtering to opponents from one conference?', criteria: conf };
  const state = {};
  for (const s of STATE_OPTIONS) state[s] = `games played in ${STATE_NAMES[s] ?? s}`;
  state.none = 'no state named as a game location (a team named after a state does not count)';
  q.state = { type: 'choice', instructions: 'Is the user filtering to games played in one US state?', criteria: state };
  const month = {};
  for (const [n, name] of MONTHS) month[n] = `games in ${name}`;
  month.none = 'no month named';
  q.month = { type: 'choice', instructions: 'Is the user filtering to games in one month?', criteria: month };
  const hm = {};
  for (const [n, name] of HMARGINS) hm[n] = `halftime margin ${name}`;
  q.hmargin = { type: 'choice', instructions: 'If a halftime lead or deficit is mentioned, how big?', criteria: hm };
  return q;
}

/** Jev answers -> parse result. Choices below 0.5 are dropped. */
export function fromJev(answers) {
  const chips = [];
  let dir = null;
  const pick = (a) => (a?.type === 'choice' && a.choice !== 'none' ? { v: a.choice, p: a.probabilities?.[a.choice] ?? a.confidence ?? 0 } : null);
  const hm = pick(answers.hmargin);
  for (const [id, a] of Object.entries(answers ?? {})) {
    if (id === 'dir') {
      const d = pick(a);
      if (d && d.p >= 0.5) dir = d.v;
    } else if (id.startsWith('g_')) {
      const c = pick(a);
      if (c && c.p >= 0.5 && chipByKey.has(c.v)) {
        const chip = chipByKey.get(c.v);
        chips.push(chip.param === 'hmargin' ? { key: c.v, param: Number(hm?.v ?? 1), p: c.p } : { key: c.v, p: c.p });
      }
    } else if (id.startsWith('c_')) {
      const key = id.slice(2);
      if (a?.type === 'noul' && a.noul >= 0.5 && chipByKey.has(key)) chips.push({ key, p: a.noul });
    } else if (id === 'team') {
      const c = pick(a);
      const ti = c ? teams.findIndex((t) => t.id === c.v) : -1;
      if (c && c.p >= 0.5 && ti >= 0) chips.push({ key: 'vsteam', param: ti, p: c.p });
    } else if (id === 'conf') {
      const c = pick(a);
      if (c && c.p >= 0.5 && CONF_OPTIONS.includes(c.v)) chips.push({ key: 'vsconf', param: c.v, p: c.p });
    } else if (id === 'state') {
      const c = pick(a);
      if (c && c.p >= 0.5 && STATE_OPTIONS.includes(c.v)) chips.push({ key: 'state', param: c.v, p: c.p });
    } else if (id === 'month') {
      const c = pick(a);
      if (c && c.p >= 0.5) chips.push({ key: 'month', param: Number(c.v), p: c.p });
    }
  }
  return { chips, dir, src: 'jev' };
}

export async function parseRemote(text, signal) {
  // text/plain keeps this a simple request, so there's no CORS preflight
  const r = await fetch(PARSE_URL, { method: 'POST', body: JSON.stringify({ q: text }), signal });
  if (!r.ok) throw new Error(`parse ${r.status}`);
  const { answers } = await r.json();
  return fromJev(answers);
}

// ---------------------------------------------------------------------------
// local parser

const STATE_NAMES = {
  AL: 'Alabama', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'Washington DC', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', NE: 'Nebraska', NV: 'Nevada',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', SC: 'South Carolina', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

// phrases per chip, on top of the chip's own label
const SYN = {
  home: ['home', 'home games', 'at home'],
  road: ['road', 'road games', 'on the road', 'away games', 'true road'],
  neutral: ['neutral', 'neutral site', 'neutral site games'],
  away: ['not at home', 'away from home'],
  ranked: ['vs ranked', 'against ranked', 'over ranked', 'ranked opponents', 'ranked opponent', 'ranked teams', 'ranked team', 'top 25', 'top 25 teams'],
  top10: ['top 10', 'top ten', 'top 10 teams'],
  top5: ['top 5', 'top five', 'top 5 teams'],
  unranked: ['vs unranked', 'against unranked', 'unranked opponents', 'unranked teams', 'unranked team'],
  whileranked: ['while ranked', 'when ranked', 'theyre ranked', 'they are ranked', 'when theyre ranked', 'as a ranked team', 'ranked themselves'],
  whileunranked: ['while unranked', 'when unranked', 'theyre unranked', 'they are unranked', 'when theyre unranked'],
  fav: ['favorite', 'favorites', 'favored', 'as favorite', 'as favorites', 'as the favorite'],
  dog: ['underdog', 'underdogs', 'as underdog', 'as an underdog', 'as a dog'],
  dog7: ['7 point dog', 'touchdown underdog', 'touchdown dog', '7 point underdog'],
  dog14: ['14 point dog', '14 point underdog', 'two touchdown underdog', 'two touchdown dog'],
  close: ['close spread', 'pick em', 'close line'],
  confgame: ['conference', 'conference games', 'conference game', 'in conference', 'league games'],
  nonconf: ['non conference', 'nonconference', 'non con', 'ooc', 'out of conference'],
  rivalry: ['rivalry', 'rivalry games', 'rivals'],
  instate: ['in state opponent', 'in state opponents', 'in state rivals', 'in state teams'],
  curcoach: ['current coach', 'current head coach', 'under the current coach'],
  newcoach: ['first year coach', 'new coach', 'coachs first season'],
  vsnewcoach: ['vs a first year coach', 'against a new coach', 'vs a new coach'],
  opener: ['opener', 'openers', 'season opener', 'season openers', 'week 1', 'opening day'],
  finale: ['finale', 'finales', 'season finale', 'regular season finale', 'last regular season game'],
  postseason: ['bowl', 'bowls', 'bowl games', 'bowl game', 'postseason', 'playoff', 'playoffs', 'bowls and playoff'],
  afterloss: ['after a loss', 'after losses', 'coming off a loss', 'off a loss', 'bounce back'],
  afterwin: ['after a win', 'coming off a win', 'off a win'],
  afterbye: ['after a bye', 'off a bye', 'coming off a bye', 'after a bye week'],
  leadhalf: ['leading at half', 'leading at halftime', 'up at half', 'up at halftime', 'ahead at half', 'ahead at halftime'],
  trailhalf: ['trailing at half', 'trailing at halftime', 'down at half', 'down at halftime', 'behind at half', 'behind at halftime'],
  wonpos: ['won the clock', 'won time of possession', 'won possession'],
  dompos: ['dominated the clock', 'dominated possession'],
  onescore: ['one score', 'one score games', 'one score game', 'close games', 'close game'],
  shootout: ['shootout', 'shootouts'],
  struggle: ['defensive struggle', 'defensive struggles', 'low scoring'],
  night: ['night', 'night game', 'night games', 'under the lights', 'primetime'],
  ot: ['ot', 'overtime', 'overtime games', 'in overtime', 'in ot', 'ot games', 'extra time', 'extra periods'],
};

// common names the official names miss; p < 1 so Jev can overrule them
const ALIAS = {
  alabama: ['bama', 'crimson tide', 'tide'], auburn: ['war eagle'], georgia: ['uga', 'dawgs'],
  tennessee: ['vols', 'volunteers'], 'florida-state': ['fsu', 'noles', 'seminoles'], florida: ['gators'],
  'miami-fl': ['miami', 'the u', 'canes', 'hurricanes'], 'ohio-state': ['buckeyes', 'tosu'],
  michigan: ['wolverines', 'um'], 'michigan-state': ['msu', 'spartans'], 'notre-dame': ['nd', 'irish', 'fighting irish'],
  texas: ['longhorns', 'horns', 'ut'], 'texas-am': ['texas a m', 'tamu', 'aggies'], oklahoma: ['sooners', 'ou'],
  'oklahoma-state': ['okie state', 'pokes'], nebraska: ['huskers', 'cornhuskers'], 'penn-state': ['psu', 'nittany lions'],
  'ole-miss': ['rebels', 'mississippi'], 'mississippi-state': ['miss state'], 'virginia-tech': ['hokies', 'vt'],
  'georgia-tech': ['gt', 'yellow jackets'], 'south-carolina': ['gamecocks'], arkansas: ['razorbacks', 'hogs'],
  wisconsin: ['badgers'], iowa: ['hawkeyes'], oregon: ['ducks'], washington: ['uw'], 'west-virginia': ['wvu', 'mountaineers'],
  pittsburgh: ['pitt'], 'north-carolina': ['unc', 'tar heels'], 'nc-state': ['wolfpack'], 'boston-college': ['bc'],
  'texas-tech': ['red raiders'], vanderbilt: ['vandy'], 'southern-miss': ['usm'], army: ['black knights'], navy: ['midshipmen'],
};

const norm = (s) => s.toLowerCase()
  .replace(/['’]s\b/g, '')
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const DIR_WORDS = {
  W: ['win', 'wins', 'winning', 'won', 'beat', 'beating', 'beats', 'unbeaten', 'undefeated', 'win streak', 'winning streak'],
  L: ['lose', 'loses', 'losing', 'loss', 'losses', 'lost', 'lost to', 'winless', 'skid', 'losing streak'],
};

const STOP = new Set(['a', 'an', 'the', 'games', 'game', 'vs', 'versus', 'v', 'against', 'in', 'and', 'or', 'streak', 'streaks',
  'when', 'while', 'over', 'at', 'on', 'of', 'to', 'their', 'they', 'theyre', 'with', 'for', 'by', 'is', 'are', 'teams',
  'team', 'longest', 'active', 'current', 'most', 'straight', 'consecutive', 'who', 'has', 'have', 'show', 'me', 'all']);

// normalized phrase -> [hit]; hit = { key, param?, p } or { dir }
const lex = new Map();
const add = (phrase, hit) => {
  const k = norm(phrase);
  if (!k) return;
  if (!lex.has(k)) lex.set(k, []);
  if (!lex.get(k).some((h) => h.key === hit.key && h.param === hit.param && h.dir === hit.dir)) lex.get(k).push(hit);
};
for (const c of CHIPS) if (!c.param) add(c.label, { key: c.key, p: 1 });
for (const [key, list] of Object.entries(SYN)) for (const s of list) add(s, { key, p: 1 });
for (const { t, i } of oppTeams) add(t.name, { key: 'vsteam', param: i, p: 1 });
for (const [id, list] of Object.entries(ALIAS)) {
  const i = teams.findIndex((t) => t.id === id);
  if (i >= 0) for (const s of list) add(s, { key: 'vsteam', param: i, p: 0.85 });
}
for (const o of CONF_OPTIONS) add(o, { key: 'vsconf', param: o, p: 1 });
add('big 10', { key: 'vsconf', param: 'Big Ten', p: 1 });
add('pac 10', { key: 'vsconf', param: 'Pac-12', p: 0.9 });
add('aac', { key: 'vsconf', param: 'American', p: 1 });
add('mwc', { key: 'vsconf', param: 'Mountain West', p: 1 });
add('conference usa', { key: 'vsconf', param: 'C-USA', p: 1 });
for (const [n, name] of MONTHS) {
  add(name, { key: 'month', param: n, p: 1 });
  add(name.slice(0, 3), { key: 'month', param: n, p: 0.9 });
}
for (const [d, list] of Object.entries(DIR_WORDS)) for (const s of list) add(s, { dir: d });
// bare "ranked" and "unranked": probably the opponent, but ask Jev
add('ranked', { key: 'ranked', p: 0.6 });
add('unranked', { key: 'unranked', p: 0.6 });

// state names only count as a location right after "in" ("in Texas");
// otherwise the same word is the team
const stateLex = new Map();
for (const s of STATE_OPTIONS) if (STATE_NAMES[s]) stateLex.set(norm(STATE_NAMES[s]), s);

const lexByLen = [[], [], [], [], [], []];
for (const k of lex.keys()) {
  const n = k.split(' ').length;
  if (n <= 5) lexByLen[n].push(k);
}

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
const tolerance = (len) => (len >= 9 ? 2 : len >= 5 ? 1 : 0);

function fuzzy(words) {
  const k = words.join(' ');
  const tol = tolerance(k.length);
  if (!tol || words.every((w) => STOP.has(w))) return null;
  let best = null;
  for (const cand of lexByLen[words.length]) {
    if (lex.get(cand).some((h) => h.dir)) continue; // no typo-matching into win/loss words
    const d = editDistance(k, cand, tol);
    if (d <= tol && (!best || d < best.d)) best = { cand, d };
  }
  return best && { k: best.cand, hits: lex.get(best.cand), fuzzy: true };
}

export function parseLocal(text) {
  const w = norm(text).split(' ').filter(Boolean);
  const chips = [];
  const unmatched = [];
  let dir = null;
  for (let i = 0; i < w.length;) {
    // "in <state>"
    if (w[i] === 'in' && i + 1 < w.length) {
      const two = w.slice(i + 1, i + 3).join(' ');
      const st = stateLex.get(two) ?? stateLex.get(w[i + 1]);
      if (st) {
        chips.push({ key: 'state', param: st, p: 0.9, pos: i });
        i += 1 + (stateLex.has(two) ? 2 : 1);
        continue;
      }
    }
    let got = null;
    for (let n = Math.min(5, w.length - i); n > 0 && !got; n--) {
      const k = w.slice(i, i + n).join(' ');
      if (lex.has(k)) got = { n, k, hits: lex.get(k) };
    }
    for (let n = Math.min(3, w.length - i); n > 0 && !got; n--) {
      const f = fuzzy(w.slice(i, i + n));
      if (f) got = { n, ...f };
    }
    if (!got) {
      // a typo'd filler word ("gams") isn't worth reporting
      const filler = STOP.has(w[i]) || (w[i].length >= 4 && [...STOP].some((x) => x.length >= 4 && editDistance(w[i], x, 1) <= 1));
      if (!filler) unmatched.push(w[i]);
      i++;
      continue;
    }
    // a phrase can mean more than one thing ("mississippi"); take the first
    const h = got.hits[0];
    if (h.dir) dir = h.dir;
    else {
      const chip = { key: h.key, p: got.fuzzy ? Math.min(h.p, 0.8) : h.p, pos: i };
      if (h.param != null) chip.param = h.param;
      if (chipByKey.get(h.key).param === 'hmargin') {
        // "leading at half by 7" -> the largest margin option at or under 7
        const by = w[i + got.n] === 'by' ? Number(w[i + got.n + 1]) : NaN;
        chip.param = Number.isFinite(by) ? Math.max(...HMARGINS.map(([m]) => m).filter((m) => m <= by), 1) : 1;
        if (Number.isFinite(by)) got.n += 2;
      }
      chips.push(chip);
    }
    i += got.n;
  }
  return { chips, dir, unmatched, src: 'local' };
}

// ---------------------------------------------------------------------------

/**
 * Candidates -> a legal definition: the most confident chip wins each key and
 * each exclusive group, capped at four, kept in the order they were typed.
 */
export function resolve(cands) {
  const kept = [];
  for (const c of [...cands].sort((a, b) => b.p - a.p)) {
    const chip = chipByKey.get(c.key);
    if (kept.some((k) => k.key === c.key)) continue;
    if (chip.x && kept.some((k) => chipByKey.get(k.key).x && chipByKey.get(k.key).group === chip.group)) continue;
    if (kept.length >= 4) break;
    kept.push(c);
  }
  return kept.sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99));
}

/** Local exact hits stand; Jev fills in and overrules the guesses. */
export function merge(local, remote) {
  if (!remote) return { chips: resolve(local.chips), dir: local.dir, src: 'local', unmatched: local.unmatched };
  const sure = local.chips.filter((c) => c.p >= 1);
  return { chips: resolve([...sure, ...remote.chips]), dir: remote.dir ?? local.dir, src: 'jev', unmatched: [] };
}

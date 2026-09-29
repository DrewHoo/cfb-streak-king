// Mine "streaks this team is king of": every ≤4-chip subset of the
// parameterless catalog (x-exclusivity honored) × both directions, evaluated
// over packed per-chip bitmasks. The whole space is ~30k definitions and mines
// in well under a second, so this runs lazily in the client.
//
// Two scopes. 'active': the definition-direction whose sole longest active
// streak belongs to this team. 'all': the sole longest run anywhere in the
// window, ended or not. Definitions that produce the identical streak (same
// last game, same length) collapse to one crown named by the fewest-chip
// definition; `also` counts the collapsed labels. Floors: length ≥ 4 and a
// field of ≥ 10 teams holding any streak under the definition.

import { CHIPS, teams, fbsNow, gamesOf } from './model.js';

export const LEN_FLOOR = 4;
export const FIELD_FLOOR = 10;

const NP = CHIPS.filter((c) => !c.param);

// how many definitions mine() walks (the empty one included), for the page copy
export const NP_COUNT = NP.length;
export const DEF_COUNT = (function count(start, chosen) {
  let n = 1;
  if (chosen.length === 4) return n;
  for (let i = start; i < NP.length; i++) {
    const c = NP[i];
    if (c.x && chosen.some((j) => NP[j].x && NP[j].group === c.group)) continue;
    n += count(i + 1, [...chosen, i]);
  }
  return n;
})(0, []);

const caches = { active: null, all: null };
const mining = { active: null, all: null };

function buildData() {
  return [...fbsNow].map((ti) => {
    const gs = gamesOf(ti);
    const ownState = teams[ti].st;
    const n = gs.length;
    const words = Math.ceil(n / 32) || 1;
    const masks = NP.map((c) => {
      const m = new Uint32Array(words);
      for (let i = 0; i < n; i++) if (c.test(gs[i], undefined, ownState)) m[i >> 5] |= 1 << (i & 31);
      return m;
    });
    return { ti, gs, n, words, masks, r: gs.map((x) => x.r) };
  });
}

// the trailing streak of the masked sequence: { W: s, L: s } with one side set
function walkActive(td, q) {
  let dir = null;
  let len = 0;
  let startIdx = -1;
  let lastIdx = -1;
  for (let w = td.words - 1; w >= 0; w--) {
    if (!q[w]) continue;
    for (let b = 31; b >= 0; b--) {
      if (!(q[w] & (1 << b))) continue;
      const i = (w << 5) | b;
      if (i >= td.n) continue;
      const r = td.r[i];
      if (dir === null) { dir = r; len = 1; lastIdx = i; startIdx = i; }
      else if (r === dir) { len++; startIdx = i; }
      else return { [dir]: { len, atEdge: false, lastIdx, startIdx } };
    }
  }
  return dir === null ? {} : { [dir]: { len, atEdge: true, lastIdx, startIdx } };
}

// the longest run of each direction anywhere in the masked sequence
function walkLongest(td, q) {
  const best = {};
  let dir = null;
  let len = 0;
  let startIdx = -1;
  const close = (lastIdx) => {
    if (dir === null || dir === 'T') return;
    const b = best[dir];
    if (!b || len > b.len) best[dir] = { len, atEdge: startIdx === 0 && q[0] & 1 && td.r[0] === dir && startIdx === firstIdx, lastIdx, startIdx };
  };
  let firstIdx = -1;
  let prev = -1;
  for (let w = 0; w < td.words; w++) {
    if (!q[w]) continue;
    for (let b = 0; b < 32; b++) {
      if (!(q[w] & (1 << b))) continue;
      const i = (w << 5) | b;
      if (i >= td.n) continue;
      if (firstIdx < 0) firstIdx = i;
      const r = td.r[i];
      if (r === dir) { len++; }
      else { close(prev); dir = r; len = 1; startIdx = i; }
      prev = i;
    }
  }
  close(prev);
  // a run that starts at the first qualifying game may run past the window
  for (const d of Object.keys(best)) best[d].atEdge = best[d].startIdx === firstIdx;
  return best;
}

async function mine(scope) {
  const data = buildData();
  const T = data.map((d) => d.ti);
  const walk = scope === 'all' ? walkLongest : walkActive;

  const subsets = [];
  (function rec(start, chosen) {
    subsets.push(chosen);
    if (chosen.length === 4) return;
    for (let i = start; i < NP.length; i++) {
      const c = NP[i];
      if (c.x && chosen.some((j) => NP[j].x && NP[j].group === c.group)) continue;
      rec(i + 1, [...chosen, i]);
    }
  })(0, []);

  const perTeam = new Map(T.map((ti) => [ti, new Map()])); // dedupe key -> crown
  const q = data.map((td) => new Uint32Array(td.words));
  const res = new Array(T.length);
  let done = 0;
  for (const def of subsets) {
    // yield to the main thread so the tab stays responsive while mining
    if (++done % 1500 === 0) await new Promise((r) => setTimeout(r, 0));
    for (let t = 0; t < T.length; t++) {
      const td = data[t];
      const qb = q[t];
      if (def.length === 0) qb.fill(0xffffffff);
      else {
        qb.set(td.masks[def[0]]);
        for (let d = 1; d < def.length; d++) {
          const md = td.masks[def[d]];
          for (let w = 0; w < td.words; w++) qb[w] &= md[w];
        }
      }
      res[t] = walk(td, qb);
    }
    for (const dir of ['W', 'L']) {
      let best = 0;
      let leader = -1;
      let leaders = 0;
      let field = 0;
      for (let t = 0; t < T.length; t++) {
        const s = res[t][dir];
        if (!s || s.len === 0) continue;
        field++;
        if (s.len > best) { best = s.len; leader = t; leaders = 1; }
        else if (s.len === best) leaders++;
      }
      if (leaders !== 1 || leader < 0) continue;
      const s = res[leader][dir];
      if (s.len < LEN_FLOOR || field < FIELD_FLOOR) continue;
      const key = dir + '|' + s.lastIdx + '|' + s.len;
      const held = perTeam.get(T[leader]);
      const prev = held.get(key);
      if (!prev) {
        const gs = data[leader].gs;
        held.set(key, {
          chips: def.map((i) => NP[i].key),
          dir, scope, len: s.len, atEdge: s.atEdge, field,
          startSe: gs[s.startIdx]?.se,
          endSe: gs[s.lastIdx]?.se,
          live: s.lastIdx === data[leader].n - 1,
          also: 0,
        });
      } else {
        prev.also++;
        if (def.length < prev.chips.length || (def.length === prev.chips.length && field > prev.field)) {
          prev.chips = def.map((i) => NP[i].key);
          prev.field = Math.max(prev.field, field);
          // same last game and length doesn't mean the same first game
          const gs = data[leader].gs;
          prev.startSe = gs[s.startIdx]?.se;
          prev.endSe = gs[s.lastIdx]?.se;
          prev.atEdge = s.atEdge;
        }
      }
    }
  }

  const cache = new Map();
  for (const [ti, held] of perTeam) {
    const list = [...held.values()];
    // simplest claim first: skip-gap streaks lengthen as chips stack, so
    // sorting by length rewards chip-stuffed definitions over clean ones
    list.sort((a, b) => a.chips.length - b.chips.length || b.len - a.len || b.field - a.field);
    cache.set(ti, list);
  }
  caches[scope] = cache;
  return cache;
}

export function mineAll(scope = 'active') {
  if (caches[scope]) return Promise.resolve(caches[scope]);
  mining[scope] ??= mine(scope);
  return mining[scope];
}

export const isMined = (scope = 'active') => !!caches[scope];

export function crownsFor(ti, scope = 'active') {
  return caches[scope]?.get(ti) ?? [];
}

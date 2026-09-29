// Mine "streaks this team is king of": every ≤4-chip subset of the
// parameterless catalog (exclusivity honored) × the three outcomes, evaluated
// over packed per-chip bitmasks. The whole space is 44,799 definitions (the
// empty one included) and mines in a second or two, lazily in the client.
//
// Two scopes. 'active': the definition-direction whose sole longest active
// streak belongs to this team. 'all': the sole longest run anywhere in the
// window, ended or not. Definitions that produce the identical streak (same
// last game, same length) collapse to one crown named by the fewest-chip
// definition; `also` counts the collapsed labels. Floors: length ≥ 4 and a
// field of ≥ 10 teams holding any streak under the definition.

import type { Crown, Dir, GameRow, Result, Scope } from './types.ts';
import { CHIPS, conflicts, qualifies } from './chips.ts';
import { fbsNow, gamesOf } from './model.ts';
import { OUTCOMES } from './streaks.ts';

interface TeamData { ti: number; gs: GameRow[]; n: number; words: number; masks: Uint32Array[]; r: Result[] }
interface Run { len: number; atEdge: boolean; lastIdx: number; startIdx: number }
type Runs = Partial<Record<Dir, Run>>;

export const LEN_FLOOR = 4;
export const FIELD_FLOOR = 10;

const NP = CHIPS.filter((c) => !c.param);

// how many definitions mine() walks (the empty one included), for the page copy
export const NP_COUNT = NP.length;
export const DEF_COUNT = (function count(start: number, chosen: number[]): number {
  let n = 1;
  if (chosen.length === 4) return n;
  for (let i = start; i < NP.length; i++) {
    const c = NP[i];
    if (chosen.some((j) => conflicts(NP[j], c))) continue;
    n += count(i + 1, [...chosen, i]);
  }
  return n;
})(0, []);

const caches: Record<Scope, Map<number, Crown[]> | null> = { active: null, all: null };
const mining: Record<Scope, Promise<Map<number, Crown[]>> | null> = { active: null, all: null };

function buildData(): TeamData[] {
  return [...fbsNow].map((ti) => {
    const gs = gamesOf(ti);
    const n = gs.length;
    const words = Math.ceil(n / 32) || 1;
    const masks = NP.map((c) => {
      const m = new Uint32Array(words);
      for (let i = 0; i < n; i++) if (qualifies(c, gs[i])) m[i >> 5] |= 1 << (i & 31);
      return m;
    });
    return { ti, gs, n, words, masks, r: gs.map((x) => x.r) };
  });
}

// The trailing runs of the masked sequence: the run of the latest result
// (W or L) and the unbeaten run, each set when it has at least one game.
function walkActive(td: TeamData, q: Uint32Array): Runs {
  let r0: Result | null = null;
  let lastIdx = -1;
  let same = 0, sameStart = -1, sameOpen = true;
  let unb = 0, unbStart = -1, unbOpen = true;
  scan: for (let w = td.words - 1; w >= 0; w--) {
    if (!q[w]) continue;
    for (let b = 31; b >= 0; b--) {
      if (!(q[w] & (1 << b))) continue;
      const i = (w << 5) | b;
      if (i >= td.n) continue;
      const r = td.r[i];
      if (r0 === null) { r0 = r; lastIdx = i; sameOpen = r !== 'T'; }
      if (sameOpen) { if (r === r0) { same++; sameStart = i; } else sameOpen = false; }
      if (unbOpen) { if (r !== 'L') { unb++; unbStart = i; } else unbOpen = false; }
      if (!sameOpen && !unbOpen) break scan;
    }
  }
  const out: Runs = {};
  // a run still open after the scan reached the first qualifying game
  if (r0 && r0 !== 'T' && same) out[r0] = { len: same, atEdge: sameOpen, lastIdx, startIdx: sameStart };
  if (unb) out.U = { len: unb, atEdge: unbOpen, lastIdx, startIdx: unbStart };
  return out;
}

// the longest run of each outcome anywhere in the masked sequence; the
// earliest wins a tie
function walkLongest(td: TeamData, q: Uint32Array): Runs {
  const best: Runs = {};
  const keep = (o: Dir, len: number, startIdx: number, lastIdx: number) => {
    const b = best[o];
    if (len && (!b || len > b.len)) best[o] = { len, atEdge: false, lastIdx, startIdx };
  };
  let dir: Result | null = null;
  let len = 0, startIdx = -1;
  let unb = 0, unbStart = -1;
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
      if (r === dir) len++;
      else {
        if (dir === 'W' || dir === 'L') keep(dir, len, startIdx, prev);
        dir = r; len = 1; startIdx = i;
      }
      if (r !== 'L') { if (!unb) unbStart = i; unb++; }
      else { keep('U', unb, unbStart, prev); unb = 0; }
      prev = i;
    }
  }
  if (dir === 'W' || dir === 'L') keep(dir, len, startIdx, prev);
  keep('U', unb, unbStart, prev);
  // a run that starts at the first qualifying game may run past the window
  for (const run of Object.values(best)) run.atEdge = run.startIdx === firstIdx;
  return best;
}

async function mine(scope: Scope): Promise<Map<number, Crown[]>> {
  const data = buildData();
  const T = data.map((d) => d.ti);
  const walk = scope === 'all' ? walkLongest : walkActive;

  const subsets: number[][] = [];
  (function rec(start: number, chosen: number[]) {
    subsets.push(chosen);
    if (chosen.length === 4) return;
    for (let i = start; i < NP.length; i++) {
      const c = NP[i];
      if (chosen.some((j) => conflicts(NP[j], c))) continue;
      rec(i + 1, [...chosen, i]);
    }
  })(0, []);

  const perTeam = new Map(T.map((ti) => [ti, new Map<string, Crown>()])); // dedupe key -> crown
  const q = data.map((td) => new Uint32Array(td.words));
  const res: Runs[] = new Array(T.length);
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
    for (const dir of OUTCOMES) {
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
      const s = res[leader][dir]!;
      if (s.len < LEN_FLOOR || field < FIELD_FLOOR) continue;
      const key = dir + '|' + s.lastIdx + '|' + s.len;
      const held = perTeam.get(T[leader])!;
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

  const cache = new Map<number, Crown[]>();
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

export function mineCrowns(scope: Scope = 'active'): Promise<Map<number, Crown[]>> {
  const done = caches[scope];
  if (done) return Promise.resolve(done);
  return (mining[scope] ??= mine(scope));
}

export const isMined = (scope: Scope = 'active') => !!caches[scope];

export function crownsFor(ti: number, scope: Scope = 'active'): Crown[] {
  return caches[scope]?.get(ti) ?? [];
}

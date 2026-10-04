// The king of a definition: the team (or teams, on a tie) holding its
// longest streak, over the crowns miner's per-chip bitmasks. The + menu shows
// one per constraint, and a constraint's own menu one per choice, for the
// definition picking it would make.

import type { ChipRef, Dir, GameRow, Scope } from './types.ts';
import { PLAIN_CHIPS, chipByKey, fitsDir, qualifies } from './chips.ts';
import type { Param, ParamKind } from './chips.ts';
import { PARAMS, swapChip, swapTargets, withChip, withParam } from './definition.ts';
import { teamData, walkActive, walkLongest, spreadWalk } from './crowns.ts';
import type { Run, TeamData } from './crowns.ts';

export interface King {
  tis: number[];
  len: number;
  /** The run reaches the first qualifying game, so it may be longer. */
  atEdge: boolean;
  /** No later qualifying game has broken it. */
  live: boolean;
  startEp: number;
  endEp: number;
  /** An active king whose run is also the all-time record. */
  record: boolean;
}

const plainIdx = new Map(PLAIN_CHIPS.map((c, i) => [c.key, i]));
// the game field a choice must equal, for the chips whose test is just that:
// one pass over a team's games then builds the mask of every choice at once
const FIELD: Partial<Record<ParamKind, (g: GameRow) => Param | null>> = {
  state: (g) => g.vst, conf: (g) => g.oppConf, team: (g) => g.oppIdx, month: (g) => g.month,
  // a mascot has several kinds per game, so it takes the generic pass below
  color: (g) => (g.oppColor >= 0 ? g.oppColor : null),
};
// a parameterized chip's masks, per team, built on first use
const paramMasks = new WeakMap<TeamData, Map<string, Uint32Array>>();

function maskOf(td: TeamData, a: ChipRef): Uint32Array {
  const i = plainIdx.get(a.key);
  if (i != null) return td.masks[i];
  let byKey = paramMasks.get(td);
  if (!byKey) paramMasks.set(td, (byKey = new Map()));
  const k = a.key + ':' + a.param;
  const hit = byKey.get(k);
  if (hit) return hit;
  const c = chipByKey.get(a.key)!;
  const field = c.param && FIELD[c.param];
  if (field) {
    if (!byKey.has(a.key)) {
      byKey.set(a.key, new Uint32Array(td.words)); // this chip's bucket pass is done; also the empty mask
      for (let g = 0; g < td.n; g++) {
        const v = field(td.gs[g]);
        if (v == null) continue;
        const kv = a.key + ':' + v;
        let m = byKey.get(kv);
        if (!m) byKey.set(kv, (m = new Uint32Array(td.words)));
        m[g >> 5] |= 1 << (g & 31);
      }
    }
    return byKey.get(k) ?? byKey.get(a.key)!;
  }
  const m = new Uint32Array(td.words);
  for (let g = 0; g < td.n; g++) if (qualifies(c, td.gs[g], a.param)) m[g >> 5] |= 1 << (g & 31);
  byKey.set(k, m);
  return m;
}

function runOf(td: TeamData, q: Uint32Array, dir: Dir, scope: Scope): Run | undefined {
  if (dir === 'C' || dir === 'N') return spreadWalk(td, q, dir === 'C' ? td.covered : td.missed, scope) ?? undefined;
  return (scope === 'all' ? walkLongest : walkActive)(td, q)[dir];
}

function best(active: ChipRef[], dir: Dir, scope: Scope) {
  const data = teamData();
  let len = 0;
  let tis: number[] = [];
  let at: { td: TeamData; run: Run } | null = null;
  for (const td of data) {
    const q = new Uint32Array(td.words);
    q.fill(0xffffffff);
    for (const a of active) {
      const m = maskOf(td, a);
      for (let w = 0; w < td.words; w++) q[w] &= m[w];
    }
    const run = runOf(td, q, dir, scope);
    if (!run?.len) continue;
    if (run.len > len) { len = run.len; tis = [td.ti]; at = { td, run }; }
    else if (run.len === len) tis.push(td.ti);
  }
  return { len, tis, at };
}

/** The king of one definition, or null when no team holds a streak under it. */
export function kingOf(active: ChipRef[], dir: Dir, scope: Scope): King | null {
  const { len, tis, at } = best(active, dir, scope);
  if (!at) return null;
  const record = scope === 'active' && best(active, dir, 'all').len <= len;
  return {
    tis, len, atEdge: at.run.atEdge, live: at.run.live,
    startEp: at.td.gs[at.run.startIdx].ep, endEp: at.td.gs[at.run.lastIdx].ep, record,
  };
}

/**
 * The current king and, for each parameterless constraint the + menu offers,
 * the king of the definition adding it would make (a swap, for an exclusive
 * group-mate). A parameterized one has no single definition to crown.
 */
export function addKings(active: ChipRef[], dir: Dir, scope: Scope) {
  const cur = kingOf(active, dir, scope);
  const byKey = new Map<string, King | null>();
  for (const c of PLAIN_CHIPS) {
    if (active.some((a) => a.key === c.key) || !fitsDir(c, dir)) continue;
    const next = withChip(active, c.key);
    if (next === active) continue;
    byKey.set(c.key, kingOf(next, dir, scope));
  }
  return { cur, byKey };
}

/**
 * For a constraint already in the definition: the king of each of its choices
 * (every state, conference, team, month or margin) and of every
 * parameterless chip it could be changed to.
 */
export function chipKings(active: ChipRef[], key: string, dir: Dir, scope: Scope) {
  const c = chipByKey.get(key)!;
  const cur = kingOf(active, dir, scope);
  const params = new Map<Param, King | null>();
  if (c.param) for (const [v] of PARAMS[c.param].options(c)) params.set(v, kingOf(withParam(active, key, v), dir, scope));
  const swaps = new Map<string, King | null>();
  for (const s of swapTargets(active, key, dir)) if (!s.param) swaps.set(s.key, kingOf(swapChip(active, key, s.key), dir, scope));
  return { cur, params, swaps };
}

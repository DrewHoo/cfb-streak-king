// The view's state and every way it changes. Pure, so the rules are testable:
// a new definition, scope or direction starts the board at its first columns
// again; all-time mode has no "this week" filter; presets are written for
// active streaks, so applying one leaves all-time mode. A chip that can't
// define the direction's streaks (one-score vs the spread) drops, whatever
// brought the pair in: an old URL, a saved streak.

import type { BoardRow, ChipRef, Crown, Dir, Scope } from './types.ts';
import type { View } from './url.ts';
import { DEFAULT_VIEW } from './url.ts';
import { chipByKey, fitsDir } from './chips.ts';

/** Columns shown before "more" on desktop. */
export const DESKTOP_CAP = 20;

export interface ViewState extends View {
  /** Columns shown before "more". */
  limit: number;
}

export type ViewAction =
  | { type: 'load'; view: View }
  | { type: 'define'; active: ChipRef[]; dir?: Dir }
  | { type: 'scope'; scope: Scope }
  | { type: 'dir'; dir: Dir }
  | { type: 'week'; on: boolean }
  | { type: 'preset'; active: ChipRef[]; dir: Dir; scope?: Scope }
  | { type: 'crown'; crown: Crown }
  | { type: 'pick'; row: BoardRow }
  | { type: 'close' }
  | { type: 'limit'; limit: number | ((l: number) => number) };

export const initialView = (team: number | null = null): ViewState => ({ ...DEFAULT_VIEW, team, limit: DESKTOP_CAP });

/** Whether a board row is the one already open. */
export const isOpen = (v: View, row: BoardRow) => v.team === row.ti && (v.scope !== 'all' || v.run === row.s.start?.ep);

const fit = (v: ViewState): ViewState => {
  const active = v.active.filter((c) => { const chip = chipByKey.get(c.key); return !chip || fitsDir(chip, v.dir); });
  return active.length === v.active.length ? v : { ...v, active };
};

export function viewReducer(v: ViewState, a: ViewAction): ViewState {
  return fit(reduce(v, a));
}

function reduce(v: ViewState, a: ViewAction): ViewState {
  switch (a.type) {
    case 'load':
      return { ...v, ...a.view };
    case 'define':
      return { ...v, active: a.active, dir: a.dir ?? v.dir, limit: DESKTOP_CAP };
    case 'scope':
      return { ...v, scope: a.scope, limit: DESKTOP_CAP, week: a.scope === 'all' ? false : v.week };
    case 'dir':
      return { ...v, dir: a.dir, limit: DESKTOP_CAP };
    case 'week':
      return { ...v, week: a.on };
    case 'preset':
      return { ...v, active: a.active, dir: a.dir, scope: a.scope ?? 'active', run: null, limit: DESKTOP_CAP };
    case 'crown':
      return { ...v, active: a.crown.chips.map((key) => ({ key })), dir: a.crown.dir, scope: a.crown.scope, run: null, limit: DESKTOP_CAP };
    case 'pick': {
      // picking the open row closes it; in all-time mode a team has one row per run
      if (isOpen(v, a.row)) return { ...v, team: null, run: null };
      return { ...v, team: a.row.ti, run: v.scope === 'all' ? a.row.s.start?.ep ?? null : null };
    }
    case 'close':
      return { ...v, team: null, run: null };
    case 'limit':
      return { ...v, limit: typeof a.limit === 'function' ? a.limit(v.limit) : a.limit };
  }
}

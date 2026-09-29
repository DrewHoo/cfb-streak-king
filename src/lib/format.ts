import type { Streak } from './types.ts';

// Small formatters shared by the grid, the ledger and the sentence line.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DIR_WORDS: Record<string, string> = { W: 'winning', L: 'losing', U: 'undefeated', C: 'covering' };
export const dirWord = (dir: string) => DIR_WORDS[dir] ?? 'winning';

// the Sports-Reference site grammar: @ road, N neutral, blank home
interface Site { neutral: boolean; home: boolean }
export const siteWord = (x: Site) => (x.neutral ? 'vs' : x.home ? 'vs' : 'at');
export const siteMark = (x: Site) => (x.neutral ? 'N' : x.home ? '' : '@');

export const yearOf = (ep: number) => new Date(ep * 86400000).getUTCFullYear();
export const yy = (ep: number) => `’${String(yearOf(ep)).slice(2)}`;
export const yyOfYear = (y: number) => `’${String(y).slice(2)}`;
export const shortDate = (ep: number) => {
  const d = new Date(ep * 86400000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}`;
};
export const dayOf = (ep: number) => DAYS[new Date(ep * 86400000).getUTCDay()];
export const monthDay = (ep: number) => { const d = new Date(ep * 86400000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
export const kickOf = (u: { hh: number }) => (u.hh !== 31 ? `${u.hh % 12 || 12}${u.hh >= 12 ? 'pm' : 'am'}` : '');
/** Our line, as a bettor reads it: -7 favored by 7, +3.5 getting 3.5, PK even. */
export const spreadText = (sp: number) => (sp === 0 ? 'PK' : sp > 0 ? `+${sp}` : `${sp}`);
export const count = (s: Pick<Streak, 'len' | 'atEdge'>) => `${s.len}${s.atEdge ? '+' : ''}`;

// state names for the "in [state]" chip: the payload carries postal codes
export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'Washington, DC',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
export const stateName = (code: string) => STATE_NAMES[code] ?? code;

// a grid row's identity: the team, plus the run's start in all-time mode
export const rowKey = (row: { key?: string; ti: number }) => row.key ?? String(row.ti);

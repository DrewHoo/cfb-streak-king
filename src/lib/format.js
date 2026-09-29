// Small formatters shared by the grid, the ledger and the sentence line.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const dirWord = (dir) => (dir === 'W' ? 'winning' : 'losing');

// the Sports-Reference site grammar: @ road, N neutral, blank home
export const siteWord = (x) => (x.neutral ? 'vs' : x.home ? 'vs' : 'at');
export const siteMark = (x) => (x.neutral ? 'N' : x.home ? '' : '@');

export const yearOf = (ep) => new Date(ep * 86400000).getUTCFullYear();
export const yy = (ep) => `’${String(yearOf(ep)).slice(2)}`;
export const yyOfYear = (y) => `’${String(y).slice(2)}`;
export const shortDate = (ep) => {
  const d = new Date(ep * 86400000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}`;
};
export const dayOf = (ep) => DAYS[new Date(ep * 86400000).getUTCDay()];
export const monthDay = (ep) => { const d = new Date(ep * 86400000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
export const kickOf = (u) => (u.hh !== 31 ? `${u.hh % 12 || 12}${u.hh >= 12 ? 'pm' : 'am'}` : '');
export const count = (s) => `${s.len}${s.atEdge ? '+' : ''}`;

// state names for the "in [state]" chip: the payload carries postal codes
export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'Washington, DC',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
export const stateName = (code) => STATE_NAMES[code] ?? code;

// a grid row's identity: the team, plus the run's start in all-time mode
export const rowKey = (row) => row.key ?? String(row.ti);

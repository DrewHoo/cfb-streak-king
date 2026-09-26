// Emit data/ref/team-info.json: { slug: { state, tz } } for the 2026 FBS set.
// tz is the campus IANA zone: derived from the state, with campus-level
// exceptions (UTEP is Mountain, Knoxville is Eastern, Bowling Green KY is
// Central, Arizona skips DST, etc.). Used for local kickoff time (night chip)
// and the in-state-opponent chip.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/util.mjs';

const S = {
  AL: ['alabama', 'auburn', 'uab', 'troy', 'south-alabama', 'jacksonville-state'],
  AR: ['arkansas', 'arkansas-state'],
  AZ: ['arizona', 'arizona-state'],
  CA: ['california', 'ucla', 'usc', 'stanford', 'san-diego-state', 'san-jose-state', 'fresno-state'],
  CO: ['colorado', 'colorado-state', 'air-force'],
  CT: ['uconn'],
  DE: ['delaware'],
  FL: ['florida', 'florida-state', 'miami-fl', 'ucf', 'south-florida', 'florida-atlantic', 'florida-international'],
  GA: ['georgia', 'georgia-tech', 'georgia-southern', 'georgia-state', 'kennesaw-state'],
  HI: ['hawaii'],
  IA: ['iowa', 'iowa-state'],
  ID: ['boise-state'],
  IL: ['illinois', 'northwestern', 'northern-illinois'],
  IN: ['indiana', 'purdue', 'notre-dame', 'ball-state'],
  KS: ['kansas', 'kansas-state'],
  KY: ['kentucky', 'louisville', 'western-kentucky'],
  LA: ['lsu', 'tulane', 'louisiana-tech', 'louisiana', 'louisiana-monroe'],
  MA: ['boston-college', 'umass'],
  MD: ['maryland', 'navy'],
  MI: ['michigan', 'michigan-state', 'central-michigan', 'eastern-michigan', 'western-michigan'],
  MN: ['minnesota'],
  MO: ['missouri', 'missouri-state'],
  MS: ['ole-miss', 'mississippi-state', 'southern-miss'],
  NC: ['north-carolina', 'nc-state', 'duke', 'wake-forest', 'east-carolina', 'charlotte', 'appalachian-state'],
  NE: ['nebraska'],
  NJ: ['rutgers'],
  NM: ['new-mexico', 'new-mexico-state'],
  NV: ['unlv', 'nevada'],
  NY: ['syracuse', 'buffalo', 'army'],
  OH: ['ohio-state', 'ohio', 'cincinnati', 'toledo', 'bowling-green', 'kent-state', 'akron', 'miami-oh'],
  OK: ['oklahoma', 'oklahoma-state', 'tulsa'],
  OR: ['oregon', 'oregon-state'],
  PA: ['penn-state', 'pittsburgh', 'temple'],
  RI: [],
  SC: ['south-carolina', 'clemson', 'coastal-carolina'],
  TN: ['tennessee', 'vanderbilt', 'memphis', 'middle-tennessee'],
  TX: ['texas', 'texas-am', 'texas-tech', 'tcu', 'smu', 'baylor', 'houston', 'rice', 'north-texas', 'utep', 'utsa', 'texas-state', 'sam-houston'],
  UT: ['utah', 'utah-state', 'byu'],
  VA: ['virginia', 'virginia-tech', 'old-dominion', 'james-madison', 'liberty'],
  WA: ['washington', 'washington-state'],
  WI: ['wisconsin'],
  WV: ['west-virginia', 'marshall'],
  WY: ['wyoming'],
};

const TZ_BY_STATE = {
  AL: 'America/Chicago', AR: 'America/Chicago', AZ: 'America/Phoenix',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York',
  DE: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York',
  HI: 'Pacific/Honolulu', IA: 'America/Chicago', ID: 'America/Boise',
  IL: 'America/Chicago', IN: 'America/New_York', KS: 'America/Chicago',
  KY: 'America/New_York', LA: 'America/Chicago', MA: 'America/New_York',
  MD: 'America/New_York', MI: 'America/New_York', MN: 'America/Chicago',
  MO: 'America/Chicago', MS: 'America/Chicago', NC: 'America/New_York',
  NE: 'America/Chicago', NJ: 'America/New_York', NM: 'America/Denver',
  NV: 'America/Los_Angeles', NY: 'America/New_York', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York',
  SC: 'America/New_York', TN: 'America/Chicago', TX: 'America/Chicago',
  UT: 'America/Denver', VA: 'America/New_York', WA: 'America/Los_Angeles',
  WI: 'America/Chicago', WV: 'America/New_York', WY: 'America/Denver',
};

// campus-level timezone exceptions
const TZ_EXCEPTIONS = {
  utep: 'America/Denver', // El Paso
  tennessee: 'America/New_York', // Knoxville
  'western-kentucky': 'America/Chicago', // Bowling Green KY
};

const info = {};
for (const [state, teams] of Object.entries(S)) {
  for (const t of teams) info[t] = { state, tz: TZ_EXCEPTIONS[t] ?? TZ_BY_STATE[state] };
}

// verify exact coverage of the 2026 FBS set
const spans = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'build', 'fbs-spans.json'), 'utf8'));
const fbs = Object.entries(spans)
  .filter(([, sp]) => sp.some(([a, b]) => a <= 2026 && b >= 2026))
  .map(([id]) => id);
const missing = fbs.filter((id) => !info[id]);
const extra = Object.keys(info).filter((id) => !fbs.includes(id));
if (missing.length) throw new Error('missing team-info for: ' + missing.join(', '));
if (extra.length) console.log('note: extra (non-2026-FBS) entries:', extra.join(', '));

fs.writeFileSync(
  path.join(ROOT, 'data', 'ref', 'team-info.json'),
  JSON.stringify({ version: 1, updated: '2026-09-26', teams: info }, null, 1),
);
console.log(`team-info: ${Object.keys(info).length} teams (2026 FBS = ${fbs.length})`);

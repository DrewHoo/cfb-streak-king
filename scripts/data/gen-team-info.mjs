// Emit data/ref/team-info.json: { slug: { state, tz } } for the 2026 FBS set,
// plus every other team Howell counts as major in some season, located from
// CFBD /teams (data/raw/cfbd-teams.json, one call).
// tz is the campus IANA zone: derived from the state, with campus-level
// exceptions (UTEP is Mountain, Knoxville is Eastern, Bowling Green KY is
// Central, Arizona skips DST, etc.). Used for local kickoff time (night chip)
// and the in-state-opponent chip.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, RAW } from '../lib/util.mjs';
import { canon } from '../lib/names.mjs';

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
  VT: 'America/New_York', DC: 'America/New_York',
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

// former majors (the Ivies, Fordham, wartime service teams): opponents only,
// located for the in-state chip and neutral-site states. CFBD has most
// schools; a service team it lacks stays unlocated and can't be in-state.
const cfbdTeams = JSON.parse(fs.readFileSync(path.join(RAW, 'cfbd-teams.json'), 'utf8'));
const located = new Map();
for (const t of cfbdTeams) {
  const st = t.location?.state;
  if (!st) continue;
  for (const n of [t.school, ...(t.alternateNames ?? [])]) {
    const id = canon(n, 'cfbd-teams');
    if (id && !located.has(id)) located.set(id, { state: st, tz: t.location.timezone || TZ_BY_STATE[st] });
  }
}
// former majors CFBD has no location for: dropped programs by campus,
// wartime service teams by base
const FORMER = {
  AL: ['spring-hill'], CA: ['alameda-coast-guard', 'del-monte-pre-flight', 'march-field', 'mare-island-marines', 'st-mary-s-pre-flight', 'cal-state-fullerton', 'long-beach-state', 'los-angeles-state', 'loyola-marymount', 'pacific', 'san-francisco', 'santa-barbara', 'santa-clara', 'st-mary-s'],
  CO: ['second-air-force-colorado', 'regis', 'colorado-college', 'denver', 'western-state'], CT: ['trinity-connecticut'], DC: ['george-washington'],
  FL: ['jacksonville-nas', 'tampa'], GA: ['fort-benning', 'georgia-pre-flight', 'oglethorpe'], IA: ['cornell-iowa', 'iowa-pre-flight'],
  IL: ['lombard', 'camp-grant', 'great-lakes-navy', 'bradley'], KS: ['haskell', 'fort-riley', 'wichita-state'],
  LA: ['centenary', 'loyola-new-orleans', 'mcneese-state'], MA: ['boston-university', 'worcester-tech'], MI: ['detroit-mercy'],
  MO: ['drury', 'st-louis', 'washington-missouri'], NC: ['north-carolina-pre-flight'], NE: ['creighton'], NJ: ['stevens'],
  NY: ['manhattan', 'new-york-university', 'union-new-york'], OH: ['xavier'], OK: ['norman-nas', 'phillips'], OR: ['portland'],
  PA: ['carlisle', 'haverford', 'swarthmore'], SC: ['citadel'],
  TN: ['cumberland', 'maryville', 'nashville', 'tennessee-medical', 'tennessee-chattanooga'],
  TX: ['amarillo-field', 'lubbock-field', 'randolph-field', 'west-texas-a-and-m', 'texas-arlington'], VA: ['quantico-marines'], VT: ['vermont'],
  WA: ['gonzaga', 'whitman'], WI: ['marquette'], WY: ['fort-warren'],
};
for (const [state, ids] of Object.entries(FORMER)) for (const id of ids) located.set(id, { state, tz: TZ_BY_STATE[state] });
const unlocated = [];
for (const id of Object.keys(spans)) {
  if (info[id] || id.startsWith('x:')) continue;
  const loc = located.get(id);
  if (loc) info[id] = loc;
  else unlocated.push(id);
}
if (unlocated.length) console.log(`former majors CFBD can't locate (${unlocated.length}): ${unlocated.join(', ')}`);

fs.writeFileSync(
  path.join(ROOT, 'data', 'ref', 'team-info.json'),
  JSON.stringify({ version: 1, updated: '2026-09-29', teams: info }, null, 1),
);
console.log(`team-info: ${Object.keys(info).length} teams (2026 FBS = ${fbs.length})`);

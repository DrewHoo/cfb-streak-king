// The other sports sites, in the order every site lists them, for llms.txt
// (the page's What to read next is PUN's claims now, readNext.ts), and the
// addresses of Putting Up Numbers' college football pages. One fact per site,
// the way the site itself says it.
import { punSlug } from './readNext.ts';

/** a site; Putting Up Numbers has a link for each of its sports */
export interface Sibling { name: string; url: string; words: string; links?: { name: string; url: string }[] }

const PUN = 'https://puttingupnumbers.com';
/** Putting Up Numbers (puttingupnumbers.com), who's setting records in each sport: one link a sport */
const PUN_SPORTS = [['College Football', 'cfb'], ['NFL', 'nfl'], ['NBA', 'nba'], ['WNBA', 'wnba'], ['NHL', 'nhl'], ["Men's college hoops", 'mcbb'], ["Women's college hoops", 'wcbb'], ['European soccer', 'european-clubs']].map(([name, id]) => ({ name, url: `${PUN}/${id}/` }));
/** Who's setting records in college football this week */
export const PUN_CFB = `${PUN}/cfb/`;
/** A current FBS team's record book there: the most in a career, a season and a game. Its slugs are our ids but Texas A&M's (punSlugs.json). */
export const punTeamUrl = (id: string) => `${PUN}/cfb/teams/${punSlug(id)}/`;

export const SIBLINGS: Sibling[] = [
  { name: 'Putting Up Numbers', url: 'https://puttingupnumbers.com/', words: "who just set or passed a record, this season's leaders, and a record book for every FBS team", links: PUN_SPORTS },
  { name: 'Hostile Territory', url: 'https://drewhoover.com/hostile-territory/', words: "every head coach's true road record against AP top-10 teams since 1936" },
  { name: 'How Many Rings?', url: 'https://drewhoover.com/how-many-rings/', words: 'every person on a national-championship staff since 1990, ranked by the number of rings they can claim' },
  { name: 'Collegiate Championships', url: 'https://drewhoover.com/collegiate-championships/', words: 'which schools have won the most NCAA championships, across 33 sports' },
  { name: 'CFB All-Time Records', url: 'https://drewhoover.com/cfb-all-time-records/', words: 'all-time win-loss, bowl and national-title records for every FBS program' },
]

// The other sports sites, in the order every site lists them: What to read
// next on the page, and llms.txt. One fact per site, the way the site itself
// says it.
export interface Sibling { name: string; url: string; words: string }

export const SIBLINGS: Sibling[] = [
  { name: 'NFL Comparator', url: 'https://drewhoover.com/nfl-comparator/', words: 'compare NFL players at the same point in their careers, every career since 1999, with a page for every player and what he leads' },
  { name: 'NBA Comparator', url: 'https://drewhoover.com/nba-comparator/', words: 'the same comparator over every NBA career since 1946-47, Wilt and Jordan included, with a page for every player and what he leads' },
  { name: 'WNBA Comparator', url: 'https://drewhoover.com/wnba-comparator/', words: 'the same comparator over every WNBA career since 1997' },
  { name: 'NHL Comparator', url: 'https://drewhoover.com/nhl-comparator/', words: 'the same comparator over every NHL career since 1917-18, Gretzky and Howe included' },
  { name: 'College Football Comparator', url: 'https://drewhoover.com/cfb-comparator/', words: 'every coach, team and player at the same point in their careers, since 1869, with the best players of each position at every school and conference' },
  { name: 'Hostile Territory', url: 'https://drewhoover.com/hostile-territory/', words: "every head coach's true road record against AP top-10 teams since 1936" },
  { name: 'How Many Rings?', url: 'https://drewhoover.com/how-many-rings/', words: 'every person on a national-championship staff since 1990, ranked by the number of rings they can claim' },
  { name: 'Collegiate Championships', url: 'https://drewhoover.com/collegiate-championships/', words: 'which schools have won the most NCAA championships, across 33 sports' },
  { name: 'CFB All-Time Records', url: 'https://drewhoover.com/cfb-all-time-records/', words: 'all-time win-loss, bowl and national-title records for every FBS program' },
]

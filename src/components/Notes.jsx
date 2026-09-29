// What to read next, and the Method notes: the page's static copy.

import { P, firstSeason } from '../lib/model.ts';
import { PLAIN_CHIPS, PLAIN_DEFINITIONS } from '../lib/chips.ts';

export function Notes() {
  return (
    <>
      <h2>What to read next</h2>
      <div className="notes">
        <p>
          <a href="https://drewhoover.com/hostile-territory/">Hostile Territory</a> — every head
          coach's true road record against AP top-10 teams since 1990, one chip per game.
        </p>
        <p>
          <a href="https://drewhoover.com/how-many-rings/">How Many Rings?</a> — every person on a
          national-championship staff since 1990, ranked by rings, each one cited.
        </p>
        <p>
          <a href="https://drewhoover.com/cfb-all-time-records/football">All-time FBS records</a> — all
          136 programs ranked by total wins, win percentage and bowl record.
        </p>
      </div>
    
      <h2>Method</h2>
      <div className="notes">
        <ul>
          <li>
            Window: {firstSeason}–{P.currentSeason}, the I-A/FBS era, {P.games.se.length.toLocaleString()} games. A team's
            games count only from its first FBS season (Appalachian State's from 2014, Missouri State's from
            2025), so no streak runs back into its FCS years. A streak that reaches the edge of its window
            shows as “N+”.
          </li>
          <li>
            A game qualifies when it matches every word in the definition. Non-qualifying games neither extend nor
            break a streak — “hasn't lost to Auburn since 1998” stays alive through seasons they don't play.
            Ties (pre-1996) end winning and losing streaks; an unbeaten streak counts wins and ties.
          </li>
          <li>
            Scores, sites and closing spreads for 1978–2013 come from Warren Repole's{' '}
            <a href="https://web.archive.org/web/2022/http://www.repole.com/sun4cast/data.html">Sunshine Forecast</a>{' '}
            files. His site is gone; the files survive only in the Internet Archive's Wayback Machine, which is
            worth <a href="https://archive.org/donate">a donation</a>. The 75 rows we found wrong and the 38 games
            the files lack are published as <a href="https://github.com/DrewHoo/repole-errata">repole-errata</a>, CC0.
          </li>
          <li>
            <a href="http://www.jhowell.net/cf/scores/ScoresIndex.htm">James Howell's historical scores</a> confirm
            every 1978–2013 result and mark conference games before 2009.
          </li>
          <li>
            <a href="https://github.com/sportsdataverse/cfbfastR-data">cfbfastR</a> (ESPN) supplies every game
            from 2014 on, conference games from 2009, and spreads as the median closing line across books.
          </li>
          <li>
            <a href="https://www.collegepollarchive.com/">College Poll Archive</a> supplies the AP polls. A rank
            is the poll in effect at kickoff.
          </li>
          <li>
            <a href="https://collegefootballdata.com/">CollegeFootballData</a> supplies head-coach tenures,
            halftime scores (2001 on) and time of possession (2004 on).
          </li>
          <li>
            A team's regular off-campus home field (Legion Field for Alabama, War Memorial Stadium in Little
            Rock for Arkansas, and similar) counts as a home game.
          </li>
          <li>
            A team's page lists every streak it is king of: each definition under which that team alone holds
            the longest active or all-time streak, at least 4 games long, among at least 10 teams with a streak
            under it. The {PLAIN_CHIPS.length} plain words alone make {PLAIN_DEFINITIONS.toLocaleString('en-US')} possible definitions,{' '}
            {(PLAIN_DEFINITIONS * 3).toLocaleString('en-US')} counting winning, losing and unbeaten separately; the words that take a choice
            (a state, a conference, an opponent, a month) push that past 24 million.
          </li>
        </ul>
      </div>
    </>
  );
}

// What to read next, and the Method notes: the page's static copy.

import { P, firstSeason, fbsNow } from '../lib/model.ts';
import { PLAIN_CHIPS, PLAIN_DEFINITIONS, PLAIN_STREAK_KINDS } from '../lib/chips.ts';

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
            Window: {firstSeason}–{P.currentSeason}, from the first AP poll, {P.games.se.length.toLocaleString()} games.
            The teams are this season's FBS teams. There was no FBS before 1978; before then a team counts in the
            seasons James Howell lists it as a major-college program. A team's games count only from its latest
            move up (Temple's from 1971, Appalachian State's from 2014), so no streak runs back into a
            lower-division stint; a season a team sat out, like 1943 or 2020, doesn't count as one. A streak that
            reaches the edge of its window shows as “N+”.
          </li>
          <li>
            A game qualifies when it matches every word in the definition. Non-qualifying games neither extend nor
            break a streak — “hasn't lost to Auburn since 1998” stays alive through seasons they don't play.
            Ties (pre-1996) end winning and losing streaks; an undefeated streak counts wins and ties. A covering
            streak counts games where the team beat the closing spread, and a not-covering streak counts games
            where it didn't: a push ends either, and a game without a line (every game before 1978, and a few
            after) doesn't count at all.
          </li>
          <li>
            Scores, sites and closing spreads for 1978–2013 come from Warren Repole's{' '}
            <a href="https://web.archive.org/web/2022/http://www.repole.com/sun4cast/data.html">Sunshine Forecast</a>{' '}
            files. His site is gone; the files survive only in the Internet Archive's Wayback Machine, which is
            worth <a href="https://archive.org/donate">a donation</a>. The 78 rows we found wrong and the 38 games
            the files lack are published as <a href="https://github.com/DrewHoo/repole-errata">repole-errata</a>, CC0.
          </li>
          <li>
            <a href="http://www.jhowell.net/cf/scores/ScoresIndex.htm">James Howell's historical scores</a> supply
            every game before 1978 (each game between two majors appears on both teams' pages, and the two agree on
            every score), confirm every 1978–2013 result, and mark conference games before 2009. Howell doesn't say
            whose home game an off-campus game was; before 1978 a city counts as a team's home field when it played
            at least 5 regular-season games there against at least 3 opponents.
          </li>
          <li>
            <a href="https://github.com/sportsdataverse/cfbfastR-data">cfbfastR</a> (ESPN) supplies every game
            from 2014 on, conference games from 2009, and spreads as the median closing line across books.
          </li>
          <li>
            <a href="https://www.collegepollarchive.com/">College Poll Archive</a> supplies the AP polls. A rank
            is the poll in effect at kickoff. The AP ranked 20 teams through 1960, 10 in 1961–67, 20 through 1988 and
            25 since, and had no preseason poll before 1950, so early-season games from those years can't qualify
            for a rank word.
          </li>
          <li>
            <a href="https://collegefootballdata.com/">CollegeFootballData</a> supplies head-coach tenures,
            halftime scores (2001 on) and time of possession (2004 on).
          </li>
          <li>
            Full moons are worked out to the minute with Jean Meeus’s lunar-phase method. A game is a werewolf
            game when the moon is full within a day of 8pm Eastern on game day.
          </li>
          <li>
            A team's regular off-campus home field (Legion Field for Alabama, War Memorial Stadium in Little
            Rock for Arkansas, and similar) counts as a home game.
          </li>
          <li>
            A team's page lists the streaks it is king of that stand out: each definition under which that team alone holds
            the longest active or all-time streak, at least 4 games long, among at least 10 teams with a streak
            under it. The {PLAIN_CHIPS.length} plain words alone make {PLAIN_DEFINITIONS.toLocaleString('en-US')} possible definitions,{' '}
            {PLAIN_STREAK_KINDS.toLocaleString('en-US')} counting winning, losing, undefeated, covering and not covering separately; the words that take a choice
            (a state, a conference, an opponent, a month) push that past 24 million.
          </li>
          <li>
            With that many definitions, some team leads almost any of them by chance, so each streak a team is king of gets a score:
            how far its streak runs past where the field's leader would be expected to land, given how often teams
            get that result in those games, less a cost for each word in the definition (more for words that
            describe the game itself, like a one-score finish). A run across decades earns a little back. A streak
            that's only a slice of a better one, or that chance would explain, isn't listed, and a word that keeps
            nearly every game (on a weekend) never names one. Each listed streak shows the odds that luck alone produces a
            streak that long under its definition: every team (or, all-time, every place a run could start) gets
            that many tries at the field's rate.
          </li>
          <li>
            The rate under the sentence pools today's {fbsNow.size} FBS teams' games, each from that team's side. A
            game between two of them counts once each way and comes out even; a game against anyone else (an FCS
            team, a program that has since dropped out) counts once, and FBS teams win most of those. So a
            condition that favors neither side, like a full moon, sits a little above 50%.
          </li>
        </ul>
      </div>
    </>
  );
}

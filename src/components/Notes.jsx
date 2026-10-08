// What to read next, and the Method notes: the page's static copy.

import { P, firstSeason, fbsNow } from '../lib/model.ts';
import { PLAIN_CHIPS, PLAIN_DEFINITIONS, PLAIN_STREAK_KINDS } from '../lib/chips.ts';
import { ALL_DEFINITIONS } from '../lib/definition.ts';
import { track } from '../lib/analytics.ts';

export const KOFI_URL = 'https://ko-fi.com/drewhooverdotcom';

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

      <h2>Using a streak from here</h2>
      <div className="notes">
        <p>
          If a streak from this page ends up in your article, broadcast, podcast or thread, please cite it: name
          the site and link to the streak where sensible; the url encodes the streak's definition into it.
        </p>
        <p>
          The site is free and serves no ads. If you enjoyed using it, consider{' '}
          <a href={KOFI_URL} onClick={() => track('kofi', { from: 'notes' })}>buying me some server compute</a> or donating to The Internet Archive's <a href="https://archive.org/donate">Wayback Machine</a> (I am a monthly donor, FTR). 
        </p>
      </div>

      <h2>Method</h2>
      <div className="notes">
        <ul>
          <li>
            Window: {firstSeason}–{P.currentSeason}, from the first AP poll, {P.games.se.length.toLocaleString()} games.
          </li>
          <li>
            Teams: The teams are this season's FBS teams. There was no FBS before 1978; before then a team counts in the
            seasons James Howell lists it as a 'major' college program. A team's games count only from its latest
            move up (Temple's from 1971, Appalachian State's from 2014).
          </li>
          <li>
            Streak Rules:
            <ul>
              <li>
                A game qualifies when it matches every word in the definition. Non-qualifying games neither extend nor
                break a streak — “hasn't lost to Auburn since 1998” stays alive through seasons they don't play.
              </li>
              <li>Ties (pre-1996) end winning and losing streaks; an undefeated streak counts wins and ties.</li>
              <li>
                A winning or losing streak can ask for a margin: “winning by 10+” counts games won by 10 or more, and any
                other result — a loss or a closer win alike — ends it. The margin is on the outcome, not a condition, because a
                condition only decides which games count, never what breaks the run.
              </li>
              <li>
                A covering streak counts games where the team beat the closing spread, and a not-covering streak counts
                games where it didn't: a push ends either, and a game without a line (every game before 1978, and a few
                after) doesn't count at all.
              </li>
              
          <li>The {PLAIN_CHIPS.length} conditions make{' '}
            {PLAIN_DEFINITIONS.toLocaleString('en-US')} possible streak definitions, {PLAIN_STREAK_KINDS.toLocaleString('en-US')} counting
            winning, losing, undefeated, covering, not covering, and winning or losing by 10+ separately; the conditions that take a parameter
            (a state, conference, opponent, month, team color, or mascot) push that past {Math.floor(ALL_DEFINITIONS / 1e6)} million.
          </li>
          <li>The odds shown are the chance that luck alone produces a streak that long: every team (or, all-time,
            every place a run could start) gets that many tries at the field's rate.
          </li>
              <li>
            A team's page shows the most interesting streak definitions according to a complicated and imperfect heuristic that takes into account the streak occurring by chance, among other factors. You can read it in the source code if you're so inclined (open a PR if you disagree with me!). 
            </li>
              <li>
                'Power conference' means: the six BCS automatic-qualifying conferences from 1998, the Power 5 from 2014, the Power 4 from 2024.
                <ul>
                  <li>The American gets to count for 2013, because it inherited the Big East's automatic berth.</li>
                  <li>
                    Notre Dame counts as a power conference opponent since power conferences allowed ND to count as such
                    to meet scheduling requirements.
                  </li>
                  <li>
                    Army also met this requirement for the Big Ten and SEC, but not unanimously so it doesn't get the
                    same treatment.
                  </li>
                  <li>The term 'power conference' has no formal meaning before 1998, so older games don't qualify.</li>
                </ul>
              </li>
              <li>
                Full moons are worked out to the minute with Jean Meeus’s lunar-phase method. A game is a werewolf
                game when the moon is full within a day of 8pm Eastern on game day.
              </li>
              <li>
                A team's regular off-campus home field (Legion Field for Alabama, War Memorial Stadium in Little
                Rock for Arkansas, and similar) counts as a home game, except in some circumstances like the Iron Bowl.
              </li>
              
              <li>
            The rate under the streak definition pools today's {fbsNow.size} FBS teams' games, each from that team's side. A
            game between two of them counts once each way and comes out even; a game against anyone else (an FCS
            team, a program that has since dropped out) counts once, and FBS teams win most of those. So a
            condition that favors neither side, like a full moon, can sit a little above 50%. I haven't found a neutral condition that disfavors FBS teams, but would love to hear about one!
          </li>
            </ul>
          </li>
          
          <li>
            Sources:
            <ul>
              <li>
                Scores, sites and closing spreads for 1978–2013 come from Warren Repole's{' '}
                <a href="https://web.archive.org/web/2022/http://www.repole.com/sun4cast/data.html">Sunshine Forecast</a>{' '}
                files. His site is gone; the files survive only in the Internet Archive's Wayback Machine, which is
                worth <a href="https://archive.org/donate">a donation</a>. The 78 rows we found wrong and the 38 games
                the files lack are published as <a href="https://github.com/DrewHoo/repole-errata">repole-errata</a>, CC0.
              </li>
              <li>
                <a href="http://www.jhowell.net/cf/scores/ScoresIndex.htm">James Howell's historical scores</a> supply
                every game before 1978, confirm every 1978–2013 result, and mark conference games before 2009. Howell doesn't say
                whose home game an off-campus game was; before 1978 a city counts as a team's home field when it played
                at least 5 regular-season games there against at least 3 opponents.
              </li>
              <li>
                <a href="https://github.com/sportsdataverse/cfbfastR-data">cfbfastR</a> (ESPN) supplies every game
                from 2014 on, conference games from 2009, and spreads as the median closing line across books.
              </li>
              <li>
                <a href="https://www.collegepollarchive.com/">College Poll Archive</a> supplies the AP polls. The AP ranked 20
                teams through 1960, 10 in 1961–67, 20 through 1988 and
                25 since, and had no preseason poll before 1950, so early-season games from those years can't qualify
                for a rank word.
              </li>
              <li>
                <a href="https://collegefootballdata.com/">CollegeFootballData</a> supplies head-coach tenures,
                halftime scores (2001 on) and time of possession (2004 on).
              </li>
              <li>
                Readers catch what the sources miss. r/CFB's{' '}
                <a href="https://www.reddit.com/r/CFB/comments/1wxgi5x/comment/pdv075e/">HurricaneRex</a> spotted that
                Washington State's 2025 games weren't counting as games against a first-year head coach: CFBD credits
                the bowl to an interim, and his one game fit the season opener just as well, which made Jimmy Rogers
                look like a mid-season hire. If a streak here looks wrong to you, it might be — say so.
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </>
  );
}

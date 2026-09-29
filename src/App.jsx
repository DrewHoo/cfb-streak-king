import { useEffect, useMemo, useState } from 'react';
import { P, teams, activeBoard, allTimeBoard, todayEpochDay, builtEpochDay, fbsNow, firstSeason, windowStartOf } from './lib/model.ts';
import { chipByKey, PLAIN_CHIPS, PLAIN_DEFINITIONS } from './lib/chips.ts';
import { loadCrowns } from './lib/loadCrowns.ts';
import { definitionPhrase, crownClaim } from './lib/sentence.ts';
import {
  PRESETS, DEFAULT_SCOPE, encodeChips, decodeChips, chipsToParam, chipsFromParam, withChip, swapChip, withoutChip, withParam,
} from './lib/definition.ts';
import { dirWord, dayOf, rowKey } from './lib/format.ts';
import { readStarred, writeStarred } from './lib/starred.ts';
import { track } from './lib/analytics.ts';
import { readParam, writeUrl } from './urlState.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { Sentence } from './components/Sentence.jsx';
import { Grid, DESKTOP_CAP } from './components/Grid.jsx';
import { TeamPanel } from './components/TeamPanel.jsx';
import { Starred } from './components/Starred.jsx';
import { ShareIcon, StarIcon } from './components/Icons.jsx';

// `initial` seeds state the prerender and the hydrate must agree on: a
// per-team page (/team/<id>/) opens with that team's panel already open and
// its crowns ({ active, all }) already loaded.
export default function App({ initial } = {}) {
  const [active, setActive] = useState(chipsFromParam(null));
  const [dir, setDir] = useState('W');
  const [scope, setScope] = useState(DEFAULT_SCOPE);
  const [team, setTeam] = useState(initial?.team ?? null);
  const [run, setRun] = useState(null); // all-time: the start ep of the open run
  const [week, setWeek] = useState(false);
  const [todayEp, setTodayEp] = useState(builtEpochDay);
  const [limit, setLimit] = useState(DESKTOP_CAP); // columns shown before 'more'
  const [addOpen, setAddOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [starred, setStarred] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  // crowns by team index: { active, all }
  const [crownSets, setCrownSets] = useState(() => (initial?.crowns && initial.team != null ? { [initial.team]: initial.crowns } : {}));
  const [crownsScope, setCrownsScope] = useState('active');
  const [crownsDir, setCrownsDir] = useState('W');
  const isMobile = useIsMobile();

  // URL -> state, after mount only: the prerender has no window
  useEffect(() => {
    setTodayEp(todayEpochDay());
    setActive(chipsFromParam(readParam('c')));
    const d = readParam('dir');
    if (d === 'L' || d === 'U') { setDir(d); setCrownsDir(d); }
    if (readParam('scope') === 'active') setScope('active');
    if (readParam('week') === '1') setWeek(true);
    const ti = teams.findIndex((t) => t.id === readParam('team'));
    if (ti >= 0 && fbsNow.has(ti)) setTeam(ti);
    // a run is keyed by its first game's epoch day, negative before 1970
    const r = readParam('run');
    if (r != null && r !== '' && Number.isInteger(Number(r))) setRun(Number(r));
    setStarred(readStarred());
    setHydrated(true);
  }, []);

  // state -> URL
  useEffect(() => {
    if (!hydrated) return;
    // an open team lives at /team/<id>/, which is also a prerendered page
    // with its own social preview; ?team= from old links moves there too
    writeUrl(import.meta.env.BASE_URL, team != null ? `team/${teams[team].id}/` : '', {
      c: chipsToParam(active),
      dir: dir === 'W' ? null : dir,
      scope: scope === DEFAULT_SCOPE ? null : scope,
      week: week ? '1' : null,
      run: scope === 'all' && run != null ? String(run) : null,
      team: null, // retired params from old links
      view: null,
      sort: null,
    });
    track('definition', { chips: encodeChips(active) || 'overall', dir, scope });
  }, [active, dir, scope, week, team, run, hydrated]);

  // the open team's crowns: its page embeds them, any other team fetches its file
  useEffect(() => {
    if (team == null || crownSets[team]) return;
    let live = true;
    loadCrowns(team).then((c) => { if (live) setCrownSets((cur) => ({ ...cur, [team]: c })); });
    return () => { live = false; };
  }, [team, crownSets]);

  const rows = useMemo(
    () => (scope === 'all' ? allTimeBoard(active, dir, todayEp) : activeBoard(active, dir, todayEp)),
    [active, dir, scope, todayEp],
  );
  const weekCount = useMemo(() => rows.filter((r) => r.onTheLine).length, [rows]);
  const shown = week ? rows.filter((r) => r.onTheLine) : rows;
  // the window edge an at-edge streak actually hit: the latest data floor
  // among active chips (night 2002, halftime 2001, possession 2004), else the
  // team's first FBS season, else the first season in the data
  const edgeFor = useMemo(() => {
    let floor = firstSeason;
    let word = null;
    for (const a of active) {
      const c = chipByKey.get(a.key);
      if (c.floor && c.floor.season > floor) { floor = c.floor.season; word = c.floor.what; }
    }
    return (ti) => {
      const joined = windowStartOf(ti);
      if (joined > floor) return { year: joined, word: null, joined: true };
      return { year: floor, word, joined: false };
    };
  }, [active]);
  const edge = team != null ? edgeFor(team) : null;
  // active: a team has one row. all-time: the open run, else the team's longest
  const teamRow = team != null
    ? rows.find((r) => r.ti === team && (scope !== 'all' || run == null || r.s.start.ep === run)) ?? rows.find((r) => r.ti === team) ?? null
    : null;
  const openKey = teamRow ? rowKey(teamRow) : null;
  const weekDay = rows.find((r) => r.onTheLine)?.next ? dayOf(rows.find((r) => r.onTheLine).next.ep) : 'Saturday';
  const crowns = team != null ? crownSets[team]?.[crownsScope] ?? null : null;

  // leaders of the presets, for the start-from list
  const startFrom = useMemo(() => {
    if (!addOpen) return [];
    const entries = PRESETS.map((p) => ({ chips: p.chips, dir: p.dir, name: p.name }));
    return entries.map((e) => {
      const b = activeBoard(e.chips, e.dir, todayEp);
      return { ...e, leader: b[0] ? teams[b[0].ti] : null, len: b[0] ? `${b[0].s.len}${b[0].s.atEdge ? '+' : ''}` : '' };
    });
  }, [addOpen, todayEp]);

  function setDefinition(chips, d) {
    setActive(chips);
    if (d) setDir(d);
    setLimit(DESKTOP_CAP); // a new board starts at the first rows again
  }
  const on = {
    scope: (s) => { setScope(s); setLimit(DESKTOP_CAP); if (s === 'all') setWeek(false); },
    dir: (d) => { setDir(d); setLimit(DESKTOP_CAP); },
    add: (key) => setDefinition(withChip(active, key)),
    swap: (oldKey, newKey) => setDefinition(swapChip(active, oldKey, newKey)),
    remove: (key) => setDefinition(withoutChip(active, key)),
    setParam: (key, param) => setDefinition(withParam(active, key, param)),
    week: () => { setWeek(true); track('week filter', { on: true }); },
    unweek: () => { setWeek(false); track('week filter', { on: false }); },
    start: (e) => {
      // presets are written for active streaks (their leaders in the list
      // are active leaders), so applying one leaves all-time mode
      setDefinition(e.chips, e.dir);
      setScope(e.scope ?? 'active');
      setRun(null);
      track('preset', { name: e.name });
    },
  };
  function pickRow(row) {
    const same = team === row.ti && (scope !== 'all' || run === row.s.start.ep);
    setTeam(same ? null : row.ti);
    setRun(same || scope !== 'all' ? null : row.s.start.ep);
    if (!same) { setCrownsDir(dir); track('team open', { team: teams[row.ti].id, scope, len: row.s.len }); }
  }
  function applyCrown(cr) {
    setDefinition(cr.chips.map((key) => ({ key })), cr.dir);
    setScope(cr.scope);
    setRun(null);
    track('lead apply', { chips: cr.chips.join(',') || 'overall', dir: cr.dir, scope: cr.scope, len: cr.len });
  }
  // the sentence and URL for one streak a team is king of
  function shareCrown(cr) {
    const chips = cr.chips.map((key) => ({ key }));
    const sentence = crownClaim(team, cr);
    const url = new URL(window.location.href);
    url.search = '';
    url.pathname = `${import.meta.env.BASE_URL}team/${teams[team].id}/`;
    if (chipsToParam(chips)) url.searchParams.set('c', chipsToParam(chips));
    if (cr.dir !== 'W') url.searchParams.set('dir', cr.dir);
    if (cr.scope !== DEFAULT_SCOPE) url.searchParams.set('scope', cr.scope);
    share(sentence, url.toString());
  }
  // analytics event names predate "crowns"; kept so the history stays continuous
  function onCrownsScope(s) { setCrownsScope(s); track('leads scope', { scope: s }); }
  function onCrownsDir(d) { setCrownsDir(d); track('leads dir', { dir: d }); }
  function applyStarred(f) {
    setDefinition(decodeChips(f.c), f.dir);
    track('apply saved streak', { chips: f.c || 'overall', dir: f.dir });
  }
  function removeStarred(f) {
    setStarred((cur) => { const next = cur.filter((x) => !(x.c === f.c && x.dir === f.dir)); writeStarred(next); return next; });
    track('unsave streak', { chips: f.c || 'overall', dir: f.dir });
  }

  const defC = encodeChips(active);
  const isSaved = starred.some((f) => f.c === defC && f.dir === dir);
  function toggleStarred() {
    setStarred((cur) => {
      const next = cur.some((f) => f.c === defC && f.dir === dir)
        ? cur.filter((f) => !(f.c === defC && f.dir === dir))
        : [...cur, { c: defC, dir, name: `${dirWord(dir)} streaks in ${definitionPhrase(active)}` }];
      writeStarred(next);
      return next;
    });
    if (!isSaved) track('save streak', { chips: defC || 'overall', dir });
  }
  function share(sentence, shareUrl) {
    const text = sentence || `Longest ${scope === 'all' ? 'all-time' : 'active'} ${dirWord(dir)} streaks in ${definitionPhrase(active)}`;
    const url = shareUrl ?? window.location.href;
    track('share', { chips: defC || 'overall', dir, team: team != null ? teams[team].id : null });
    try {
      if (navigator.share) { navigator.share({ title: 'Streak King', text, url }).catch(() => {}); return; }
      navigator.clipboard.writeText(`${text} ${url}`).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      });
    } catch {}
  }

  const panel = team != null && (
    <TeamPanel
      ti={team} row={teamRow} rank={teamRow ? rows.indexOf(teamRow) + 1 : 0} field={rows.length}
      active={active} dir={dir} scope={scope} edge={edge} crowns={crowns}
      crownsScope={crownsScope} crownsDir={crownsDir} onCrownsScope={onCrownsScope} onCrownsDir={onCrownsDir}
      onShare={share} onShareCrown={shareCrown} onClose={() => { setTeam(null); setRun(null); }} onApplyCrown={applyCrown}
    />
  );

  return (
    <main>
      <div className="dateline">
        <span>drewhoover.com · {firstSeason}–{P.currentSeason}<span className="dateline-upd"> · updated {String(P.builtAt).slice(0, 10)}</span></span>
        <span className="dateline-acts">
          <button className={'ico' + (isSaved ? ' on' : '')} onClick={toggleStarred} aria-pressed={isSaved} aria-label={isSaved ? 'Saved' : 'Save this streak'}>
            <StarIcon filled={isSaved} />
          </button>
          <button className="ico" onClick={() => share()} aria-label="Share"><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      <h1>Streak King</h1>

      <Sentence
        active={active} dir={dir} scope={scope} week={week} weekCount={weekCount} weekDay={weekDay}
        startFrom={startFrom} isMobile={isMobile} addOpen={addOpen} setAddOpen={setAddOpen} on={on}
      />

      <Grid
        rows={shown} curTeam={team} openKey={openKey} onPick={pickRow} edgeFor={edgeFor} isMobile={isMobile}
        limit={limit} setLimit={setLimit} week={week} scope={scope} dir={dir} panel={panel}
      />

      <Starred starred={starred} todayEp={todayEp} onApply={applyStarred} onRemove={removeStarred} />

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

      <footer>
        <a href="https://drewhoover.com/">drewhoover.com</a> · data rebuilt weekly in season ·{' '}
        <a href="https://github.com/DrewHoo/cfb-streak-king">source & receipts</a>
      </footer>
    </main>
  );
}

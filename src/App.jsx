import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { teams, activeBoard, allTimeBoard, edgeFor as edgeForDefinition, todayEpochDay, builtEpochDay } from './lib/model.ts';
import { definitionPhrase, crownClaim } from './lib/sentence.ts';
import { encodeChips, decodeChips, withChip, swapChip, withoutChip, withParam } from './lib/definition.ts';
import { parseUrl, toUrl, crownUrl, teamUrl, gamesUrl } from './lib/url.ts';
import { viewReducer, initialView, isOpen } from './lib/view.ts';
import { gameVs } from './lib/team.ts';
import { dirWord, dayOf, rowKey, siteWord } from './lib/format.ts';
import { track } from './lib/analytics.ts';
import { writeUrl, absoluteUrl } from './urlState.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { useCrowns } from './hooks/useCrowns.ts';
import { useStarred } from './hooks/useStarred.ts';
import { useShare } from './hooks/useShare.ts';
import { Dateline } from './components/Dateline.jsx';
import { Sentence } from './components/Sentence.jsx';
import { BaseRate } from './components/BaseRate.jsx';
import { Grid } from './components/Grid.jsx';
import { TeamPanel } from './components/TeamPanel.jsx';
import { TeamPage } from './components/TeamPage.jsx';
import { GamesPage } from './components/GamesPage.jsx';
import { Matchup } from './components/Matchup.jsx';
import { Starred } from './components/Starred.jsx';
import { Notes } from './components/Notes.jsx';

const BASE = import.meta.env.BASE_URL;

// `initial` seeds state the prerender and the hydrate must agree on: a
// per-team page (/team/<id>/) starts on that team's page with its crowns
// ({ active, all }) already loaded; /games/ starts on the schedule.
export default function App({ initial } = {}) {
  const [view, dispatch] = useReducer(viewReducer, initial, (i) => initialView(i?.page ?? null, !!i?.games));
  const { active, dir, scope, week, team, run, limit, page, game, vs, games } = view;
  const [todayEp, setTodayEp] = useState(builtEpochDay);
  const [addOpen, setAddOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // one team's crowns at a time: the page's, else the open panel's
  const crownTeam = page ?? team;
  const crowns = useCrowns(crownTeam, initial);
  const star = useStarred(active, dir);
  const { copied, share } = useShare();
  const isMobile = useIsMobile();

  // URL -> state, after mount only: the prerender has no window. Back and
  // Forward load the entry's URL the same way, at the scroll it was left at.
  useEffect(() => {
    const load = () => parseUrl(window.location.pathname, window.location.search);
    const v = load();
    dispatch({ type: 'load', view: v });
    crowns.followDir(v.dir);
    setTodayEp(todayEpochDay());
    setHydrated(true);
    try { window.history.scrollRestoration = 'manual'; } catch {}
    const onPop = (e) => {
      dispatch({ type: 'load', view: load() });
      const y = e.state?.y ?? 0;
      requestAnimationFrame(() => window.scrollTo(0, y));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // state -> URL. A change of definition replaces the entry. Opening a streak
  // or a matchup, or moving to a team page or back to the board, pushes one,
  // remembering the URL underneath so closing can be a step back. (The
  // analytics embed counts each as a pageview.)
  const last = useRef(null);
  useEffect(() => {
    if (!hydrated) return;
    const was = last.current;
    last.current = view;
    const { path, params } = toUrl(view);
    const moved = !!was && (was.page !== page || was.games !== games);
    const opened = !!was && ((game != null && was.game == null) || (page == null && game == null && team != null && was.team == null && was.game == null));
    const pushed = writeUrl(BASE, path, params, moved || opened ? { under: window.location.href } : null);
    if (pushed && moved) window.scrollTo(0, 0);
    if (page == null && game == null && !games) track('definition', { chips: encodeChips(active) || 'overall', dir, scope });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dir, scope, week, team, run, page, game, vs, games, hydrated]);

  // Closing a panel or a matchup: step back when that lands exactly on what's
  // underneath, so Back and the close button agree; otherwise close in place.
  function close(action) {
    const after = absoluteUrl(BASE, toUrl(viewReducer(view, action)));
    if (window.history.state?.under === after) window.history.back();
    else dispatch(action);
  }

  const rows = useMemo(
    () => (scope === 'all' ? allTimeBoard(active, dir, todayEp) : activeBoard(active, dir, todayEp)),
    [active, dir, scope, todayEp],
  );
  const weekCount = useMemo(() => rows.filter((r) => r.onTheLine).length, [rows]);
  const shown = week ? rows.filter((r) => r.onTheLine) : rows;
  const edgeFor = useMemo(() => edgeForDefinition(active, dir), [active, dir]);
  // active: a team has one row. all-time: the open run, else the team's longest
  const teamRow = team != null
    ? rows.find((r) => r.ti === team && (scope !== 'all' || run == null || r.s.start.ep === run)) ?? rows.find((r) => r.ti === team) ?? null
    : null;
  const nextUp = rows.find((r) => r.onTheLine)?.next;
  const weekDay = nextUp ? dayOf(nextUp.ep) : 'Saturday';
  const matchup = game != null ? gameVs(game, vs, todayEp) : null;
  // the board's own streak for the matchup's team, when this game is its next
  // one: it leads that team's list in the sheet (plain chips only, as a
  // team's list is)
  const pin = useMemo(() => {
    if (!matchup || page != null || scope !== 'active' || active.some((a) => a.param != null)) return null;
    const row = rows.find((r) => r.ti === game);
    if (!row || row.next?.i !== matchup.i) return null;
    const level = rows.filter((r) => r.s.len === row.s.len);
    const since = row.qual[row.qual.length - row.s.len].se;
    return { chips: active.map((a) => a.key), dir, len: row.s.len, atEdge: row.s.atEdge, rank: rows.indexOf(level[0]) + 1, tied: level.length, field: rows.length, next: row.next, since, chance: null, score: 0 };
  }, [matchup, page, scope, active, dir, rows, game]);

  const define = (chips, d) => dispatch({ type: 'define', active: chips, dir: d });
  const on = {
    scope: (s) => dispatch({ type: 'scope', scope: s }),
    dir: (d) => dispatch({ type: 'dir', dir: d }),
    add: (key) => define(withChip(active, key)),
    swap: (oldKey, newKey) => define(swapChip(active, oldKey, newKey)),
    remove: (key) => define(withoutChip(active, key)),
    setParam: (key, param) => define(withParam(active, key, param)),
    week: () => { dispatch({ type: 'week', on: true }); track('week filter', { on: true }); },
    unweek: () => { dispatch({ type: 'week', on: false }); track('week filter', { on: false }); },
  };
  function pickRow(row) {
    if (isOpen(view, row)) { close({ type: 'close' }); return; }
    crowns.followDir(dir);
    track('team open', { team: teams[row.ti].id, scope, len: row.s.len });
    dispatch({ type: 'pick', row });
  }
  function openTeam(ti, from) {
    track('team page', { team: teams[ti].id, from });
    dispatch({ type: 'page', team: ti });
  }
  function openGame(ti, g, from) {
    track('matchup', { team: teams[ti].id, opp: teams[g.oppIdx]?.id, from });
    dispatch({ type: 'game', team: ti, vs: g.oppIdx });
  }
  // one streak, a crown or a row of a team's list: its board, with that team open
  function openStreak(s, ti, from) {
    crowns.followDir(s.dir);
    dispatch({ type: 'streak', chips: s.chips, dir: s.dir, scope: s.scope ?? 'active', team: ti });
    track('lead apply', { chips: s.chips.join(',') || 'overall', dir: s.dir, scope: s.scope ?? 'active', len: s.len, from });
  }
  function applyStarred(f) {
    define(decodeChips(f.c), f.dir);
    track('apply saved streak', { chips: f.c || 'overall', dir: f.dir });
  }
  function shareView(sentence) {
    const text = sentence || `Longest ${scope === 'all' ? 'all-time' : 'active'} ${dirWord(dir)} streaks in ${definitionPhrase(active)}`;
    track('share', { chips: encodeChips(active) || 'overall', dir, team: team != null ? teams[team].id : null });
    share(text, window.location.href);
  }
  // one streak a team is king of: its sentence and the board under its definition, the team open
  function shareCrown(cr, ti = team) {
    track('share', { chips: cr.chips.join(',') || 'overall', dir: cr.dir, team: teams[ti].id });
    share(crownClaim(ti, cr), absoluteUrl(BASE, crownUrl(ti, cr)));
  }
  function shareTeam(ti) {
    track('share', { team: teams[ti].id, page: true });
    share(`${teams[ti].name}’s streaks, record and next game`, absoluteUrl(BASE, teamUrl(ti)));
  }
  function openGames() {
    track('games');
    dispatch({ type: 'games' });
  }
  function shareGames() {
    track('share', { games: true });
    share(`This week's college football games, with every streak on the line`, absoluteUrl(BASE, gamesUrl()));
  }
  function shareGame() {
    track('share', { team: teams[game].id, matchup: true });
    share(`${teams[game].name} ${siteWord(matchup)} ${teams[matchup.oppIdx]?.name}: every streak on the line`, absoluteUrl(BASE, toUrl({ ...view, vs: matchup.oppIdx })));
  }

  const panel = team != null && (
    <TeamPanel
      ti={team} row={teamRow} rank={teamRow ? rows.indexOf(teamRow) + 1 : 0} field={rows.length}
      active={active} dir={dir} scope={scope} edge={edgeFor(team)} crowns={crowns.crowns}
      crownsScope={crowns.scope} crownsDir={crowns.dir} onCrownsScope={crowns.onScope} onCrownsDir={crowns.onDir}
      onShare={shareView} onShareCrown={shareCrown} onClose={() => close({ type: 'close' })} onApplyCrown={(cr) => openStreak(cr, team, 'panel')}
      onTeam={(ti) => openTeam(ti, 'panel')} onGame={(ti, g) => openGame(ti, g, 'panel')}
    />
  );

  return (
    <main>
      {page != null ? (
        <TeamPage
          ti={page} todayEp={todayEp} crowns={crowns} isMobile={isMobile} copied={copied}
          on={{
            board: () => dispatch({ type: 'board' }),
            team: (ti) => openTeam(ti, 'picker'),
            game: (ti, g) => openGame(ti, g, 'team page'),
            streak: (s, ti) => openStreak(s, ti, 'team page'),
            share: shareTeam,
          }}
        />
      ) : games ? (
        <GamesPage todayEp={todayEp} copied={copied} on={{ board: () => dispatch({ type: 'board' }), game: (ti, g) => openGame(ti, g, 'games'), share: shareGames }} />
      ) : (
        <>
          <Dateline isStarred={star.isStarred} onStar={star.toggle} onShare={() => shareView()} copied={copied} onTeam={(ti) => openTeam(ti, 'find')} onGames={openGames} isMobile={isMobile} />
          <h1>Streak King</h1>

          <Sentence
            active={active} dir={dir} scope={scope} week={week} weekCount={weekCount} weekDay={weekDay}
            isMobile={isMobile} addOpen={addOpen} setAddOpen={setAddOpen} on={on}
          />
          <BaseRate active={active} dir={dir} />

          <Grid
            rows={shown} curTeam={team} openKey={teamRow ? rowKey(teamRow) : null} onPick={pickRow} onGame={(ti, g) => openGame(ti, g, 'column')} edgeFor={edgeFor} isMobile={isMobile}
            limit={limit} setLimit={(l) => dispatch({ type: 'limit', limit: l })} week={week} scope={scope} dir={dir} panel={panel}
          />

          <Starred starred={star.starred} todayEp={todayEp} onApply={applyStarred} onRemove={star.remove} />
        </>
      )}

      <Matchup
        ti={matchup ? game : null} game={matchup} crowns={game === crownTeam ? crowns.active : null} pin={pin} todayEp={todayEp} isMobile={isMobile}
        onClose={() => close({ type: 'closeGame' })} onTeam={(ti) => openTeam(ti, 'matchup')}
        onStreak={(s, ti) => openStreak(s, ti, 'matchup')} onShare={shareGame}
      />

      <Notes />

      <footer>
        <a href="https://drewhoover.com/">drewhoover.com</a> · data rebuilt weekly in season ·{' '}
        <a href="https://github.com/DrewHoo/cfb-streak-king">source & receipts</a>
      </footer>
    </main>
  );
}

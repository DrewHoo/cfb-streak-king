import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { P, teams, activeBoard, allTimeBoard, edgeFor as edgeForDefinition, todayEpochDay, builtEpochDay } from './lib/model.ts';
import { definitionPhrase } from './lib/sentence.ts';
import { encodeChips, decodeChips, withChip, swapChip, withoutChip, withParam } from './lib/definition.ts';
import { parseUrl, toUrl, teamUrl, gamesUrl, gameUrl, breakersUrl } from './lib/url.ts';
import { viewReducer, initialView, isOpen } from './lib/view.ts';
import { findGame, keyOf, keyString, seasonWeeks } from './lib/game.ts';
import { refsOf } from './lib/minedChips.ts';
import { dirWord, dayOf, rowKey } from './lib/format.ts';
import { track } from './lib/analytics.ts';
import { writeUrl, absoluteUrl } from './urlState.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { useDigests } from './hooks/useDigests.ts';
import { useSeason } from './hooks/useSeason.ts';
import { useBreakers } from './hooks/useBreakers.ts';
import { BreakersPage, BreakerPage } from './components/BreakersPage.jsx';
import { useStarred } from './hooks/useStarred.ts';
import { useShare } from './hooks/useShare.ts';
import { Dateline } from './components/Dateline.jsx';
import { Sentence } from './components/Sentence.jsx';
import { BaseRate } from './components/BaseRate.jsx';
import { Grid } from './components/Grid.jsx';
import { TeamPanel } from './components/TeamPanel.jsx';
import { TeamPage } from './components/TeamPage.jsx';
import { GamesPage, defaultWeek } from './components/GamesPage.jsx';
import { GamePage } from './components/GamePage.jsx';
import { Starred } from './components/Starred.jsx';
import { Notes, KOFI_URL } from './components/Notes.jsx';

const BASE = import.meta.env.BASE_URL;

// `initial` seeds state the prerender and the hydrate must agree on (the
// data keys are not the view's: `crowns`, `seasonRows`, `digests`, `breaks`): a
// per-team page (/team/<id>/) starts on that team's page with its crowns
// ({ active, all }) already loaded; a game page (/game/<date>/<teams>/) on
// that game with its season's rows; /games/ starts on the schedule, and
// /games/week/<n>/ on that week.
export default function App({ initial } = {}) {
  const [view, dispatch] = useReducer(viewReducer, initial, (i) => initialView(i?.page ?? null, !!i?.games, i?.bwk ?? null, !!i?.risk, i?.game ?? null, i?.season ?? null, !!i?.breakers, i?.breaker ?? null));
  const { active, dir, scope, week, team, run, limit, page, game, games, bwk, season, risk, breakers, breaker } = view;
  const [todayEp, setTodayEp] = useState(builtEpochDay);
  const [addOpen, setAddOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // the schedule's digests: embedded on a games page, loaded when the schedule opens from the board
  const digests = useDigests(games, initial);
  // the open game, and its season's rows (what each game ended, who it made a
  // leader); the schedule's selected season likewise. A page's embedded slice
  // serves until a page needs a game it lacks (another week's, after a click)
  const found = useMemo(() => (game ? findGame(game) : null), [game]);
  const gameSeason = found ? (found.played ? found.played.sides[0].row.se : P.currentSeason) : games ? season ?? P.currentSeason : null;
  const need = useMemo(() => {
    if (game) return [keyString(game)];
    if (!games) return [];
    const se = season ?? P.currentSeason;
    const weeks = seasonWeeks(se);
    const wk = bwk ?? defaultWeek(se, weeks);
    return (weeks.find((w) => w.wk === wk)?.games ?? []).map((g) => keyString(g.key));
  }, [game, games, season, bwk]);
  const seasonRows = useSeason(gameSeason, need, initial);
  // the season's streak-breakers: all of them on the leaderboard, a team page's own rows on it
  const breaks = useBreakers(breaker != null ? [breaker] : breakers ? 'all' : page != null ? [page] : [], initial);
  // a team page opened from the breakers leaderboard scrolls to its breaks
  const [teamFocus, setTeamFocus] = useState(null);
  const star = useStarred(active, dir);
  const { copied, share } = useShare();
  const isMobile = useIsMobile();

  // URL -> state, after mount only: the prerender has no window. Back and
  // Forward load the entry's URL the same way, at the scroll it was left at.
  useEffect(() => {
    const load = () => parseUrl(window.location.pathname, window.location.search);
    const v = load();
    dispatch({ type: 'load', view: v });
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

  // state -> URL. A change of definition replaces the entry. Opening a
  // streak, or moving to a team page, a game page or back to the board,
  // pushes one, remembering the URL underneath so closing can be a step
  // back. (The analytics embed counts each as a pageview.)
  const last = useRef(null);
  useEffect(() => {
    if (!hydrated) return;
    const was = last.current;
    last.current = view;
    const { path, params } = toUrl(view);
    const moved = !!was && (was.page !== page || was.game !== game || was.games !== games || was.bwk !== bwk || was.season !== season || was.risk !== risk || was.breakers !== breakers || was.breaker !== breaker);
    const opened = !!was && (page == null && game == null && team != null && was.team == null);
    const pushed = writeUrl(BASE, path, params, moved || opened ? { under: window.location.href } : null);
    // a move between the schedule's own sections keeps its place (the at-risk section scrolls itself into view)
    if (pushed && moved && !(was.games && games)) window.scrollTo(0, 0);
    if (page == null && game == null && !games) track('definition', { chips: encodeChips(active) || 'overall', dir, scope });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dir, scope, week, team, run, page, game, games, bwk, season, risk, breakers, breaker, hydrated]);

  // Closing a panel: step back when that lands exactly on what's
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
    track('team open', { team: teams[row.ti].id, scope, len: row.s.len });
    dispatch({ type: 'pick', row });
  }
  function openTeam(ti, from) {
    track('team page', { team: teams[ti].id, from });
    setTeamFocus(from === 'breakers' ? 'breaks' : null);
    dispatch({ type: 'page', team: ti });
  }
  function openBreakers(from) {
    track('breakers', { from });
    dispatch({ type: 'breakers' });
  }
  // one team's broken streaks, their own address
  function openBreaker(ti, from) {
    track('breakers', { from, team: teams[ti].id });
    dispatch({ type: 'breakers', team: ti });
  }
  function shareBreaker(ti) {
    track('share', { breakers: true, team: teams[ti].id });
    share(`The streaks ${teams[ti].name} broke this season`, absoluteUrl(BASE, breakersUrl(ti)));
  }
  function shareBreakers() {
    track('share', { breakers: true });
    share(`Top Streak-Breakers: the college football teams that broke the most streaks this season`, absoluteUrl(BASE, breakersUrl()));
  }
  // a game's page, from a row that describes it from one team's side
  function openGame(ti, g, from) {
    track('game', { team: teams[ti].id, opp: teams[g.oppIdx]?.id, from });
    dispatch({ type: 'game', key: keyOf(ti, g) });
  }
  function openGameKey(key, from) {
    track('game', { team: teams[key.home].id, opp: teams[key.away].id, from });
    dispatch({ type: 'game', key });
  }
  // one streak — a crown, a row of a team's list, or a broken run: its board,
  // with that team open. A mined key decodes to its chip and choice; a
  // broken run names its all-time row.
  function openStreak(s, ti, from) {
    const chips = refsOf(s.chips);
    dispatch({ type: 'streak', chips, dir: s.dir, scope: s.scope ?? 'active', team: ti, run: s.run ?? null });
    track('lead apply', { chips: s.chips.join(',') || 'overall', dir: s.dir, scope: s.scope ?? 'active', len: s.len, from });
  }
  // a broken run's "now the all-time longest": its definition's all-time board, no team open
  function openAllTime(b, from) {
    openStreak({ ...b, scope: 'all', run: null }, null, from);
  }
  function applyStarred(f) {
    define(decodeChips(f.c), f.dir);
    track('apply saved streak', { chips: f.c || 'overall', dir: f.dir });
  }
  function shareView(sentence) {
    const text = sentence || `Longest ${scope === 'all' ? 'all-time' : 'active'} ${dirWord(dir)} streaks in ${definitionPhrase(active, dir)}`;
    track('share', { chips: encodeChips(active) || 'overall', dir, team: team != null ? teams[team].id : null });
    share(text, window.location.href);
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
  // a schedule section's own address: the URL moves to it, and the share sheet (or the clipboard) gets it
  function linkSection(kind, wk) {
    if (kind === 'risk') dispatch({ type: 'risk' }); else dispatch({ type: 'bweek', wk });
    track('share', { games: true, section: kind, wk });
    share(kind === 'risk' ? `Week ${wk}'s college football streaks most at risk` : `The college football streaks broken in Week ${wk}`, absoluteUrl(BASE, gamesUrl(kind === 'risk' ? null : wk, kind === 'risk')));
  }
  function shareGame(key) {
    track('share', { game: true, team: teams[key.home].id, opp: teams[key.away].id });
    const played = !!found?.played;
    share(`${teams[key.away].name} ${key.neutral ? 'vs' : 'at'} ${teams[key.home].name}: ${played ? 'the streaks it ended' : 'every streak on the line'}`, absoluteUrl(BASE, gameUrl(key)));
  }

  const panel = team != null && (
    <TeamPanel
      ti={team} row={teamRow} rank={teamRow ? rows.indexOf(teamRow) + 1 : 0} field={rows.length}
      active={active} dir={dir} scope={scope} edge={edgeFor(team)}
      onShare={shareView} onClose={() => close({ type: 'close' })}
      onTeam={(ti) => openTeam(ti, 'panel')} onGame={(ti, g) => openGame(ti, g, 'panel')}
    />
  );

  return (
    <main>
      {page != null ? (
        <TeamPage
          ti={page} todayEp={todayEp} initial={initial} breakers={breaks} focus={teamFocus} isMobile={isMobile} copied={copied}
          on={{
            board: () => dispatch({ type: 'board' }),
            team: (ti) => openTeam(ti, 'picker'),
            breakers: () => openBreakers('team page'),
            breaker: (ti) => openBreaker(ti, 'team page'),
            game: (ti, g) => openGame(ti, g, 'team page'),
            streak: (s, ti) => openStreak(s, ti, 'team page'),
            allTime: (b) => openAllTime(b, 'team page all-time'),
            share: shareTeam,
          }}
        />
      ) : game != null ? (
        <GamePage
          found={found} season={seasonRows} todayEp={todayEp} isMobile={isMobile} copied={copied}
          on={{
            board: () => dispatch({ type: 'board' }),
            team: (ti) => openTeam(ti, 'game'),
            streak: (s, ti) => openStreak(s, ti, 'game'),
            week: (se, wk) => { dispatch({ type: 'bweek', wk, season: se === P.currentSeason ? null : se }); track('games', { from: 'game' }); },
            share: shareGame,
          }}
        />
      ) : breaker != null ? (
        <BreakerPage
          ti={breaker} breakers={breaks} copied={copied}
          on={{ breakers: () => openBreakers('breaker'), team: (ti) => openTeam(ti, 'breaker'), streak: (s, ti) => openStreak(s, ti, 'breaker'), allTime: (b) => openAllTime(b, 'breaker all-time'), share: shareBreaker }}
        />
      ) : breakers ? (
        <BreakersPage
          breakers={breaks} copied={copied}
          on={{ board: () => dispatch({ type: 'board' }), breaker: (ti) => openBreaker(ti, 'breakers'), share: shareBreakers }}
        />
      ) : games ? (
        <GamesPage
          digests={digests} seasonRows={seasonRows} season={season ?? P.currentSeason} bwk={bwk} risk={risk} copied={copied}
          on={{
            board: () => dispatch({ type: 'board' }),
            game: (key) => openGameKey(key, 'games'),
            streak: (b) => openStreak(b, b.ti, 'broken'),
            allTime: (b) => openAllTime(b, 'broken all-time'),
            week: (wk) => { dispatch({ type: 'bweek', wk, season }); track('broken week', { wk, season }); },
            year: (se) => { dispatch({ type: 'bweek', wk: null, season: se === P.currentSeason ? null : se }); track('games year', { season: se }); },
            link: linkSection,
            share: shareGames,
          }}
        />
      ) : (
        <>
          <Dateline isStarred={star.isStarred} onStar={star.toggle} onShare={() => shareView()} copied={copied} onTeam={(ti) => openTeam(ti, 'find')} onGames={openGames} onBreakers={() => openBreakers('board')} isMobile={isMobile} />
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

      <Notes />

      <footer>
        <a href="https://drewhoover.com/">drewhoover.com</a> · data rebuilt weekly in season ·{' '}
        <a href="https://github.com/DrewHoo/cfb-streak-king">source & receipts</a> ·{' '}
        <a href={KOFI_URL} onClick={() => track('kofi', { from: 'footer' })}>buy me a coffee</a>
      </footer>
    </main>
  );
}

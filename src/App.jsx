import { useEffect, useMemo, useReducer, useState } from 'react';
import { teams, activeBoard, allTimeBoard, edgeFor as edgeForDefinition, todayEpochDay, builtEpochDay } from './lib/model.ts';
import { definitionPhrase, crownClaim } from './lib/sentence.ts';
import { encodeChips, decodeChips, presetLeaders, withChip, swapChip, withoutChip, withParam } from './lib/definition.ts';
import { parseUrl, toUrl, crownUrl } from './lib/url.ts';
import { viewReducer, initialView, isOpen } from './lib/view.ts';
import { dirWord, dayOf, rowKey } from './lib/format.ts';
import { track } from './lib/analytics.ts';
import { writeUrl, absoluteUrl } from './urlState.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { useCrowns } from './hooks/useCrowns.ts';
import { useStarred } from './hooks/useStarred.ts';
import { useShare } from './hooks/useShare.ts';
import { Dateline } from './components/Dateline.jsx';
import { Sentence } from './components/Sentence.jsx';
import { Grid } from './components/Grid.jsx';
import { TeamPanel } from './components/TeamPanel.jsx';
import { Starred } from './components/Starred.jsx';
import { Notes } from './components/Notes.jsx';

const BASE = import.meta.env.BASE_URL;

// `initial` seeds state the prerender and the hydrate must agree on: a
// per-team page (/team/<id>/) opens with that team's panel already open and
// its crowns ({ active, all }) already loaded.
export default function App({ initial } = {}) {
  const [view, dispatch] = useReducer(viewReducer, initial?.team ?? null, initialView);
  const { active, dir, scope, week, team, run, limit } = view;
  const [todayEp, setTodayEp] = useState(builtEpochDay);
  const [addOpen, setAddOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const crowns = useCrowns(team, initial);
  const star = useStarred(active, dir);
  const { copied, share } = useShare();
  const isMobile = useIsMobile();

  // URL -> state, after mount only: the prerender has no window
  useEffect(() => {
    const v = parseUrl(window.location.pathname, window.location.search);
    dispatch({ type: 'load', view: v });
    crowns.followDir(v.dir);
    setTodayEp(todayEpochDay());
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // state -> URL, one replaceState per change (the analytics embed counts each as a pageview)
  useEffect(() => {
    if (!hydrated) return;
    const { path, params } = toUrl(view);
    writeUrl(BASE, path, params);
    track('definition', { chips: encodeChips(active) || 'overall', dir, scope });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dir, scope, week, team, run, hydrated]);

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
  const startFrom = useMemo(() => (addOpen ? presetLeaders(todayEp) : []), [addOpen, todayEp]);

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
    start: (e) => { dispatch({ type: 'preset', active: e.chips, dir: e.dir, scope: e.scope }); track('preset', { name: e.name }); },
  };
  function pickRow(row) {
    if (!isOpen(view, row)) {
      crowns.followDir(dir);
      track('team open', { team: teams[row.ti].id, scope, len: row.s.len });
    }
    dispatch({ type: 'pick', row });
  }
  function applyCrown(cr) {
    dispatch({ type: 'crown', crown: cr });
    track('lead apply', { chips: cr.chips.join(',') || 'overall', dir: cr.dir, scope: cr.scope, len: cr.len });
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
  // one streak a team is king of: its sentence and its team page with that definition
  function shareCrown(cr) {
    track('share', { chips: cr.chips.join(',') || 'overall', dir: cr.dir, team: teams[team].id });
    share(crownClaim(team, cr), absoluteUrl(BASE, crownUrl(team, cr)));
  }

  const panel = team != null && (
    <TeamPanel
      ti={team} row={teamRow} rank={teamRow ? rows.indexOf(teamRow) + 1 : 0} field={rows.length}
      active={active} dir={dir} scope={scope} edge={edgeFor(team)} crowns={crowns.crowns}
      crownsScope={crowns.scope} crownsDir={crowns.dir} onCrownsScope={crowns.onScope} onCrownsDir={crowns.onDir}
      onShare={shareView} onShareCrown={shareCrown} onClose={() => dispatch({ type: 'close' })} onApplyCrown={applyCrown}
    />
  );

  return (
    <main>
      <Dateline isStarred={star.isStarred} onStar={star.toggle} onShare={() => shareView()} copied={copied} />
      <h1>Streak King</h1>

      <Sentence
        active={active} dir={dir} scope={scope} week={week} weekCount={weekCount} weekDay={weekDay}
        startFrom={startFrom} isMobile={isMobile} addOpen={addOpen} setAddOpen={setAddOpen} on={on}
      />

      <Grid
        rows={shown} curTeam={team} openKey={teamRow ? rowKey(teamRow) : null} onPick={pickRow} edgeFor={edgeFor} isMobile={isMobile}
        limit={limit} setLimit={(l) => dispatch({ type: 'limit', limit: l })} week={week} scope={scope} dir={dir} panel={panel}
      />

      <Starred starred={star.starred} todayEp={todayEp} onApply={applyStarred} onRemove={star.remove} />

      <Notes />

      <footer>
        <a href="https://drewhoover.com/">drewhoover.com</a> · data rebuilt weekly in season ·{' '}
        <a href="https://github.com/DrewHoo/cfb-streak-king">source & receipts</a>
      </footer>
    </main>
  );
}

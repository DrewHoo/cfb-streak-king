import { useEffect, useMemo, useState } from 'react';
import {
  P, teams, confs, CHIPS, chipByKey, board, thisWeek,
  gamesOf, fmtDate, todayEpochDay, fbsNow,
} from './lib/model.js';
import { crownsFor, mineAll, isMined, LEN_FLOOR, FIELD_FLOOR } from './lib/crowns.js';
import { readParam, writeParam } from './urlState.js';

const BASE = import.meta.env.BASE_URL;

const PRESETS = [
  { name: 'The Saban Standard', chips: [{ key: 'unranked' }], dir: 'W' },
  { name: 'Ranked Futility', chips: [{ key: 'ranked' }], dir: 'L' },
  { name: 'Road Kill', chips: [{ key: 'road' }, { key: 'confgame' }], dir: 'L' },
  { name: 'Saturday Night Lights', chips: [{ key: 'home' }, { key: 'night' }], dir: 'W' },
  { name: 'Never Twice', chips: [{ key: 'afterloss' }], dir: 'W' },
  { name: 'Opening Day', chips: [{ key: 'opener' }], dir: 'W' },
  { name: 'Kings of the State', chips: [{ key: 'instate' }], dir: 'W' },
  { name: 'Giant Killers', chips: [{ key: 'dog' }], dir: 'W' },
  { name: 'Chalk', chips: [{ key: 'fav' }], dir: 'L' },
  { name: 'Bowl Curse', chips: [{ key: 'postseason' }], dir: 'L' },
];

const GROUPS = ['site', 'opp rank', 'own rank', 'betting', 'conference', 'opponent', 'coach', 'calendar', 'context', 'shape', 'half', 'possession', 'kickoff'];
const MONTHS = [[9, 'September'], [10, 'October'], [11, 'November'], [12, 'December'], [1, 'January']];
const HMARGINS = [[1, 'by any'], [3, 'by 3+'], [7, 'by 7+'], [10, 'by 10+'], [14, 'by 14+']];
const STATE_OPTIONS = [...P.states].filter(Boolean).sort();
const CONF_OPTIONS = ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 'Big East', 'American', 'Mountain West', 'C-USA', 'MAC', 'Sun Belt', 'WAC', 'Big 8', 'SWC', 'Big West', 'Independent'];

const fbsEver = teams
  .map((t, i) => ({ t, i }))
  .filter(({ t }) => t.fbs)
  .sort((a, b) => a.t.name.localeCompare(b.t.name));
const fbsCurrent = [...fbsNow]
  .map((i) => ({ t: teams[i], i }))
  .sort((a, b) => a.t.name.localeCompare(b.t.name));

const builtEp = Math.floor(Date.parse(P.builtAt) / 86400000);

const track = (name, props) => {
  try { window.dhAnalytics?.track(name, props); } catch {}
};

// saved streaks live in localStorage until accounts exist (specs/accounts.spec.md)
const FAV_KEY = 'sk-favs';
const readFavs = () => {
  try {
    const f = JSON.parse(localStorage.getItem(FAV_KEY));
    return Array.isArray(f) ? f : [];
  } catch { return []; }
};
const writeFavs = (f) => {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch {}
};

function encodeChips(active) {
  return active.map(({ key, param }) => (param != null ? `${key}:${param}` : key)).join(',');
}
function decodeChips(s) {
  if (!s) return [];
  const out = [];
  for (const part of s.split(',')) {
    const [key, ...rest] = part.split(':');
    const c = chipByKey.get(key);
    if (!c) continue;
    let param = rest.length ? rest.join(':') : undefined;
    if (c.param === 'month' || c.param === 'hmargin') param = Number(param);
    if (c.param === 'team') param = teams.findIndex((t) => t.id === param);
    if (c.param && (param == null || param === -1 || Number.isNaN(param))) continue;
    out.push(c.param ? { key, param } : { key });
  }
  return out.slice(0, 4);
}

const dirWord = (dir) => (dir === 'W' ? 'winning' : 'losing');
const oppWord = (dir) => (dir === 'W' ? 'loss' : 'win');

function chipPhrase({ key, param }) {
  const c = chipByKey.get(key);
  if (key === 'road') return 'hostile territory'; // reads as "in hostile territory + …"
  if (key === 'vsteam') return `vs ${teams[param]?.name ?? '?'}`;
  if (key === 'state') return `in ${param}`;
  if (key === 'vsconf') return `vs the ${param}`;
  if (key === 'month') return `in ${MONTHS.find(([n]) => n === param)?.[1] ?? param}`;
  if (key === 'leadhalf') return param > 1 ? `leading at half by ${param}+` : 'leading at half';
  if (key === 'trailhalf') return param > 1 ? `trailing at half by ${param}+` : 'trailing at half';
  return c.label;
}

function siteWord(x) {
  return x.neutral ? 'vs' : x.home ? 'vs' : 'at';
}

const siteMark = (x) => (x.neutral ? 'N' : x.home ? '' : '@');
const yearOf = (ep) => new Date(ep * 86400000).getUTCFullYear();
const shortDate = (ep) => {
  const d = new Date(ep * 86400000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}`;
};

/** The hostile-territory square: cream + ink mark for a win, dark + dim mark
 *  for a loss, dashed for a tie. Opponents without a mark get their initial. */
function Chip({ g }) {
  const t = teams[g.oppIdx];
  const cls = g.r === 'W' ? 'sq w' : g.r === 'L' ? 'sq l' : 'sq t';
  const name = t?.name ?? '?';
  return (
    <span className={cls} title={`${siteWord(g)} ${name} ${g.us}–${g.them}, ${yearOf(g.ep)}`}>
      {t?.espn ? <img src={`${BASE}logos/${t.espn}.png`} alt={name} loading="lazy" /> : <b>{name[0]}</b>}
    </span>
  );
}

const CHIP_CAP = 12;
const DESKTOP_CAP = 24;

// what a chip's data floor covers, for the window-edge message
const FLOOR_WORDS = {
  night: 'night-game',
  leadhalf: 'halftime-score',
  trailhalf: 'halftime-score',
  wonpos: 'possession',
  dompos: 'possession',
};

// data-coverage notes, surfaced as a popover on the picker group label
const GROUP_NOTES = {
  betting: 'Closing lines cover 1978–2025 plus this season. Games without a line don’t qualify.',
  coach: 'Head-coach tenures from CollegeFootballData, with mid-season changes resolved to the exact game. Games against teams without coach data (mostly FCS) don’t qualify under the vs chip.',
  half: 'Halftime scores are known from 2001 and solid from 2003. Earlier games can’t qualify.',
  possession: 'Time of possession is known from 2004. Earlier games can’t qualify.',
  kickoff: 'Kickoff times are known from 2002 and solid from 2014. Earlier games can’t qualify as night games.',
};

function ColumnCollapsed({ row, onOpen, edge }) {
  const t = teams[row.ti];
  const streak = [...row.qual.slice(-row.s.len)].reverse();
  const shown = streak.slice(0, CHIP_CAP);
  const more = row.s.len - shown.length;
  return (
    <button className="colbtn" onClick={onOpen} aria-label={`${t.name}: ${row.s.len} straight`}>
      <span className={'colcount' + (row.onTheLine ? ' is-otl' : '')}>
        {row.s.len}{row.s.atEdge ? '+' : ''}
      </span>
      <img className="colteam" src={`${BASE}logos-color/${t.espn}.png`} alt={t.name} loading="lazy" />
      {shown.map((g) => <Chip key={g.i} g={g} />)}
      {more > 0 && <span className="colmore">+{more}</span>}
      {row.s.atEdge
        ? <span className="coledge">’{String(edge.year).slice(2)}</span>
        : (
          <span className="colender">
            <Chip g={row.s.ender} />
            <span className="colyr">’{String(yearOf(row.s.ender.ep)).slice(2)}</span>
          </span>
        )}
    </button>
  );
}

function ColumnExpanded({ row, dir, onClose, edge }) {
  const t = teams[row.ti];
  const rows = [...row.qual.slice(-row.s.len)].reverse();
  if (!row.s.atEdge) rows.push(row.s.ender);
  const nxt = row.onTheLine ? row.next : null;
  const nxtTeam = nxt ? teams[nxt.oppIdx] : null;
  const kick = nxt && nxt.hh !== 31 ? `${nxt.hh % 12 || 12}${nxt.hh >= 12 ? 'pm' : 'am'}` : '';
  return (
    <div className="xcol">
      <div className="xcol-head">
        <span className={'colcount' + (row.onTheLine ? ' is-otl' : '')}>{row.s.len}{row.s.atEdge ? '+' : ''}</span>
        <img className="colteam" src={`${BASE}logos-color/${t.espn}.png`} alt="" />
        <div className="xcol-id">
          <span className="xcol-name">{t.name}</span>
          {row.onTheLine && <span className="otl-tag">on the line</span>}
        </div>
        <button className="xcol-x" onClick={onClose} aria-label="collapse">×</button>
      </div>
      {nxt && (
        <div className="xrow next-row">
          <span className="sq p" title={`next: ${siteWord(nxt)} ${nxtTeam?.name}`}>
            {nxtTeam?.espn ? <img src={`${BASE}logos/${nxtTeam.espn}.png`} alt={nxtTeam?.name} /> : <b>{nxtTeam?.name?.[0]}</b>}
          </span>
          <span className="xd">{shortDate(nxt.ep)}</span>
          <span className="xown">{nxt.ownRank > 0 ? `#${nxt.ownRank}` : ''}</span>
          <span className={'xsite' + (siteMark(nxt) === 'N' ? ' n' : '')}>{siteMark(nxt)}</span>
          <span className="xopp">{nxt.oppRank > 0 ? `#${nxt.oppRank}` : ''}</span>
          <span className="xnext">{kick || 'next'}</span>
        </div>
      )}
      {rows.map((g) => (
        <div key={g.i + '-' + g.ep} className={'xrow' + (g.r !== dir ? ' ender-row' : '')}>
          <Chip g={g} />
          <span className="xd">{shortDate(g.ep)}</span>
          <span className="xown">{g.ownRank > 0 ? `#${g.ownRank}` : ''}</span>
          <span className={'xsite' + (siteMark(g) === 'N' ? ' n' : '')}>{siteMark(g)}</span>
          <span className="xopp">{g.oppRank > 0 ? `#${g.oppRank}` : ''}</span>
          <span className={'xsc' + (g.r === 'W' ? ' w' : '')}>
            {g.r !== dir ? g.r + ' ' : ''}{String(g.us).padStart(2, ' ')}–{String(g.them).padEnd(2, ' ')}
          </span>
        </div>
      ))}
      {row.s.atEdge && (
        <div className="log-note">
          {edge.word
            ? `earliest ${edge.word} data is ${edge.year}; this streak may be longer than we can show`
            : 'runs past the start of the data (1978)'}
        </div>
      )}
    </div>
  );
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

export default function App() {
  const [active, setActive] = useState([]);
  const [dir, setDir] = useState('W');
  const [todayEp, setTodayEp] = useState(builtEp);
  const [showAll, setShowAll] = useState(false);
  const [noteOpen, setNoteOpen] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [view, setView] = useState('board');
  const [crownTi, setCrownTi] = useState(null);
  const [crownsAll, setCrownsAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [favs, setFavs] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setTodayEp(todayEpochDay());
    const c = decodeChips(readParam('c'));
    if (c.length) setActive(c);
    const d = readParam('dir');
    if (d === 'L') setDir('L');
    setFavs(readFavs());
    const v = readParam('view');
    if (v === 'crowns' || v === 'curses') {
      const tid = readParam('team');
      const ti = teams.findIndex((t) => t.id === tid);
      setCrownTi(ti >= 0 && fbsNow.has(ti) ? ti : null);
      setView(v);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeParam('c', encodeChips(active) || null);
    writeParam('dir', dir === 'W' ? null : dir);
    writeParam('sort', null); // scrub the retired sort param from old links
    track('definition', { chips: encodeChips(active) || 'overall', dir });
  }, [active, dir, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeParam('view', view === 'board' ? null : view);
    writeParam('team', view !== 'board' && crownTi != null ? teams[crownTi].id : null);
  }, [view, crownTi, hydrated]);

  const rows = useMemo(() => board(active, dir, 'games', todayEp), [active, dir, todayEp]);
  const week = useMemo(() => thisWeek(active, dir, todayEp), [active, dir, todayEp]);
  // the window edge an at-edge streak actually hit: the latest data floor
  // among active chips (night 2002, halftime 2001, possession 2004), else 1978
  const edge = useMemo(() => {
    let year = 1978;
    let word = null;
    for (const a of active) {
      const c = chipByKey.get(a.key);
      if (c.floor && c.floor > year) { year = c.floor; word = FLOOR_WORDS[a.key] ?? c.label; }
    }
    return { year, word };
  }, [active]);
  // current leader of each saved streak, for the little crest on its entry
  const favLeaders = useMemo(
    () => favs.map((f) => {
      const b = board(decodeChips(f.c), f.dir, 'games', todayEp);
      return b.length ? teams[b[0].ti] : null;
    }),
    [favs, todayEp],
  );

  const isOn = (key) => active.some((a) => a.key === key);
  const full = active.length >= 4;

  function toggle(key) {
    setExpanded(null);
    setActive((cur) => {
      if (cur.some((a) => a.key === key)) return cur.filter((a) => a.key !== key);
      if (cur.length >= 4) return cur;
      const c = chipByKey.get(key);
      const withoutGroupX = c.x ? cur.filter((a) => !(chipByKey.get(a.key).x && chipByKey.get(a.key).group === c.group)) : cur;
      if (withoutGroupX.length >= 4) return cur;
      const def = c.param === 'month' ? 11 : c.param === 'conf' ? 'SEC' : c.param === 'state' ? 'TX' : c.param === 'hmargin' ? 1 : c.param === 'team'
        ? teams.findIndex((t) => t.id === 'alabama') : undefined;
      return [...withoutGroupX, c.param ? { key, param: def } : { key }];
    });
  }
  function remove(key) {
    setExpanded(null);
    setActive((cur) => cur.filter((a) => a.key !== key));
  }
  function setParam(key, param) {
    setActive((cur) => cur.map((a) => (a.key === key ? { ...a, param } : a)));
  }
  function applyPreset(p) {
    setExpanded(null);
    setActive(p.chips);
    setDir(p.dir);
    track('preset', { name: p.name });
  }
  const defC = encodeChips(active);
  const isSaved = favs.some((f) => f.c === defC && f.dir === dir);
  function toggleFav() {
    setFavs((cur) => {
      const next = cur.some((f) => f.c === defC && f.dir === dir)
        ? cur.filter((f) => !(f.c === defC && f.dir === dir))
        : [...cur, { c: defC, dir, name: `${dirWord(dir)} · ${active.map(chipPhrase).join(' + ') || 'all games'}` }];
      writeFavs(next);
      return next;
    });
    if (!isSaved) track('save streak', { chips: defC || 'overall', dir });
  }
  function applyFav(f) {
    setExpanded(null);
    setActive(decodeChips(f.c));
    setDir(f.dir);
    track('apply saved streak', { chips: f.c || 'overall', dir: f.dir });
  }
  function removeFav(f) {
    setFavs((cur) => {
      const next = cur.filter((x) => !(x.c === f.c && x.dir === f.dir));
      writeFavs(next);
      return next;
    });
  }
  const minedView = view === 'crowns' || view === 'curses';
  const [mined, setMined] = useState(false);
  useEffect(() => {
    if (!minedView || mined) return;
    if (isMined()) { setMined(true); return; }
    let live = true;
    mineAll().then(() => { if (live) setMined(true); });
    return () => { live = false; };
  }, [minedView, mined]);
  const crowns = useMemo(
    () => (minedView && mined && crownTi != null ? crownsFor(crownTi) : null),
    [minedView, mined, crownTi],
  );
  function openMined(which) {
    setCrownTi((cur) => cur ?? rows[0]?.ti ?? fbsCurrent[0].i);
    setCrownsAll(false);
    setView(which);
    track(which + ' view', {});
  }
  function applyCrown(cr) {
    setActive(cr.chips.map((key) => ({ key })));
    setDir(cr.dir);
    setView('board');
    setExpanded(crownTi);
    track('crown apply', { chips: cr.chips.join(',') || 'overall', dir: cr.dir, len: cr.len });
  }
  function share() {
    try {
      navigator.clipboard.writeText(window.location.href).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      });
    } catch {}
  }

  return (
    <main>
      <p className="dateline">drewhoover.com · 1978–{P.currentSeason} · updated {String(P.builtAt).slice(0, 10)}</p>
      <h1>Streak King</h1>
      <p className="sub">
        Design a streak definition with up to four constraints, and see which of the 136 FBS teams owns the
        longest active run under it.
      </p>

      <div className="defbar">
        <span className="defbar-lead">
          Longest active <b>{dirWord(dir)}</b> streaks in
        </span>
        {active.length === 0 && <span className="defbar-all">all games</span>}
        {active.map((a) => {
          const c = chipByKey.get(a.key);
          return (
            <span className="pill" key={a.key}>
              <span className="pill-label">{chipPhrase(a)}</span>
              {c.param === 'team' && (
                <select
                  value={a.param}
                  onChange={(e) => setParam(a.key, Number(e.target.value))}
                  aria-label="opponent team"
                >
                  {fbsEver.map(({ t, i }) => (
                    <option key={t.id} value={i}>{t.name}</option>
                  ))}
                </select>
              )}
              {c.param === 'conf' && (
                <select
                  value={a.param}
                  onChange={(e) => setParam(a.key, e.target.value)}
                  aria-label="opponent conference"
                >
                  {CONF_OPTIONS.filter((o) => confs.includes(o)).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}
              {c.param === 'state' && (
                <select
                  value={a.param}
                  onChange={(e) => setParam(a.key, e.target.value)}
                  aria-label="state"
                >
                  {STATE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}
              {c.param === 'month' && (
                <select
                  value={a.param}
                  onChange={(e) => setParam(a.key, Number(e.target.value))}
                  aria-label="month"
                >
                  {MONTHS.map(([n, name]) => (
                    <option key={n} value={n}>{name}</option>
                  ))}
                </select>
              )}
              {c.param === 'hmargin' && (
                <select
                  value={a.param}
                  onChange={(e) => setParam(a.key, Number(e.target.value))}
                  aria-label="halftime margin"
                >
                  {HMARGINS.map(([n, name]) => (
                    <option key={n} value={n}>{name}</option>
                  ))}
                </select>
              )}
              <button className="pill-x" onClick={() => remove(a.key)} aria-label={`remove ${chipPhrase(a)}`}>×</button>
            </span>
          );
        })}
        {(active.length < 4 || pickerOpen) && (
          <button
            className={'addbtn' + (pickerOpen ? ' open' : '')}
            onClick={() => setPickerOpen((o) => !o)}
            aria-expanded={pickerOpen}
          >
            {pickerOpen ? 'done' : '+ constraint'}
          </button>
        )}
        {active.length >= 4 && !pickerOpen && <span className="defbar-cap">4 of 4</span>}
      </div>

      <div className="controls">
        <span className="toggle" role="group" aria-label="streak direction">
          <button className={dir === 'W' ? 'on' : ''} onClick={() => setDir('W')}>WIN STREAKS</button>
          <button className={dir === 'L' ? 'on' : ''} onClick={() => setDir('L')}>LOSING STREAKS</button>
        </span>
        <button className={'sharebtn' + (isSaved ? ' saved' : '')} onClick={toggleFav} aria-pressed={isSaved}>
          {isSaved ? '★ SAVED' : '☆ SAVE'}
        </button>
        <button className="sharebtn" onClick={share}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12.5" cy="3" r="2" /><circle cx="3.5" cy="8" r="2" /><circle cx="12.5" cy="13" r="2" />
            <path d="M5.3 7l5.4-3M5.3 9l5.4 3" />
          </svg>
          {copied ? 'COPIED ✓' : 'SHARE THIS BOARD'}
        </button>
      </div>

      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => applyPreset(p)}>{p.name}</button>
        ))}
      </div>

      {favs.length > 0 && (
        <div className="favs">
          <span className="favs-lead">your streaks</span>
          {favs.map((f, i) => (
            <span className="fav" key={(f.c || 'all') + f.dir}>
              <button className="fav-apply" onClick={() => applyFav(f)}>
                {favLeaders[i]?.espn && (
                  <img className="fav-ico" src={`${BASE}logos-color/${favLeaders[i].espn}.png`} alt="" loading="lazy" />
                )}
                {f.name}
              </button>
              <button className="fav-x" onClick={() => removeFav(f)} aria-label={`remove ${f.name}`}>×</button>
            </span>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div className="picker">
          {GROUPS.map((grp) => (
            <div className="pick-row" key={grp}>
              <span className="grp">
                {grp}
                {GROUP_NOTES[grp] && (
                  <button
                    className={'grp-i' + (noteOpen === grp ? ' on' : '')}
                    onClick={() => setNoteOpen((n) => (n === grp ? null : grp))}
                    aria-label={`about ${grp} data`}
                    aria-expanded={noteOpen === grp}
                  >ⓘ</button>
                )}
              </span>
              {noteOpen === grp && <span className="grp-note">{GROUP_NOTES[grp]}</span>}
              {CHIPS.filter((c) => c.group === grp).map((c) => (
                <button
                  key={c.key}
                  className={'chipbtn' + (isOn(c.key) ? ' on' : '')}
                  disabled={!isOn(c.key) && full}
                  onClick={() => toggle(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ))}
          <p className="pick-note">
            <span className="cap">{active.length} of 4 constraints.</span>
          </p>
          <div className="pick-done">
            <button onClick={() => setPickerOpen(false)}>done</button>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>The Board</button>
        <button className={view === 'crowns' ? 'on' : ''} onClick={() => openMined('crowns')}>Crowns</button>
        <button className={view === 'curses' ? 'on' : ''} onClick={() => openMined('curses')}>Curses</button>
      </div>

      {minedView && crownTi != null && (() => {
        const d = view === 'crowns' ? 'W' : 'L';
        const list = (crowns ?? []).filter((c) => c.dir === d);
        const shown = crownsAll ? list : list.slice(0, 12);
        return (
          <div className="crowns">
            <div className="crowns-head">
              {teams[crownTi].espn && <img className="colteam" src={`${BASE}logos-color/${teams[crownTi].espn}.png`} alt="" />}
              <select value={crownTi} onChange={(e) => { setCrownTi(Number(e.target.value)); setCrownsAll(false); }} aria-label="team">
                {fbsCurrent.map(({ t, i }) => <option key={t.id} value={i}>{t.name}</option>)}
              </select>
              <span className="crowns-note">
                {view === 'crowns'
                  ? 'active winning streaks this team solely leads'
                  : 'active losing streaks nobody else can match'} · length ≥ {LEN_FLOOR}, field ≥ {FIELD_FLOOR} teams
              </span>
            </div>
            {crowns === null && <p className="empty">Mining all 78,276 boards…</p>}
            {crowns !== null && (
              <div>
                <h3 className={'crown-h' + (d === 'L' ? ' l' : '')}>{list.length} {view}</h3>
                {list.length === 0 && <p className="empty">None under the current floors.</p>}
                {shown.map((cr) => (
                  <button className="crown" key={cr.dir + cr.chips.join()} onClick={() => applyCrown(cr)}>
                    <span className={'crown-len' + (d === 'L' ? ' l' : '')}>{cr.len}{cr.atEdge ? '+' : ''}</span>
                    <span className="crown-txt">
                      {cr.chips.length ? cr.chips.map((k) => chipPhrase({ key: k })).join(' · ') : 'all games'}
                    </span>
                    <span className="crown-meta">
                      field of {cr.field}{cr.startSe ? ` · since ${cr.startSe}` : ''}
                    </span>
                  </button>
                ))}
                {!crownsAll && list.length > 12 && (
                  <div className="showmore"><button onClick={() => setCrownsAll(true)}>show all {list.length}</button></div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {view === 'board' && <>
      {isMobile && rows.some((r) => r.ti === expanded) && (
        <ColumnExpanded
          row={rows.find((r) => r.ti === expanded)}
          dir={dir}
          edge={edge}
          onClose={() => setExpanded(null)}
        />
      )}
      <div className="colwrap">
        {rows.length === 0 && <p className="empty">No team currently holds a {dirWord(dir)} streak under this definition.</p>}
        {(isMobile || showAll ? rows : rows.slice(0, DESKTOP_CAP)).map((row) => {
          if (row.ti === expanded) {
            return isMobile ? null : (
              <ColumnExpanded key={teams[row.ti].id} row={row} dir={dir} edge={edge} onClose={() => setExpanded(null)} />
            );
          }
          return <ColumnCollapsed key={teams[row.ti].id} row={row} edge={edge} onOpen={() => setExpanded(row.ti)} />;
        })}
      </div>
      {!isMobile && rows.length > DESKTOP_CAP && (
        <div className="showmore">
          <button onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'show fewer' : `show all ${rows.length} teams`}
          </button>
        </div>
      )}

      <h2>This Week</h2>
      <p className="h2-note">Qualifying games in the next eight days with a streak at stake.</p>
      {week === null ? (
        <p className="empty">
          One of the active constraints (betting, game shape, or after-a-result) can't be known before
          kickoff, so upcoming games can't be matched to this definition.
        </p>
      ) : week.length === 0 ? (
        <p className="empty">No qualifying games in the next eight days.</p>
      ) : (
        <div>
          {week.slice(0, 24).map(({ ti, s, u }) => (
            <div className="tw-row" key={ti + '-' + u.ep}>
              <span className="d">{fmtDate(u.ep)}</span>
              <span className="m">
                <b>{teams[ti].name}</b> {u.home ? (u.neutral ? 'vs' : 'hosts') : u.neutral ? 'vs' : 'at'}{' '}
                {u.oppRank > 0 ? `#${u.oppRank} ` : ''}{teams[u.oppIdx]?.name}
                {u.hh !== 31 ? `, ${u.hh > 12 ? u.hh - 12 : u.hh}${u.hh >= 12 ? 'pm' : 'am'} local` : ''}
              </span>
              <span className={'at' + (dir === 'L' ? ' l' : '')}>{s.len}{s.atEdge ? '+' : ''}{dir} at stake</span>
            </div>
          ))}
        </div>
      )}

      </>}

      <h2>Method</h2>
      <div className="notes">
        <ul>
          <li>
            Window: 1978–{P.currentSeason}, the I-A/FBS era. {P.games.se.length.toLocaleString()} games. A streak
            that reaches 1978 shows as “N+”.
          </li>
          <li>
            A game qualifies when it matches every active constraint. Non-qualifying games neither extend nor
            break a streak — “hasn't lost to Auburn since 1998” stays alive through seasons they don't play.
            Ties (pre-1996) end streaks in both directions.
          </li>
          <li>
            Scores and sites 1978–2013 come from Warren Repole's Sunshine Forecast archive (recovered via the
            Wayback Machine), cross-checked against jhowell.net; 2014–present from cfbfastR/ESPN. AP ranks are
            the poll in effect at kickoff, from College Poll Archive. Spreads are closing lines: Repole
            1978–2013, per-book medians from cfbfastR 2014–2025.
          </li>
          <li>
            Off-campus home sites (Legion Field, War Memorial in Little Rock, and similar) count as home games
            via a versioned rulings file. Conference games use jhowell's per-game marks before 2009 and the
            source flag after.
          </li>
          <li>
            Famous streaks reproduce as build checks: Alabama's 100 straight over unranked teams, Kansas's
            46-game road skid, Vanderbilt's 26 straight SEC losses.
          </li>
          <li>
            Head-coach tenures come from CollegeFootballData; mid-season changes are placed at the exact game
            by matching each coach's record against the result sequence. Halftime scores (2001+) and time of
            possession (2004+) come from CFBD box data.
          </li>
          <li>
            The design space: the 34 parameterless chips compose into 39,138 distinct definitions — 78,276
            counting direction. The parameterized chips (opponent, conference, state, month, halftime margin)
            push that past 24 million.
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

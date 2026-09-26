import { useEffect, useMemo, useState } from 'react';
import {
  P, teams, confs, CHIPS, chipByKey, board, thisWeek,
  gamesOf, fmtDate, todayEpochDay,
} from './lib/model.js';
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

const GROUPS = ['site', 'opp rank', 'own rank', 'betting', 'conference', 'opponent', 'calendar', 'context', 'shape', 'kickoff'];
const MONTHS = [[9, 'September'], [10, 'October'], [11, 'November'], [12, 'December'], [1, 'January']];
const STATE_OPTIONS = [...P.states].filter(Boolean).sort();
const CONF_OPTIONS = ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 'Big East', 'American', 'Mountain West', 'C-USA', 'MAC', 'Sun Belt', 'WAC', 'Big 8', 'SWC', 'Big West', 'Independent'];

const fbsEver = teams
  .map((t, i) => ({ t, i }))
  .filter(({ t }) => t.fbs)
  .sort((a, b) => a.t.name.localeCompare(b.t.name));

const builtEp = Math.floor(Date.parse(P.builtAt) / 86400000);

const track = (name, props) => {
  try { window.dhAnalytics?.track(name, props); } catch {}
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
    if (c.param === 'month') param = Number(param);
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
  return c.label;
}

function siteWord(x) {
  return x.neutral ? 'vs' : x.home ? 'vs' : 'at';
}

function GameLog({ row, dir }) {
  // the streak itself plus the game that ended the previous run — nothing older
  const { qual, s } = row;
  const start = qual.length - s.len;
  const from = Math.max(0, start - 1);
  const shown = qual.slice(from);
  return (
    <div className="detail">
      {from > 0 && (
        <div className="log-note">
          {from} earlier qualifying game{from === 1 ? '' : 's'} not shown
        </div>
      )}
      {shown.map((x, j) => {
        const idx = from + j;
        const inStreak = idx >= start;
        const isEnder = idx === start - 1;
        return (
          <div key={x.i + '-' + x.ep} className={'log-row' + (isEnder ? ' ender-row' : '')}>
            <span className="d">{fmtDate(x.ep)}</span>
            <span className="m">
              {siteWord(x)} {x.oppRank > 0 ? `#${x.oppRank} ` : ''}
              <b>{teams[x.oppIdx]?.name}</b>
              {x.neutral ? ' (n)' : ''}
              {isEnder ? ' — streak starts after this one' : ''}
            </span>
            <span className={'sc' + (x.r === 'W' ? ' w' : '')}>
              {x.r} {x.us}–{x.them}{inStreak ? ' •' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState([]);
  const [dir, setDir] = useState('W');
  const [sort, setSort] = useState('games');
  const [todayEp, setTodayEp] = useState(builtEp);
  const [expanded, setExpanded] = useState(null);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setTodayEp(todayEpochDay());
    const c = decodeChips(readParam('c'));
    if (c.length) setActive(c);
    const d = readParam('dir');
    if (d === 'L') setDir('L');
    const so = readParam('sort');
    if (so === 'since') setSort('since');
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeParam('c', encodeChips(active) || null);
    writeParam('dir', dir === 'W' ? null : dir);
    writeParam('sort', sort === 'games' ? null : sort);
    track('definition', { chips: encodeChips(active) || 'overall', dir });
  }, [active, dir, sort, hydrated]);

  const rows = useMemo(() => board(active, dir, sort, todayEp), [active, dir, sort, todayEp]);
  const week = useMemo(() => thisWeek(active, dir, todayEp), [active, dir, todayEp]);

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
      const def = c.param === 'month' ? 11 : c.param === 'conf' ? 'SEC' : c.param === 'state' ? 'TX' : c.param === 'team'
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
        Design a streak definition with up to four constraints, and see which of the {rows.length ? '136' : '136'} FBS
        teams owns the longest active run under it. Games between constraints don't break a streak — only a
        qualifying {oppWord(dir)} does.
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
        <span className="toggle" role="group" aria-label="sort">
          <button className={sort === 'games' ? 'on' : ''} onClick={() => setSort('games')}>BY GAMES</button>
          <button className={sort === 'since' ? 'on' : ''} onClick={() => setSort('since')}>BY YEARS SINCE</button>
        </span>
        <button className="sharebtn" onClick={share}>{copied ? 'COPIED ✓' : 'SHARE THIS BOARD'}</button>
      </div>

      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => applyPreset(p)}>{p.name}</button>
        ))}
      </div>

      {pickerOpen && (
        <div className="picker">
          {GROUPS.map((grp) => (
            <div className="pick-row" key={grp}>
              <span className="grp">{grp}</span>
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
            <span className="cap">{active.length} of 4 constraints.</span>{' '}
            Betting chips have lines for 1978–2025 (unlined games don't qualify). Night games are known from
            2002, solid from 2014. Ties (pre-1996) end streaks in both directions.
          </p>
        </div>
      )}

      <h2>The Board</h2>
      <p className="h2-note">
        Current FBS teams, ranked by active {dirWord(dir)} streak under this definition. “N+” means the run
        reaches the 1978 edge of the data. Tap a row for the game log.
      </p>
      <div className="board">
        {rows.length === 0 && <p className="empty">No team currently holds a {dirWord(dir)} streak under this definition.</p>}
        {rows.map((row, idx) => {
          const t = teams[row.ti];
          const e = row.s.ender;
          return (
            <div key={t.id}>
              <button className="row-btn" onClick={() => setExpanded(expanded === row.ti ? null : row.ti)}>
                <span className="rk">{idx + 1}</span>
                <img className="logo" src={`${BASE}logos/${t.espn}.png`} alt="" loading="lazy" />
                <span className="tm">{t.name}</span>
                <span className={'stk' + (dir === 'L' ? ' l' : '')}>
                  {row.s.len}{row.s.atEdge ? '+' : ''}{dir}
                </span>
                <span className="ender">
                  {row.s.atEdge ? (
                    <>runs past the start of the data (1978)</>
                  ) : (
                    <>
                      last {oppWord(dir)} {fmtDate(e.ep)} {siteWord(e)} {e.oppRank > 0 ? `#${e.oppRank} ` : ''}
                      <b>{teams[e.oppIdx]?.name}</b> {e.us}–{e.them}
                    </>
                  )}
                </span>
                {row.onTheLine ? <span className="otl">on the line</span> : <span />}
              </button>
              {expanded === row.ti && <GameLog row={row} dir={dir} />}
            </div>
          );
        })}
      </div>

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
            Not here yet: coach chips, halftime chips, and time-of-possession chips (the free data source
            gates them), plus spreads for {P.currentSeason}.
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

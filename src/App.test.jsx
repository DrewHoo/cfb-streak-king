// @vitest-environment jsdom
// The deployed HTML is App rendered at build time (scripts/prerender.mjs), and
// main.jsx hydrates onto it. Render on the "server" the same way, hydrate the
// markup in a DOM, and fail on any mismatch React reports.

import { describe, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import { P, teams, gamesOf, upcomingOf } from './lib/model.ts';
import { seasonWeeks } from './lib/game.ts';
import { matchingGames } from './components/GamesPage.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no matchMedia; useIsMobile only needs the shape
window.matchMedia ??= (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
// the build's files, empty: without them a page would fall back to mining in
// the page (minutes), and these tests check the render, not the rows
const empty = (url) => (
  /crowns\//.test(url) ? { v: 6, scope: /\.all\.json/.test(url) ? 'all' : 'active', rows: [] }
    : /digests\.json/.test(url) ? { v: 1, builtAt: '', broken: {}, atRisk: null, onLine: {} }
      : /games\/\d{4}\.json/.test(url) ? { v: 1, season: Number(/(\d{4})\.json/.exec(url)[1]), builtAt: '', games: {} }
        : /breakers\/\d{4}\.json/.test(url) ? { v: 1, season: 2026, builtAt: '', teams: {}, ranks: {} }
        : null
);
globalThis.fetch = async (url) => {
  const body = empty(String(url));
  return body ? new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response('', { status: 404 });
};

async function hydrate(initial, url = '/cfb-streak-king/') {
  window.history.replaceState(null, '', url);
  const html = renderToString(<App initial={initial} />);
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.replaceChildren(root);
  const errors = [];
  const consoleError = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')));
  let r;
  await act(async () => {
    r = hydrateRoot(root, <App initial={initial} />, { onRecoverableError: (e) => errors.push(String(e)) });
  });
  consoleError.mockRestore();
  return { html, root, errors, unmount: () => act(() => r.unmount()) };
}

describe('prerender + hydrate', () => {
  test('the root page hydrates without a mismatch', async () => {
    const { html, errors, unmount } = await hydrate({ page: null });
    expect(html).toContain('<h1>Streak King</h1>');
    expect(errors).toEqual([]);
    await unmount();
  });

  test('a team page hydrates without a mismatch, crowns included', async () => {
    const ti = teams.findIndex((t) => t.id === 'alabama');
    // any crowns will do: this checks the render, crowns.test covers their contents
    const crown = (chips, dir, len) => ({ chips, dir, scope: 'active', len, atEdge: false, field: 40, rank: 1, tied: 1, second: 3, startSe: 2024, live: true, also: 0, p: 0.5, n: 1000, hT: 10, nT: 20 });
    const crowns = { active: [crown(['road'], 'W', 9), crown(['ranked'], 'W', 5), crown(['night'], 'L', 4)], all: [] };
    const { html, errors, unmount } = await hydrate({ page: ti, crowns }, '/cfb-streak-king/team/alabama/');
    expect(html).toContain('Alabama');
    expect(html).toContain('pick another team');
    expect(html).not.toContain('<h1>Streak King</h1>');
    // the page's one list: the team's streaks, crowns grouped in; no King-of list of its own
    expect(html).toContain('class="tpg-streaks"');
    expect(html).not.toContain('is the King of');
    expect(errors).toEqual([]);
    await unmount();
  });

  test('the schedule hydrates without a mismatch', async () => {
    const { html, errors, unmount } = await hydrate({ page: null, games: true }, '/cfb-streak-king/games/');
    expect(html).toContain('class="gpg"');
    expect(html).toContain('Week ');
    expect(errors).toEqual([]);
    await unmount();
  });

  test("a week page renders that week's broken digest, sub-streaks grouped, in the prerender itself", async () => {
    // a completed week of the running season, and one of its games as the ender
    const weeks = seasonWeeks(P.currentSeason);
    const week = weeks.find((w) => w.games.every((g) => !g.scheduled) && w.games.length);
    const ti = week.games[0].key.home;
    const ender = gamesOf(ti).find((g) => g.ep === week.games[0].key.ep);
    const run = (chips, len) => ({ chips, dir: 'W', scope: 'all', len, atEdge: false, field: 40, rank: 1, tied: 1, second: 3, startSe: 2023, live: false, also: 0, p: 0.5, n: 1000, hT: 10, nT: 20, ti, since: 2023, ender, run: ender.ep - 400, everLen: 20, everN: 1 });
    // the build's rows; the page's list rule folds the sub-streak under the run
    const digests = { builtAt: '', broken: { [week.wk]: { wk: week.wk, lo: week.lo, hi: week.hi, rows: [run(['home'], 9), run(['home', 'night'], 7)] } }, atRisk: null, onLine: {} };
    const seasonRows = { season: P.currentSeason, builtAt: '', games: new Map(), complete: false };
    const { html, errors, unmount } = await hydrate({ page: null, games: true, bwk: week.wk, digests, seasonRows }, `/cfb-streak-king/games/week/${week.wk}/`);
    // the heading's two text nodes meet at a React marker
    expect(html.replace(/<!-- -->/g, '')).toContain(`Streaks broken in Week ${week.wk}`);
    expect(html).toContain('show 1 sub-streak');
    expect(html).not.toContain('finding the week');
    expect(html).not.toContain('No games in this week');
    expect(errors).toEqual([]);
    await unmount();
  });

  test("the schedule's filter keeps the games with a team by that name, and everything when empty", () => {
    const week = seasonWeeks(P.currentSeason).find((w) => w.games.length > 10);
    const ti = week.games[0].key.home;
    const name = teams[ti].name;
    expect(matchingGames(week.games, '')).toBe(week.games);
    const hits = matchingGames(week.games, name.slice(0, 4).toUpperCase());
    expect(hits.length).toBeGreaterThan(0);
    for (const g of hits) expect([teams[g.key.home].name, teams[g.key.away].name].some((n) => n.toLowerCase().includes(name.slice(0, 4).toLowerCase()))).toBe(true);
    expect(matchingGames(week.games, 'zzzzqq')).toEqual([]);
  });

  test('the streak-breakers page and a team page’s breaks hydrate without a mismatch, from the embedded rows', async () => {
    // a break: Georgia ended Alabama's run at home (Alabama's game row from its side)
    const bama = teams.findIndex((t) => t.id === 'alabama'), uga = teams.findIndex((t) => t.id === 'georgia');
    const ender = gamesOf(bama).find((g) => g.se === P.currentSeason && g.oppIdx === uga && g.r === 'L');
    if (!ender) return; // another payload
    const run = (chips, len) => ({ chips, dir: 'W', scope: 'all', len, atEdge: false, field: 40, rank: 1, tied: 1, second: 3, startSe: 2023, live: false, also: 0, p: 0.5, n: 1000, hT: 10, nT: 20, ti: bama, since: 2023, ender, run: ender.ep - 400, everLen: len, everN: 1 });
    const breakers = { season: P.currentSeason, builtAt: '', complete: true, teams: new Map([[uga, [run(['home'], 9), run(['home', 'night'], 7)]]]), ranks: new Map([[uga, 1]]) };
    const a = await hydrate({ breakers: true, breaks: breakers }, '/cfb-streak-king/breakers/');
    expect(a.html).toContain('Top Streak-Breakers');
    expect(a.html).toContain('Georgia');
    expect(a.html).toContain('Alabama had won 9 straight at home');
    expect(a.html).toContain('SKR');
    expect(a.html).toContain('bkr-v'); // whose streaks, a count each
    expect(a.errors).toEqual([]);
    await a.unmount();
    const slice = { ...breakers, complete: false };
    const b = await hydrate({ page: uga, crowns: { active: [], all: [] }, breaks: slice }, '/cfb-streak-king/team/georgia/');
    expect(b.html).toContain('Streaks broken this season');
    expect(b.html.replace(/<[^>]+>/g, '')).toContain('Georgia ended 1 streak by beating other teams');
    expect(b.html).toContain('show 1 sub-streak');
    expect(b.html.replace(/<[^>]+>/g, '')).toContain('Streak King Rank #1');
    expect(b.html).toContain('bk-logo'); // whose streak it was, in the schedule's row
    expect(b.html).toContain('now the all-time longest streak');
    expect(b.errors).toEqual([]);
    await b.unmount();
    // a past season's leaderboard boots on its address (the 404 shell), built from its season file, labeled two-condition
    const past = await hydrate({ breakers: true, season: 1995 }, '/cfb-streak-king/breakers/1995/');
    expect(past.html).toContain('Top Streak-Breakers');
    expect(past.html).toContain('1995');
    expect(past.html.replace(/<!-- -->/g, '')).toContain('count definitions of up to two conditions');
    expect(past.errors).toEqual([]);
    await past.unmount();
    // the team's own broken-streaks page, from its slice
    const c = await hydrate({ breakers: true, breaker: uga, breaks: slice }, '/cfb-streak-king/breakers/georgia/');
    expect(c.html.replace(/<!-- -->/g, '')).toContain('Streaks Georgia broke');
    expect(c.html.replace(/<!-- -->/g, '')).toContain('Alabama had won 9 straight at home');
    expect(c.html.replace(/<!-- -->/g, '')).toContain('now the all-time longest streak');
    expect(c.html).toContain('bk-logo');
    expect(c.errors).toEqual([]);
    await c.unmount();
  });

  test('a URL with a definition hydrates first, then applies it', async () => {
    const { root, errors, unmount } = await hydrate({ page: null }, '/cfb-streak-king/?c=road&dir=L');
    expect(errors).toEqual([]);
    expect(root.textContent).toContain('on the road');
    await unmount();
  });

  test("an old team link with a definition hydrates as the page, then opens that team's panel on the board", async () => {
    const ti = teams.findIndex((t) => t.id === 'alabama');
    const { root, errors, unmount } = await hydrate({ page: ti, crowns: { active: [], all: [] } }, '/cfb-streak-king/team/alabama/?c=night');
    expect(errors).toEqual([]);
    expect(root.querySelector('h1').textContent).toBe('Streak King');
    expect(root.querySelector('.panel-name').textContent).toBe('Alabama');
    expect(window.location.pathname + window.location.search).toBe('/?c=night&t=alabama');
    await unmount();
  });

  test("a named definition's page hydrates on its definition, with its own h1, and a panel on it keeps its path", async () => {
    // the test's base is "/" (vitest's BASE_URL), so the written address has no site prefix
    const { root, errors, unmount } = await hydrate({ landing: 'longest-home-win-streaks' }, '/longest-home-win-streaks/');
    expect(errors).toEqual([]);
    expect(root.querySelector('h1').textContent).toBe('Longest active home win streaks in college football');
    expect(root.querySelector('.landing-line')).not.toBeNull();
    expect(root.textContent).toContain('at home');
    // the list under the grid links every named definition by its address, this one marked
    expect(root.querySelector('.landings a[aria-current="page"]').getAttribute('href')).toBe('/longest-home-win-streaks/');
    expect(root.querySelectorAll('.landings a[href^="/longest-"]').length).toBeGreaterThan(20);
    expect(window.location.pathname + window.location.search).toBe('/longest-home-win-streaks/');
    // the board arriving at a named definition by an old link lands on its path
    await unmount();
    const old = await hydrate({ page: null }, '/?c=road&scope=active&t=alabama');
    expect(old.errors).toEqual([]);
    expect(old.root.querySelector('h1').textContent).toBe('Longest active road win streaks in college football');
    expect(window.location.pathname + window.location.search).toBe('/longest-road-win-streaks/?t=alabama');
    await old.unmount();
  });

  test('on desktop the open streak is a card in the grid; ← → move it along the columns and Escape closes it', async () => {
    const { root, errors, unmount } = await hydrate({ page: null }, '/cfb-streak-king/?t=alabama');
    expect(errors).toEqual([]);
    const card = root.querySelector('.colwrap .card');
    expect(card).not.toBeNull();
    expect(card.querySelector('.colbtn.hi')).not.toBeNull();
    expect(card.querySelector('.card-panel .panel-name').textContent).toBe('Alabama');
    const cols = [...root.querySelectorAll('.colwrap > .colbtn, .colwrap > .card')];
    const at = cols.findIndex((el) => el.classList.contains('card'));
    const nextName = cols[at + 1].querySelector('.colteam')?.getAttribute('alt');
    const key = (k) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });
    await key('ArrowRight');
    expect(root.querySelector('.card .panel-name').textContent).toBe(nextName);
    await key('ArrowLeft');
    expect(root.querySelector('.card .panel-name').textContent).toBe('Alabama');
    await key('Escape');
    expect(window.location.search).toBe('');
    // the card stays for its exit animation, then goes
    expect(root.querySelector('.card.exit')).not.toBeNull();
    await act(() => new Promise((r) => setTimeout(r, 350)));
    expect(root.querySelector('.card')).toBeNull();
    await unmount();
  });

  test("on a phone the board hydrates as the board, then a shared streak link opens its sheet over it", async () => {
    const wide = window.matchMedia;
    window.matchMedia = (query) => ({ matches: /max-width: 640px/.test(query), media: query, addEventListener() {}, removeEventListener() {} });
    try {
      const { root, errors, unmount } = await hydrate({ page: null }, '/cfb-streak-king/?t=alabama');
      expect(errors).toEqual([]);
      // the board stays in the page, its column lit; the panel is in the sheet (a portal), not the rail
      expect(root.querySelector('.colwrap')).not.toBeNull();
      expect(root.querySelector('.colbtn.hi')).not.toBeNull();
      expect(root.querySelector('.panel')).toBeNull();
      expect(document.querySelector('.sheet.streak .panel-name').textContent).toBe('Alabama');
      await unmount();
    } finally {
      window.matchMedia = wide;
    }
  });

  test('a game page hydrates without a mismatch, played or scheduled, and an old matchup link lands on the game', async () => {
    const played = { ep: 20736, home: teams.findIndex((t) => t.id === 'alabama'), away: teams.findIndex((t) => t.id === 'georgia'), neutral: false };
    const a = await hydrate({ game: played, seasonRows: null }, '/cfb-streak-king/game/2026-10-10/georgia-at-alabama/');
    expect(a.html).toContain('class="gp"');
    expect(a.html).toContain('Streaks this game ended');
    expect(a.errors).toEqual([]);
    await a.unmount();
    const ti = teams.findIndex((t) => t.id === 'byu');
    const next = upcomingOf(ti)[0];
    if (next) {
      const b = await hydrate({ page: ti, crowns: { active: [], all: [] } }, '/cfb-streak-king/team/byu/?vs=next');
      expect(b.errors).toEqual([]);
      expect(b.root.querySelector('.gp')).not.toBeNull();
      expect(b.root.textContent).toContain('On the line');
      await b.unmount();
    }
  });
});

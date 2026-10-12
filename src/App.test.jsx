// @vitest-environment jsdom
// The deployed HTML is App rendered at build time (scripts/prerender.mjs), and
// main.jsx hydrates onto it. Render on the "server" the same way, hydrate the
// markup in a DOM, and fail on any mismatch React reports.

import { describe, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import { teams, upcomingOf } from './lib/model.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no matchMedia; useIsMobile only needs the shape
window.matchMedia ??= (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
// the build's files, empty: without them a page would fall back to mining in
// the page (minutes), and these tests check the render, not the rows
const empty = (url) => (
  /crowns\//.test(url) ? { v: 4, active: [], all: [] }
    : /digests\.json/.test(url) ? { v: 1, builtAt: '', broken: {}, atRisk: null, onLine: {} }
      : /games\/\d{4}\.json/.test(url) ? { v: 1, season: Number(/(\d{4})\.json/.exec(url)[1]), builtAt: '', games: {} }
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
    const crown = (chips, dir, len) => ({ chips, dir, scope: 'active', len, atEdge: false, field: 40, rank: 1, tied: 1, second: 3, startSe: 2024, live: true, also: 0, chance: 0.01, score: 5, dup: false });
    const crowns = { active: [crown(['road'], 'W', 9), crown(['ranked'], 'W', 5), crown(['night'], 'L', 4)], all: [] };
    const { html, errors, unmount } = await hydrate({ page: ti, crowns }, '/cfb-streak-king/team/alabama/');
    expect(html).toContain('Alabama');
    expect(html).toContain('pick another team');
    expect(html).not.toContain('<h1>Streak King</h1>');
    // the page's one list: the team's streaks, crowns folded in; no King-of list of its own
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

  test('a URL with a definition hydrates first, then applies it', async () => {
    const { root, errors, unmount } = await hydrate({ page: null }, '/cfb-streak-king/?c=road&dir=L');
    expect(errors).toEqual([]);
    expect(root.textContent).toContain('on the road');
    await unmount();
  });

  test("an old team link with a definition hydrates as the page, then opens that team's panel on the board", async () => {
    const ti = teams.findIndex((t) => t.id === 'alabama');
    const { root, errors, unmount } = await hydrate({ page: ti, crowns: { active: [], all: [] } }, '/cfb-streak-king/team/alabama/?c=road');
    expect(errors).toEqual([]);
    expect(root.querySelector('h1').textContent).toBe('Streak King');
    expect(root.querySelector('.panel-name').textContent).toBe('Alabama');
    expect(window.location.pathname + window.location.search).toBe('/?c=road&t=alabama');
    await unmount();
  });

  test('a game page hydrates without a mismatch, played or scheduled, and an old matchup link lands on the game', async () => {
    const played = { ep: 20736, home: teams.findIndex((t) => t.id === 'alabama'), away: teams.findIndex((t) => t.id === 'georgia'), neutral: false };
    const a = await hydrate({ game: played, season: null }, '/cfb-streak-king/game/2026-10-10/georgia-at-alabama/');
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

// @vitest-environment jsdom
// The deployed HTML is App rendered at build time (scripts/prerender.mjs), and
// main.jsx hydrates onto it. Render on the "server" the same way, hydrate the
// markup in a DOM, and fail on any mismatch React reports.

import { describe, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import { teams } from './lib/model.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no matchMedia; useIsMobile only needs the shape
window.matchMedia ??= (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });

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
    const crown = (chips, dir, len) => ({ chips, dir, scope: 'active', len, atEdge: false, field: 40, startSe: 2024, live: true, also: 0 });
    const crowns = { active: [crown(['road'], 'W', 9), crown(['ranked'], 'W', 5), crown(['night'], 'L', 4)], all: [] };
    const { html, errors, unmount } = await hydrate({ page: ti, crowns }, '/cfb-streak-king/team/alabama/');
    expect(html).toContain('Alabama');
    expect(html).toContain('pick another team');
    expect(html).not.toContain('<h1>Streak King</h1>');
    expect(html).toContain(`<b class="w">${crowns.active.filter((c) => c.dir === 'W').length}</b>`);
    expect(html).not.toContain('finding every streak');
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

  test('a matchup link hydrates as the team page, then raises the sheet', async () => {
    const ti = teams.findIndex((t) => t.id === 'byu');
    const { errors, unmount } = await hydrate({ page: ti, crowns: { active: [], all: [] } }, '/cfb-streak-king/team/byu/?vs=next');
    expect(errors).toEqual([]);
    expect(document.body.querySelector('.sheet.matchup')).not.toBeNull();
    await unmount();
  });
});

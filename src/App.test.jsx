// @vitest-environment jsdom
// The deployed HTML is App rendered at build time (scripts/prerender.mjs), and
// main.jsx hydrates onto it. Render on the "server" the same way, hydrate the
// markup in a DOM, and fail on any mismatch React reports.

import { describe, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import { teams } from './lib/model.js';

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
    const { html, errors, unmount } = await hydrate({ team: null });
    expect(html).toContain('<h1>Streak King</h1>');
    expect(errors).toEqual([]);
    await unmount();
  });

  test('a team page hydrates without a mismatch', async () => {
    const ti = teams.findIndex((t) => t.id === 'alabama');
    const { html, errors, unmount } = await hydrate({ team: ti }, '/cfb-streak-king/team/alabama/');
    expect(html).toContain('Alabama');
    expect(errors).toEqual([]);
    await unmount();
  });

  test('a URL with a definition hydrates first, then applies it', async () => {
    const { root, errors, unmount } = await hydrate({ team: null }, '/cfb-streak-king/?c=road&dir=L');
    expect(errors).toEqual([]);
    expect(root.textContent).toContain('on the road');
    await unmount();
  });
});

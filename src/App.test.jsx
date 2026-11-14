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
import { CTX, LIST } from './lib/list.ts';
import { FRONT, frontList } from './lib/front.ts';
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
        : /front\.json/.test(url) ? { v: 1, builtAt: '', rows: [] }
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
  test('the builder hydrates without a mismatch', async () => {
    const { html, errors, unmount } = await hydrate({ page: null }, '/cfb-streak-king/build/');
    expect(html).toContain('<h1>Streak King</h1>');
    expect(errors).toEqual([]);
    await unmount();
  });

  // a team's current runs, as the front page's file keeps them: any will do, front.test covers the rule. No conditions, so the
  // team's next game puts each on the line, for teams that play within the week; a postseason run's next game is a bowl, so it isn't
  const builtEp = Math.floor(Date.parse(P.builtAt) / 86400000);
  const playing = teams.map((_, ti) => ti).filter((ti) => upcomingOf(ti)[0] && upcomingOf(ti)[0].ep - builtEp <= 8);
  const frontRuns = () => {
    const se = P.currentSeason;
    const crown = (chips, dir, len, extra = {}) => ({ chips, dir, scope: 'active', len, unsure: false, field: 130, rank: 1, tied: 1, second: 3, startSe: se - 3, endSe: se, live: true, also: 0, p: 0.5, n: 10000, hT: 10, nT: 20, gT: 20, ...extra });
    const [a, b, c, d, e] = playing;
    return new Map([
      [a, [crown([], 'W', 40, { p: 0.4 })]],
      [b, [crown([], 'L', 25, { p: 0.4 })]],
      [c, [crown([], 'W', 12)]],
      [d, [crown([], 'W', 6)]],
      // not on the line this week, however long
      [e, [crown(['postseason'], 'W', 90, { p: 0.3 })]],
    ]);
  };

  test('the front page hydrates without a mismatch, its rows in the prerender', async () => {
    const runs = frontRuns();
    const { html, root, errors, unmount } = await hydrate({ page: null, front: true, frontRuns: runs }, '/');
    expect(errors).toEqual([]);
    expect(html).toContain('<h1>Streak King</h1>');
    const rows = frontList(runs, Math.floor(Date.parse(P.builtAt) / 86400000), CTX, LIST, FRONT);
    expect(rows.length).toBe(4);
    // the claims are in the prerendered HTML, in order, and the frozen run isn't
    const claims = [...root.querySelectorAll('.fr-list .fr-txt > span')].map((e) => e.textContent);
    expect(claims.length).toBe(rows.length);
    expect(claims[0]).toBe(`${teams[playing[0]].name} has won 40 straight games`);
    expect(claims.some((c) => c.startsWith(teams[playing[4]].name))).toBe(false);
    expect(root.querySelector('h2.fr-h').textContent).toMatch(/^On the line (in Week \d+|this week)$/);
    // the builder is a link away, and isn't on the page
    expect(root.querySelector('a.fr-build').getAttribute('href')).toBe('/build/');
    expect(root.querySelector('.colwrap')).toBeNull();
    expect(root.querySelector('.landings h2').textContent).toBe('Longest streaks by category');
    await unmount();
  });

  test('an old root link with a definition hydrates as the front page, then opens the builder at /build/', async () => {
    const { root, errors, unmount } = await hydrate({ page: null, front: true, frontRuns: frontRuns() }, '/?c=road%2Cnight&dir=L');
    expect(errors).toEqual([]);
    expect(root.textContent).toContain('on the road');
    expect(root.querySelector('.fr-list')).toBeNull();
    expect(window.location.pathname).toBe('/build/');
    await unmount();
  });

  test("a column says its run in words, as its button's own text, and hides its pictures from screen readers", async () => {
    const { root, unmount } = await hydrate({ page: null }, '/cfb-streak-king/build/');
    for (const col of [...root.querySelectorAll('.colwrap > .colbtn')].slice(0, 8)) {
      const btn = col.matches('button') ? col : col.querySelector('.colbody');
      expect(btn.getAttribute('aria-label')).toBeNull();
      expect(btn.querySelector('.sr-only').textContent).toMatch(/^[^:]+: \d+\+? wins in a row(, (since [A-Z][a-z]+ \d{4}|\d{4}.\d{4}.*))?\.$/);
      for (const el of btn.children) if (!el.classList.contains('sr-only')) expect(el.getAttribute('aria-hidden')).toBe('true');
      const head = col.querySelector('.colhead');
      if (head) expect(head.querySelector('.sr-only').textContent).toMatch(/: the game\.$/);
    }
    await unmount();
  });

  test('a team page hydrates without a mismatch, crowns included', async () => {
    const ti = teams.findIndex((t) => t.id === 'alabama');
    // any crowns will do: this checks the render, crowns.test covers their contents
    const crown = (chips, dir, len) => ({ chips, dir, scope: 'active', len, unsure: false, field: 40, rank: 1, tied: 1, second: 3, startSe: 2024, live: true, also: 0, p: 0.5, n: 1000, hT: 10, nT: 20, gT: 20 });
    const record = { ...crown(['home'], 'W', 30), scope: 'all', startSe: 1978, endSe: 1982, live: false };
    const crowns = { active: [crown(['road'], 'W', 9), crown(['ranked'], 'W', 5), crown(['night'], 'L', 4), crown(['home', 'fullmoon'], 'W', 6)], allSimple: { rows: [record], trivia: 12 }, all: null };
    const { html, errors, unmount } = await hydrate({ page: ti, crowns }, '/cfb-streak-king/team/alabama/');
    expect(html).toContain('Alabama');
    // the sections in order, each section's default rows in the prerender (crawlers read them), the schedule last
    const at = (x) => html.indexOf(x);
    expect(at('Streaks by opponent')).toBeGreaterThan(0);
    expect(at('Streaks by opponent')).toBeLessThan(at('All-time streaks'));
    expect(at('All-time streaks')).toBeLessThan(at('Active streaks'));
    expect(at('Active streaks')).toBeLessThan(at('Streaks broken this season'));
    expect(at('Streaks broken this season')).toBeLessThan(at(' schedule</h2>')); // "{season} schedule", the season its own text node
    expect(html).toContain('ended 1982');
    // each section's simple | trivia switch, the simple list showing; the active section's from the active file's one trivia row
    expect(html.match(/aria-label="Simple or trivia [a-z-]+ streaks"/g)).toEqual(['aria-label="Simple or trivia all-time streaks"', 'aria-label="Simple or trivia active streaks"']);
    expect(html).toContain('at home'); // the all-time simple row, in the prerender (with 'ended 1982' above)
    expect(html).not.toContain('under a full moon'); // the trivia row, behind its switch
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
    const run = (chips, len) => ({ chips, dir: 'W', scope: 'all', len, unsure: false, field: 40, rank: 1, tied: 1, second: 3, startSe: 2023, live: false, also: 0, p: 0.5, n: 1000, hT: 10, nT: 20, gT: 20, ti, since: 2023, ender, run: ender.ep - 400, everLen: 20, everN: 1 });
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
    const run = (chips, len) => ({ chips, dir: 'W', scope: 'all', len, unsure: false, field: 40, rank: 1, tied: 1, second: 3, startSe: 2023, live: false, also: 0, p: 0.5, n: 1000, hT: 10, nT: 20, gT: 20, ti: bama, since: 2023, ender, run: ender.ep - 400, everLen: len, everN: 1 });
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
    const { root, errors, unmount } = await hydrate({ page: null }, '/cfb-streak-king/build/?c=road&dir=L');
    expect(errors).toEqual([]);
    expect(root.textContent).toContain('on the road');
    await unmount();
  });

  test("an old team link with a definition hydrates as the page, then opens that team's panel on the board", async () => {
    const ti = teams.findIndex((t) => t.id === 'alabama');
    const { root, errors, unmount } = await hydrate({ page: ti, crowns: { active: [], all: [] } }, '/cfb-streak-king/team/alabama/?c=fullmoon');
    expect(errors).toEqual([]);
    expect(root.querySelector('h1').textContent).toBe('Streak King');
    expect(root.querySelector('.panel-name').textContent).toBe('Alabama');
    expect(window.location.pathname + window.location.search).toBe('/build/?c=fullmoon&t=alabama');
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
    const old = await hydrate({ page: null, front: true, frontRuns: frontRuns() }, '/?c=road&scope=active&t=alabama');
    expect(old.errors).toEqual([]);
    expect(old.root.querySelector('h1').textContent).toBe('Longest active road win streaks in college football');
    expect(window.location.pathname + window.location.search).toBe('/longest-road-win-streaks/?t=alabama');
    await old.unmount();
  });

  test("a team's by-opponent page hydrates as that board, the question as its h1 and the answer under it; its team page carries both lists", async () => {
    const ti = teams.findIndex((t) => t.id === 'auburn');
    const { root, errors, unmount } = await hydrate({ as: ti, asDir: 'L' }, '/team/auburn/losing-streaks-by-opponent/');
    expect(errors).toEqual([]);
    expect(root.querySelector('h1').textContent).toBe('Who has beaten Auburn the most times in a row?');
    expect(root.querySelector('.landing-line').textContent).toMatch(/^Georgia Tech beat Auburn 13 straight times, 1941–1954/);
    // the sentence says the team, the columns are its opponents, and the first column's words name Georgia Tech
    expect(root.textContent).toContain('as Auburn');
    expect(root.querySelector('.colwrap .colbtn .sr-only').textContent).toMatch(/^vs Georgia Tech: 13 losses in a row, 1941–1954/);
    expect(window.location.pathname + window.location.search).toBe('/team/auburn/losing-streaks-by-opponent/');
    await unmount();
    // the winning page, and a column open on it keeps the path
    const w = await hydrate({ as: ti, asDir: 'W' }, '/team/auburn/win-streaks-by-opponent/?t=kentucky');
    expect(w.errors).toEqual([]);
    expect(w.root.querySelector('h1').textContent).toBe('Who has Auburn beaten the most times in a row?');
    expect(w.root.querySelector('.card .panel-name').textContent).toBe('Auburn');
    expect(w.root.querySelector('.card .claim').textContent).toMatch(/^Auburn won 15 straight games against Kentucky/);
    expect(window.location.pathname + window.location.search).toBe('/team/auburn/win-streaks-by-opponent/?t=kentucky');
    await w.unmount();
    // the team page's section is the winning list, what the team is good at, and links both pages by their addresses
    const page = await hydrate({ page: ti, crowns: { active: [], all: [] } }, '/team/auburn/');
    expect(page.errors).toEqual([]);
    expect(page.root.querySelector('.tpg-opp h3 a').getAttribute('href')).toBe('/team/auburn/win-streaks-by-opponent/');
    expect(page.root.querySelector('.tpg-opp h3').textContent).toBe('Who has Auburn beaten the most times in a row?');
    expect(page.root.querySelector('.tpg-opp .srow-txt span').textContent).toBe('Chattanooga');
    expect(page.root.querySelector('.tpg-opp-more a[href="/team/auburn/losing-streaks-by-opponent/"]').textContent).toBe('Who has beaten Auburn the most times in a row? ›');
    await page.unmount();
  });

  test("a series page is the series': the same lead from either side, every game a winner's mark that says its score and opens its game; a team page lists its series", async () => {
    const al = teams.findIndex((t) => t.id === 'alabama'), ut = teams.findIndex((t) => t.id === 'tennessee');
    const { root, errors, unmount } = await hydrate({ series: { ti: al, oi: ut } }, '/team/alabama/vs/tennessee/');
    expect(errors).toEqual([]);
    expect(root.querySelector('h1').textContent).toBe('Alabama vs Tennessee all-time record');
    const lead = root.querySelector('.ser-lead').textContent;
    expect(lead).toMatch(/^Alabama leads Tennessee 60-41-7 in 109 games since their first meeting in 1901\./);
    // the scoreboard: each team's wins beside its name, in the address's order
    expect([...root.querySelectorAll('.ser-side span')].map((e) => e.textContent)).toEqual(['Alabama', 'Tennessee']);
    expect(root.querySelector('.ser-mid').textContent).toBe('7 ties');
    // every game is a mark whose words carry the score; the ones since 1936 are links to their game pages, the older ones aren't
    const marks = [...root.querySelectorAll('.ser-grid .ser-mk')];
    expect(marks.length).toBeGreaterThanOrEqual(109);
    expect(marks[0].tagName).toBe('SPAN');
    expect(marks[0].textContent).toMatch(/^1901: Alabama 6, Tennessee 6, a tie, (at|neutral)/);
    // the score as played, with the ruling beside it
    expect(marks.find((m) => m.textContent.startsWith('1993:')).textContent).toMatch(/Tennessee by forfeit/);
    expect(marks.find((m) => m.textContent.startsWith('2005:')).textContent).toMatch(/Alabama's win vacated/);
    const links = root.querySelectorAll('.ser-grid a.ser-mk');
    expect(links.length).toBeGreaterThan(80);
    expect(links[0].getAttribute('href')).toMatch(/^\/game\/1936-\d\d-\d\d\/(alabama|tennessee)-(at|vs)-(alabama|tennessee)\/$/);
    // the line shows the last meeting at first, with its four-digit year, and the last mark is the one lit
    expect(root.querySelector('.ser-line .ser-ld').textContent).toMatch(/^\d{1,2}\/\d{1,2}\/20\d\d$/);
    expect(marks[marks.length - 1].classList.contains('on')).toBe(true);
    expect(root.querySelector('.ser-site tbody th').textContent).toBe('Alabama');
    expect(root.querySelector('.tpg-opp-more, .ser-note')).toBeNull();
    expect(window.location.pathname).toBe('/team/alabama/vs/tennessee/');
    await unmount();
    // the other address is the same page with the teams swapped: the same lead, Tennessee on the left
    const other = await hydrate({ series: { ti: ut, oi: al } }, '/team/tennessee/vs/alabama/');
    expect(other.errors).toEqual([]);
    expect(other.root.querySelector('.ser-lead').textContent).toBe(lead);
    expect([...other.root.querySelectorAll('.ser-side span')].map((e) => e.textContent)).toEqual(['Tennessee', 'Alabama']);
    await other.unmount();
    const page = await hydrate({ page: al, crowns: { active: [], all: [] } }, '/team/alabama/');
    expect(page.errors).toEqual([]);
    const link = page.root.querySelector('.tpg-series a[href="/team/alabama/vs/tennessee/"]');
    expect(link.textContent).toMatch(/^vs Tennessee\d+-\d+-7$/);
    await page.unmount();
  });

  test('on desktop the open streak is a card in the grid; ← → move it along the columns and Escape closes it', async () => {
    const { root, errors, unmount } = await hydrate({ page: null }, '/cfb-streak-king/build/?t=alabama');
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
      const { root, errors, unmount } = await hydrate({ page: null }, '/cfb-streak-king/build/?t=alabama');
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

import { describe, expect, test } from 'vitest';
import { P, teams, fbsNow, upcomingOf } from './model.ts';
import { DEFAULT_VIEW, parseUrl, toUrl, teamUrl, gamesUrl, gameUrl, teamFromPath, breakersUrl, boardUrl, hrefOf, landingFromPath, landingOf } from './url.ts';
import type { View } from './url.ts';
import { LANDINGS } from './landing.ts';

const idx = (id: string) => teams.findIndex((t) => t.id === id);
const search = (params: Record<string, string | null>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString();
const roundTrip = (v: View) => { const u = toUrl(v); return parseUrl(`/cfb-streak-king/${u.path}`, search(u.params)); };

describe('url', () => {
  test('a bare URL is the default view', () => {
    expect(parseUrl('/cfb-streak-king/', '')).toEqual(DEFAULT_VIEW);
    expect(toUrl(DEFAULT_VIEW)).toEqual({ path: '', params: expect.objectContaining({ c: null, dir: null, scope: null, week: null, run: null }) });
  });

  test('views round-trip', () => {
    const views: View[] = [
      { ...DEFAULT_VIEW, active: [{ key: 'road' }, { key: 'month', param: 11 }], dir: 'L', scope: 'active', week: true },
      { ...DEFAULT_VIEW, active: [], dir: 'U', team: idx('alabama'), run: 7933 },
      { ...DEFAULT_VIEW, active: [{ key: 'road' }], dir: 'N' },
      { ...DEFAULT_VIEW, active: [{ key: 'home' }], dir: 'W10', scope: 'active' },
      { ...DEFAULT_VIEW, active: [], dir: 'L7' },
      { ...DEFAULT_VIEW, active: [{ key: 'vsteam', param: idx('auburn') }], team: idx('kansas'), run: -4000 },
      { ...DEFAULT_VIEW, page: idx('byu') },
      { ...DEFAULT_VIEW, game: { ep: 20736, home: idx('alabama'), away: idx('georgia'), neutral: false } },
      { ...DEFAULT_VIEW, game: { ep: 20473, home: idx('miami-fl'), away: idx('indiana'), neutral: true } },
      { ...DEFAULT_VIEW, games: true },
      { ...DEFAULT_VIEW, games: true, bwk: 5 },
      { ...DEFAULT_VIEW, games: true, bwk: 5, season: 1987 },
      { ...DEFAULT_VIEW, games: true, season: 1987 },
      { ...DEFAULT_VIEW, games: true, risk: true },
    ];
    for (const v of views) expect(roundTrip(v)).toEqual(v);
  });

  test('a margin outcome is dir=W10; anything unreadable is winning', () => {
    expect(toUrl({ ...DEFAULT_VIEW, dir: 'W10' }).params.dir).toBe('W10');
    expect(parseUrl('/cfb-streak-king/', 'dir=W10').dir).toBe('W10');
    expect(parseUrl('/cfb-streak-king/', 'dir=L14').dir).toBe('L14');
    expect(parseUrl('/cfb-streak-king/', 'dir=W0').dir).toBe('W');
    expect(parseUrl('/cfb-streak-king/', 'dir=U10').dir).toBe('W');
  });

  test('the schedule’s sections have their own addresses', () => {
    expect(gamesUrl().path).toBe('games/');
    expect(gamesUrl(5).path).toBe('games/week/5/');
    expect(gamesUrl(null, true).path).toBe('games/at-risk/');
    expect(parseUrl('/cfb-streak-king/games/at-risk/', '')).toMatchObject({ games: true, risk: true, bwk: null, page: null });
    expect(parseUrl('/cfb-streak-king/games/week/5/', '')).toMatchObject({ games: true, risk: false, bwk: 5 });
  });

  test('a run only belongs to the all-time view', () => {
    expect(toUrl({ ...DEFAULT_VIEW, scope: 'active', run: 100 }).params.run).toBeNull();
  });

  test('the path names a team page; the open panel is ?t=', () => {
    expect(teamFromPath('/cfb-streak-king/team/alabama/')).toBe(idx('alabama'));
    expect(teamFromPath('/cfb-streak-king/team/not-a-team/')).toBeNull();
    expect(teamFromPath('/cfb-streak-king/team/x:tarletonstate/')).toBeNull();
    expect(parseUrl('/cfb-streak-king/team/georgia/', '')).toMatchObject({ page: idx('georgia'), team: null, game: null });
    expect(teamUrl(idx('georgia'))).toMatchObject({ path: 'team/georgia/', params: { t: null, c: null } });
    const panel = toUrl({ ...DEFAULT_VIEW, team: idx('georgia') });
    expect([panel.path, panel.params.t]).toEqual(['', 'georgia']);
    expect(parseUrl('/cfb-streak-king/', '?t=georgia').team).toBe(idx('georgia'));
  });

  test('old links still open the panel: ?team=, and /team/<id>/ with a definition', () => {
    expect(parseUrl('/cfb-streak-king/', '?team=georgia').team).toBe(idx('georgia'));
    expect(parseUrl('/cfb-streak-king/team/georgia/', '?c=road&dir=L')).toMatchObject({ team: idx('georgia'), page: null, dir: 'L', active: [{ key: 'road' }] });
  });

  test('the schedule is /games/, and a team page or matchup takes precedence over it', () => {
    expect(gamesUrl()).toMatchObject({ path: 'games/', params: { c: null, t: null } });
    expect(parseUrl('/cfb-streak-king/games/', '')).toMatchObject({ games: true, page: null, team: null, bwk: null });
    expect(toUrl({ ...DEFAULT_VIEW, games: true, page: idx('byu') }).path).toBe('team/byu/');
  });

  test('the streak-breakers leaderboard is /breakers/, in the board’s place', () => {
    expect(breakersUrl()).toMatchObject({ path: 'breakers/', params: { c: null, t: null } });
    expect(parseUrl('/cfb-streak-king/breakers/', '')).toMatchObject({ breakers: true, games: false, page: null, team: null });
    expect(parseUrl('/cfb-streak-king/breakers', '').breakers).toBe(true);
    expect(parseUrl('/cfb-streak-king/games/', '').breakers).toBe(false);
    expect(toUrl({ ...DEFAULT_VIEW, breakers: true, page: idx('byu') }).path).toBe('team/byu/');
    // one team's broken streaks, its own address
    expect(breakersUrl(idx('georgia')).path).toBe('breakers/georgia/');
    expect(parseUrl('/cfb-streak-king/breakers/georgia/', '')).toMatchObject({ breakers: true, breaker: idx('georgia'), page: null });
    expect(parseUrl('/cfb-streak-king/breakers/not-a-team/', '')).toMatchObject({ breakers: false, breaker: null });
    // a past season, its own address; the running season is /breakers/ itself; a year with no games isn't one
    expect(breakersUrl(null, 1995).path).toBe('breakers/1995/');
    expect(breakersUrl(idx('iowa'), 1995).path).toBe('breakers/1995/iowa/');
    expect(breakersUrl(null, P.currentSeason).path).toBe('breakers/');
    expect(parseUrl('/cfb-streak-king/breakers/1995/', '')).toMatchObject({ breakers: true, breaker: null, season: 1995, games: false });
    expect(parseUrl('/cfb-streak-king/breakers/1995/iowa/', '')).toMatchObject({ breakers: true, breaker: idx('iowa'), season: 1995 });
    expect(parseUrl(`/cfb-streak-king/breakers/${P.currentSeason}/`, '')).toMatchObject({ breakers: true, season: null });
    expect(parseUrl('/cfb-streak-king/breakers/1850/', '')).toMatchObject({ breakers: false, season: null });
    // a breaker below FBS (or one that has left it) still has an address
    const below = teams.findIndex((t, i) => !fbsNow.has(i));
    expect(parseUrl(`/cfb-streak-king/breakers/${teams[below].id}/`, '')).toMatchObject({ breakers: true, breaker: below });
    // the page's first address still opens it
    expect(parseUrl('/cfb-streak-king/stoppers/', '')).toMatchObject({ breakers: true, breaker: null });
    expect(parseUrl('/cfb-streak-king/stoppers/georgia/', '')).toMatchObject({ breakers: true, breaker: idx('georgia') });
  });

  test('a week of broken streaks is /games/week/<n>/, and round-trips', () => {
    expect(parseUrl('/cfb-streak-king/games/week/5/', '')).toMatchObject({ games: true, bwk: 5, page: null });
    expect(toUrl({ ...DEFAULT_VIEW, games: true, bwk: 5 }).path).toBe('games/week/5/');
    expect(toUrl({ ...DEFAULT_VIEW, games: true, bwk: null }).path).toBe('games/');
    expect(parseUrl('/cfb-streak-king/games/week/x/', '').bwk).toBeNull();
  });

  test('a game is /game/<date>/<away>-at-<home>/ (-vs- neutral), and the old matchup address opens the team’s game', () => {
    const key = { ep: 20736, home: idx('alabama'), away: idx('georgia'), neutral: false };
    expect(gameUrl(key).path).toBe('game/2026-10-10/georgia-at-alabama/');
    expect(parseUrl('/cfb-streak-king/game/2026-10-10/georgia-at-alabama/', '')).toMatchObject({ game: key, page: null, games: false });
    expect(parseUrl('/cfb-streak-king/game/2026-01-19/indiana-vs-miami-fl/', '').game).toMatchObject({ home: idx('miami-fl'), away: idx('indiana'), neutral: true });
    expect(parseUrl('/cfb-streak-king/game/2026-10-10/nobody-at-alabama/', '').game).toBeNull();
    // the old matchup address: the team's next game, or its game against the opponent
    const next = upcomingOf(idx('byu'))[0];
    if (next) {
      expect(parseUrl('/cfb-streak-king/team/byu/', '?vs=next')).toMatchObject({ game: { ep: next.ep }, page: null });
      expect(parseUrl('/cfb-streak-king/team/byu/', `?vs=${teams[next.oppIdx].id}`).game).toMatchObject({ ep: next.ep });
    }
    // the game page leaves the definition out
    const u = toUrl({ ...DEFAULT_VIEW, active: [{ key: 'road' }], team: idx('utah'), game: key });
    expect([u.path, search(u.params)]).toEqual(['game/2026-10-10/georgia-at-alabama/', '']);
  });

  test('junk params fall back to defaults', () => {
    expect(parseUrl('/', '?dir=X&scope=nope&run=abc&week=yes')).toEqual(DEFAULT_VIEW);
  });

  test('a broken run’s all-time link is the board under its definition, no team open', () => {
    const u = boardUrl(['fullmoon'], 'W', 'all');
    expect(u.params.t ?? null).toBeNull();
    expect(hrefOf('/cfb-streak-king/', u)).toBe('/cfb-streak-king/?c=fullmoon');
    expect(parseUrl('/cfb-streak-king/', '?c=fullmoon')).toMatchObject({ scope: 'all', team: null });
    expect(hrefOf('/x/', { path: 'games/', params: { a: null, b: '' } })).toBe('/x/games/');
  });

  test('a named definition is at its own path, and the path is the definition', () => {
    // the board on a landing's definition writes the landing's path, with no definition params
    const u = boardUrl(['road'], 'W', 'all');
    expect(hrefOf('/cfb-streak-king/', u)).toBe('/cfb-streak-king/longest-road-win-streaks-ever/');
    expect(hrefOf('/cfb-streak-king/', toUrl({ ...DEFAULT_VIEW, active: [{ key: 'home' }], scope: 'active' }))).toBe('/cfb-streak-king/longest-home-win-streaks/');
    expect(hrefOf('/cfb-streak-king/', toUrl({ ...DEFAULT_VIEW, active: [], dir: 'L', scope: 'active' }))).toBe('/cfb-streak-king/longest-active-losing-streaks/');
    // a panel open on one keeps the path and adds the team
    expect(hrefOf('/cfb-streak-king/', toUrl({ ...DEFAULT_VIEW, active: [{ key: 'home' }], scope: 'active', team: idx('alabama') }))).toBe('/cfb-streak-king/longest-home-win-streaks/?t=alabama');
    // the path reads back as the definition; a param on it still wins
    expect(parseUrl('/cfb-streak-king/longest-home-win-streaks/', '')).toMatchObject({ active: [{ key: 'home' }], dir: 'W', scope: 'active', page: null, games: false, breakers: false });
    expect(parseUrl('/cfb-streak-king/longest-active-losing-streaks/', '?t=alabama')).toMatchObject({ active: [], dir: 'L', scope: 'active', team: idx('alabama') });
    expect(parseUrl('/cfb-streak-king/longest-active-losing-streaks/', '?dir=W')).toMatchObject({ active: [], dir: 'W', scope: 'active' });
    // an old query-string link to a definition that has since got a page moves to the page; a margin and a chip choice included
    expect(hrefOf('/cfb-streak-king/', toUrl(parseUrl('/cfb-streak-king/', '?c=all&dir=W10&scope=active')))).toBe('/cfb-streak-king/longest-double-digit-win-streaks/');
    expect(hrefOf('/cfb-streak-king/', toUrl(parseUrl('/cfb-streak-king/', '?c=vsmascot%3Aanimal')))).toBe('/cfb-streak-king/longest-win-streaks-vs-animal-mascots-ever/');
    expect(landingFromPath('/cfb-streak-king/longest-home-win-streaks/')?.slug).toBe('longest-home-win-streaks');
    expect(landingFromPath('/cfb-streak-king/team/alabama/')).toBeNull();
    expect(landingFromPath('/cfb-streak-king/games/')).toBeNull();
    expect(landingFromPath('/cfb-streak-king/not-a-page/')).toBeNull();
    // the default definition is the root, not a landing
    expect(hrefOf('/cfb-streak-king/', toUrl(DEFAULT_VIEW))).toBe('/cfb-streak-king/');
    expect(landingOf(DEFAULT_VIEW)).toBeNull();
    // every landing round-trips
    for (const l of LANDINGS) {
      const v = parseUrl(`/cfb-streak-king/${l.slug}/`, '');
      expect(hrefOf('/cfb-streak-king/', toUrl(v))).toBe(`/cfb-streak-king/${l.slug}/`);
      expect(landingOf(v)?.slug).toBe(l.slug);
    }
  });
});

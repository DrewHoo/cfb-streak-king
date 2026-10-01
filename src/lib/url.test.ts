import { describe, expect, test } from 'vitest';
import { teams } from './model.ts';
import { DEFAULT_VIEW, parseUrl, toUrl, crownUrl, teamFromPath } from './url.ts';
import type { View } from './url.ts';

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
      { ...DEFAULT_VIEW, active: [{ key: 'vsteam', param: idx('auburn') }], team: idx('kansas'), run: -4000 },
    ];
    for (const v of views) expect(roundTrip(v)).toEqual(v);
  });

  test('a run only belongs to the all-time view', () => {
    expect(toUrl({ ...DEFAULT_VIEW, scope: 'active', run: 100 }).params.run).toBeNull();
  });

  test('the team comes from the path, or an old ?team= link', () => {
    expect(teamFromPath('/cfb-streak-king/team/alabama/')).toBe(idx('alabama'));
    expect(teamFromPath('/cfb-streak-king/team/not-a-team/')).toBeNull();
    expect(teamFromPath('/cfb-streak-king/team/x:tarletonstate/')).toBeNull();
    expect(parseUrl('/cfb-streak-king/', '?team=georgia').team).toBe(idx('georgia'));
    expect(toUrl({ ...DEFAULT_VIEW, team: idx('georgia') }).path).toBe('team/georgia/');
  });

  test('junk params fall back to defaults', () => {
    expect(parseUrl('/', '?dir=X&scope=nope&run=abc&week=yes')).toEqual(DEFAULT_VIEW);
  });

  test('a crown links to its team page with its definition', () => {
    const u = crownUrl(idx('alabama'), { chips: ['road'], dir: 'U', scope: 'active', len: 5, atEdge: false, field: 20, live: true, also: 0, chance: 0 });
    expect(u.path).toBe('team/alabama/');
    expect(search(u.params)).toBe('c=road&dir=U&scope=active');
  });
});

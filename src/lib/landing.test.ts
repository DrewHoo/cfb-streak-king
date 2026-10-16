import { describe, expect, test } from 'vitest';
import { LANDINGS, landingBySlug, landingFor, landingFromPath, leadSentence } from './landing.ts';
import { DEFAULT_CHIPS, encodeChips, chipsFromParam } from './definition.ts';
import { chipByKey } from './chips.ts';
import { teams } from './model.ts';

describe('landing', () => {
  test('every slug is unique, a path, and no team id', () => {
    const slugs = LANDINGS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
    const ids = new Set(teams.map((t) => t.id));
    for (const s of slugs) expect(ids.has(s)).toBe(false);
    for (const s of ['games', 'game', 'team', 'breakers', 'stoppers', 'blog', 'at-risk', 'week']) expect(slugs).not.toContain(s);
  });

  test('every definition reads as chips the catalog has, and no two share one', () => {
    const seen = new Set<string>();
    for (const l of LANDINGS) {
      if (l.c !== 'all') for (const part of l.c.split(',')) expect(chipByKey.has(part.split(':')[0])).toBe(true);
      // the c spelling round-trips through the catalog's own encoding
      expect(encodeChips(chipsFromParam(l.c)) || 'all').toBe(l.c);
      const k = `${l.c}|${l.dir}|${l.scope}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      expect(l.h1).toMatch(/^Longest /);
      expect(l.description.length).toBeGreaterThan(60);
    }
  });

  test('the default definition is the root page, not a landing', () => {
    expect(landingFor(encodeChips(DEFAULT_CHIPS), 'W', 'all')).toBeNull();
  });

  test('a landing is found by its path and its definition', () => {
    expect(landingFromPath('/cfb-streak-king/longest-home-win-streaks/')?.c).toBe('home');
    expect(landingFromPath('/cfb-streak-king/longest-home-win-streaks')?.c).toBe('home');
    expect(landingFromPath('/cfb-streak-king/')).toBeNull();
    expect(landingFor('home', 'W', 'active')?.slug).toBe('longest-home-win-streaks');
    expect(landingFor('home', 'W', 'all')?.slug).toBe('longest-home-win-streaks-ever');
    expect(landingFor('home', 'C', 'all')).toBeNull();
  });

  test('a title says what people type', () => {
    expect(landingBySlug.get('longest-active-win-streaks')!.title).toBe('Current longest winning streaks in college football');
    expect(landingBySlug.get('longest-home-losing-streaks')!.title).toBe('Current longest home losing streaks in college football');
    expect(landingBySlug.get('longest-win-streaks-in-college-football-history')!.title).toBe('Longest winning streaks in college football history');
    // a row's own title wins where the searcher's words differ from the page's
    expect(landingBySlug.get('longest-active-cover-streaks')!.title).toBe('Current longest cover streaks (ATS) in college football');
    expect(landingBySlug.get('longest-active-cover-streaks')!.h1).toBe('Longest active cover streaks in college football');
    expect(landingBySlug.get('longest-win-streaks-in-october')!.title).toBe('Current longest October winning streaks in college football');
  });

  test('a definition with a chip choice (a month) has a page, found by its spelling', () => {
    expect(landingFor('month:10', 'W', 'active')?.slug).toBe('longest-win-streaks-in-october');
    expect(landingFor('all', 'C', 'active')?.slug).toBe('longest-active-cover-streaks');
    expect(landingFor('all', 'N', 'active')?.slug).toBe('longest-active-ats-losing-streaks');
  });

  describe('lead sentence', () => {
    const ep = (d: string) => Date.parse(d) / 86400000;
    const active = landingBySlug.get('longest-active-win-streaks')!;
    const ever = landingBySlug.get('longest-win-streaks-in-college-football-history')!;
    test('names the leader, the length, since when, and the next two', () => {
      expect(leadSentence(active, [
        { name: 'Indiana', len: 22, atEdge: false, startEp: ep('2024-10-19') },
        { name: 'Texas Tech', len: 16, atEdge: false },
        { name: 'Oregon', len: 11, atEdge: false },
        { name: 'BYU', len: 6, atEdge: false },
      ])).toBe('Indiana has the longest active win streak in FBS: 22 games, since October 2024. Then Texas Tech at 16 and Oregon at 11.');
    });
    test('a tie at the top is shared, and a lone row has no "then"', () => {
      expect(leadSentence(active, [
        { name: 'Navy', len: 6, atEdge: false },
        { name: 'Ohio State', len: 6, atEdge: false },
        { name: 'Purdue', len: 4, atEdge: false },
      ])).toBe('Navy and Ohio State share the longest active win streak in FBS: 6 games. Then Purdue at 4.');
      expect(leadSentence(active, [{ name: 'Navy', len: 1, atEdge: false }])).toBe('Navy has the longest active win streak in FBS: 1 game.');
      expect(leadSentence(active, [])).toBe('');
    });
    test('all-time gives the years, or says it is still going', () => {
      expect(leadSentence(ever, [
        { name: 'Oklahoma', len: 47, atEdge: false, startEp: ep('1953-10-10'), endEp: ep('1957-11-09') },
        { name: 'Toledo', len: 35, atEdge: false },
      ])).toBe('Oklahoma holds the longest win streak of any FBS team since 1936: 47 games, 1953–1957. Then Toledo at 35.');
      expect(leadSentence(ever, [{ name: 'Indiana', len: 48, atEdge: false, startEp: ep('2024-08-31'), live: true }]))
        .toBe('Indiana holds the longest win streak of any FBS team since 1936: 48 games, from 2024 and still going.');
    });
  });
});

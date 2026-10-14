import { describe, expect, test } from 'vitest';
import { LANDINGS, landingFor, landingFromPath } from './landing.ts';
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
});

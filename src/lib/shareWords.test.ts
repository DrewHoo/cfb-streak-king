import { describe, expect, test } from 'vitest';
import { defWords, shareText } from './shareWords.ts';
import type { ShareMeta } from './shareWords.ts';
import { P, teams } from './model.ts';
import { DEFAULT_CHIPS, PARAMS, chipWord } from './definition.ts';
import { chipByKey } from './chips.ts';

// the worker's meta, built the way the prerender builds it
const meta: ShareMeta = {
  site: 'College Football Streak King',
  teams: Object.fromEntries(teams.filter((t) => t.major).map((t) => [t.id, t.name])),
  mascots: P.mascots ?? [],
  colors: P.colors ?? [],
};
const q = (s: string) => new URLSearchParams(s);
const BASE = '/cfb-streak-king/';

describe('shareWords', () => {
  test('plain chips word as their labels, in order, dropping what it cannot read', () => {
    expect(defWords('road,ranked', meta)).toEqual(['on the road', 'vs ranked opponents']);
    expect(defWords('all', meta)).toEqual([]);
    expect(defWords('road,nope,vsteam:not-a-team', meta)).toEqual(['on the road']);
  });

  test('every parameter kind words exactly like definition.ts', () => {
    // [the c= fragment, the ChipRef definition.ts would decode it to]
    const cases: [string, { key: string; param: string | number }][] = [
      ['month:11', { key: 'month', param: 11 }],
      ['leadhalf:7', { key: 'leadhalf', param: 7 }],
      ['state:OH', { key: 'state', param: 'OH' }],
      ['vsconf:SEC', { key: 'vsconf', param: 'SEC' }],
      ['vsteam:minnesota', { key: 'vsteam', param: teams.findIndex((t) => t.id === 'minnesota') }],
      ['vsmascot:bulldogs', { key: 'vsmascot', param: P.mascots!.indexOf('Bulldogs') }],
      ['vsmascot:force', { key: 'vsmascot', param: P.mascots!.indexOf('force') }],
      ['vscolor:orange', { key: 'vscolor', param: P.colors!.indexOf('orange') }],
    ];
    for (const [frag, ref] of cases) {
      expect(defWords(frag, meta), frag).toEqual([chipWord(ref)]);
    }
  });

  test('the absent c param means the same default definition.ts uses', () => {
    const words = DEFAULT_CHIPS.map((ref) => chipWord(ref));
    const t = shareText(BASE, q('dir=L'), meta)!;
    for (const w of words) expect(t.title).toContain(w);
  });

  test('mascot URL keys match the slugs definition.ts encodes', () => {
    for (const [i] of PARAMS.mascot.options(chipByKey.get('vsmascot')!)) {
      const enc = PARAMS.mascot.encode(i);
      expect(defWords(`vsmascot:${enc}`, meta), enc).toHaveLength(1);
    }
  });

  test('a bare or already-prerendered URL is left alone', () => {
    expect(shareText(BASE, q(''), meta)).toBeNull();
    expect(shareText(BASE + 'games/', q(''), meta)).toBeNull();
    expect(shareText(BASE + 'games/week/5/', q(''), meta)).toBeNull();
    expect(shareText(BASE + 'team/alabama/', q(''), meta)).toBeNull();
  });

  test('a definition board titles itself; an open team leads it', () => {
    const t = shareText(BASE, q('c=road,ranked&dir=L&scope=active'), meta)!;
    expect(t.title).toBe('Longest active losing streaks · on the road · vs ranked opponents · College Football Streak King');
    const g = shareText(BASE, q('c=vsteam:minnesota,road&t=michigan&run=3943'), meta)!;
    expect(g.title).toContain('Michigan — Longest all-time winning streaks · vs Minnesota · on the road');
  });

  test('a margin outcome words like the board does; an unreadable one is winning', () => {
    expect(shareText(BASE, q('c=road&dir=W10'), meta)!.title).toMatch(/^Longest all-time winning by 10\+ streaks · on the road/);
    expect(shareText(BASE, q('dir=L7&scope=active'), meta)!.description).toMatch(/active losing by 7\+ streak/);
    expect(shareText(BASE, q('dir=W0'), meta)!.title).toMatch(/all-time winning streaks/);
  });

  test('a matchup names both sides; the next game stands in for an unknown one', () => {
    expect(shareText(BASE + 'team/alabama/', q('vs=mississippi-state'), meta)!.title)
      .toBe('Alabama vs Mississippi State · College Football Streak King');
    expect(shareText(BASE + 'team/alabama/', q('vs=next'), meta)!.title)
      .toBe('Alabama’s next game · College Football Streak King');
    expect(shareText(BASE + 'team/alabama/', q('vs=not-a-team'), meta)).toBeNull();
  });
});

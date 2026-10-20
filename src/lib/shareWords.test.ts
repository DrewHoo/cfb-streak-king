import { describe, expect, test } from 'vitest';
import { defWords, shareText, rowWords, gameFromShare, gameText, pastWeekText } from './shareWords.ts';
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

  test('a season-file row words its chips, joined with "+" in the file, and its margin', () => {
    const row = { team: 'alabama', chips: 'road+ranked', dir: 'W', len: 14, atEdge: false, rank: 1, field: 17, since: 2007 };
    expect(rowWords(row, meta)).toBe('14 straight on the road · vs ranked opponents');
    expect(rowWords({ ...row, chips: '', atEdge: true }, meta)).toBe('14+ straight');
    expect(rowWords({ ...row, dir: 'W10' }, meta)).toMatch(/^14 straight by 10\+ .*on the road · vs ranked opponents$/);
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
    // a team's by-opponent pages are prerendered too; a column open on one is worded from the page's definition
    expect(shareText(BASE + 'team/auburn/losing-streaks-by-opponent/', q(''), meta)).toBeNull();
    expect(shareText(BASE + 'team/auburn/losing-streaks-by-opponent/', q('t=georgia-tech'), meta)!.title).toBe('Auburn vs Georgia Tech — Longest all-time losing streaks as Auburn · College Football Streak King');
    expect(shareText(BASE + 'team/not-a-team/losing-streaks-by-opponent/', q('t=georgia-tech'), meta)).toBeNull();
    // the by-opponent board in any other state: ?as=, its default definition no conditions
    const as = shareText(BASE, q('as=auburn&dir=L&scope=active'), meta)!;
    expect(as.title).toBe('Longest active losing streaks as Auburn · College Football Streak King');
    expect(as.description).toMatch(/^Auburn’s longest active losing streak against each opponent it has played, ranked since 1936\./);
    expect(shareText(BASE, q('as=auburn&c=home'), meta)!.title).toBe('Longest all-time winning streaks as Auburn · at home · College Football Streak King');
    expect(shareText(BASE, q('as=not-a-team'), meta)).toBeNull();
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

describe('shareWords: landings and never-major opponents', () => {
  test("a named definition's page needs no rewrite; a panel open on it reads from its definition", () => {
    expect(shareText(`${BASE}longest-home-win-streaks/`, q(''), meta)).toBeNull();
    const t = shareText(`${BASE}longest-home-win-streaks/`, q('?t=alabama'), meta)!;
    expect(t.title).toBe('Alabama — Longest active winning streaks · at home · College Football Streak King');
    expect(t.description).toContain('longest active winning streak at home');
    const l = shareText(`${BASE}longest-active-losing-streaks/`, q('?t=kansas'), meta)!;
    expect(l.title).toBe('Kansas — Longest active losing streaks · College Football Streak King');
  });

  test('a game against a never-major opponent still names both sides, from the others table', () => {
    const other = teams.find((t) => !t.major)!;
    const withOthers: ShareMeta = { ...meta, others: { [other.id]: other.name } };
    const path = `${BASE}game/2026-09-05/${other.id}-at-alabama/`;
    expect(gameFromShare(path, meta)).toBeNull();
    const g = gameFromShare(path, withOthers)!;
    expect(g).toMatchObject({ away: other.id, home: 'alabama', neutral: false, date: '2026-09-05' });
    const text = gameText(g, withOthers, { home: 42, away: 7 }, []);
    expect(text.title).toBe(`Alabama 42, ${other.name} 7 (Sep 5, 2026) · College Football Streak King`);
    expect(gameText(g, withOthers, null, []).title).toBe(`${other.name} at Alabama, Sep 5, 2026: streaks on the line · College Football Streak King`);
    // a placeholder id carries a colon
    expect(gameFromShare(`${BASE}game/2026-08-29/x:sacramentostate-at-eastern-michigan/`, { ...meta, others: { 'x:sacramentostate': 'Sacramento State' } })).toMatchObject({ away: 'x:sacramentostate', home: 'eastern-michigan' });
  });

  test("a past season's schedule words by season and week", () => {
    expect(pastWeekText(1987, 8, meta).title).toBe('Week 8, 1987 college football: the games and the streaks they broke · College Football Streak King');
    expect(pastWeekText(1987, null, meta).title).toMatch(/^1987 college football season/);
  });
});

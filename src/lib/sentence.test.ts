import { describe, expect, test } from 'vitest';
import type { ChipRef } from './types.ts';
import type { Chip } from './chips.ts';
import { conflicts } from './chips.ts';
import { P, teams, CHIPS, activeBoard, allTimeBoard } from './model.ts';
import { definitionPhrase, claim, noClaim, ordinal, SLOTS } from './sentence.ts';
import { defaultParam, MAX_CHIPS } from './definition.ts';

const today = Math.floor(Date.parse(P.builtAt) / 86400000);
const idx = (id: string) => teams.findIndex((t) => t.id === id);
const chips = (...keys: string[]): ChipRef[] => keys.map((k) => {
  const [key, param] = k.split(':');
  return param == null ? { key } : { key, param: /^\d+$/.test(param) ? Number(param) : param };
});

// every ≤4-chip definition of parameterless chips, exclusivity honored
function* definitions(pool: Chip[]): Generator<Chip[]> {
  function* rec(start: number, chosen: Chip[]): Generator<Chip[]> {
    yield chosen;
    if (chosen.length === MAX_CHIPS) return;
    for (let i = start; i < pool.length; i++) {
      const c = pool[i];
      if (chosen.some((d) => conflicts(d, c))) continue;
      yield* rec(i + 1, [...chosen, c]);
    }
  }
  yield* rec(0, []);
}

describe('definitionPhrase', () => {
  test('every chip has a slot', () => {
    expect(CHIPS.map((c) => c.key).filter((k) => !SLOTS[k])).toEqual([]);
  });

  test('every parameterless definition reads cleanly', () => {
    const plain = CHIPS.filter((c) => !c.param);
    let n = 0;
    const bad = [];
    for (const def of definitions(plain)) {
      n++;
      const s = definitionPhrase(def.map((c) => ({ key: c.key })));
      const problems = [
        /undefined|null|\?|NaN/.test(s) && 'placeholder',
        /\s{2}|^\s|\s$/.test(s) && 'spacing',
        (s.match(/\bagainst\b/g) ?? []).length > 1 && 'two againsts',
        (s.match(/\bwhen\b/g) ?? []).length > 1 && 'two whens',
        / ,|,,/.test(s) && 'comma',
      ].filter(Boolean);
      if (problems.length) bad.push(`${def.map((c) => c.key).join('+')}: ${problems.join(', ')}: ${s}`);
    }
    expect(n).toBeGreaterThan(40000);
    expect(bad.slice(0, 20)).toEqual([]);
  });

  test('every chip that takes a choice reads cleanly at its default, alone and paired', () => {
    const plain = CHIPS.filter((c) => !c.param);
    for (const c of CHIPS.filter((x) => x.param)) {
      const p = { key: c.key, param: defaultParam(c) };
      for (const other of [null, ...plain]) {
        if (other && conflicts(c, other)) continue;
        const s = definitionPhrase(other ? [p, { key: other.key }] : [p]);
        expect(s, `${c.key}+${other?.key}`).not.toMatch(/undefined|null|\?|NaN|\s{2}/);
      }
    }
  });

  test('sample phrases', () => {
    expect([
      [],
      ['unranked'],
      ['road', 'confgame'],
      ['onescore', 'rivalry', 'night'],
      ['ranked', 'confgame', 'road'],
      ['vsteam:' + idx('auburn')],
      ['vsteam:' + idx('auburn'), 'vsnewcoach'],
      ['vsconf:SEC', 'ranked'],
      ['vsnewcoach', 'top10'],
      ['opener', 'postseason'],
      ['shootout', 'overtime'],
      ['dog14', 'whileranked', 'curcoach'],
      ['afterloss'],
      ['afterbye', 'home'],
      ['leadhalf:7', 'wonpos'],
      ['trailhalf:1'],
      ['state:TX', 'month:11'],
      ['instate', 'nonconf'],
      ['finale', 'struggle', 'afterwin', 'neutral'],
    ].map((keys) => definitionPhrase(chips(...keys)))).toMatchInlineSnapshot(`
      [
        "games",
        "games against unranked opponents",
        "games against conference opponents on the road",
        "one-score rivalry night games",
        "games against ranked conference opponents on the road",
        "games against Auburn",
        "games against Auburn while led by a first-year head coach",
        "games against ranked SEC opponents",
        "games against top-10 opponents led by first-year head coaches",
        "season openers in bowl and playoff games",
        "overtime shootouts",
        "games while ranked as a 14+ point underdog under the current head coach",
        "games coming off a loss",
        "games at home, coming off a bye",
        "games when leading at half by 7+ and winning the possession battle",
        "games when trailing at half",
        "games in Texas in November",
        "games against non-conference in-state opponents",
        "regular-season finales at neutral sites in rock fights, coming off a win",
      ]
    `);
  });
});

describe('claim', () => {
  test('an active streak reads in the present tense with its start', () => {
    const r = activeBoard(chips('unranked'), 'W', today)[0];
    expect(claim(r, chips('unranked'), 'W')).toMatch(new RegExp(`^${teams[r.ti].name} has won ${r.s.len}\\+? straight games against unranked opponents(, since [A-Z][a-z]{2} \\d{4})?\\.$`));
  });

  test('an ended run reads in the past tense with a year span', () => {
    const r = allTimeBoard(chips('unranked'), 'W', today).find((x) => x.ti === idx('alabama') && x.s.len === 100)!;
    expect(claim(r, chips('unranked'), 'W')).toBe('Alabama won 100 straight games against unranked opponents, 2007–2021.');
  });

  test('a run inside one year says "in"', () => {
    const r = allTimeBoard(chips('opener'), 'L', today).find((x) => !x.live && x.s.start!.se === x.s.end!.se && x.s.len === 1)!;
    expect(claim(r, chips('opener'), 'L')).toMatch(/ lost 1 straight season opener in \d{4}\.$/);
  });

  test('a run reaching the window edge takes a plus and no start date', () => {
    const r = allTimeBoard([], 'W', today).find((x) => x.s.atEdge && x.live);
    if (!r) return;
    expect(claim(r, [], 'W')).toMatch(/ has won \d+\+ straight games\.$/);
  });

  test('no streak', () => {
    expect(noClaim(idx('alabama'), chips('road'), 'L')).toBe('Alabama has no active losing streak in games on the road.');
  });
});

test('ordinal', () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
});

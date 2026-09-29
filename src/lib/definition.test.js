import { describe, expect, test } from 'vitest';
import { teams, CHIPS, chipByKey } from './model.js';
import {
  DEFAULT_CHIPS, MAX_CHIPS, MONTHS, HMARGINS, STATE_OPTIONS, CONF_OPTIONS, PRESETS,
  encodeChips, decodeChips, chipsToParam, chipsFromParam, defaultParam, withChip, swapChip, withoutChip, withParam, chipWord,
} from './definition.js';

// every value a chip's parameter can take in the UI
const paramValues = (c) => ({
  month: MONTHS.map(([n]) => n),
  hmargin: HMARGINS.map(([n]) => n),
  state: STATE_OPTIONS,
  conf: CONF_OPTIONS,
  team: [teams.findIndex((t) => t.id === 'alabama'), teams.findIndex((t) => t.id === 'x:tarletonstate')],
}[c.param]);

describe('URL round-trip', () => {
  test('every chip and every parameter value survives encode/decode', () => {
    for (const c of CHIPS) {
      for (const param of c.param ? paramValues(c) : [undefined]) {
        const def = [param === undefined ? { key: c.key } : { key: c.key, param }];
        expect(decodeChips(encodeChips(def)), c.key).toEqual(def);
      }
    }
  });

  test('a four-chip definition keeps its order', () => {
    const def = [{ key: 'road' }, { key: 'month', param: 11 }, { key: 'ranked' }, { key: 'vsconf', param: 'SEC' }];
    expect(decodeChips(encodeChips(def))).toEqual(def);
  });

  test('bad input is dropped, not guessed', () => {
    expect(decodeChips('road,nope,month:x,vsteam:not-a-team,state')).toEqual([{ key: 'road' }]);
    expect(decodeChips('')).toEqual([]);
    expect(decodeChips('home,ranked,dog,night,opener')).toHaveLength(MAX_CHIPS);
  });

  test('the c param: absent is the default, "all" is no constraints', () => {
    expect(chipsToParam(DEFAULT_CHIPS)).toBeNull();
    expect(chipsToParam([])).toBe('all');
    expect(chipsFromParam(null)).toEqual(DEFAULT_CHIPS);
    expect(chipsFromParam('all')).toEqual([]);
    expect(chipsFromParam(chipsToParam([{ key: 'road' }]))).toEqual([{ key: 'road' }]);
  });
});

describe('editing a definition', () => {
  test('an exclusive chip replaces its group-mate', () => {
    expect(withChip([{ key: 'home' }, { key: 'ranked' }], 'road')).toEqual([{ key: 'ranked' }, { key: 'road' }]);
  });
  test('a non-exclusive chip stacks', () => {
    expect(withChip([{ key: 'rivalry' }], 'instate')).toEqual([{ key: 'rivalry' }, { key: 'instate' }]);
  });
  test('a fifth chip is refused', () => {
    const four = [{ key: 'home' }, { key: 'ranked' }, { key: 'night' }, { key: 'opener' }];
    expect(withChip(four, 'rivalry')).toBe(four);
  });
  test('a chip with a choice starts at its default', () => {
    for (const c of CHIPS.filter((x) => x.param)) expect(withChip([], c.key)).toEqual([{ key: c.key, param: defaultParam(c) }]);
  });
  test('swap, remove, set param', () => {
    expect(swapChip([{ key: 'home' }, { key: 'night' }], 'home', 'month')).toEqual([{ key: 'month', param: 11 }, { key: 'night' }]);
    expect(withoutChip([{ key: 'home' }, { key: 'night' }], 'home')).toEqual([{ key: 'night' }]);
    expect(withParam([{ key: 'month', param: 11 }], 'month', 9)).toEqual([{ key: 'month', param: 9 }]);
  });
});

test('every chip reads as a word', () => {
  for (const c of CHIPS) {
    const w = chipWord(c.param ? { key: c.key, param: defaultParam(c) } : { key: c.key });
    expect(w, c.key).toMatch(/^\S.*\S$/);
    expect(w, c.key).not.toMatch(/undefined|\?/);
  }
});

test('presets only use real chips', () => {
  for (const p of PRESETS) for (const { key } of p.chips) expect(chipByKey.has(key), `${p.name}: ${key}`).toBe(true);
});

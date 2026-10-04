import { describe, expect, test } from 'vitest';
import { P, teams, fbsNow, gamesOf } from './model.ts';
import { chipByKey, qualifies } from './chips.ts';

// The mascot and color rulings as the payload ships them (data/ref/*,
// applied by build-current). These pin the judgment calls the chips sell.

const idx = (id: string) => teams.findIndex((t) => t.id === id);
const mascot = (label: string) => P.mascots!.indexOf(label);
const color = (word: string) => P.colors!.indexOf(word);
const CLASSES = ['animal', 'people', 'bird', 'cat', 'canine', 'myth', 'force'];

describe('team traits', () => {
  test('the payload carries the tables and every current-FBS team is tagged where a kind exists', () => {
    expect(P.mascots!.length).toBeGreaterThan(20);
    expect(P.colors).toEqual(['red', 'orange', 'gold', 'green', 'blue', 'purple', 'black']);
    for (const ti of fbsNow) expect(teams[ti].kc, teams[ti].id).toBeGreaterThanOrEqual(0);
    // a nickname that's a color, a plant or a machine is no mascot kind at all
    const kindless = [...fbsNow].filter((ti) => !teams[ti].mg?.length).map((ti) => teams[ti].id).sort();
    expect(kindless).toEqual(['north-texas', 'ohio-state', 'stanford', 'syracuse', 'toledo']);
  });

  test('every name-group in the table has at least two current-FBS teams; no "vs Horned Frogs"', () => {
    const groups = P.mascots!.filter((m) => !CLASSES.includes(m));
    for (const g of groups) {
      const gi = mascot(g);
      const holders = [...fbsNow].filter((ti) => teams[ti].mg?.includes(gi));
      expect(holders.length, g).toBeGreaterThanOrEqual(2);
    }
    expect(groups).not.toContain('Horned Frogs');
    // TCU still counts as an animal mascot
    expect(teams[idx('tcu')].mg).toContain(mascot('animal'));
  });

  test('the judgment calls hold: colors are the one a fan would name', () => {
    expect(teams[idx('alabama')].kc).toBe(color('red'));
    expect(teams[idx('ohio-state')].kc).toBe(color('red'));
    expect(teams[idx('auburn')].kc).toBe(color('orange'));
    expect(teams[idx('tennessee')].kc).toBe(color('orange'));
    expect(teams[idx('clemson')].kc).toBe(color('orange'));
    expect(teams[idx('michigan')].kc).toBe(color('blue'));
    expect(teams[idx('michigan')].kc).not.toBe(color('gold'));
    expect(teams[idx('lsu')].kc).toBe(color('purple'));
  });

  test('mascot kinds: Bulldogs are canine animals, the Tide is a force, Devils group up', () => {
    const uga = teams[idx('georgia')].mg!;
    expect(uga).toContain(mascot('Bulldogs'));
    expect(uga).toContain(mascot('canine'));
    expect(uga).toContain(mascot('animal'));
    expect(teams[idx('alabama')].mg).toEqual([mascot('force')]);
    expect(teams[idx('tennessee')].mg).toContain(mascot('people'));
    for (const id of ['duke', 'arizona-state']) expect(teams[idx(id)].mg).toContain(mascot('Devils'));
  });

  test('the chips read a game row: Alabama vs Mississippi State is a game vs Bulldogs', () => {
    const vsmascot = chipByKey.get('vsmascot')!;
    const vscolor = chipByKey.get('vscolor')!;
    const g = gamesOf(idx('alabama')).findLast((x) => x.oppIdx === idx('mississippi-state'))!;
    expect(qualifies(vsmascot, g, mascot('Bulldogs'))).toBe(true);
    expect(qualifies(vsmascot, g, mascot('canine'))).toBe(true);
    expect(qualifies(vsmascot, g, mascot('Tigers'))).toBe(false);
    expect(qualifies(vscolor, g, color('red'))).toBe(true); // maroon reads red
    const t = gamesOf(idx('alabama')).findLast((x) => x.oppIdx === idx('tennessee'))!;
    expect(qualifies(vscolor, t, color('orange'))).toBe(true);
    expect(qualifies(vscolor, t, color('blue'))).toBe(false);
  });
});

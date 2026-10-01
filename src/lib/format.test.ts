import { expect, test } from 'vitest';
import { oddsText } from './format.ts';

test('odds against, two significant figures, in words a reader says', () => {
  expect(oddsText(0.6)).toBe('likely');
  expect(oddsText(0.5)).toBe('likely');
  expect(oddsText(0.4)).toBe('1 in 2.5');
  expect(oddsText(1 / 42)).toBe('1 in 42');
  expect(oddsText(1 / 4213)).toBe('1 in 4,200');
  expect(oddsText(1 / 987654)).toBe('1 in 990,000');
  expect(oddsText(2.4e-7)).toBe('1 in 4.2 million');
  expect(oddsText(1e-10)).toBe('1 in 10 billion');
  expect(oddsText(3e-13)).toBe('1 in 3.3 trillion');
  expect(oddsText(2.7e-22)).toBe('1 in 10²²');
});

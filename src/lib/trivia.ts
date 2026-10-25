// Simple and trivia (specs/trivia.spec.md): a streak is simple when its
// definition has at most two conditions, a margin outcome ("won by 10+")
// counting as one, and none of them is a trivia chip; every other streak the
// list rule admits is trivia. The trivia chips are the ones nobody opens a
// thread with, and every win-more condition (one that describes the team
// already winning the game). Active and all-time list simple streaks; trivia
// is a list of its own, and off the breakers board. Pure, so the share
// worker words and scores with it; list.ts holds the knobs (LIST.admit).

import { isMargin } from './outcome.ts';
import type { Dir } from './types.ts';

/**
 * The trivia chips, by catalog key: a derived chip ("vscolor:red", "leadhalf:1") goes by its own.
 * This list, not list.ts's tiers, decides trivia: the tiers are prices the miner's keep floor reads, so retiering a chip re-mines.
 */
export const TRIVIA_CHIPS = ['fullmoon', 'weekday', 'weekend', 'vscolor', 'vsnewcoach', 'state', 'afterwin', 'leadhalf', 'trailhalf', 'wonpos', 'lostpos'];
/** The most conditions a simple streak has. */
export const MAX_SIMPLE = 2;

const triviaKeys = new Set(TRIVIA_CHIPS);
/** Whether a chip key (mined or catalog) is a trivia chip. */
export const isTriviaChip = (key: string) => triviaKeys.has(key.split(':')[0]);
/** How many conditions a definition makes: its chips, and a margin outcome as one more. */
export const conditionsOf = (d: { chips: readonly string[]; dir: Dir }) => d.chips.length + (isMargin(d.dir) ? 1 : 0);
/** Whether a definition is trivia: more than `max` conditions, or (with `chips`) a trivia chip at any count. */
export const isTrivia = (d: { chips: readonly string[]; dir: Dir }, max = MAX_SIMPLE, chips = true) => conditionsOf(d) > max || (chips && d.chips.some(isTriviaChip));

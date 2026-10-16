// What a break is worth (breakers.ts tells the season's breaks with it):
// pure, with no imports, so the share worker scores a past season's breaks
// from its season file the way the page does.

export type BreakCat = 'alltime' | 'leading';
export const BREAK_CATS: BreakCat[] = ['alltime', 'leading'];
export const BREAK_WORDS: Record<BreakCat, string> = { alltime: 'all-time longest', leading: 'was longest active streak' };

/** The weights: points by category, the discount per condition (base ÷ (1 + discount × conditions)), and the covering flag. */
export const BREAK = { points: { alltime: 10, leading: 4 } as Record<BreakCat, number>, discount: 0.5, covers: false };

/** A break's category: the longest ever under the definition, else a run the list rule admits by its place (the active field's leader, or the medal rule's `admitRank`); any other run isn't a break here. */
export const breakCat = (b: { len: number; everLen: number; rank: number }, admitRank = 1): BreakCat | null => (b.len >= b.everLen ? 'alltime' : b.rank <= admitRank ? 'leading' : null);
/** What a break is worth. */
export const breakPoints = (b: { len: number; everLen: number; rank: number; chips: string[] }, w = BREAK, admitRank = 1) => {
  const c = breakCat(b, admitRank);
  return c ? w.points[c] / (1 + w.discount * b.chips.length) : 0;
};

/**
 * The leaderboard's order: the most points first, then the most breaks, then
 * the team's index. Points compare rounded, because a sum taken in a different
 * order (the page's and the share worker's) differs in its last bits, and a
 * tie must fall the same way wherever it is ranked.
 */
export const rankOrder = (a: { ti: number; n: number; points: number }, b: { ti: number; n: number; points: number }) =>
  Math.round(b.points * 1e6) - Math.round(a.points * 1e6) || b.n - a.n || a.ti - b.ti;


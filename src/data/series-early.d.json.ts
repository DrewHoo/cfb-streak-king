// Types for series-early.json (scripts/data/build-series-early.mjs).
declare const early: {
  v: number;
  /** The payload's first season: every game here is before it. */
  before: number;
  source: string;
  /** Team ids, which hi/ai index. */
  teams: string[];
  games: { se: number[]; ep: number[]; hi: number[]; ai: number[]; hs: number[]; as: number[]; fl: number[] };
};
export default early;

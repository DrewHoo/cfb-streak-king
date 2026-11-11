// Types for series-early.json (scripts/data/build-series-early.mjs).
declare const early: {
  v: number;
  /** Where the games come from; `src` indexes it. */
  sources: string[];
  /** Team ids, which hi/ai index. */
  teams: string[];
  games: { se: number[]; ep: number[]; hi: number[]; ai: number[]; hs: number[]; as: number[]; fl: number[]; src: number[] };
};
export default early;

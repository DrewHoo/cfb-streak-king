// The payload as shipped (src/data/payload.json, built by
// scripts/data/build-payload.mjs and build-current.mjs) and the shapes the
// client derives from it. Encodings are in schema.ts.

/** A head-coach stint: coach index, first season, games into that season it began, interim. */
export type Stint = [ci: number, startSe: number, startOrd: number, interim: 0 | 1];

export interface Team {
  id: string;
  name: string;
  /** Seasons Howell counts as major (FBS from 1978); null for a team never major. */
  major: [number, number][] | null;
  /** Postal code of the campus. */
  st?: string;
  espn?: string | null;
  /** [firstSeason, lastSeason, confIdx] runs. */
  conf?: [number, number, number][];
  /** -1 as the coach index: an unresolved multi-coach season. */
  hc?: Stint[];
  /** Mascot kinds (indices into Payload.mascots): the nickname's name-group and its classes. */
  mg?: number[];
  /** The school's identity color (index into Payload.colors). */
  kc?: number;
}

/** Completed games as parallel arrays, ascending by ep. */
export interface GameCols {
  se: number[]; ep: number[]; hi: number[]; ai: number[]; hs: number[]; as: number[];
  fl: number[]; sp: number[]; hr: number[]; ar: number[]; hh: number[]; rv: number[]; vs: number[];
  hf: number[]; af: number[]; hp: number[]; ap: number[]; ot: number[];
}

/** Scheduled games of the running season. */
export interface UpcomingCols {
  ep: number[]; hi: number[]; ai: number[]; fl: number[]; hr: number[]; ar: number[];
  hh: number[]; rv: number[]; wk: number[]; vs: number[];
  /** The line as of the build, encoded like games.sp; absent in payloads built before it was added. */
  sp?: number[];
}

export interface Payload {
  v: number;
  builtAt: string;
  lastBaseSeason: number;
  floors: Record<string, number>;
  confs: string[];
  states: string[];
  coachNames: string[];
  coachIds: (string | number)[];
  teams: Team[];
  rivals: { n: string; a: number; b: number }[];
  games: GameCols;
  currentSeason: number;
  upcoming: UpcomingCols;
  /** Mascot kinds: name-group labels ("Bulldogs"), then class keys ("animal"); absent in older payloads. */
  mascots?: string[];
  /** School color words; absent in older payloads. */
  colors?: string[];
}

export type Result = 'W' | 'L' | 'T';
/**
 * The outcome a streak counts: won, lost, undefeated (won or tied), covered
 * the spread, or failed to. A winning or losing outcome can carry the margin
 * it demands, "W10": won by 10 or more (outcome.ts reads it).
 */
export type Dir = 'W' | 'L' | 'U' | 'C' | 'N' | `W${number}` | `L${number}`;
/** Against the closing spread: covered, didn't, or pushed. */
export type Cover = 'W' | 'L' | 'P';
export type Scope = 'active' | 'all';

/** What's known about a game before kickoff, from one team's side. */
export interface GameContext {
  i: number;
  ep: number;
  se: number;
  home: boolean;
  neutral: boolean;
  conf: boolean;
  post: boolean;
  oppIdx: number;
  /** AP rank at kickoff, 0 unranked, null when no poll was in effect. */
  oppRank: number | null;
  ownRank: number | null;
  /** The line from our side, + = we were underdogs; null when unlined. Closing for a played game, as of the build for a scheduled one. */
  sp: number | null;
  hh: number;
  rv: number;
  /** Venue state, postal code. */
  vst: string | null;
  /** The team's own campus state, postal code; a venue-state chip never counts a game here. */
  ownSt: string | null;
  month: number;
  /** Day of the week of the game date, 0 Sunday. */
  wday: number;
  /** The moon is full within a day of the game's evening (moon.ts). */
  moon: boolean;
  /** The opponent's conference that season. */
  oppConf: string | null;
  /** The team's own conference that season ("Independent" for an independent; the conference chips can't read such a game). */
  ownConf: string | null;
  /** The opponent counted as power-conference that season (power.ts; always false before 1998). */
  oppPower: boolean;
  /** The team itself was a power-conference member that season (strict membership, so never Notre Dame while independent). */
  ownPower: boolean;
  /** The opponent's mascot kinds (indices into Payload.mascots; empty when unknown). */
  oppMascots: readonly number[];
  /** The opponent's school color (index into Payload.colors; -1 unknown). */
  oppColor: number;
  /** The opponent's campus is in our campus's state. */
  inState: boolean;
  hcCur: boolean;
  hcNew: boolean;
  vsNew: boolean;
  opener?: boolean;
  finale?: boolean;
}

/** A completed game from one team's side. */
export interface GameRow extends GameContext {
  us: number;
  them: number;
  r: Result;
  margin: number;
  total: number;
  /** Overtime periods; -1 unknown. */
  ot: number;
  /** Halftime margin from our side; null unknown. */
  h1: number | null;
  /** Our share of possession; null unknown. */
  pos: number | null;
  /** Against the closing spread; null when the game has no line. */
  cover: Cover | null;
  /** The result of our previous game, if it was this season or last. */
  prevR: Result | null;
  /** Days since our previous game. */
  rest: number | null;
}

/** A scheduled game from one team's side. */
export interface UpcomingRow extends GameContext {
  wk: number;
}

export interface ChipRef {
  key: string;
  param?: string | number;
}

export interface Streak {
  dir: Dir;
  len: number;
  /** The run reaches the first qualifying game in the team's window. */
  atEdge: boolean;
  last: GameRow;
  /** The game that ended the previous run; null at the window edge. */
  ender: GameRow | null;
  start?: GameRow;
  end?: GameRow;
  startIdx?: number;
  endIdx?: number;
}

export interface BoardRow {
  ti: number;
  s: Streak;
  /** The team's qualifying games, ascending. */
  qual: GameRow[];
  /** The team's next qualifying scheduled game. */
  next: UpcomingRow | null;
  /** That game is within 8 days. */
  onTheLine: boolean;
  /** All-time rows: the game that broke the run, null when it's live. */
  ended?: GameRow | null;
  live?: boolean;
  key?: string;
}

/**
 * A run under one definition: the definition's conditions, the team's place
 * in that field, and the rates the list rule scores it by (list.ts).
 */
export interface Placing {
  chips: string[];
  /** Teams holding any run under the definition. */
  field: number;
  /** 1 = the longest; teams level on length share a rank. */
  rank: number;
  tied: number;
  /** The longest run any other team holds; the gap to it is part of the score. */
  second: number;
  /** The outcome's rate pooled over every FBS team's qualifying games, and how many games that is. */
  p: number;
  n: number;
  /** The team's own hits and qualifying games under the definition. */
  hT: number;
  nT: number;
  /** The run reaches the definition's first qualifying game in the team's window, and no later qualifying game broke it: both read the definition, so a placing carries its own. */
  atEdge: boolean;
  live: boolean;
  /** A broken run's: the longest run ever under the definition, by any team, and how many teams' longest it is. */
  everLen?: number;
  everN?: number;
}

/**
 * One of a team's runs as the miner keeps it: under the definition with the
 * fewest conditions, with the definition the team places highest under in
 * `highest` when that is a different one. Active: the team's current run;
 * all-time: its longest ever. The list rule (list.ts) decides whether the
 * run is on a list, which placing it shows, and its score.
 */
export interface MinedCrown extends Placing {
  dir: Dir;
  scope: Scope;
  len: number;
  startSe?: number;
  endSe?: number;
  /** How many other definitions have the same run. */
  also: number;
  highest?: Placing;
}

/** A run on a list: its picked placing at the top level, the rule's outputs, and its other placing. */
export interface Crown extends MinedCrown {
  /** The chance some team's streak reaches this length under the definition by luck alone, 0–1. */
  chance: number;
  score: number;
  /** The per-game rarity the score used, in bits (list.ts rateOf). */
  bits: number;
  /** A sub-streak: the team holds a run at least as long under a subset of these conditions (list.ts markSubStreaks); shown on request. */
  subStreak: boolean;
  /** The run's other placing, when it has one: fewer conditions, or a higher place. */
  other?: Placing;
}

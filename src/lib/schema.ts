// The payload's encoding, shared by the build scripts (scripts/data, which
// import this file directly; Node strips the types) and the client.

/** Bits of games.fl and upcoming.fl. */
export const FLAG = { neutral: 1, conf: 2, post: 4 } as const;

/** games.sp: no closing line. Lines are stored in half-points, home side. */
export const NO_LINE = 9999;
/** games.hh / upcoming.hh: kickoff hour unknown. */
export const NO_HOUR = 31;
/** games.hf / af / hp / ap / ot: box-score field unknown (before its floor). */
export const UNKNOWN = -1;
/** games.hr / ar: the team wasn't ranked in the poll in effect. */
export const UNRANKED = 0;
/** The end year of a span that runs to the present (teams[].major). */
export const PRESENT = 9999;

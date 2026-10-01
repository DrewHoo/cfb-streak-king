// Full moons, for the werewolf chip. Each full moon's instant comes from
// Meeus, Astronomical Algorithms (2nd ed.), ch. 49: the mean phase plus the
// periodic terms for a full moon, good to a few minutes. The planetary terms
// (under a minute) and ΔT (about a minute across the window) are left out;
// neither can move a game across the one-day line below.

const RAD = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * RAD);
/** Julian Day of 1970-01-01 00:00 UTC: JD minus this is the epoch day. */
const JD_EPOCH = 2440587.5;

/** The instant of full moon number k (k = n + 0.5, n = 0 at the January 2000 new moon), as a fractional epoch day. */
function fullMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;
  const corr =
    -0.40614 * sin(Mp)
    + 0.17302 * E * sin(M)
    + 0.01614 * sin(2 * Mp)
    + 0.01043 * sin(2 * F)
    + 0.00734 * E * sin(Mp - M)
    - 0.00514 * E * sin(Mp + M)
    + 0.00209 * E * E * sin(2 * M)
    - 0.00111 * sin(Mp - 2 * F)
    - 0.00057 * sin(Mp + 2 * F)
    + 0.00056 * E * sin(2 * Mp + M)
    - 0.00042 * sin(3 * Mp)
    + 0.00042 * E * sin(M + 2 * F)
    + 0.00038 * E * sin(M - 2 * F)
    - 0.00024 * E * sin(2 * Mp - M)
    - 0.00017 * sin(Om)
    - 0.00007 * sin(Mp + 2 * M)
    + 0.00004 * sin(2 * Mp - 2 * F)
    + 0.00004 * sin(3 * M)
    + 0.00003 * sin(Mp + M - 2 * F)
    + 0.00003 * sin(2 * Mp + 2 * F)
    - 0.00003 * sin(Mp + M + 2 * F)
    + 0.00003 * sin(Mp - M + 2 * F)
    - 0.00002 * sin(Mp - M - 2 * F)
    - 0.00002 * sin(3 * Mp + M)
    + 0.00002 * sin(4 * Mp);
  return jde + corr - JD_EPOCH;
}

// every full moon from 1930 through 2035, ascending
const FULL_MOONS: number[] = [];
for (let n = Math.floor((1930 - 2000) * 12.3685); n <= Math.ceil((2035 - 2000) * 12.3685); n++) FULL_MOONS.push(fullMoon(n + 0.5));

/** The full moon nearest a fractional epoch day. */
export function nearestFullMoon(t: number): number {
  let lo = 0, hi = FULL_MOONS.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (FULL_MOONS[mid] <= t) lo = mid; else hi = mid;
  }
  return Math.abs(FULL_MOONS[lo] - t) <= Math.abs(FULL_MOONS[hi] - t) ? FULL_MOONS[lo] : FULL_MOONS[hi];
}

/**
 * A game on this date is played under a full moon when the moon is full
 * within a day of that evening: 00:00 UTC after the game date, 8pm Eastern
 * in season. About three games in 44.
 */
export const underFullMoon = (ep: number) => Math.abs(nearestFullMoon(ep + 1) - (ep + 1)) <= 1;

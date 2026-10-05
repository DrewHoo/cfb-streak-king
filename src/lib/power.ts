// Which opponents count as "power conference" in a season. The ruling is
// era-aware and follows the sport's own formal lines, never a retroactive
// judgment:
//
//   1998–2013  the BCS automatic-qualifying conferences: ACC, Big East,
//              Big Ten, Big 12, Pac-10/12 and SEC, with the American
//              inheriting the Big East's berth for 2013, the BCS's final
//              season (UCF won that year's Fiesta Bowl on it).
//   2014–2023  the Power 5: the five autonomy conferences named in NCAA
//              governance when the College Football Playoff began.
//   2024–      the Power 4: the same minus the Pac-12, which 2024
//              realignment cut to two teams (the 2026 rebuild from the
//              Mountain West doesn't restore it).
//
// Notre Dame counts throughout, by team exception: every power conference
// that requires a power opponent in nonconference scheduling counts Notre
// Dame as one, and the BCS wrote it its own automatic-berth rule from 1998.
// Its 2020 ACC season needs no exception. Army does not count: only the
// Big Ten and SEC treat it as a power opponent, and it spent the era in
// C-USA (1998–2004), independence, and the American (2024–).
//
// Before the BCS no formal line exists — the Bowl Coalition and Alliance
// (1992–97) never included the Big Ten or Pac-10, and earlier eras kept
// many of the best teams (Notre Dame, Penn State, Miami) independent, so
// "power conference opponent" would systematically miss them. The chip's
// floor is therefore 1998, not a retroactive call.
//
// The payload names a lineage by its modern name (Pac-12 covers Pac-8/10
// seasons), so spans here use payload names, and teams use payload ids.

/** The first season "power conference" means something: the BCS's first. */
export const POWER_FROM = 1998;

const SPANS: Record<string, [number, number]> = {
  SEC: [POWER_FROM, Infinity],
  'Big Ten': [POWER_FROM, Infinity],
  'Big 12': [POWER_FROM, Infinity],
  ACC: [POWER_FROM, Infinity],
  'Pac-12': [POWER_FROM, 2023],
  'Big East': [POWER_FROM, 2012],
  American: [2013, 2013],
};

/** Teams that count regardless of conference, by payload id. */
const TEAMS: Record<string, [number, number]> = {
  'notre-dame': [POWER_FROM, Infinity],
};

/** Whether `conf` (a payload conference name) was a power conference in `season`. */
export function isPowerConf(conf: string | null, season: number): boolean {
  if (!conf) return false;
  const s = SPANS[conf];
  return !!s && season >= s[0] && season <= s[1];
}

/** Whether the team with payload id `id`, in `conf` that season, counts as a power-conference opponent. */
export function isPowerOpp(id: string | undefined, conf: string | null, season: number): boolean {
  if (isPowerConf(conf, season)) return true;
  const t = id ? TEAMS[id] : undefined;
  return !!t && season >= t[0] && season <= t[1];
}

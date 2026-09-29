// Coach stint resolution, shared by build-payload.mjs (1978-2025) and
// build-current.mjs (the 2026 layer).
//
// CFBD's /coaches endpoint gives one row per coach per team per season with
// that coach's on-field record. Single-coach seasons need no work. Multi-coach
// seasons are resolved to an exact per-game boundary by matching each coach's
// (w, l, t) as a prefix of the team's result sequence for that season: try
// coach orderings, walk the results accumulating w/l/t, and cut where the
// triple matches exactly. Repole/cfbfastR and CFBD count the same games, so
// exact prefix hits are the expected case; a season where no ordering matches
// is marked unresolved (coach null for that whole season) rather than guessed.

/**
 * results: ['W','L','T', ...] the team's games for one season, in order.
 * rows: [{ k, g, w, l, t }] the season's coach rows (order not trusted).
 * prevK: the coach who ended the previous season, tried first.
 * Returns [{ k, startOrd }] in game order, or null if no ordering matches.
 */
export function resolveSeason(results, rows, prevK) {
  const perms = [];
  const permute = (rest, acc) => {
    if (!rest.length) { perms.push(acc); return; }
    for (let i = 0; i < rest.length; i++) permute(rest.toSpliced(i, 1), [...acc, rest[i]]);
  };
  permute(rows, []);
  perms.sort((a, b) => (b[0].k === prevK ? 1 : 0) - (a[0].k === prevK ? 1 : 0));
  for (const perm of perms) {
    let i = 0;
    const segs = [];
    let ok = true;
    for (const c of perm) {
      let w = 0, l = 0, t = 0;
      const start = i;
      while (i < results.length && !(w === c.w && l === c.l && t === c.t)) {
        const r = results[i];
        if (r === 'W') w++; else if (r === 'L') l++; else t++;
        i++;
        if (w > c.w || l > c.l || t > c.t) break;
      }
      if (!(w === c.w && l === c.l && t === c.t)) { ok = false; break; }
      segs.push({ k: c.k, startOrd: start });
    }
    // trailing games CFBD didn't count stay with the last coach
    if (ok) return segs;
  }
  return null;
}

/**
 * coachSeasons: Map(year -> [{ k, g, w, l, t }]), resultsBySeason:
 * Map(year -> results[]). Returns stints [{ k|null, startSe, startOrd }],
 * where k null means the season's boundary could not be resolved. warn is
 * called with (year, rows) for each unresolved season. resolvedByYear
 * (Map(year -> [{ k, startOrd }])) carries researched rulings that replace
 * that season's CFBD rows outright (data/ref/coach-overrides.json).
 */
export function buildStints(coachSeasons, resultsBySeason, warn, resolvedByYear) {
  const years = [...new Set([...coachSeasons.keys(), ...(resolvedByYear?.keys() ?? [])])].sort((a, b) => a - b);
  const stints = [];
  let lastK = undefined; // undefined = nothing yet; null = unresolved span
  const push = (k, startSe, startOrd) => {
    if (k !== lastK) { stints.push({ k, startSe, startOrd }); lastK = k; }
  };
  for (const year of years) {
    if (resolvedByYear?.has(year)) {
      for (const s of resolvedByYear.get(year)) push(s.k, year, s.startOrd);
      continue;
    }
    const rows = coachSeasons.get(year).filter((r) => r.g > 0);
    if (!rows.length) continue;
    if (rows.length === 1) {
      // CFBD sometimes drops a coach from a two-coach season, leaving one
      // row that covers only part of it; crediting that coach from game 0
      // hands the other coach's games to the wrong person. Two or more games
      // short of the team's season is that case: leave it unresolved (one
      // game short is usually a bowl the interim coached, and stays).
      const n = resultsBySeason.get(year)?.length ?? rows[0].g;
      if (rows[0].g + 1 < n) { warn?.(year, rows); push(null, year, 0); continue; }
      push(rows[0].k, year, 0);
      continue;
    }
    const results = resultsBySeason.get(year);
    const segs = results ? resolveSeason(results, rows, lastK) : null;
    if (!segs) {
      warn?.(year, rows);
      push(null, year, 0);
      continue;
    }
    for (const s of segs) push(s.k, year, s.startOrd);
  }
  return stints;
}

/**
 * A stint is an interim job when it started mid-season and never crossed a
 * season boundary: the next stint begins that same season or opens the next.
 */
export function markInterim(stints) {
  return stints.map((s, i) => {
    const next = stints[i + 1];
    const interim = s.startOrd > 0 && !!next &&
      (next.startSe === s.startSe || (next.startSe === s.startSe + 1 && next.startOrd === 0));
    return { ...s, interim };
  });
}

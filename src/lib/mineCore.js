// The miner's inner walk, in plain JavaScript with no imports so a Node
// worker thread can load it as is (crowns.ts prepares its inputs and reads
// its output; in the browser it runs on the page's thread). Everything it
// needs arrives as plain data: each team's per-chip bitmasks and results,
// the chips' conflicts and word costs, the week grid, the floors and the
// score weights. See crowns.ts for what the walk is.
//
// One depth-first walk over the subsets of up to four chips, each prefix's
// AND carried down and a prefix dropped with its subtree once fewer than
// FIELD_FLOOR teams keep a qualifying game or none keeps LEN_FLOOR. At each
// surviving definition, one forward scan per team and result sequence
// (plain, by the margin, against the spread) yields three things at once:
// the trailing run (the active reading), the longest run (all-time), and
// every run a game ended, with each team's run length entering every week,
// so an ended run can be placed in the field as its week began and the
// week's leader before and after can be compared (a new leader).
//
// `prefix` splits the walk across threads: a call evaluates the definition
// `prefix` names and, when `descend`, every definition below it. The empty
// prefix without descent is the empty definition alone.

const RESULT = { W: 1, L: 2, T: 0 };
const DIRS = ['W', 'L', 'U', 'C', 'N', 'W10', 'L10'];
// each scan's result sequence, and the outcome each of its runs names (W-shaped, L-shaped, undefeated)
const SCANS = [
  { seq: 'r', dirs: ['W', 'L', 'U'], lined: false },
  { seq: 'rM', dirs: ['W10', 'L10', null], lined: false },
  { seq: 'rC', dirs: ['C', 'N', null], lined: true },
];

const popcount = (x) => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};
const countAnd = (a, b) => { let n = 0; for (let w = 0; w < a.length; w++) n += popcount(a[w] & b[w]); return n; };
const log2 = Math.log2;

/**
 * Whether definition `a` (chip indices, ascending) is simpler than `b`:
 * fewer chips; then fewer choices in all (`choices[i]` is log2 of the
 * choices chip i is one of, 0 for a plain chip), so "at home" beats "vs
 * Alabama"; then earlier in the catalog.
 */
export function simpler(a, b, choices) {
  if (a.length !== b.length) return a.length < b.length;
  let ca = 0, cb = 0;
  for (const i of a) ca += choices[i];
  for (const i of b) cb += choices[i];
  if (ca !== cb) return ca < cb;
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k];
  return false;
}
const PLACING = ['chips', 'field', 'rank', 'tied', 'second', 'p', 'n', 'hT', 'nT', 'atEdge', 'live', 'rivals', 'everLen', 'everN'];
const placingOf = (r) => { const t = {}; for (const k of PLACING) if (r[k] !== undefined) t[k] = r[k]; return t; };
/**
 * Fold `cand`, one definition's placing of a run, into `held` under the
 * run's key: the fewest-conditions placing stays on top, `also` counts the rest, and
 * the highest placing (the lowest rank, then the fewest-conditions) rides along
 * as `highest` when it places higher than the top one. Used by the walk and,
 * across threads, by crowns.ts.
 */
export function collapseInto(held, key, cand, choices) {
  const prev = held.get(key);
  if (!prev) { held.set(key, cand); return; }
  const also = prev.also + cand.also + 1;
  let top = prev, other = cand;
  if (simpler(cand.chips, prev.chips, choices)) { top = cand; other = prev; held.set(key, cand); }
  top.also = also;
  const better = (x, y) => x.rank < y.rank || (x.rank === y.rank && simpler(x.chips, y.chips, choices));
  let best = null;
  for (const x of [other, prev.highest, cand.highest]) if (x && (!best || better(x, best))) best = x;
  top.highest = best && best.rank < top.rank ? placingOf(best) : undefined;
}

/**
 * One forward scan of a team's masked sequence: the trailing runs, the
 * longest runs, the runs ended by a game in a recorded week, and the run
 * lengths entering each recorded week (plus the state after the last one).
 * `results` codes each game 1 W, 2 L, 0 T; `wkOf[i]` is game i's week index
 * or -1; weeks from `wFrom` are recorded. `sideIdx` is written per recorded
 * week with the team's last qualifying game in it (-1 none).
 */
function scan(td, q, results, wkOf, wFrom, W, floor, out) {
  const entW = out.entW, entL = out.entL, entU = out.entU, lastGame = out.lastGame;
  lastGame.fill(-1, wFrom, W + 1);
  // the state after the last game lands in slot W
  let dir = 0, len = 0, startIdx = -1;
  let unb = 0, unbStart = -1;
  let prev = -1, firstIdx = -1;
  let wp = wFrom;
  let trailW = null, trailL = null, trailU = null; // set at the end
  let bestW = null, bestL = null, bestU = null;
  const ended = out.ended;
  ended.length = 0;
  const keep = (slot, l, s, e) => {
    // the longest run; on a tie the later one, as it sorts first on the all-time board
    if (!l) return slot;
    if (!slot || l >= slot.len) return { len: l, startIdx: s, lastIdx: e, atEdge: false, live: false };
    return slot;
  };
  for (let w = 0; w < td.words; w++) {
    if (!q[w]) continue;
    for (let b = 0; b < 32; b++) {
      if (!(q[w] & (1 << b))) continue;
      const i = (w << 5) | b;
      if (i >= td.n) continue;
      if (firstIdx < 0) firstIdx = i;
      const gw = wkOf[i];
      // the recorded weeks this game is the first of or past: what the team carried in
      if (gw >= 0) {
        while (wp <= gw) { entW[wp] = dir === 1 ? len : 0; entL[wp] = dir === 2 ? len : 0; entU[wp] = unb; wp++; }
        lastGame[gw] = i;
      } else if (gw === -2) {
        // a game past the last recorded week never happens: weeks cover every game
      }
      const r = results[i];
      if (r === dir) len++;
      else {
        if (dir === 1 || dir === 2) {
          const kept = keep(dir === 1 ? bestW : bestL, len, startIdx, prev);
          if (dir === 1) bestW = kept; else bestL = kept;
          if (len >= floor && gw >= wFrom) ended.push({ kind: dir === 1 ? 0 : 1, len, startIdx, lastIdx: prev, enderIdx: i, w: gw, atEdge: startIdx === firstIdx });
        }
        dir = r; len = 1; startIdx = i;
      }
      if (r !== 2) { if (!unb) unbStart = i; unb++; }
      else {
        bestU = keep(bestU, unb, unbStart, prev);
        if (unb >= floor && gw >= wFrom) ended.push({ kind: 2, len: unb, startIdx: unbStart, lastIdx: prev, enderIdx: i, w: gw, atEdge: unbStart === firstIdx });
        unb = 0;
      }
      prev = i;
    }
  }
  while (wp <= W) { entW[wp] = dir === 1 ? len : 0; entL[wp] = dir === 2 ? len : 0; entU[wp] = unb; wp++; }
  if (dir === 1 || dir === 2) { const kept = keep(dir === 1 ? bestW : bestL, len, startIdx, prev); if (dir === 1) bestW = kept; else bestL = kept; }
  bestU = keep(bestU, unb, unbStart, prev);
  for (const best of [bestW, bestL, bestU]) if (best) { best.atEdge = best.startIdx === firstIdx; best.live = best.lastIdx === prev; }
  // the trailing runs: the run of the latest result, and the undefeated run
  if (dir === 1 || dir === 2) {
    const t = { len, startIdx, lastIdx: prev, atEdge: startIdx === firstIdx, live: true };
    if (dir === 1) trailW = t; else trailL = t;
  }
  if (unb) trailU = { len: unb, startIdx: unbStart, lastIdx: prev, atEdge: unbStart === firstIdx, live: true };
  out.trail = [trailW, trailL, trailU];
  out.best = [bestW, bestL, bestU];
}

// the field's places: how many are longer than each length, how many level, the longest other
function placesOf(lens, T) {
  let best = 0, bestN = 0, second = 0, field = 0;
  for (let t = 0; t < T; t++) {
    const l = lens[t];
    if (!l) continue;
    field++;
    if (l > best) { second = best; best = l; bestN = 1; } else if (l === best) bestN++; else if (l > second) second = l;
  }
  return {
    field, best, bestN,
    rank: (len) => { let n = 1; for (let t = 0; t < T; t++) if (lens[t] > len) n++; return n; },
    tied: (len) => { let n = 0; for (let t = 0; t < T; t++) if (lens[t] === len) n++; return n; },
    other: (len) => (len === best ? (bestN > 1 ? best : second) : best),
  };
}

/**
 * Walk the definitions and return every team's candidate runs, per reading.
 * @param {object} input see crowns.ts (mineInput)
 */
export function mineCore(input) {
  const { teams: data, chips, weeks, floors, rank, prefix, descend, maxChips } = input;
  const T = data.length;
  const NP = chips.n;
  const W = weeks.count;
  const wFromDeep = weeks.wFrom; // the running season's first recorded week: deep definitions record from here
  const wFromHist = weeks.wHist; // the history pass records every week at definitions of up to `histChips` chips
  const { LEN_FLOOR, FIELD_FLOOR, KEEP_FLOOR } = floors;
  const { chanceW, leadW, leadFloor, spanA, spanAll, PMAX, cutoff } = rank;
  const log2Teams = log2(rank.teams);
  const seasons = (td, s, e) => (td.se[e] - td.se[s] + 1);

  const runs = { active: data.map(() => new Map()), all: data.map(() => new Map()), broken: data.map(() => new Map()), leaders: data.map(() => new Map()) };
  const q = Array.from({ length: maxChips + 1 }, () => data.map((td) => new Uint32Array(td.words)));
  const alive = Array.from({ length: maxChips + 1 }, () => new Uint8Array(T));
  for (let t = 0; t < T; t++) { q[0][t].fill(0xffffffff); alive[0][t] = 1; }
  const lens = new Int32Array(T);
  // per team, per scan: the scan's output buffers, reused
  const outs = data.map(() => SCANS.map(() => ({ entW: new Int16Array(W + 1), entL: new Int16Array(W + 1), entU: new Int16Array(W + 1), lastGame: new Int32Array(W + 1).fill(-1), ended: [], trail: null, best: null })));
  const linedBuf = data.map((td) => new Uint32Array(td.words));
  // the field entering each recorded week, per (scan, kind): reused
  const bestLen = new Int32Array(W + 2), bestN = new Int32Array(W + 2), bestT = new Int32Array(W + 2), secondLen = new Int32Array(W + 2), fieldN = new Int32Array(W + 2);
  // the counts the rates read: pooled over the field, and per team (8 per team: games, won, lost, lined, covered, missed, won by the margin, lost by it)
  const pooled = new Float64Array(8);
  const perTeam = new Float64Array(T * 8);
  const hitsOf = (c, o, dir) => {
    const g = c[o], won = c[o + 1], lost = c[o + 2], lined = c[o + 3], cov = c[o + 4], miss = c[o + 5], wonM = c[o + 6], lostM = c[o + 7];
    return dir === 'W' ? [won, g] : dir === 'L' ? [lost, g] : dir === 'U' ? [g - lost, g] : dir === 'C' ? [cov, lined] : dir === 'N' ? [miss, lined] : dir === 'W10' ? [wonM, g] : [lostM, g];
  };
  const rateOf = (dir) => { const [hit, n] = hitsOf(pooled, 0, dir); return { p: n ? hit / n : 1, n }; };
  // the team's games the outcome can count at all: every game, or every lined game for a spread outcome
  const gAll = Int32Array.from(data, (td) => td.n);
  const gLined = Int32Array.from(data, (td) => { let n = 0; for (const w of td.lined) n += popcount(w); return n; });
  const teamHits = (t, dir) => { const [hit, n] = hitsOf(perTeam, t * 8, dir); return { hT: hit, nT: n, gT: dir === 'C' || dir === 'N' ? gLined[t] : gAll[t] }; };
  // a definition whose opponent chip names one of the team's rivals: the choice was among its rivals, not among every opponent
  const rivalsOf = (t, def) => { if (!chips.rivalMask) return {}; for (const i of def) if (chips.rivalMask[t * NP + i]) return { rivals: chips.rivalN[t] }; return {}; };
  const conditionCost = (def) => { let c = 0; for (const i of def) c += chips.cost[i]; return c; };
  const fits = (def, d) => { for (const i of def) if (!chips.fits[i * 7 + d]) return false; return true; };
  const score = (scope, len, second, p, n, span, cost) => {
    const pp = Math.min(p, PMAX);
    const b = log2(1 / pp);
    const chance = scope === 'active' ? log2Teams : log2(Math.max(2, n * (1 - pp)));
    const gap = leadFloor == null ? len - second : Math.max(leadFloor, len - second);
    return len * b + leadW * gap * b - chanceW * chance - cost + (scope === 'active' ? spanA : spanAll) * log2(span);
  };
  const collapse = (held, key, cand) => collapseInto(held, key, cand, chips.choices);

  const evaluate = (def, depth) => {
    const qd = q[depth], ad = alive[depth];
    const cost = conditionCost(def);
    const hist = def.length <= input.histChips;
    const wFrom = hist ? wFromHist : wFromDeep;
    pooled.fill(0);
    perTeam.fill(0);
    for (let t = 0; t < T; t++) {
      const td = data[t];
      for (let s = 0; s < 3; s++) outs[t][s].trail = null;
      if (!ad[t]) continue;
      const qb = qd[t];
      for (let s = 0; s < 3; s++) {
        let m = qb;
        if (SCANS[s].lined) { m = linedBuf[t]; for (let w = 0; w < td.words; w++) m[w] = qb[w] & td.lined[w]; }
        scan(td, m, td[SCANS[s].seq], td.wkOf, wFrom, W, LEN_FLOOR, outs[t][s]);
      }
      // the empty definition fills every bit, past the last game too
      const o = t * 8;
      for (let w = 0; w < td.words; w++) {
        const rem = td.n - (w << 5);
        perTeam[o] += popcount(rem >= 32 ? qb[w] : qb[w] & ((1 << rem) - 1));
      }
      perTeam[o + 1] = countAnd(qb, td.won);
      perTeam[o + 2] = countAnd(qb, td.lost);
      perTeam[o + 3] = countAnd(qb, td.lined);
      perTeam[o + 4] = countAnd(qb, td.covered);
      perTeam[o + 5] = countAnd(qb, td.missed);
      perTeam[o + 6] = countAnd(qb, td.wonM);
      perTeam[o + 7] = countAnd(qb, td.lostM);
      for (let j = 0; j < 8; j++) pooled[j] += perTeam[o + j];
    }
    for (let s = 0; s < 3; s++) {
      for (let k = 0; k < 3; k++) {
        const dir = SCANS[s].dirs[k];
        if (!dir) continue;
        const d = DIRS.indexOf(dir);
        if (!fits(def, d)) continue;
        const { p, n } = rateOf(dir);
        // --- the active and all-time readings: every team's run, placed in the field
        for (const scope of ['active', 'all']) {
          let field = 0;
          for (let t = 0; t < T; t++) {
            const o = outs[t][s];
            const run = o.trail ? (scope === 'active' ? o.trail[k] : o.best[k]) : null;
            lens[t] = run ? run.len : 0;
            if (lens[t]) field++;
          }
          if (field < FIELD_FLOOR) continue;
          const places = placesOf(lens, T);
          for (let t = 0; t < T; t++) {
            const run = lens[t] ? (scope === 'active' ? outs[t][s].trail[k] : outs[t][s].best[k]) : null;
            if (!run || run.len < LEN_FLOOR) continue;
            const td = data[t];
            const second = places.other(run.len);
            const sc = score(scope, run.len, second, p, n, seasons(td, run.startIdx, run.lastIdx), cost);
            if (sc < KEEP_FLOOR && def.length) continue;
            collapse(runs[scope][t], dir + '|' + run.startIdx + '|' + run.lastIdx + '|' + run.len, {
              chips: def, dir, scope, len: run.len, atEdge: run.atEdge, field, rank: places.rank(run.len), tied: places.tied(run.len), second,
              startIdx: run.startIdx, lastIdx: run.lastIdx, live: run.live, also: 0, p, n, ...teamHits(t, dir), ...rivalsOf(t, def),
            });
          }
        }
        // the longest run ever under the definition, by any team, and how many teams' longest it is (lens holds the all-time reading's)
        let everLen = 0, everN = 0;
        for (let t = 0; t < T; t++) { if (lens[t] > everLen) { everLen = lens[t]; everN = 1; } else if (lens[t] && lens[t] === everLen) everN++; }
        // --- broken: every run a recorded week's game ended, placed as the week began; and the week's new leader.
        // The field's shape entering each recorded week (best, how many share it, the second, the count) in one pass per
        // team over its entering lengths, so a run's place and a change of leader cost nothing more per week.
        const ent = k === 0 ? 'entW' : k === 1 ? 'entL' : 'entU';
        bestLen.fill(0, wFrom, W + 1); bestN.fill(0, wFrom, W + 1); bestT.fill(-1, wFrom, W + 1); secondLen.fill(0, wFrom, W + 1); fieldN.fill(0, wFrom, W + 1);
        for (let t = 0; t < T; t++) {
          const o = outs[t][s];
          if (!o.trail) continue;
          const e = o[ent];
          for (let w = wFrom; w <= W; w++) {
            const l = e[w];
            if (!l) continue;
            fieldN[w]++;
            if (l > bestLen[w]) { secondLen[w] = bestLen[w]; bestLen[w] = l; bestN[w] = 1; bestT[w] = t; }
            else if (l === bestLen[w]) bestN[w]++;
            else if (l > secondLen[w]) secondLen[w] = l;
          }
        }
        const lenAt = (t, w) => (outs[t][s].trail ? outs[t][s][ent][w] : 0);
        const other = (w, len) => (len === bestLen[w] ? (bestN[w] > 1 ? bestLen[w] : secondLen[w]) : bestLen[w]);
        for (let t = 0; t < T; t++) {
          const o = outs[t][s];
          if (!o.trail) continue;
          for (const run of o.ended) {
            if (run.kind !== k) continue;
            const w = run.w;
            if (fieldN[w] < FIELD_FLOOR) continue;
            const td = data[t];
            const second = other(w, run.len);
            const sc = score('active', run.len, second, p, n, seasons(td, run.startIdx, run.lastIdx), cost);
            if (sc < KEEP_FLOOR && def.length) continue;
            let rank = 1, tied = 0;
            for (let u = 0; u < T; u++) { const l = lenAt(u, w); if (l > run.len) rank++; else if (l === run.len) tied++; }
            collapse(runs.broken[t], dir + '|' + run.enderIdx + '|' + run.startIdx + '|' + run.len, {
              chips: def, dir, scope: 'active', len: run.len, atEdge: run.atEdge, field: fieldN[w], rank, tied, second,
              startIdx: run.startIdx, lastIdx: run.lastIdx, live: false, also: 0, p, n, ...teamHits(t, dir), ...rivalsOf(t, def), enderIdx: run.enderIdx, w, everLen, everN,
            });
          }
        }
        // a new sole leader after a week: the field entering w+1 against the field entering w
        if (dir === 'U') continue; // the undefeated run is the winning one's story
        for (let w = wFrom; w < W; w++) {
          if (bestN[w + 1] !== 1 || bestLen[w + 1] < LEN_FLOOR || fieldN[w + 1] < FIELD_FLOOR) continue;
          const nt = bestT[w + 1];
          const ot = bestN[w] === 1 ? bestT[w] : -1;
          if (nt === ot) continue; // the same team still leads
          // the game that did it: the old leader's run ending this week, else the new leader's game this week
          let causeT = -1, causeIdx = -1;
          if (ot >= 0 && lenAt(ot, w + 1) < lenAt(ot, w)) {
            for (const run of outs[ot][s].ended) if (run.kind === k && run.w === w) { causeT = ot; causeIdx = run.enderIdx; break; }
          }
          if (causeIdx < 0) { const g = outs[nt][s].lastGame[w]; if (g >= 0) { causeT = nt; causeIdx = g; } }
          if (causeIdx < 0) continue; // nothing this week explains it
          const td = data[nt];
          const len = bestLen[w + 1];
          // the run's start: walk back from the team's last game in the week over its results
          let start = outs[nt][s].lastGame[w];
          if (start < 0) { for (let x = w - 1; x >= wFrom && start < 0; x--) start = outs[nt][s].lastGame[x]; }
          if (start < 0) continue;
          const seq = td[SCANS[s].seq];
          const m = SCANS[s].lined ? linedBuf[nt] : qd[nt];
          let cnt = 0, idx = start;
          const want = k === 0 ? 1 : 2;
          for (; idx >= 0; idx--) {
            if (!(m[idx >> 5] & (1 << (idx & 31)))) continue;
            if (seq[idx] !== want) { idx++; break; }
            cnt++;
            if (cnt === len) break;
          }
          if (idx < 0) idx = 0;
          const second = secondLen[w + 1];
          const sc = score('active', len, second, p, n, seasons(td, idx, start), cost);
          if (sc < cutoff) continue;
          collapse(runs.leaders[nt], dir + '|' + w + '|' + len, {
            chips: def, dir, scope: 'active', len, atEdge: false, field: fieldN[w + 1], rank: 1, tied: 1, second,
            startIdx: idx, lastIdx: start, live: true, also: 0, p, n, ...teamHits(nt, dir), ...rivalsOf(nt, def), w, prevT: ot, prevLen: ot >= 0 ? lenAt(ot, w) : bestLen[w], causeT, causeIdx,
          });
        }
      }
    }
  };

  const rec = (start, depth, chosen) => {
    evaluate(chosen, depth);
    if (depth === maxChips) return;
    for (let i = start; i < NP; i++) {
      if (depth === 0 && roots && !roots.includes(i)) continue;
      if (chips.loose[i]) continue;
      let ok = true;
      for (const j of chosen) if (chips.conflict[j * NP + i]) { ok = false; break; }
      if (!ok) continue;
      let field = 0, able = 0;
      for (let t = 0; t < T; t++) {
        alive[depth + 1][t] = 0;
        if (!alive[depth][t]) continue;
        const a = q[depth][t], b = data[t].masks[i], o = q[depth + 1][t];
        let n = 0;
        for (let w = 0; w < a.length; w++) { o[w] = a[w] & b[w]; n += popcount(o[w]); }
        if (n) { alive[depth + 1][t] = 1; field++; if (n >= LEN_FLOOR) able++; }
      }
      if (field < FIELD_FLOOR || !able) continue;
      rec(i + 1, depth + 1, [...chosen, i]);
    }
  };
  // the prefix's AND chain, under the same floors as the walk's own steps
  const empty = () => ({ active: data.map(() => []), all: data.map(() => []), broken: data.map(() => []), leaders: data.map(() => []) });
  for (let d = 0; d < prefix.length; d++) {
    const i = prefix[d];
    if (chips.loose[i]) return empty();
    for (let e = 0; e < d; e++) if (chips.conflict[prefix[e] * NP + i]) return empty();
    let field = 0, able = 0;
    for (let t = 0; t < T; t++) {
      alive[d + 1][t] = 0;
      if (!alive[d][t]) continue;
      const a = q[d][t], b = data[t].masks[i], o = q[d + 1][t];
      let n = 0;
      for (let w = 0; w < a.length; w++) { o[w] = a[w] & b[w]; n += popcount(o[w]); }
      if (n) { alive[d + 1][t] = 1; field++; if (n >= LEN_FLOOR) able++; }
    }
    if (field < FIELD_FLOOR || !able) return empty();
  }
  if (descend) rec(prefix.length ? prefix[prefix.length - 1] + 1 : 0, prefix.length, prefix);
  else evaluate(prefix, prefix.length);
  const out = (maps) => maps.map((m) => [...m.values()]);
  return { active: out(runs.active), all: out(runs.all), broken: out(runs.broken), leaders: out(runs.leaders) };
}

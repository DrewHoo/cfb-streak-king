// The tuner: the list rule's knobs (list.ts LIST) as a panel over any list,
// on at ?tune=1 (tune.ts). A change re-runs the rule on every list on the
// page; "why" under a row opens its score's terms (Why); two rows picked
// to compare show each term's difference; "copy as LIST" puts the knobs on
// the clipboard as the TypeScript to paste into list.ts. It ships in
// production: whoever finds it, good on them.

import { useState } from 'react';
import { LIST, scoreParts, tierOf, conditionCost } from '../lib/list.ts';
import { choicesOf } from '../lib/minedChips.ts';
import { useTune, knobsSource } from '../tune.ts';
import { streakWords } from './StreakRow.jsx';

// each knob: its path in LIST, a label, its range, and what it does (the ⓘ)
const TIER_HELP = 'Bits charged per condition, by tier. Brag, 1: what a fan says unprompted (at home, on the road, in conference games, vs ranked, vs a team, vs a conference, rivalry game, bowl game, night game, as an underdog, after a loss). Plain, 3: a qualifier (vs unranked, while ranked, non-conference, power-conference, in-state, neutral site, as the favorite, close spread, under a coach, opener, finale, leading at half). Trivia, 9: almanac facts (full moon, weekday, after a bye, after a win, vs a color, vs a mascot, in a month, in a state). In-game, 12: facts from the game itself (the clock, one-score, shootout, rock fight, overtime). A condition that is one choice among many also costs log2 of the choices: vs a team is one of 288, +8.2 bits; a state +5.6; a month +3.6.';
const KNOBS = [
  { path: 'admit.rank', label: 'admit: worst place on a list', min: 1, max: 10, step: 1,
    help: 'A run is on a list when the team’s place is this or better, ties included, under at least one of the definitions the mine kept the run under. 1 is the one-floor rule: the field’s leader, or the longest ever. 3 is the medal rule. A broken run that is the longest ever under its definition is on the list whatever its place.' },
  { path: 'pick', label: 'pick: which definition shows', options: ['fewest', 'highest'],
    help: 'The mine keeps each run under two definitions at most: the one with the fewest conditions, and the one the team places highest under, when that is a different definition. fewest-conditions: show the fewest-conditions definition that gets the run onto the list (“16 straight, 2nd of 136” rather than “longest in non-conference games”, once 2nd place is admitted). leading: always show the definition the team places highest under. The other definition’s place appears in the row’s small print.' },
  { path: 'rate', label: 'rate: team’s own rate (0 field, 1 team)', min: 0, max: 1, step: 0.05,
    help: 'How much a run is measured against the team’s own rate under its definition instead of the rate across every FBS team. At 0, “conference games vs red schools” is a coin flip across FBS and sixty of them earn 54 bits. At 1, Ohio State wins 95% of those, so each is worth a fraction of a bit. The “1 in N by chance” figure on a row always uses the FBS-wide rate.' },
  { path: 'rateShrink', label: 'rate shrink: games of prior', min: 0, max: 200, step: 5,
    help: 'The team’s own rate is pulled toward the FBS-wide rate by this many games’ worth of weight, so a team with three qualifying games is not read as perfect or hopeless: team rate = (hits + k × FBS rate) ÷ (games + k).' },
  { path: 'rarityW', label: 'rarity bonus (× bits per game)', min: 0, max: 20, step: 0.5,
    help: 'Adds this many times the per-game rarity, in bits, to every run whatever its length. It lifts hard definitions as a whole, so four wins on the road vs ranked teams sit nearer thirty easy ones. 0 adds nothing.' },
  { path: 'marginCost', label: 'margin cost (by 10+)', min: 0, max: 15, step: 0.5,
    help: 'Bits charged to a “by 10+” outcome, the way a condition is charged. Without it a by-10 run has no condition cost and a higher per-game rarity, so by-10 rows crowd the top.' },
  { path: 'bucket', label: 'score bucket (0 pure score)', min: 0, max: 40, step: 1,
    help: 'Width of a score band. Rows sort by band, then by per-game rarity, then by length, so inside a band the hardest definitions come first (top-5 wins before unranked wins). 0 sorts by score alone. Bands have edges: 19.9 and 20.1 land in different bands.' },
  { path: 'leadW', label: 'lead weight', min: 0, max: 3, step: 0.05,
    help: 'Weight of the lead term: (this run’s length − the longest other team’s run) × per-game rarity. Negative when the team trails its field, so a sole leader outranks a longer run that sits 2nd. A tie for the lead adds nothing.' },
  { path: 'leadFloor', label: 'lead floor (games; blank = none)', min: -50, max: 0, step: 1, nullable: true,
    help: 'The lowest value the lead term may take, in games. Blank: a trailing run pays its whole gap. 0: a trailing run scores as if it led by nothing.' },
  { path: 'chanceW', label: 'chance weight', min: 0, max: 3, step: 0.05,
    help: 'Weight of the chance term: log2 of the number of teams in the field (active streaks), or of the number of games a run could have started at (all-time). It is what the leader of 136 teams is expected to hold by luck alone.' },
  { path: 'spanA', label: 'span weight, active', min: 0, max: 5, step: 0.25,
    help: 'Weight of log2(seasons the run covers), for active runs. A run across decades counts for more than one that fits in a season.' },
  { path: 'spanAll', label: 'span weight, all-time', min: 0, max: 5, step: 0.25,
    help: 'Weight of log2(seasons the run covers), for all-time runs.' },
  { path: 'tiers.brag', label: 'tier: brag', min: 0, max: 30, step: 0.5, help: TIER_HELP },
  { path: 'tiers.plain', label: 'tier: plain', min: 0, max: 30, step: 0.5, help: TIER_HELP },
  { path: 'tiers.trivia', label: 'tier: trivia', min: 0, max: 30, step: 0.5, help: TIER_HELP },
  { path: 'tiers.ingame', label: 'tier: in-game', min: 0, max: 30, step: 0.5, help: TIER_HELP },
  { path: 'sameYears.directed', label: 'same years: only fewer conditions and more games replace', bool: true,
    help: 'All-time lists only. Two runs of the same outcome whose definitions nest (one’s conditions are a subset of the other’s) and that share enough seasons count as one story, and the list keeps one of them. On: only the run with fewer conditions and at least as many games can replace the other, so a 44-game conference run cannot replace the 47-game run of the same years. Off: the higher score replaces the lower, whichever way.' },
  { path: 'sameYears.overlap', label: 'same years: % of seasons shared', min: 0, max: 100, step: 5,
    help: 'The share of the shorter run’s seasons the two runs must have in common to count as one story, in percent.' },
  { path: 'olderStands', label: 'an older sub-streak stays its own row', bool: true,
    help: 'A run under more conditions that is no longer than a run under fewer of them is a sub-streak, grouped under the longer run. On: a sub-streak that started before the longer run stays a row of its own. The same-years rule respects this too.' },
];

const get = (k, path) => path.split('.').reduce((o, p) => o[p], k);
const fmt = (x) => (x == null ? '—' : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));

function Knob({ k, knobs, set }) {
  const v = get(knobs, k.path);
  const base = get(LIST, k.path);
  const changed = v !== base;
  const id = 'tune-' + k.path.replace('.', '-');
  const [help, setHelp] = useState(false);
  return (
    <label className={'tune-k' + (changed ? ' changed' : '')} htmlFor={id}>
      <span>
        {k.label}{changed ? <i> (was {String(base)})</i> : null}
        {k.help && <button type="button" className="tip-i tune-i" onClick={(e) => { e.preventDefault(); setHelp((o) => !o); }} aria-label={`What ${k.label} does`} aria-expanded={help}>i</button>}
      </span>
      {k.options ? (
        <select id={id} value={v} onChange={(e) => set(k.path, e.target.value)}>{k.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      ) : k.bool ? (
        <input id={id} type="checkbox" checked={!!v} onChange={(e) => set(k.path, e.target.checked)} />
      ) : (
        <span className="tune-num">
          <input type="range" min={k.min} max={k.max} step={k.step} value={v ?? k.max} onChange={(e) => set(k.path, +e.target.value)} aria-label={k.label} />
          <input id={id} type="number" min={k.min} max={k.max} step={k.step} value={v ?? ''} placeholder={k.nullable ? 'none' : ''}
            onChange={(e) => set(k.path, e.target.value === '' ? (k.nullable ? null : base) : +e.target.value)} />
        </span>
      )}
      {help && <small className="tune-help">{k.help}</small>}
    </label>
  );
}

const TERMS = [['length', 'length'], ['lead', 'lead'], ['chance', 'chance'], ['conditions', 'conditions'], ['margin', 'margin'], ['rarity', 'rarity'], ['span', 'span'], ['total', 'total']];

/** The score's terms for one row, in bits: why it sits where it does. */
export function Why({ s }) {
  const { knobs, picked, pick } = useTune();
  const parts = scoreParts(s, undefined, knobs);
  const on = picked.includes(s);
  return (
    <div className="why">
      <table>
        <tbody>
          {TERMS.map(([k, label]) => <tr key={k} className={k === 'total' ? 'why-total' : ''}><th>{label}</th><td>{fmt(parts[k])}</td></tr>)}
        </tbody>
      </table>
      <small>
        p field {parts.pF.toFixed(3)} · p team {parts.pT.toFixed(3)} ({s.hT}/{s.nT}) · {parts.b.toFixed(2)} bits/game · lead {s.len}−{s.second} · {s.field} in field
        {s.chips.length ? <> · words {s.chips.map((k) => `${k} ${tierOf(k)}${choicesOf(k) > 1 ? ` +log2(${choicesOf(k)})` : ''}`).join(', ')} = {conditionCost(s.chips, knobs).toFixed(1)}</> : null}
        {s.other ? <> · also under {streakWords(s.other.chips)}, {s.other.rank === 1 && s.other.tied === 1 ? '1st' : `${s.other.rank}${s.other.tied > 1 ? ' (tied)' : ''}`} of {s.other.field}</> : null}
        {s.also ? <> · {s.also} other definitions have this run</> : null}
      </small>
      <button className={'tune-pick' + (on ? ' on' : '')} onClick={(e) => { e.stopPropagation(); pick(s); }} aria-pressed={on}>{on ? 'picked' : 'compare'}</button>
    </div>
  );
}

/** The term-by-term difference of the two picked rows. */
function Compare({ a, b, knobs }) {
  const pa = scoreParts(a, undefined, knobs), pb = scoreParts(b, undefined, knobs);
  const words = (s) => `${s.len} ${s.dir} · ${streakWords(s.chips)}`;
  return (
    <div className="tune-cmp">
      <table>
        <thead><tr><th /><th>{words(a)}</th><th>{words(b)}</th><th>Δ</th></tr></thead>
        <tbody>
          {TERMS.map(([k, label]) => <tr key={k} className={k === 'total' ? 'why-total' : ''}><th>{label}</th><td>{fmt(pa[k])}</td><td>{fmt(pb[k])}</td><td>{fmt(pa[k] - pb[k])}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function Tuner() {
  const { on, knobs, over, set, reset, picked, pick } = useTune();
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  if (!on) return null;
  const changed = Object.keys(over).length;
  const copy = async () => {
    try { await navigator.clipboard.writeText(knobsSource(knobs)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ }
  };
  return (
    <aside className={'tune' + (open ? ' open' : '')} aria-label="The list rule's knobs">
      <button className="tune-h" onClick={() => setOpen((v) => !v)} aria-expanded={open}>tuner{changed ? ` · ${changed} changed` : ''}</button>
      {open && (
        <div className="tune-body">
          <p className="tune-note">The list rule's knobs (list.ts). Every list on this page re-runs as you turn one; "why" under a row shows its terms.</p>
          {KNOBS.map((k) => <Knob key={k.path} k={k} knobs={knobs} set={set} />)}
          <div className="tune-acts">
            <button onClick={copy}>{copied ? 'copied' : 'copy as LIST'}</button>
            <button onClick={reset} disabled={!changed}>reset</button>
            {picked.length ? <button onClick={() => picked.forEach((r) => pick(r))}>clear picks</button> : null}
          </div>
          {picked.length === 2 && <Compare a={picked[0]} b={picked[1]} knobs={knobs} />}
          {picked.length === 1 && <p className="tune-note">one row picked; pick another to compare</p>}
        </div>
      )}
    </aside>
  );
}

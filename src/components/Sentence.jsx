// The definition sentence. Every word that can change is a Radix dropdown.
// A constraint's own menu tunes it (its choices and group-mates, at the top)
// or changes it to any other constraint (below); "remove" sits small in its
// header. Adding a constraint starts from "in all games" when there is none
// and from + after: a dropdown on desktop, a bottom sheet (vaul) on a phone.
// Every choice wears the king of the definition picking it would make.

import { useEffect, useRef, useState } from 'react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Drawer } from 'vaul';
import { CHIPS, chipByKey, conflicts, fitsDir } from '../lib/chips.ts';
import { GROUPS, GROUP_NOTES, PARAMS, chipWord, MAX_CHIPS, swapTargets } from '../lib/definition.ts';
import { dirWord, yearOf, yy } from '../lib/format.ts';
import { MARGINS, marginDir } from '../lib/outcome.ts';
import { teams } from '../lib/model.ts';
import { useAddKings, useChipKings } from '../hooks/useAddKings.ts';
import { Caret } from './Icons.jsx';

const BASE = import.meta.env.BASE_URL;
// a list longer than this scrolls in its own box, so what's below stays in view
const LONG_LIST = 9;

function Word({ label, children, strong, open, onOpenChange, wide, contentRef }) {
  return (
    <DM.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <DM.Trigger asChild>
        <button className={'pick' + (strong ? ' strong' : '')}>{label}<Caret /></button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content ref={contentRef} className={'menu' + (wide ? ' add chip' : '')} sideOffset={6} collisionPadding={12} loop>
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

// a choice, and, once worked out, the king it would crown
const Item = ({ on, muted, disabled, title, onSelect, children, king, holds, scope }) => (
  <DM.Item
    className={'mi' + (on ? ' on' : '') + (muted ? ' muted' : '') + (holds && !on ? ' holds' : '')}
    onSelect={onSelect} disabled={disabled} title={title ?? (king ? kingTitle(king, holds && !on) : undefined)}
  >
    <span>{children}</span>
    {king && <span className="pk"><KingMark k={king} scope={scope} stack /></span>}
    {/* a king column keeps the check's width on every row, so the marks line up */}
    {(on || king) && <span className={'mi-check' + (on ? '' : ' off')} aria-hidden={!on || undefined}>✓</span>}
  </DM.Item>
);
const Heading = ({ children, title }) => <DM.Label className="menu-h" title={title}>{children}</DM.Label>;
const Rule = () => <DM.Separator className="menu-rule" />;

const sameTeams = (a, b) => a.length === b.length && a.every((t) => b.includes(t));
const yearSpan = (k, fmt) => (yearOf(k.startEp) === yearOf(k.endEp) ? fmt(k.startEp) : `${fmt(k.startEp)}–${fmt(k.endEp)}`);
const kingTitle = (k, holds) => `${k.tis.map((ti) => teams[ti].name).join(' & ')}${holds ? ' holds' : ''}, ${k.len} straight, ${yearSpan(k, yearOf)}`;
const holdsFor = (k, cur) => !!(k && cur && sameTeams(k.tis, cur.tis));

/** Who would be king with this constraint picked: mark, length, years, and a tag
 *  when an all-time king is still going or an active one is also the record.
 *  `stack` tucks the tag under the years, for a menu row that can't grow. */
function KingMark({ k, scope, stack }) {
  const tag = scope === 'all' ? (k.live ? 'active' : null) : (k.record ? 'all-time' : null);
  const tagEl = tag && <span className={'pk-tag ' + (scope === 'all' ? 'act' : 'rec')}>{tag}</span>;
  const len = <b className="pk-len">{k.len}{k.atEdge ? '+' : ''}</b>;
  if (stack) {
    return <><KingCrest k={k} />{len}<span className="pk-when"><span className="pk-yr">{yearSpan(k, yy)}</span>{tagEl}</span></>;
  }
  return <><KingCrest k={k} />{len}<span className="pk-yr">{yearSpan(k, yy)}</span>{tagEl}</>;
}
function KingCrest({ k }) {
  return (
    <span className={'pk-crest' + (k.tis.length > 1 ? ' tie' : '')}>
      {k.tis.slice(0, 2).map((ti) => (teams[ti].espn
        ? <img key={ti} src={`${BASE}logos-color/${teams[ti].espn}.png`} alt="" loading="lazy" />
        : <b key={ti}>{teams[ti].name[0]}</b>))}
    </span>
  );
}

/** One constraint as a pill: its label and the king it would crown. */
function ChipPill({ c, k, cur, scope, disabled, onSelect, Item: I }) {
  const holds = holdsFor(k, cur);
  const cls = 'pill' + (holds ? ' holds' : '') + (k && k.len < 4 ? ' weak' : '');
  return (
    <I className={cls} title={k ? kingTitle(k, holds) : undefined} disabled={disabled} onSelect={onSelect}>
      <span className="pk-l">{c.label}</span>
      {k && <KingMark k={k} scope={scope} />}
    </I>
  );
}

/** Chips as pills, one group per heading. */
function PillGroups({ chips, kingOf, cur, scope, isDisabled, onPick, Item: I, Heading: H, Group: G }) {
  return GROUPS.map((grp) => {
    const inGroup = chips.filter((c) => c.group === grp);
    if (!inGroup.length) return null;
    return (
      <G key={grp} wrap>
        <H title={GROUP_NOTES[grp]}>{grp}{GROUP_NOTES[grp] ? ' ⓘ' : ''}</H>
        {inGroup.map((c) => {
          const disabled = isDisabled?.(c) ?? false;
          return <ChipPill key={c.key} c={c} k={disabled ? null : kingOf(c.key)} cur={cur} scope={scope} disabled={disabled} onSelect={() => onPick(c.key)} Item={I} />;
        })}
      </G>
    );
  });
}

/**
 * A constraint's own menu. The top tunes it: the constraint itself (checked)
 * or its choices, then its group-mates. Below, "change to" offers every other
 * constraint no other word excludes. "remove" is small text in the header,
 * never a whole row, so it isn't hit by accident. It opens on the checked row.
 */
function ChipWord({ a, active, dir, scope, on }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef(null);
  const kings = useChipKings(open, active, a.key, dir, scope);
  const c = chipByKey.get(a.key);
  const targets = swapTargets(active, a.key, dir);
  const siblings = targets.filter((s) => s.group === c.group);
  const others = targets.filter((s) => s.group !== c.group);
  const params = c.param ? PARAMS[c.param].options(c) : [];
  const cur = kings?.cur;
  const crowned = (k) => ({ king: k, holds: holdsFor(k, cur), scope });
  const rows = (c.param ? params.length : 1) + siblings.length;

  // open on the current choice: focus it and scroll its list to it
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const el = contentRef.current?.querySelector('.mi.on');
      if (!el) return;
      el.focus({ preventScroll: true });
      const box = el.closest('.menu-choices.long');
      if (box) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  return (
    <Word label={chipWord(a)} strong open={open} onOpenChange={setOpen} wide contentRef={contentRef}>
      <div className="menu-top">
        <DM.Label className="menu-h">{c.group}</DM.Label>
        <DM.Item className="mi-remove" onSelect={() => on.remove(a.key)}>remove</DM.Item>
      </div>
      <DM.Group className={'menu-choices' + (rows > LONG_LIST ? ' long' : '')}>
        {c.param
          ? params.map(([v, label]) => (
            <Item key={v} on={a.param === v} onSelect={() => on.setParam(a.key, v)} {...crowned(kings?.params.get(v))}>{label}</Item>
          ))
          : <Item on {...crowned(cur)}>{c.label}</Item>}
        {c.param && siblings.length > 0 && <Rule />}
        {siblings.map((s) => (
          <Item key={s.key} onSelect={() => on.swap(a.key, s.key)} {...crowned(kings?.swaps.get(s.key))}>{s.label}</Item>
        ))}
      </DM.Group>
      {others.length > 0 && (
        <>
          <DM.Label className="menu-h menu-sec">change to</DM.Label>
          <PillGroups
            chips={others} kingOf={(key) => kings?.swaps.get(key)} cur={cur} scope={scope}
            onPick={(key) => on.swap(a.key, key)} Item={DmItem} Heading={Heading} Group={DmGroup}
          />
        </>
      )}
    </Word>
  );
}

/** The body of the add menu, shared by the dropdown and the sheet. */
function AddBody({ active, dir, scope, week, weekCount, weekDay, kings, on, Item: I, Heading: H, Group: G }) {
  const full = active.length >= MAX_CHIPS;
  // one-score and shootout can't define a spread streak
  const chips = CHIPS.filter((c) => !active.some((a) => a.key === c.key) && fitsDir(c, dir));
  // at four constraints only a swap for an exclusive group-mate still fits
  const swaps = (c) => active.some((a) => conflicts(chipByKey.get(a.key), c));
  return (
    <>
      <PillGroups
        chips={chips} kingOf={(key) => kings?.byKey.get(key)} cur={kings?.cur} scope={scope}
        isDisabled={(c) => full && !swaps(c)} onPick={on.add} Item={I} Heading={H} Group={G}
      />
      {scope === 'active' && weekCount > 0 && !week && (
        <G>
          <H>this week</H>
          <I onSelect={on.week}>could be broken {weekDay} <b className="mi-n">· {weekCount}</b></I>
        </G>
      )}
    </>
  );
}

const DmItem = ({ onSelect, disabled, className = '', title, children }) => (
  <DM.Item className={'mi ' + className} onSelect={onSelect} disabled={disabled} title={title}><span>{children}</span></DM.Item>
);
const DmGroup = ({ wrap, children }) => <DM.Group className={'menu-grp' + (wrap ? ' wrap' : '')}>{children}</DM.Group>;
const SheetItem = ({ onSelect, disabled, className = '', title, children }) => (
  <button className={'mi ' + className} onClick={onSelect} disabled={disabled} title={title}><span>{children}</span></button>
);
const SheetHeading = ({ children, title }) => <span className="menu-h" title={title}>{children}</span>;
const SheetGroup = ({ wrap, children }) => <div className={'menu-grp' + (wrap ? ' wrap' : '')}>{children}</div>;

/** Adding a constraint: "in all games" is the trigger while there's none, + after. */
function AddMenu({ isMobile, open, setOpen, dir, ...body }) {
  const label = 'Add a constraint';
  const kings = useAddKings(open, body.active, dir, body.scope);
  const empty = body.active.length === 0;
  const trigger = empty
    ? <button className={'pick strong' + (open ? ' open' : '')} aria-label={`in all games: ${label.toLowerCase()}`}>in all games<Caret /></button>
    : <button className={'addbtn' + (open ? ' open' : '')} aria-label={label}>+</button>;
  if (isMobile) {
    const on = Object.fromEntries(Object.entries(body.on).map(([k, f]) => [k, (...args) => { f(...args); setOpen(false); }]));
    return (
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="sheet-ov" />
          <Drawer.Content className="sheet" aria-describedby={undefined}>
            <Drawer.Title className="sheet-title">{label}</Drawer.Title>
            <div className="sheet-body">
              <AddBody {...body} dir={dir} kings={kings} on={on} Item={SheetItem} Heading={SheetHeading} Group={SheetGroup} />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }
  return (
    <DM.Root open={open} onOpenChange={setOpen} modal={false}>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content className="menu add" sideOffset={8} align={empty ? 'center' : 'end'} collisionPadding={12} loop>
          <AddBody {...body} dir={dir} kings={kings} Item={DmItem} Heading={Heading} Group={DmGroup} />
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function Sentence({ active, dir, scope, week, weekCount, weekDay, isMobile, addOpen, setAddOpen, on }) {
  // at four constraints each word's own menu does the swapping; + stays only
  // while it still has the week filter to offer
  const canAdd = active.length < MAX_CHIPS || (scope === 'active' && weekCount > 0 && !week);
  // an outcome the definition's chips can't pair with: one-score or shootout vs the spread
  const blocker = (d) => active.map((a) => chipByKey.get(a.key)).find((c) => c && !fitsDir(c, d));
  const dirItem = (d, word) => {
    const b = blocker(d);
    return <Item on={dir === d} disabled={!!b} title={b ? `not with ${b.label}` : undefined} onSelect={() => on.dir(d)}>{word}</Item>;
  };
  return (
    <div className="sentence">
      <span>Longest</span>
      <Word label={scope === 'all' ? 'all-time' : 'active'}>
        <Item on={scope === 'active'} onSelect={() => on.scope('active')}>active</Item>
        <Item on={scope === 'all'} onSelect={() => on.scope('all')}>all-time</Item>
      </Word>
      <Word label={dirWord(dir)}>
        {dirItem('W', 'winning')}
        {dirItem('L', 'losing')}
        {dirItem('U', 'undefeated')}
        {dirItem('C', 'covering')}
        {dirItem('N', 'not covering')}
        {/* by a margin: every game of the run won (or lost) by at least that many */}
        {['W', 'L'].map((base) => (
          <DM.Group className="menu-grp wrap" key={base}>
            <DM.Label className="menu-h">{base === 'W' ? 'winning by' : 'losing by'}</DM.Label>
            {MARGINS.map((by) => {
              const d = marginDir(base, by);
              const b = blocker(d);
              return (
                <DM.Item key={d} className={'mi pill' + (dir === d ? ' on' : '')} disabled={!!b} title={b ? `not with ${b.label}` : `every game ${base === 'W' ? 'won' : 'lost'} by ${by} or more`} onSelect={() => on.dir(d)}>
                  <span className="pk-l">{by}+</span>
                </DM.Item>
              );
            })}
          </DM.Group>
        ))}
      </Word>
      <span>streaks</span>
      {active.map((a) => <ChipWord key={a.key} a={a} active={active} dir={dir} scope={scope} on={on} />)}
      {week && (
        <Word label={`could be broken ${weekDay}`} strong>
          <Item muted onSelect={on.unweek}>remove</Item>
        </Word>
      )}
      {canAdd && (
        <AddMenu
          isMobile={isMobile} open={addOpen} setOpen={setAddOpen} dir={dir}
          active={active} scope={scope} week={week} weekCount={weekCount} weekDay={weekDay} on={on}
        />
      )}
    </div>
  );
}

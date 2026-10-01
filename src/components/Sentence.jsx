// The definition sentence. Every word that can change is a Radix dropdown;
// the + button opens every remaining word grouped by heading: a dropdown on
// desktop, a bottom sheet (vaul) on a phone.

import * as DM from '@radix-ui/react-dropdown-menu';
import { Drawer } from 'vaul';
import { CHIPS, chipByKey, conflicts, fitsDir } from '../lib/chips.ts';
import {
  GROUPS, GROUP_NOTES, PARAMS, chipWord, MAX_CHIPS,
} from '../lib/definition.ts';
import { dirWord } from '../lib/format.ts';
import { Caret } from './Icons.jsx';

const BASE = import.meta.env.BASE_URL;

function Word({ label, children, strong }) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>
        <button className={'pick' + (strong ? ' strong' : '')}>{label}<Caret /></button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content className="menu" sideOffset={6} collisionPadding={12} loop>
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

const Item = ({ on, muted, disabled, title, onSelect, children }) => (
  <DM.Item className={'mi' + (on ? ' on' : '') + (muted ? ' muted' : '')} onSelect={onSelect} disabled={disabled} title={title}>
    <span>{children}</span>{on && <span className="mi-check">✓</span>}
  </DM.Item>
);
const Heading = ({ children, title }) => <DM.Label className="menu-h" title={title}>{children}</DM.Label>;
const Rule = () => <DM.Separator className="menu-rule" />;

/** A constraint's own menu: its parameter (if any), its group-mates, remove. */
function ChipWord({ a, active, dir, on }) {
  const c = chipByKey.get(a.key);
  const siblings = CHIPS.filter((s) => s.group === c.group && s.key !== a.key && !active.some((x) => x.key === s.key) && fitsDir(s, dir));
  const params = c.param ? PARAMS[c.param].options(c) : [];
  return (
    <Word label={chipWord(a)} strong>
      <Heading>{c.group}</Heading>
      {params.map(([v, label]) => <Item key={v} on={a.param === v} onSelect={() => on.setParam(a.key, v)}>{label}</Item>)}
      {params.length > 0 && siblings.length > 0 && <Rule />}
      {siblings.map((s) => <Item key={s.key} onSelect={() => on.swap(a.key, s.key)}>{s.label}</Item>)}
      <Rule />
      <Item muted onSelect={() => on.remove(a.key)}>remove</Item>
    </Word>
  );
}

/** The body of the + menu, shared by the dropdown and the sheet. */
function AddBody({ active, dir, scope, week, weekCount, weekDay, startFrom, on, Item: I, Heading: H, Group: G }) {
  const full = active.length >= MAX_CHIPS;
  return (
    <>
      {GROUPS.map((grp) => {
        const chips = CHIPS.filter((c) => c.group === grp && !active.some((a) => a.key === c.key) && fitsDir(c, dir));
        if (!chips.length) return null;
        return (
          <G key={grp}>
            <H title={GROUP_NOTES[grp]}>{grp}{GROUP_NOTES[grp] ? ' ⓘ' : ''}</H>
            {chips.map((c) => {
              const swaps = active.some((a) => conflicts(chipByKey.get(a.key), c));
              return <I key={c.key} disabled={full && !swaps} onSelect={() => on.add(c.key)}>{c.label}</I>;
            })}
          </G>
        );
      })}
      {scope === 'active' && weekCount > 0 && !week && (
        <G>
          <H>this week</H>
          <I onSelect={on.week}>could be broken {weekDay} <b className="mi-n">· {weekCount}</b></I>
        </G>
      )}
      <G>
        <H>start from</H>
        {startFrom.map((e, i) => (
          <I key={i} title={e.name} onSelect={() => on.start(e)} className="start">
            {e.saved && <span className="star">★ </span>}
            {e.leader?.espn && <img src={`${BASE}logos-color/${e.leader.espn}.png`} alt="" loading="lazy" />}
            <b>{e.len}</b> {dirWord(e.dir)} {e.chips.map(chipWord).join(' · ') || 'all games'}
          </I>
        ))}
      </G>
    </>
  );
}

const DmItem = ({ onSelect, disabled, className = '', title, children }) => (
  <DM.Item className={'mi ' + className} onSelect={onSelect} disabled={disabled} title={title}><span>{children}</span></DM.Item>
);
const DmGroup = ({ children }) => <DM.Group className="menu-grp">{children}</DM.Group>;
const SheetItem = ({ onSelect, disabled, className = '', title, children }) => (
  <button className={'mi ' + className} onClick={onSelect} disabled={disabled} title={title}><span>{children}</span></button>
);
const SheetHeading = ({ children, title }) => <span className="menu-h" title={title}>{children}</span>;
const SheetGroup = ({ children }) => <div className="menu-grp">{children}</div>;

function AddMenu({ isMobile, open, setOpen, ...body }) {
  const label = 'Add a constraint';
  if (isMobile) {
    const on = Object.fromEntries(Object.entries(body.on).map(([k, f]) => [k, (...args) => { f(...args); setOpen(false); }]));
    return (
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Trigger asChild><button className={'addbtn' + (open ? ' open' : '')} aria-label={label}>+</button></Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="sheet-ov" />
          <Drawer.Content className="sheet" aria-describedby={undefined}>
            <Drawer.Title className="sheet-title">{label}</Drawer.Title>
            <div className="sheet-body">
              <AddBody {...body} on={on} Item={SheetItem} Heading={SheetHeading} Group={SheetGroup} />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }
  return (
    <DM.Root open={open} onOpenChange={setOpen} modal={false}>
      <DM.Trigger asChild><button className={'addbtn' + (open ? ' open' : '')} aria-label={label}>+</button></DM.Trigger>
      <DM.Portal>
        <DM.Content className="menu add" sideOffset={8} align="end" collisionPadding={12} loop>
          <AddBody {...body} Item={DmItem} Heading={Heading} Group={DmGroup} />
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function Sentence({ active, dir, scope, week, weekCount, weekDay, startFrom, isMobile, addOpen, setAddOpen, on }) {
  // an outcome the definition's chips can't pair with: one-score vs the spread
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
      </Word>
      <span>streaks</span>
      {active.length === 0 && <span className="allgames">in all games</span>}
      {active.map((a) => <ChipWord key={a.key} a={a} active={active} dir={dir} on={on} />)}
      {week && (
        <Word label={`could be broken ${weekDay}`} strong>
          <Item muted onSelect={on.unweek}>remove</Item>
        </Word>
      )}
      <AddMenu
        isMobile={isMobile} open={addOpen} setOpen={setAddOpen}
        active={active} dir={dir} scope={scope} week={week} weekCount={weekCount} weekDay={weekDay} startFrom={startFrom} on={on}
      />
    </div>
  );
}

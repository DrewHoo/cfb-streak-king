// Pick any current FBS team: a filter box over the list, in a dropdown on
// desktop and a bottom sheet on a phone. The team page's name is one trigger
// and the board's "find a team" another.

import { useMemo, useState } from 'react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Drawer } from 'vaul';
import { teams } from '../lib/model.ts';
import { teamList, seasonRecord, recordText } from '../lib/team.ts';
import { TeamMark } from './Chip.jsx';

const plain = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function useFilter() {
  const [q, setQ] = useState('');
  const all = useMemo(teamList, []);
  const want = plain(q);
  // names that start with what's typed, then names that contain it
  const list = want
    ? [...all.filter((ti) => plain(teams[ti].name).startsWith(want)), ...all.filter((ti) => !plain(teams[ti].name).startsWith(want) && plain(teams[ti].name).includes(want))]
    : all;
  return { q, setQ, list };
}

const Row = ({ ti }) => (
  <>
    <TeamMark ti={ti} className="tp-logo" />
    <span className="tp-name">{teams[ti].name}</span>
    <span className="tp-rec">{recordText(seasonRecord(ti))}</span>
  </>
);

/** `children` is the trigger (one element); `onPick(ti)` gets the chosen team. */
export function TeamPicker({ children, current, onPick, isMobile }) {
  const [open, setOpen] = useState(false);
  const { q, setQ, list } = useFilter();
  const change = (o) => { setOpen(o); if (!o) setQ(''); };
  const pick = (ti) => { change(false); onPick(ti); };
  const box = (autoFocus) => (
    <input
      className="tp-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a team" aria-label="Find a team" autoFocus={autoFocus}
      // typing is the filter's, not the menu's own type-to-jump
      onKeyDown={(e) => { if (e.key === 'Enter' && list.length) pick(list[0]); else if (e.key !== 'Escape' && e.key !== 'ArrowDown' && e.key !== 'Tab') e.stopPropagation(); }}
    />
  );
  const none = list.length === 0 && <p className="tp-none">No current FBS team matches.</p>;

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={change}>
        <Drawer.Trigger asChild>{children}</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="sheet-ov" />
          <Drawer.Content className="sheet" aria-describedby={undefined}>
            <Drawer.Title className="sheet-title">Team</Drawer.Title>
            <div className="tp-top">{box(false)}</div>
            <div className="sheet-body">
              {none}
              {list.map((ti) => (
                <button key={ti} className={'mi tp-row' + (ti === current ? ' on' : '')} onClick={() => pick(ti)}><Row ti={ti} /></button>
              ))}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }
  return (
    <DM.Root open={open} onOpenChange={change} modal={false}>
      <DM.Trigger asChild>{children}</DM.Trigger>
      <DM.Portal>
        <DM.Content className="menu tp-menu" sideOffset={6} collisionPadding={12} align="start">
          <div className="tp-top">{box(true)}</div>
          <div className="tp-list">
            {none}
            {list.map((ti) => (
              <DM.Item key={ti} className={'mi tp-row' + (ti === current ? ' on' : '')} onSelect={() => pick(ti)}><Row ti={ti} /></DM.Item>
            ))}
          </div>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

// A select said the way the definition sentence says its words: a Radix
// dropdown under a dashed-underline trigger, the current choice checked. It
// replaces the native <select>, whose menu took the platform's look.

import * as DM from '@radix-ui/react-dropdown-menu';
import { Caret } from './Icons.jsx';

/**
 * options: [{ value, label, hint? }]; `value` is the current one. A hint
 * (the week's dates) shows in the menu beside its label, not on the trigger.
 * `className` dresses the trigger beyond .pick (the week picker keeps its
 * display face).
 */
export function Picker({ value, options, onChange, ariaLabel, className = '' }) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>
        <button className={'pick ' + className} aria-label={ariaLabel}>{current?.label}<Caret /></button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content className="menu" sideOffset={6} collisionPadding={12} loop>
          {options.map((o) => (
            <DM.Item key={String(o.value)} className={'mi' + (o.value === value ? ' on' : '')} onSelect={() => onChange(o.value)}>
              <span>{o.label}{o.hint && <small className="mi-hint">{o.hint}</small>}</span>
              <span className={'mi-check' + (o.value === value ? '' : ' off')} aria-hidden={o.value !== value || undefined}>✓</span>
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

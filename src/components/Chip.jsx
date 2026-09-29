import { teams } from '../lib/model.ts';
import { siteWord, yearOf, spreadText } from '../lib/format.ts';

const BASE = import.meta.env.BASE_URL;

/** The hostile-territory square: cream + ink mark for a win, dark + dim mark
 *  for a loss, dashed for a tie. Opponents without a mark get their initial.
 *  `cover` draws the result against the spread instead (a push as a tie). */
export function Chip({ g, small, cover }) {
  const t = teams[g.oppIdx];
  const r = cover ? (g.cover === 'P' ? 'T' : g.cover ?? 'T') : g.r;
  const cls = (r === 'W' ? 'sq w' : r === 'L' ? 'sq l' : 'sq t') + (small ? ' s' : '');
  const name = t?.name ?? '?';
  return (
    <span className={cls} title={`${siteWord(g)} ${name} ${g.us}–${g.them}${cover && g.sp != null ? ` (${spreadText(g.sp)})` : ''}, ${yearOf(g.ep)}`}>
      {t?.espn ? <img src={`${BASE}logos/${t.espn}.png`} alt={name} loading="lazy" /> : <b>{name[0]}</b>}
    </span>
  );
}

/** An upcoming opponent: dashed rust, since nothing has happened yet. */
// the next qualifying game: dashed, and in color when it sits atop a column
export function NextChip({ u, color, small, title }) {
  const t = teams[u.oppIdx];
  return (
    <span className={'sq p' + (color ? ' c' : '') + (small ? ' s' : '')} title={title ?? `next: ${siteWord(u)} ${t?.name}`}>
      {t?.espn ? <img src={`${BASE}${color ? 'logos-color' : 'logos'}/${t.espn}.png`} alt={t?.name} /> : <b>{t?.name?.[0]}</b>}
    </span>
  );
}

export function TeamMark({ ti, className = 'colteam' }) {
  const t = teams[ti];
  return t?.espn ? <img className={className} src={`${BASE}logos-color/${t.espn}.png`} alt={t.name} loading="lazy" /> : null;
}

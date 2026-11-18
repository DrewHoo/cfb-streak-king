// What to read next: Putting Up Numbers' claims about the team the reader is
// looking at. The index site's back-bar embed (data-read-next="cfb") fetches
// and shuffles them and draws the top bar; the block under the board shows
// the first five of the same order as sentences. The prerender bakes a list
// into the page (the sport's, a team page its team's) for a crawler and for a
// reader the embed never reaches. puttingupnumbers' specs/read-next-across-sites.spec.md.

import PUN_SLUGS from './punSlugs.json';

/** a link as the block shows it, from PUN's links.json */
export interface ReadNextLink { id: string; kind: string; sport: string; href: string; text: string }
/** the embed's order and its counters (back-bar.js) */
interface Drawn { subject: string; links: ReadNextLink[]; tap: (l: ReadNextLink, slot: number, where: string) => void; shown: (where: string, ids: string[]) => void }

declare global {
  interface Window { dhReadNext?: Drawn }
}

export const PUN_ORIGIN = 'https://puttingupnumbers.com';
/** the block's length, and the fewest it shows */
export const BLOCK = 5;
export const FEWEST = 3;

/** PUN's slug for one of our teams: ours, but Texas A&M's (punSlugs.json) */
export const punSlug = (id: string): string => (PUN_SLUGS as Record<string, string>)[id] ?? id;

/** the subject the embed reads off <html>: a team, or none (then it uses the last one any sports site set) */
export function setSubject(teamId: string | null) {
  const el = document.documentElement;
  if (teamId) el.setAttribute('data-dh-subject', `team:${punSlug(teamId)}`);
  else el.removeAttribute('data-dh-subject');
}

let baked: ReadNextLink[] = [];
/** the list the prerender baked into this page: set by the prerender before it renders, and by main.jsx from the page before it hydrates */
export const setBaked = (links: ReadNextLink[]) => { baked = links; };
export const bakedLinks = () => baked;

/** the embed's order, when it has drawn enough */
export const drawnLinks = (): ReadNextLink[] | null => {
  const d = typeof window === 'undefined' ? null : window.dhReadNext;
  return d && d.links.length >= FEWEST ? d.links.slice(0, BLOCK) : null;
};

const from = () => window.location.pathname.split('/')[1] || 'index';
const track = (name: string, props: Record<string, unknown>) => { try { window.dhAnalytics?.track(name, props); } catch {} };

/** a tap on the block, counted (and remembered, so the draw drops it for 30 days) by the embed, or here when it never loaded */
export function tapLink(l: ReadNextLink, slot: number) {
  if (window.dhReadNext) window.dhReadNext.tap(l, slot, 'block');
  else track('readnext', { from: from(), to: l.href, id: l.id, kind: l.kind, sport: l.sport, slot, where: 'block' });
}
/** the block came on screen */
export function blockShown(links: ReadNextLink[]) {
  const ids = links.map((l) => l.id);
  if (window.dhReadNext) window.dhReadNext.shown('block', ids);
  else track('readnext shown', { from: from(), subject: null, ids, where: 'block' });
}
export const isPun = (href: string) => href.startsWith(`${PUN_ORIGIN}/`);

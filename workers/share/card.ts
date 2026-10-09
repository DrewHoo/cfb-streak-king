// The share card: a definition's board drawn as a 1200x630 PNG through
// workers-og (satori + resvg wired for workerd, wasm included). The design
// follows gen-og.mjs: the dark room, Graduate counts, serif names, mono
// small print. Fonts ride in the bundle (OFL; the same four the site uses).

import { ImageResponse } from 'workers-og';
// wrangler's Data rule hands these over as ArrayBuffers
import graduate from './fonts/Graduate-Regular.ttf';
import mono from './fonts/IBMPlexMono-Regular.ttf';
import monoBold from './fonts/IBMPlexMono-SemiBold.ttf';
import serif from './fonts/SourceSerif4-Regular.ttf';

const BG = '#282127';
const INK = '#efe6d9';
const MUTED = '#bfb2a6';
const FAINT = '#857a75';
const LINE = '#453a42';
const CREAM = '#f3e2bc';
const RUST = '#c36c36';

export interface CardRow {
  count: string;
  name: string;
  /** A dense row's small print under the name. */
  sub?: string;
  /** The count in rust: a losing or not-covering run. */
  bad?: boolean;
  /** "’08–’21" or "since ’19"; said in mono small print. */
  span: string;
  live: boolean;
  /** The team's color mark as a data URI, when its PNG could be fetched. */
  logo: string | null;
  initial: string;
  /** A live run's next qualifying game: "next vs <mark> 10/14". */
  next?: { word: string; logo: string | null; initial: string; date: string } | null;
}

export interface Card {
  heading: string;
  words: string;
  rows: CardRow[];
  /** "1936–2026 · 63,855 games · drewhoover.com" */
  footer: string;
  /** Rows that are a claim with small print under it (a week's broken or at-risk streaks), not a name and a span. */
  dense?: boolean;
}

// satori reads the text as-is, entities included, so only the characters
// that would open a tag or close an attribute are escaped; "A&M" stays "A&M"
const esc = (s: string) => s.replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function renderCard(card: Card): Response {
  const rows = card.dense
    ? card.rows.map((r) => `
    <div style="display:flex; flex-direction:row; align-items:center; gap:14px; padding:6px 0; border-bottom:1px dashed ${LINE};">
      <div style="display:flex; justify-content:flex-end; width:64px; font-family:'Graduate'; font-size:24px; color:${r.bad ? RUST : CREAM};">${esc(r.count)}</div>
      ${r.logo
        ? `<img src="${r.logo}" width="32" height="32" />`
        : `<div style="display:flex; justify-content:center; width:32px; font-family:'Graduate'; font-size:18px; color:${MUTED};">${esc(r.initial)}</div>`}
      <div style="display:flex; flex-direction:column; flex-grow:1; width:590px;">
        <div style="display:flex; font-family:'Source Serif 4'; font-size:18px; color:${INK}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(r.name)}</div>
        <div style="display:flex; font-family:'IBM Plex Mono'; font-size:11px; letter-spacing:1px; color:${FAINT}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${esc((r.sub ?? '').toUpperCase())}</div>
      </div>
    </div>`).join('')
    : card.rows.map((r) => `
    <div style="display:flex; flex-direction:row; align-items:center; gap:16px; padding:7px 0; border-bottom:1px dashed ${LINE};">
      <div style="display:flex; justify-content:flex-end; width:80px; font-family:'Graduate'; font-size:28px; color:${CREAM};">${esc(r.count)}</div>
      ${r.logo
        ? `<img src="${r.logo}" width="38" height="38" />`
        : `<div style="display:flex; justify-content:center; width:38px; font-family:'Graduate'; font-size:20px; color:${MUTED};">${esc(r.initial)}</div>`}
      <div style="display:flex; flex-grow:1; font-family:'Source Serif 4'; font-size:25px; color:${INK};">${esc(r.name)}</div>
      <div style="display:flex; flex-direction:row; align-items:center; gap:6px; font-family:'IBM Plex Mono'; font-size:14px; letter-spacing:1px; color:${r.live ? RUST : FAINT};">
        <span>${esc(r.span.toUpperCase())}</span>
        ${r.next ? `<span>· NEXT ${esc(r.next.word.toUpperCase())}</span>${r.next.logo
          ? `<img src="${r.next.logo}" width="20" height="20" />`
          : `<span style="font-family:'Graduate'; font-size:13px; color:${MUTED};">${esc(r.next.initial)}</span>`}<span>${esc(r.next.date)}</span>` : ''}
      </div>
    </div>`).join('');

  // every meaningful glyph stays inside the centered 720px column: Reddit's
  // compact feed center-crops the 1.91:1 card to a near-square thumbnail,
  // and a safe-zone layout survives any such crop
  const html = `
  <div style="display:flex; flex-direction:column; align-items:center; width:1200px; height:630px; background-color:${BG}; padding:40px 0 32px;
              background-image: radial-gradient(circle at 600px -126px, rgba(243,226,188,0.13) 0%, rgba(243,226,188,0) 65%);">
    <div style="display:flex; font-family:'IBM Plex Mono'; font-weight:600; font-size:16px; letter-spacing:4px; color:${RUST};">DREWHOOVER.COM · STREAK KING</div>
    <div style="display:flex; font-family:'Graduate'; font-size:34px; color:${CREAM}; margin-top:10px; max-width:720px;">${esc(card.heading.toUpperCase())}</div>
    <div style="display:flex; font-family:'Source Serif 4'; font-size:22px; color:${MUTED}; margin-top:2px; max-width:720px;">${esc(card.words)}</div>
    <div style="display:flex; flex-direction:column; margin-top:12px; flex-grow:1; width:720px;">${rows}</div>
    <div style="display:flex; font-family:'IBM Plex Mono'; font-size:14px; letter-spacing:2px; color:${FAINT}; margin-top:10px;">${esc(card.footer.toUpperCase())}</div>
  </div>`;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Graduate', data: graduate as ArrayBuffer, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: mono as ArrayBuffer, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: monoBold as ArrayBuffer, weight: 600, style: 'normal' },
      { name: 'Source Serif 4', data: serif as ArrayBuffer, weight: 400, style: 'normal' },
    ],
  });
}

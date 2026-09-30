// Fetch missing one-color team marks into public/logos/<espnId>.png.
// The ink-density pipeline is hostile-territory's: alpha from darkness OR
// saturation baked onto pure black at FULL resolution, then trim, then resize
// (thresholding after a resize half-keys anti-aliased edges into speckle).
// CSS treatments downstream: wins = plain opacity, losses = invert(.66).
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';

const OUT = 'public/logos';
mkdirSync(OUT, { recursive: true });
// Teams whose primary mark carries black lettering, fills or keylines that
// vanish on the dark page. ESPN's dark-background variant feeds their COLOR
// logos only. The mono pipeline always uses the standard mark: its dark
// lettering and keylines are exactly the ink the density formula needs, and
// the dark variant's white detail would knock them out into mush on both
// square types. Audited twice over each logo's opaque pixels (Sept 2026): by
// CIE76 distance from the page background, which finds black, and by WCAG
// luminance contrast under 1.6, which finds the navy, maroon and forest
// green that have chroma but don't read. Each pass was then checked by eye
// on a contact sheet; a team stays off the list when ESPN's two variants
// are the same image.
const DARK_SOURCE = new Set([
  '2005', // air-force
  '2006', // akron
  '2032', // arkansas-state
  '2', // auburn
  '2050', // ball-state
  '239', // baylor
  '103', // boston-college
  '189', // bowling-green
  '25', // california
  '2117', // central-michigan
  '2132', // cincinnati
  '324', // coastal-carolina
  '57', // florida
  '2229', // florida-international
  '61', // georgia
  '2247', // georgia-state
  '59', // georgia-tech
  '356', // illinois
  '2294', // iowa
  '2306', // kansas-state
  '2309', // kent-state
  '96', // kentucky
  '2335', // liberty
  '2348', // louisiana-tech
  '99', // lsu
  '276', // marshall
  '120', // maryland
  '193', // miami-oh
  '127', // michigan-state
  '2623', // missouri-state
  '2440', // nevada
  '166', // new-mexico-state
  '87', // notre-dame
  '194', // ohio-state
  '197', // oklahoma-state
  '295', // old-dominion
  '204', // oregon-state
  '213', // penn-state
  '221', // pittsburgh
  '242', // rice
  '164', // rutgers
  '21', // san-diego-state
  '23', // san-jose-state
  '2579', // south-carolina
  '2572', // southern-miss
  '2628', // tcu
  '245', // texas-am
  '2641', // texas-tech
  '2649', // toledo
  '202', // tulsa
  '5', // uab
  '113', // umass
  '2439', // unlv
  '328', // utah-state
  '2638', // utep
  '2636', // utsa
  '238', // vanderbilt
  '258', // virginia
  '259', // virginia-tech
  '154', // wake-forest
  '277', // west-virginia
  '98', // western-kentucky
]);
const colorSrcUrl = (espn) =>
  `https://a.espncdn.com/i/teamlogos/ncaa/${DARK_SOURCE.has(String(espn)) ? '500-dark' : '500'}/${espn}.png`;
const monoSrcUrl = (espn) => `https://a.espncdn.com/i/teamlogos/ncaa/500/${espn}.png`;
const payload = JSON.parse(readFileSync('src/data/payload.json', 'utf8'));
const fbs = payload.teams.filter((t) => t.major?.some(([a, b]) => a <= 2026 && b >= 2026));
// mono ink marks for EVERY team with an espn id (opponent chips), color marks
// for the current FBS set (column headers).
mkdirSync('public/logos-color', { recursive: true });

let made = 0;
const missing = [];
for (const t of fbs) {
  if (!t.espn) { missing.push(t.id); continue; }
  const out = `public/logos-color/${t.espn}.png`;
  if (existsSync(out)) continue;
  const res = await fetch(colorSrcUrl(t.espn));
  if (!res.ok) { missing.push(`${t.id} color (http ${res.status})`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf).resize(72, 72, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 }).toFile(out);
  made++;
  await new Promise((r) => setTimeout(r, 150));
}
for (const t of payload.teams) {
  if (!t.espn) continue;
  const out = `${OUT}/${t.espn}.png`;
  if (existsSync(out)) continue;
  const res = await fetch(monoSrcUrl(t.espn));
  if (!res.ok) { missing.push(`${t.id} (http ${res.status})`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buf).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const ink = Math.min(1, Math.max((1 - lum) * 1.2, sat * 0.9));
    data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
    data[i + 3] = Math.round(data[i + 3] * ink);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 10 })
    .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  made++;
  await new Promise((r) => setTimeout(r, 150));
}
console.log(`generated ${made}; missing: ${missing.join(', ') || 'none'}`);

// Fetch missing team marks: one-color into public/logos/<espnId>.png, color
// into public/logos-color/<espnId>.png. Existing files are kept, so delete one
// to refetch it.
// The mono ink-density pipeline is hostile-territory's: alpha from darkness OR
// saturation baked onto pure black at FULL resolution, then trim, then resize
// (thresholding after a resize half-keys anti-aliased edges into speckle).
// CSS treatments downstream: wins = plain opacity, losses = invert(.66).
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';

const OUT = 'public/logos';
mkdirSync(OUT, { recursive: true });
// Color marks sit on the dark page, where black, navy, maroon and forest
// green sink in. ESPN publishes a dark-background variant of every mark
// (500-dark); it feeds the COLOR logos only, and only when it helps. The mono
// pipeline always uses the standard mark: its dark lettering and keylines are
// exactly the ink the density formula needs, and the dark variant's white
// detail would knock them out into mush on both square types.
//
// "Helps" is measured over the mark's opaque pixels at display size, two ways
// (audited against a contact sheet of all 136 FBS teams, Sept 2026):
//   - CIE76 distance from the page background under 25: finds black.
//   - WCAG luminance contrast against the page under 1.6: finds the navy,
//     maroon and green that have chroma but don't read.
// The variant wins when either share is large on the standard mark and at
// least two points smaller on the variant. Many teams' two files are the
// same image, and those stay as they are.
const PAGE = [0x28, 0x21, 0x27];
// by eye: a white keyline the measures barely see, and the original two
const FORCE_DARK = new Set([
  '61', // georgia
  '2579', // south-carolina
  '197', // oklahoma-state
  '194', // ohio-state
  '2641', // texas-tech
]);
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lumOf = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function labOf(r, g, b) {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const x = t((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = t(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = t((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const PAGE_LAB = labOf(...PAGE);
const PAGE_LUM = lumOf(...PAGE);
const resized = (buf) => sharp(buf).resize(72, 72, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
/** The shares of a mark's opaque pixels that read as the page: by color distance, by luminance. */
async function sunk(buf) {
  const { data } = await resized(buf).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  let n = 0, near = 0, flat = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    n++;
    const lab = labOf(data[i], data[i + 1], data[i + 2]);
    if (Math.hypot(lab[0] - PAGE_LAB[0], lab[1] - PAGE_LAB[1], lab[2] - PAGE_LAB[2]) < 25) near++;
    const l = lumOf(data[i], data[i + 1], data[i + 2]);
    if ((Math.max(l, PAGE_LUM) + 0.05) / (Math.min(l, PAGE_LUM) + 0.05) < 1.6) flat++;
  }
  return n ? { near: near / n, flat: flat / n } : { near: 0, flat: 0 };
}
async function prefersDark(espn, std, dark) {
  if (FORCE_DARK.has(String(espn))) return true;
  const [a, b] = [await sunk(std), await sunk(dark)];
  return (a.near > 0.15 && a.near - b.near >= 0.02) || (a.flat >= 0.2 && a.flat - b.flat >= 0.02);
}
const srcUrl = (espn, dark) => `https://a.espncdn.com/i/teamlogos/ncaa/${dark ? '500-dark' : '500'}/${espn}.png`;
const pause = () => new Promise((r) => setTimeout(r, 150));
async function get(url) {
  const res = await fetch(url);
  await pause();
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

const payload = JSON.parse(readFileSync('src/data/payload.json', 'utf8'));
// build-current nulls the id of a team whose mark hasn't been fetched yet and
// lists it in data/build/logo-wants.json, so a new opponent gets its mark here
const WANTS = 'data/build/logo-wants.json';
const wants = existsSync(WANTS) ? JSON.parse(readFileSync(WANTS, 'utf8')) : [];
const marks = [...payload.teams.filter((t) => t.espn), ...wants];
// a mono ink mark (result squares) and a color mark (column heads, next-game
// chips, the ledger) for every team with an ESPN id
mkdirSync('public/logos-color', { recursive: true });

let made = 0;
let darkened = 0;
const missing = [];
for (const t of marks) {
  const out = `public/logos-color/${t.espn}.png`;
  if (existsSync(out)) continue;
  const std = await get(srcUrl(t.espn, false));
  if (!std) { missing.push(`${t.id} color`); continue; }
  const dark = await get(srcUrl(t.espn, true));
  const useDark = !!dark && await prefersDark(t.espn, std, dark);
  if (useDark) darkened++;
  await resized(useDark ? dark : std).png({ compressionLevel: 9 }).toFile(out);
  made++;
}
for (const t of marks) {
  const out = `${OUT}/${t.espn}.png`;
  if (existsSync(out)) continue;
  const buf = await get(srcUrl(t.espn, false));
  if (!buf) { missing.push(`${t.id} mono`); continue; }
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
}
console.log(`generated ${made} (${darkened} color marks from the dark variant); missing: ${missing.join(', ') || 'none'}`);

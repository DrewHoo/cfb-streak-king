// Fetch missing one-color team marks into public/logos/<espnId>.png.
// The ink-density pipeline is hostile-territory's: alpha from darkness OR
// saturation baked onto pure black at FULL resolution, then trim, then resize
// (thresholding after a resize half-keys anti-aliased edges into speckle).
// CSS treatments downstream: wins = plain opacity, losses = invert(.66).
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';

const OUT = 'public/logos';
mkdirSync(OUT, { recursive: true });
const payload = JSON.parse(readFileSync('src/data/payload.json', 'utf8'));
const fbs = payload.teams.filter((t) => t.fbs?.some(([a, b]) => a <= 2026 && b >= 2026));

let made = 0;
const missing = [];
for (const t of fbs) {
  if (!t.espn) { missing.push(t.id); continue; }
  const out = `${OUT}/${t.espn}.png`;
  if (existsSync(out)) continue;
  const res = await fetch(`https://a.espncdn.com/i/teamlogos/ncaa/500/${t.espn}.png`);
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

#!/usr/bin/env node
// The deploy's last check: the payload about to ship holds everything the
// live site's does. It fails when this payload was built before the live one,
// or holds fewer finals of the running season: a branch merged with the
// payload it was cut with, a refresh whose games call failed and built the
// season short. Once the site has a week, no deploy takes it back.
//
// To back a bad refresh out on purpose, put "[older data]" in the commit
// message (the workflow sets ALLOW_OLDER_DATA from it). A live payload that
// can't be read isn't checked: the committed payload is still the newest
// main has.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/util.mjs';

const LIVE = 'https://drewhoover.com/cfb-streak-king/share/payload.json';
const finals = (p) => p.games.se.filter((se) => se === p.currentSeason).length;

const mine = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'payload.json'), 'utf8'));
let live;
try {
  const res = await fetch(`${LIVE}?t=${Date.now()}`, { headers: { 'user-agent': 'cfb-streak-king build (drewhoover.com)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  live = await res.json();
} catch (e) {
  console.log(`not checked: the live payload couldn't be read (${e.message})`);
  process.exit(0);
}

const older = [];
if (mine.builtAt < live.builtAt) older.push(`it was built ${mine.builtAt}, before the live site's ${live.builtAt}`);
if (mine.currentSeason === live.currentSeason && finals(mine) < finals(live)) {
  older.push(`it has ${finals(mine)} finals of ${mine.currentSeason}, and the live site has ${finals(live)}`);
}
if (!older.length) {
  console.log(`the payload (${mine.builtAt}, ${finals(mine)} finals of ${mine.currentSeason}) is no older than the live site's (${live.builtAt}, ${finals(live)})`);
  process.exit(0);
}
console.error(`This payload would take the live site back: ${older.join('; ')}.`);
if (process.env.ALLOW_OLDER_DATA) {
  console.error('Shipping it anyway: the commit says [older data].');
  process.exit(0);
}
console.error('Pull main and rebuild the payload (node scripts/data/build-current.mjs), or put "[older data]" in the commit message to ship it on purpose.');
process.exit(1);

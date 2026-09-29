// The app's model: the shipped payload, decoded once at module scope so the
// prerender and the client share it. createModel.ts does the work.

import payload from '../data/payload.json';
import { createModel } from './createModel.ts';

export const model = createModel(payload);
export const {
  P, teams, confs, firstSeason, fbsNow, confOf, windowStartOf, gamesOf, upcomingOf, activeBoard, allTimeBoard, edgeFor,
} = model;
export { CHIPS, chipByKey } from './chips.ts';

export const todayEpochDay = () => Math.floor(Date.now() / 86400000);
/** The day the payload was built, as the first render's "today": the prerender and the hydrate must agree. */
export const builtEpochDay = Math.floor(Date.parse(P.builtAt) / 86400000);

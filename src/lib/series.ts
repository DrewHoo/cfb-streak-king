// The app's series (seriesCore.ts on the shipped payload and the early
// games): every meeting of two teams, back to the first one jhowell.net has.

import early from '../data/series-early.json';
import { teams, fbsNow, gamesOf, upcomingOf } from './model.ts';
import { createSeries } from './seriesCore.ts';

export { SERIES_MIN } from './seriesCore.ts';
export type { Series, SeriesGame, Run } from './seriesCore.ts';

export const { seriesGames, seriesOf, meetings, seriesOpponents, hasSeries } = createSeries({ teams, fbsNow, gamesOf, upcomingOf }, early);

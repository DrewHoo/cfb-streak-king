import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.jsx'
import { teamFromPath, gamesFromPath, weekFromPath, seasonFromPath, riskFromPath, breakersFromPath, breakerFromPath, breakersSeasonFromPath, landingFromPath, asTeamFromPath } from './lib/url.ts'
import { gameFromPath } from './lib/game.ts'
import { decodeSeason } from './lib/seasonFile.ts'
import { decodeCrowns } from './lib/crownsFile.ts'
import { decodeDigests } from './lib/digests.ts'
import { decodeBreakers } from './lib/breakers.ts'
import './styles.css'

// The markup is already in the HTML: scripts/prerender.mjs bakes it in at
// build time so crawlers get the whole page without running anything.
// Hydrate onto it rather than throwing it away (createRoot would). The dev
// server has no baked markup, so fall back to a plain render there.
// /team/<id>/ and /game/<date>/<teams>/ are prerendered pages; the hydrate
// must start from the same state the prerender did, so the team or game
// comes from the path here, not from a post-mount effect
const game = gameFromPath(window.location.pathname)
const page = game ? null : teamFromPath(window.location.pathname)
// a team page embeds that team's crowns, a games page the schedule's digests, a game page its season's rows (scripts/prerender.mjs)
const embedded = document.getElementById('crowns-data')
const digests = document.getElementById('digests-data')
const seasonRows = document.getElementById('season-data')
const breakers = document.getElementById('breakers-data')
// a team's by-opponent page (/team/<id>/losing-streaks-by-opponent/), prerendered on that board
const asPage = page == null && !game ? asTeamFromPath(window.location.pathname) : null
const initial = {
  page,
  game,
  games: page == null && !game && gamesFromPath(window.location.pathname),
  bwk: page == null && !game ? weekFromPath(window.location.pathname) : null,
  risk: page == null && !game && riskFromPath(window.location.pathname),
  breakers: page == null && !game && breakersFromPath(window.location.pathname),
  breaker: page == null && !game ? breakerFromPath(window.location.pathname) : null,
  // a past season's schedule or streak-breakers (not prerendered: the app boots on the 404 shell)
  season: page == null && !game ? seasonFromPath(window.location.pathname) ?? breakersSeasonFromPath(window.location.pathname) : null,
  // a named definition's board (/longest-home-win-streaks/), prerendered on that definition
  landing: page == null && !game ? landingFromPath(window.location.pathname)?.slug ?? null : null,
  as: asPage?.ti ?? null,
  asDir: asPage?.dir ?? null,
  crowns: page != null && embedded ? { active: decodeCrowns(JSON.parse(embedded.textContent)).rows, all: null } : null,
  digests: page == null && digests ? decodeDigests(JSON.parse(digests.textContent)) : null,
  seasonRows: seasonRows ? decodeSeason(JSON.parse(seasonRows.textContent)) : null,
  breaks: breakers ? decodeBreakers(JSON.parse(breakers.textContent)) : null,
}

const root = document.getElementById('root')
const app = (
  <React.StrictMode>
    <App initial={initial} />
  </React.StrictMode>
)
if (root.firstChild) hydrateRoot(root, app)
else createRoot(root).render(app)

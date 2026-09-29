import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.jsx'
import { teams, fbsNow } from './lib/model.ts'
import { decodeCrowns } from './lib/crownsFile.ts'
import './styles.css'

// The markup is already in the HTML: scripts/prerender.mjs bakes it in at
// build time so crawlers get the whole page without running anything.
// Hydrate onto it rather than throwing it away (createRoot would). The dev
// server has no baked markup, so fall back to a plain render there.
// /team/<id>/ is a prerendered page with that team open; the hydrate must
// start from the same state the prerender did, so the team comes from the
// path here, not from a post-mount effect
const m = /\/team\/([a-z0-9-]+)\/?$/.exec(window.location.pathname)
const ti = m ? teams.findIndex((t) => t.id === m[1]) : -1
const team = ti >= 0 && fbsNow.has(ti) ? ti : null
// a team page embeds that team's crowns (scripts/prerender.mjs)
const embedded = document.getElementById('crowns-data')
const initial = { team, crowns: team != null && embedded ? decodeCrowns(JSON.parse(embedded.textContent)) : null }

const root = document.getElementById('root')
const app = (
  <React.StrictMode>
    <App initial={initial} />
  </React.StrictMode>
)
if (root.firstChild) hydrateRoot(root, app)
else createRoot(root).render(app)

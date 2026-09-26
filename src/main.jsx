import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// The markup is already in the HTML: scripts/prerender.mjs bakes it in at
// build time so crawlers get the whole page without running anything.
// Hydrate onto it rather than throwing it away (createRoot would). The dev
// server has no baked markup, so fall back to a plain render there.
const root = document.getElementById('root')
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
if (root.firstChild) hydrateRoot(root, app)
else createRoot(root).render(app)

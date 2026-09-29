import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages serves this repo at https://<domain>/<repo-name>/, so every
// asset URL has to start with the repo name. Skipping this ships a blank page
// with a 404 for every JS and CSS file. package.json "name" is the repo name.
export default defineConfig({
  base: `/${pkg.name}/`,
  plugins: [react()],
  // the suite walks the real 63k-game payload; CI runners are a few times
  // slower than a laptop, so the 5s default is too tight
  test: { testTimeout: 30000 },
  // the data in its own chunk: a code-only deploy leaves the cached payload
  // alone, and the payload refresh leaves the cached code alone
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: { groups: [{ name: 'payload', test: /src[\\/]data[\\/]payload\.json/ }] },
      },
    },
  },
})

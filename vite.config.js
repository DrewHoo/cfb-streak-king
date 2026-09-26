import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages serves this repo at https://<domain>/<repo-name>/, so every
// asset URL has to start with the repo name. Skipping this ships a blank page
// with a 404 for every JS and CSS file. package.json "name" is the repo name.
export default defineConfig({
  base: `/${pkg.name}/`,
  plugins: [react()],
})

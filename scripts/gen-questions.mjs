// Writes worker/src/questions.json: the Jev question set built from the chip
// catalog by src/lib/intent.js. The Worker's dev and deploy scripts run this
// first, so the deployed questions always match the client's answer mapping.
import { createServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { buildQuestions, STATE_CONTEXT } = await vite.ssrLoadModule('/src/lib/intent.js')
const out = path.join(ROOT, 'worker/src/questions.json')
fs.writeFileSync(out, JSON.stringify({ context: STATE_CONTEXT, questions: buildQuestions() }))
console.log(`wrote ${path.relative(ROOT, out)} (${Object.keys(buildQuestions()).length} questions)`)
await vite.close()

// POST text -> Jev's answers to the streak-definition questions. The browser
// maps answers to chips (src/lib/intent.js fromJev). The question set is fixed
// here, so this can't be used as a general Jev proxy.
import spec from './questions.json'

const ORIGINS = [/^https:\/\/drewhoover\.com$/, /^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/]
const MAX_BODY = 1000
const MAX_Q = 200

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') ?? ''
    const allowed = ORIGINS.some((re) => re.test(origin))
    const cors = allowed ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: allowed ? 204 : 403,
        headers: { ...cors, 'access-control-allow-methods': 'POST', 'access-control-max-age': '86400' },
      })
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405, cors)
    if (!allowed) return json({ error: 'origin' }, 403, cors)

    const { success } = await env.LIMIT.limit({ key: request.headers.get('cf-connecting-ip') ?? 'unknown' })
    if (!success) return json({ error: 'rate' }, 429, cors)

    if (Number(request.headers.get('content-length') ?? MAX_BODY + 1) > MAX_BODY) return json({ error: 'size' }, 413, cors)
    let q
    try {
      q = JSON.parse(await request.text()).q
    } catch {
      return json({ error: 'body' }, 400, cors)
    }
    if (typeof q !== 'string' || !q.trim() || q.length > MAX_Q) return json({ error: 'q' }, 400, cors)

    try {
      const t0 = Date.now()
      const out = await env.AI.run('typesafe/jev', { state: spec.context + JSON.stringify(q.trim()), questions: spec.questions })
      console.log(JSON.stringify({ msg: 'parsed', ms: Date.now() - t0, tokens: out.usage?.input_tokens }))
      return json({ model: out.model, answers: out.answers }, 200, cors)
    } catch (err) {
      console.error(JSON.stringify({ msg: 'jev failed', err: String(err) }))
      return json({ error: 'upstream', ...(env.DEBUG ? { detail: String(err) } : {}) }, 502, cors)
    }
  },
}

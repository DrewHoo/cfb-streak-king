// URL <-> state helpers. Read the URL only after mount (in a useEffect), never
// during render: the prerender runs without a window, and seeding state from
// the URL during render hydrates into a mismatch when the param is set.

export function readParam(key) {
  try {
    return new URLSearchParams(window.location.search).get(key)
  } catch {
    return null
  }
}

// The whole URL in one replaceState: the path (a team page is /team/<id>/
// under the site base, everything else the root) plus the params. Null or
// empty params are dropped. One call per state change, so the analytics
// embed counts one pageview per change.
export function writeUrl(base, path, params) {
  try {
    const url = new URL(window.location.href)
    url.pathname = base + path
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === '') url.searchParams.delete(key)
      else url.searchParams.set(key, value)
    }
    if (url.href !== window.location.href) window.history.replaceState(null, '', url)
  } catch {}
}

// replaceState, not pushState: changing a filter should not grow the back
// stack. The analytics embed counts each call as a pageview, so the shared
// URL and the report agree on what people looked at.
export function writeParam(key, value) {
  try {
    const url = new URL(window.location.href)
    if (value == null || value === '') url.searchParams.delete(key)
    else url.searchParams.set(key, value)
    window.history.replaceState(null, '', url)
  } catch {}
}

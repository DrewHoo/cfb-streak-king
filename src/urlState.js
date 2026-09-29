// Writing the URL. What it means lives in src/lib/url.ts (pure). Touch the
// real URL only after mount, never during render: the prerender runs without
// a window, and seeding state from the URL during render hydrates into a
// mismatch when a param is set.

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

// An absolute link: the page's origin, the path under the site base, and the
// non-empty params (a shared crown's team page).
export function absoluteUrl(base, { path, params }) {
  const url = new URL(window.location.href)
  url.search = ''
  url.pathname = base + path
  for (const [key, value] of Object.entries(params)) if (value != null && value !== '') url.searchParams.set(key, value)
  return url.toString()
}

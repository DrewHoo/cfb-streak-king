// Writing the URL. What it means lives in src/lib/url.ts (pure). Touch the
// real URL only after mount, never during render: the prerender runs without
// a window, and seeding state from the URL during render hydrates into a
// mismatch when a param is set.

// The whole URL in one call: the path (a team page is /team/<id>/ under the
// site base, everything else the root) plus the params. Null or empty params
// are dropped. A change of definition replaces the entry; opening a streak, a
// matchup or a team page pushes one (`push` is the new entry's state), so Back
// returns from it. One call per state change, so the analytics embed counts
// one pageview per change. Returns whether an entry was pushed.
export function writeUrl(base, path, params, push = null) {
  try {
    const url = new URL(window.location.href)
    url.pathname = base + path
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === '') url.searchParams.delete(key)
      else url.searchParams.set(key, value)
    }
    if (url.href === window.location.href) return false
    if (push) {
      // leave the scroll position on the entry being left, for the way back
      window.history.replaceState({ ...window.history.state, y: window.scrollY }, '')
      window.history.pushState(push, '', url)
      return true
    }
    window.history.replaceState(window.history.state, '', url)
  } catch {}
  return false
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

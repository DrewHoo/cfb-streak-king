// The weekly posts: markdown files under content/posts/, one per post, read
// by the prerender into /blog/<slug>/ pages, the /blog/ index and the RSS
// feed. The slug is the file name. Frontmatter is a flat `key: value` block
// between --- lines; `title`, `date` (YYYY-MM-DD) and `description` are
// required, and a post missing one fails the build rather than publishing a
// page with an empty head. A file without frontmatter (content/posts/README.md)
// is skipped.
import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function frontmatter(src) {
  const m = FRONT.exec(src)
  if (!m) return null
  const out = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([a-zA-Z_][\w-]*):\s*(.*)$/.exec(line)
    if (!kv) continue
    let v = kv[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[kv[1]] = v
  }
  return { data: out, body: src.slice(m[0].length) }
}

/**
 * Every post, newest first: { slug, title, date, description, image?, html,
 * text }. `html` is the body rendered; `text` the body's words, for the feed
 * and a word count.
 */
export function readPosts(dir) {
  if (!fs.existsSync(dir)) return []
  const posts = []
  for (const file of fs.readdirSync(dir).sort()) {
    if (!/\.md$/.test(file)) continue
    const src = fs.readFileSync(path.join(dir, file), 'utf8')
    const fm = frontmatter(src)
    if (!fm) continue
    const slug = file.replace(/\.md$/, '')
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`posts: ${file}: the file name is the slug; use lowercase letters, digits and hyphens`)
    for (const k of ['title', 'date', 'description']) if (!fm.data[k]) throw new Error(`posts: ${file}: frontmatter needs ${k}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.data.date)) throw new Error(`posts: ${file}: date must be YYYY-MM-DD, got ${fm.data.date}`)
    const html = marked.parse(fm.body, { async: false, gfm: true })
    posts.push({
      slug,
      title: fm.data.title,
      date: fm.data.date,
      description: fm.data.description,
      image: fm.data.image || null,
      draft: fm.data.draft === 'true',
      html,
      text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    })
  }
  return posts.filter((p) => !p.draft).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)))
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** "October 16, 2026" */
export function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}
/** The RFC 822 date RSS wants, at noon UTC on the post's day. */
export const rfc822 = (iso) => new Date(`${iso}T12:00:00Z`).toUTCString()

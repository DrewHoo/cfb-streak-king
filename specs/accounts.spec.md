# Accounts and saved streaks

Status: spec only. v0 (shipped 2026-09-26) saves streaks to localStorage under the
`sk-favs` key with no account. This documents the path to real accounts so favorites
sync across devices.

## What exists now (v0)

- A ☆ SAVE button next to SHARE saves the current definition: `{ c, dir, name }`,
  where `c` is the same encoding the `?c=` URL param uses and `name` is the generated
  sentence ("winning · hostile territory + vs ranked").
- Saved streaks render as a "your streaks" row under the presets. Tap applies, × removes.
- localStorage is per-browser and per-device. That's the whole limitation accounts fix.

## Goal

A user signs in once, and their saved streaks follow them across devices. Nothing else
needs an account. Keep the static site static; the account layer is a separate small
service.

## Constraint that shapes the design

The site is static GitHub Pages at `drewhoover.com/cfb-streak-king/`. Any persistence
needs an external API. Every sibling site on drewhoover.com has the same need
eventually, so the service should be one shared auth + storage API for the domain, not
a per-project backend.

## Recommended architecture

- **Auth: Better Auth** (better-auth.com), self-hosted TypeScript. Social login only,
  no passwords: "Continue with Google" plus GitHub. Better Auth owns the user/session/
  account tables and gives us cookie sessions out of the box.
- **DB: Postgres on Neon** (free tier is fine at this scale; drizzle adapter).
- **Host: a small Node server** on Fly.io/Railway/Render (~$0–5/mo), serving
  `api.drewhoover.com`. The static sites and the API are then same-site
  (`*.drewhoover.com`), so session cookies work with `Domain=.drewhoover.com` and
  Better Auth's `crossSubDomainCookies` option; no third-party-cookie trouble. CORS
  allowlist is `https://drewhoover.com` with credentials.
- Cloudflare Workers + Neon's HTTP driver is a serverless variant of the same shape if
  a always-on server feels heavy. Better Auth runs on Workers.

## Data model

Better Auth manages `user`, `session`, `account`, `verification`. Ours is one table:

```sql
create table saved_streak (
  id          bigint generated always as identity primary key,
  user_id     text not null references "user"(id) on delete cascade,
  site        text not null default 'cfb-streak-king',
  def         text not null,        -- the ?c= encoding, '' = all games
  dir         char(1) not null,     -- 'W' | 'L'
  name        text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, site, def, dir)
);
```

`def` reuses the URL encoding on purpose: it's already the wire format for shared
links, and unknown chip keys drop silently on decode, so old rows survive catalog
changes the same way old links do. `site` makes the table serve every sibling site.

## API

- `api.drewhoover.com/api/auth/*` — Better Auth's own routes.
- `GET /api/favs?site=cfb-streak-king` — the signed-in user's rows.
- `PUT /api/favs` — replace the user's set for a site (client sends the full list;
  favorites are small and last-write-wins is fine).

## Client behavior

- Signed out: exactly v0, localStorage only. A quiet "sign in to sync" link next to
  the your-streaks row.
- First sign-in: union localStorage favorites into the account by `(def, dir)`, then
  treat the server as the source of truth and localStorage as an offline cache.
- The embed pattern applies: auth is optional-chained everywhere, and the site works
  fully with the API unreachable.

## Alternatives considered

- **Supabase** (auth + Postgres + RLS in one): less code, but the auth user table
  lives in their schema and the free tier pauses idle projects. Fine fallback.
- **Clerk / Auth0**: fastest setup, but hosted pricing for a hobby domain and the user
  table isn't ours.
- **Firebase**: NoSQL and Google lock-in for a relational 1-table problem.

Better Auth + Neon wins on owning the data, $0-ish cost, and one service reusable by
every project on the domain.

## Open questions

- Providers: Google only, or Google + GitHub? (CFB audience skews Google.)
- Does anything later (claiming a team? comments?) want a public username, or is auth
  purely for sync? Purely-sync needs no profile at all.
- A privacy note on the site becomes necessary once accounts exist.

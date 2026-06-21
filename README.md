# Bible Tracker ✝️

A LINE LIFF web app for tracking Bible reading progress within church communities.
Each church runs its own private leaderboard; members log the chapters they read and
compete on a per-church ranking. The UI is entirely in **Thai** and ships as a PWA.

## Features

- **Multi-church** — anyone can create a church (becoming its admin) or join an
  existing one with a join code. Each church has its own members and leaderboard.
- **Per-church leaderboard** — members are ranked by score (number of chapters read).
- **Reading log** — two-step book → chapter picker with range selection; logs are
  de-duplicated per `(user, book, chapter)`.
- **History** — calendar view of your reading with per-day detail and delete.
- **Admin tools** — church admins can rename the church and share its join code.
- **LINE auth** — sign-in via LINE LIFF, bridged into Supabase so Row Level Security
  can enforce per-church and admin-only rules at the database level.
- **PWA** — installable on iOS/Android with the church logo icon.

## Tech Stack

| Layer    | Choice                                                        |
| -------- | ------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind CSS v4         |
| Auth     | LINE LIFF v2 → custom Supabase JWT (verified server-side)    |
| Data     | Supabase (PostgreSQL) with Row Level Security                |
| Extras   | driver.js (onboarding tour) · lucide-react (icons) · jose (JWT) |
| Hosting  | Vercel                                                        |

## Architecture

### Auth & identity bridge

The app authenticates with **LINE LIFF** only — there is no Supabase Auth login.
To let RLS identify the user, `app/api/auth/line/route.ts` verifies the LIFF ID token
with LINE and mints a short-lived **Supabase JWT** (signed with the project's JWT
secret) whose `sub` is the LINE userId. The client then talks to Supabase with that
token, so `auth.jwt()->>'sub'` resolves to the LINE userId inside RLS policies.

> LINE userIds are not UUIDs, so policies use the helper `requesting_user_id()`
> (reads the raw `sub` claim as text) instead of the built-in `auth.uid()`.

### Multi-tenancy & RLS

- `churches` and a `church_members` join table (`user_id`, `church_id`, `role`) are
  the source of truth for membership and roles (`admin` / `member`).
- Create/join go through `SECURITY DEFINER` RPCs (`create_church`, `join_church`) so
  the `churches` table stays non-enumerable and memberships are created atomically.
- RLS restricts profile/log writes to your own rows, scopes church data to
  co-members, and limits church edits to admins. Recursive membership checks are
  done via `SECURITY DEFINER` helpers (`is_church_member`, `is_church_admin`,
  `shares_church_with`) to avoid policy recursion.

### Routing (all client components)

- **`/`** — register/join: create a church (editable, auto-suggested slug) or enter a
  join code. Existing members are redirected to their church.
- **`/[church]`** — the church's leaderboard + your profile summary. Members get an
  "add reading" button; admins get an action menu (edit church / add reading).
- **`/[church]/record`** — book → chapter selector; inserts to `reading_logs` and
  recalculates score.
- **`/[church]/history`** — calendar history with per-day detail and delete.
- **`/[church]/settings`** — admin-only: rename church, copy join code (slug is
  immutable).

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Environment variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=<supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
SUPABASE_JWT_SECRET=<supabase project JWT secret>   # Settings → API → JWT Settings

# LINE
NEXT_PUBLIC_LIFF_ID=<LINE LIFF app id>
LINE_CHANNEL_ID=<LINE Login channel id>             # the ID token's audience
```

> `LINE_CHANNEL_ID` must equal the `aud` claim of the LIFF ID token (the **LINE Login**
> channel behind your LIFF app), **not** the LIFF id or Messaging API channel.
>
> If your Supabase project uses asymmetric JWT signing keys, keep the legacy HS256
> secret active and use it for `SUPABASE_JWT_SECRET`.

### 3. Database migrations

Apply the SQL in `supabase/migrations/` **in order** via the Supabase SQL editor:

1. `0001_multichurch_schema.sql` — tables, `requesting_user_id()`, RPCs.
2. Deploy the app so the auth bridge is live and requests carry the Supabase JWT.
3. `0002_multichurch_rls.sql` — enable Row Level Security. **Apply last** — enabling
   RLS before the auth bridge is live will lock out the client.
4. `0003_fix_rls_recursion.sql` — `SECURITY DEFINER` helpers that resolve RLS
   recursion on `church_members`.

### 4. Run

```bash
npm run dev      # http://localhost:3000
```

## Scripts

```bash
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run lint     # ESLint (next/core-web-vitals + next/typescript)
```

No test framework is configured.

## Database Schema

**`profiles`** — `id` (LINE userId, PK), `display_name`, `avatar_url`, `score` (int),
`has_seen_onboarding` (bool). Score = count of the user's `reading_logs` rows.

**`reading_logs`** — `id` (bigint PK), `user_id` (FK → profiles), `book_name`,
`chapter`, `created_at`. Unique on `(user_id, book_name, chapter)`.

**`churches`** — `id` (uuid PK), `name`, `slug` (varchar(5), URL id used in
`/[church]`), `join_code` (unique), `created_at`.

**`church_members`** — `id` (bigint PK), `user_id` (FK → profiles), `church_id`
(FK → churches), `role` (`admin` | `member`), unique on `(user_id, church_id)`.

`data/bible.ts` holds all 66 books with Thai names and chapter counts; these names
must match the `book_name` values stored in Supabase.

## Deploy

Deployed to **Vercel**. Set all environment variables above in the Vercel project
settings, and ensure the database migrations have been applied (see step 3).

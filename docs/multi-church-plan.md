# Multi-Church Support — Implementation Plan

## Context

The app started single-tenant: one global leaderboard, every user in one shared pool,
all DB access client-side with the Supabase **anon key** and **no RLS**. This change lets
other churches register and use the tracker independently — each church with its own
members, its own leaderboard, and an **admin** who can configure the church.

The key insight: the missing piece is not a table or a "controller" — it is **verified
identity at the database level**. The app authenticates with LINE LIFF only and never
signs into Supabase Auth, so Postgres sees every request as anonymous (`auth.uid()` is
`NULL`). A client-side `role === 'admin'` check is bypassable with the public anon key.
To make "only admins can configure their church" real, we (a) bridge LINE identity into a
Supabase JWT and (b) enforce rules with RLS.

### Decisions
- **Join flow:** unique `join_code` per church; create a church (→ admin) or enter a code (→ member).
- **Enforcement:** Supabase **RLS** policies.
- **Leaderboard:** **per-church only**, scoped by the church in the URL.
- **Role model:** separate **`church_members`** join table (`user_id`, `church_id`, `role`).
- **Identity bridge:** LINE → Supabase Auth JWT so `auth.jwt()->>'sub'` = LINE userId.
- **Routing:** `/` = register/join; `/[church]` = leaderboard; admins get an action menu (Edit church / Add reading).
- **Slug:** `/[church]` uses a `slug` (1–5 English chars). Suggested from the name, editable at
  creation, **immutable afterward** (no rename). `church_members` is the source of truth for
  membership+role, so `church_id` is **not** duplicated onto `profiles`.

## Part A — Backend (first)

- **A1 Schema** (`supabase/migrations/0001_multichurch_schema.sql`): `churches` (`id`, `name`,
  `slug` varchar(5) unique, `join_code` unique, `created_at`) and `church_members`
  (`user_id`→profiles, `church_id`→churches, `role` check admin|member, unique(user_id, church_id)).
- **A2 Identity helper:** `requesting_user_id()` reads `request.jwt.claims ->> 'sub'` as text
  (avoids the `auth.uid()` uuid-cast error, since LINE ids are not UUIDs).
- **A3 RPCs** (SECURITY DEFINER): `gen_join_code()`, `create_church(p_name, p_slug)` (validate
  `^[a-z0-9]{1,5}$` + unique, create church + admin membership), `join_church(p_code)`.
- **A4 RLS** (`supabase/migrations/0002_multichurch_rls.sql`, applied last): own-row writes for
  profiles/reading_logs; churches/members visible to co-members; church UPDATE admin-only.
- **A5 Auth bridge** (`app/api/auth/line/route.ts`): verify LIFF id token with LINE, mint a
  Supabase JWT signed with `SUPABASE_JWT_SECRET`. Client builds an authed Supabase client with
  `Authorization: Bearer <token>`.
- **A6 Rollout order:** apply schema + RPCs → ship auth bridge → enable RLS last.

## Part B — Frontend

- **B1** `lib/supabaseClient.ts` factory `createAuthedClient(token)`; `LiffProvider` mints the
  JWT, exposes the authed client + the user's memberships/role.
- **B2** `/` = register/join (create church with editable suggested slug; or join by code).
- **B3** `/[church]` = leaderboard scoped to church; member → "เพิ่มการอ่าน", admin → action menu.
- **B4** record/history use the authed client; back-links return to `/[church]`.
- **B5** `/[church]/settings` (admin) renames the church name + shows join code; slug read-only.

## Verification
1. Run migrations on a Supabase branch; verify create/join RPCs and RLS isolation between churches.
2. `POST /api/auth/line` with a LIFF id token returns a JWT whose `sub` = LINE userId; authed query respects RLS.
3. `npm run dev`: register → `/[church]` as admin (action menu); second account joins by code; records stay church-scoped.
4. `npm run lint` and `npm run build` pass.

## Env / deps
- New env: `SUPABASE_JWT_SECRET` (server-only), `NEXT_PUBLIC_LIFF_ID` (existing) used for token audience.
- New dep: `jose` (JWT signing/verification).

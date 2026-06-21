# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js on localhost:3000)
npm run build    # Production build
npm run lint     # ESLint (flat config, next/core-web-vitals + next/typescript)
```

No test framework is configured.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
NEXT_PUBLIC_LIFF_ID=<LINE LIFF app id>
```

## Architecture

Bible Tracker is a LINE LIFF web app for tracking Bible reading progress within a church community. The UI is entirely in **Thai**. It is a PWA deployed to Vercel.

**Stack:** Next.js 16 (App Router) · React 19 · Supabase (PostgreSQL) · LINE LIFF v2 auth · Tailwind CSS v4 · driver.js (onboarding tour) · lucide-react (icons)

### Auth & Data Flow

`LiffProvider` (wraps the entire app via `layout.tsx`) handles the full auth lifecycle:
1. Initializes LINE LIFF SDK → redirects to LINE login if not authenticated
2. Fetches LINE profile → upserts to Supabase `profiles` table
3. Exposes `profile`, `liff`, `isInitializing`, and onboarding state via React context (`useLiff()`)

There is no server-side auth or API routes — all Supabase calls are client-side using the anon key.

### Pages (all client components with `'use client'`)

- **`/`** — Leaderboard with paginated user rankings (sorted by score) + user profile summary + onboarding tour trigger
- **`/record`** — Two-step book→chapter selector. Supports range selection (click first chapter, click last). Inserts to `reading_logs`, recalculates score from count
- **`/history`** — Calendar view of reading history with per-day detail. Supports deleting individual log entries

### Supabase Schema

**`profiles`** — `id` (LINE user ID, PK), `display_name`, `avatar_url`, `score` (int), `has_seen_onboarding` (bool)

**`reading_logs`** — `id` (bigint PK), `user_id` (FK→profiles.id), `book_name`, `chapter`, `created_at`. Unique constraint on `(user_id, book_name, chapter)`.

Score = count of user's reading_logs rows. On record submit, it recalculates by counting rows rather than incrementing.

### Key Data

`data/bible.ts` contains all 66 Bible books with Thai names and chapter counts. Book names in this file must match `book_name` values stored in Supabase.

### Path Alias

`@/*` maps to the project root (configured in `tsconfig.json`).

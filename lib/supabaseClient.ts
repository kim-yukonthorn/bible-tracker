import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Anonymous client (no user identity). Kept for backwards-compat / public reads.
export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Build a Supabase client authenticated as the current LINE user.
 *
 * `token` is the Supabase-compatible JWT minted by /api/auth/line (its `sub`
 * claim is the LINE userId). Sending it as the Authorization header makes
 * `auth.jwt()->>'sub'` resolve to the LINE userId inside RLS policies.
 */
export function createAuthedClient(token: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

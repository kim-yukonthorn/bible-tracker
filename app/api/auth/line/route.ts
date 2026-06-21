import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'

// Verify a LINE LIFF ID token and mint a Supabase-compatible session JWT.
//
// Flow:
//   1. Client posts the LIFF ID token (liff.getIDToken()).
//   2. We verify it with LINE's verify endpoint (validates signature, audience,
//      and expiry) and extract the LINE userId (`sub`).
//   3. We sign a short-lived JWT with the Supabase project's JWT secret so that
//      `auth.jwt()->>'sub'` inside RLS resolves to the LINE userId.
//
// Required server-only env:
//   SUPABASE_JWT_SECRET  - Supabase project JWT secret (Settings > API)
//   LINE_CHANNEL_ID      - LINE Login channel ID (the ID token's audience)

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'

interface LineVerifyResponse {
  sub: string
  name?: string
  picture?: string
  aud: string
  iss: string
  exp: number
  error?: string
  error_description?: string
}

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json()
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 })
    }

    const jwtSecret = process.env.SUPABASE_JWT_SECRET
    const channelId = process.env.LINE_CHANNEL_ID
    if (!jwtSecret || !channelId) {
      return NextResponse.json(
        { error: 'Server is missing SUPABASE_JWT_SECRET or LINE_CHANNEL_ID' },
        { status: 500 },
      )
    }

    // 1. Verify the ID token with LINE.
    const verifyRes = await fetch(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    })

    const verified = (await verifyRes.json()) as LineVerifyResponse
    if (!verifyRes.ok || verified.error || !verified.sub) {
      return NextResponse.json(
        { error: verified.error_description || 'Invalid LINE ID token' },
        { status: 401 },
      )
    }

    // 2. Mint a Supabase session JWT (sub = LINE userId).
    const secret = new TextEncoder().encode(jwtSecret)
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(verified.sub)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret)

    return NextResponse.json({
      token,
      profile: {
        id: verified.sub,
        display_name: verified.name ?? '',
        avatar_url: verified.picture ?? '',
      },
    })
  } catch (err) {
    console.error('LINE auth bridge failed:', err)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}

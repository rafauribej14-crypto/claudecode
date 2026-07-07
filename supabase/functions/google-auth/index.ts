// Supabase Edge Function: verify a Google Sign-In credential (JWT) on the
// server and issue a freshapp session token. This is what lets Google accounts
// use the sealed token-based sync — the browser can no longer be trusted to
// assert "I am g_<sub>" on its own.
//
// Deploy:  supabase functions deploy google-auth --no-verify-jwt
// Set the audience to your Google client id (defaults to the app's id):
//   supabase secrets set GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { jwtVerify, createRemoteJWKSet } from 'https://esm.sh/jose@5.9.6'

const GOOGLE_CLIENT_ID =
  Deno.env.get('GOOGLE_CLIENT_ID') ??
  '910402518107-mu83apdl4il5vvco26n8ugopj1pmsqmc.apps.googleusercontent.com'

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let credential = ''
  try {
    credential = (await req.json()).credential ?? ''
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!credential) return json({ error: 'missing_credential' }, 400)

  // 1) Verify the Google JWT (signature, issuer, audience, expiry).
  let payload: Record<string, unknown>
  try {
    const res = await jwtVerify(credential, JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: GOOGLE_CLIENT_ID,
    })
    payload = res.payload as Record<string, unknown>
  } catch {
    return json({ error: 'invalid_token' }, 401)
  }

  const sub = String(payload.sub ?? '')
  if (!sub) return json({ error: 'no_sub' }, 401)
  const email = String(payload.email ?? '')
  const name = String(payload.name ?? '')
  const syncKey = `g_${sub}`

  // 2) Issue a session token and store its hash (service role bypasses RLS).
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const rawToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const tokenHash = await sha256Hex(rawToken)

  const insert = await fetch(`${supabaseUrl}/rest/v1/sessions`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ token_hash: tokenHash, sync_key: syncKey }),
  })
  if (!insert.ok) {
    return json({ error: 'session_store_failed' }, 500)
  }

  return json({ sync_key: syncKey, name, email, token: rawToken })
})

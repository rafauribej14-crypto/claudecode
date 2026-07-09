// Cloud-backed accounts via Supabase, so a user can sign up on one device and
// log in from any other with the same username + password.
//
// Security model: all auth goes through SECURITY DEFINER Postgres functions
// (app_signup / app_login / app_change_password / app_set_name) that hash with
// bcrypt via pgcrypto. The anon key can only EXECUTE these functions — it has
// NO direct read/write access to the accounts table, so password hashes never
// leave the database. When Supabase is unreachable the caller falls back to the
// local mirror so the app keeps working offline, like the data sync does.

import { SUPABASE_URL, SUPABASE_ANON_KEY, cloudEnabled } from '@/services/cloudSync'

export interface AccountInfo {
  sync_key: string
  name: string
  token: string
}

function headers(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
}

/** POST to a Postgres RPC, with a timeout so a hung network never freezes auth. */
async function rpc(fn: string, args: Record<string, unknown>, ms = 8000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(args),
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(t)
  }
}

export type SignupResult =
  | { status: 'ok'; account: AccountInfo }
  | { status: 'taken' }
  | { status: 'network' }

/** Create an account in the cloud. Empty result => username already taken. */
export async function remoteSignup(username: string, password: string, name: string): Promise<SignupResult> {
  if (!cloudEnabled()) return { status: 'network' }
  try {
    const res = await rpc('app_signup', { p_username: username, p_password: password, p_name: name })
    if (!res.ok) return { status: 'network' }
    const rows = await res.json()
    if (Array.isArray(rows) && rows.length > 0) return { status: 'ok', account: rows[0] as AccountInfo }
    return { status: 'taken' }
  } catch {
    return { status: 'network' }
  }
}

export type LoginResult =
  | { status: 'ok'; account: AccountInfo }
  | { status: 'invalid' }
  | { status: 'network' }

/** Validate credentials in the cloud. Empty result => wrong username/password. */
export async function remoteLogin(username: string, password: string): Promise<LoginResult> {
  if (!cloudEnabled()) return { status: 'network' }
  try {
    const res = await rpc('app_login', { p_username: username, p_password: password })
    if (!res.ok) return { status: 'network' }
    const rows = await res.json()
    if (Array.isArray(rows) && rows.length > 0) return { status: 'ok', account: rows[0] as AccountInfo }
    return { status: 'invalid' }
  } catch {
    return { status: 'network' }
  }
}

export type ChangePwResult = { ok: true } | { ok: false; reason: 'invalid' | 'network' }

/** Change the cloud password (verifies the current one first, in-database). */
export async function remoteChangePassword(username: string, current: string, next: string): Promise<ChangePwResult> {
  if (!cloudEnabled()) return { ok: false, reason: 'network' }
  try {
    const res = await rpc('app_change_password', { p_username: username, p_current: current, p_new: next })
    if (!res.ok) return { ok: false, reason: 'network' }
    const val = await res.json()
    return val === true ? { ok: true } : { ok: false, reason: 'invalid' }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/** Update the display name on the account (best-effort). */
export async function remoteSetName(username: string, name: string): Promise<void> {
  if (!cloudEnabled()) return
  try { await rpc('app_set_name', { p_username: username, p_name: name }) } catch { /* best-effort */ }
}

export type GoogleAuthResult =
  | { status: 'ok'; account: AccountInfo & { email?: string } }
  | { status: 'invalid' }
  | { status: 'network' }

/**
 * Exchange a Google Sign-In credential (JWT) for a freshapp session token.
 * The browser decodes the JWT to read Google's stable user id (sub), then calls
 * the app_google_login DB function to get a session token. No Edge Function
 * required — Google login works with only supabase/setup.sql.
 */
export async function googleAuth(credential: string): Promise<GoogleAuthResult> {
  if (!cloudEnabled()) return { status: 'network' }
  let sub = '', email = '', name = ''
  try {
    const payload = JSON.parse(atob(credential.split('.')[1]))
    sub = String(payload.sub ?? '')
    email = String(payload.email ?? '')
    name = String(payload.name ?? '')
  } catch {
    return { status: 'invalid' }
  }
  if (!sub) return { status: 'invalid' }
  try {
    const res = await rpc('app_google_login', { p_sub: sub, p_email: email, p_name: name })
    if (!res.ok) return { status: 'network' }
    const rows = await res.json()
    if (Array.isArray(rows) && rows.length > 0) {
      return { status: 'ok', account: { ...(rows[0] as AccountInfo), email } }
    }
    return { status: 'network' }
  } catch {
    return { status: 'network' }
  }
}

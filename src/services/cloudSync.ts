// Cross-device sync via Supabase (optional — activates when env vars are set).
// Stores the whole app state as a single JSON blob keyed by the user's Google id.
// If VITE_SUPABASE_* are absent, every function is a no-op and the app keeps
// working purely on localStorage (single-device), exactly as before.

// The anon key is designed to be public (it ships in the browser bundle);
// data protection comes from RLS policies, not from hiding this key.
// Env vars can still override these defaults.
const DEFAULT_SUPABASE_URL = 'https://oxkxxvxzrhksbllyhhjg.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94a3h4dnh6cmhrc2JsbHloaGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyODcwOTksImV4cCI6MjA5ODg2MzA5OX0.j43cWyqesuPtFTWdWydJZW7GaMUIVDvqfP-6ihxamtQ'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

export const cloudEnabled = (): boolean => SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0

// localStorage keys that hold user data worth syncing (NOT auth_users/passwords)
const SYNC_KEYS = [
  'profile',
  'products',
  'inventory',
  'purchases',
  'recipes',
  'prices',
  'meal_plans',
  'pantry',
  'eating_out',
  'meal_log',
  'onboarded_flag',
  'snack_check_date',
  'budget_carryover_dismissed',
]

function snapshot(): Record<string, string> {
  const data: Record<string, string> = {}
  for (const k of SYNC_KEYS) {
    const v = localStorage.getItem(k)
    if (v != null) data[k] = v
  }
  return data
}

function hydrate(data: Record<string, string>) {
  for (const k of SYNC_KEYS) {
    if (data[k] != null) localStorage.setItem(k, data[k])
  }
}

let currentUserKey: string | null = null

export function setSyncUser(key: string | null) {
  currentUserKey = key
}

/** Clears synced user data from this device (used on logout so accounts don't bleed into each other). */
export function clearLocalUserData() {
  for (const k of SYNC_KEYS) localStorage.removeItem(k)
}

function headers(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
}

export type PullResult = 'found' | 'empty' | 'error'

/** Last sync error, surfaced in Settings so debugging doesn't require DevTools. */
let lastError: string | null = null
export function getLastSyncError(): string | null { return lastError }
function setLastError(msg: string | null) {
  lastError = msg
  if (msg) localStorage.setItem('sync_last_error', msg)
  else localStorage.removeItem('sync_last_error')
}
// Restore across reloads
try { lastError = localStorage.getItem('sync_last_error') } catch { /* ignore */ }

async function describeError(res: Response): Promise<string> {
  let body = ''
  try { body = (await res.text()).slice(0, 200) } catch { /* ignore */ }
  return `HTTP ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`
}

/**
 * Pull cloud state into localStorage.
 * - 'found': a cloud record existed and was applied
 * - 'empty': the request succeeded but this user has no cloud record yet (safe to seed)
 * - 'error': the request failed — DO NOT overwrite the cloud, keep local data as-is
 */
export async function pullState(userKey: string): Promise<PullResult> {
  if (!cloudEnabled() || !userKey) return 'empty'
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userKey)}&select=data`,
      { headers: headers() },
    )
    if (!res.ok) {
      setLastError(`Al leer: ${await describeError(res)}`)
      return 'error'
    }
    const rows = await res.json()
    setLastError(null)
    if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
      hydrate(rows[0].data as Record<string, string>)
      return 'found'
    }
    return 'empty'
  } catch (err: any) {
    setLastError(`Red: ${err?.message ?? 'fetch falló'}`)
    return 'error'
  }
}

/** Upsert the current localStorage snapshot to the cloud (last-write-wins). */
export async function pushState(): Promise<void> {
  if (!cloudEnabled() || !currentUserKey) return
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_state`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: currentUserKey,
        data: snapshot(),
        updated_at: new Date().toISOString(),
      }),
    })
    if (!res.ok) setLastError(`Al guardar: ${await describeError(res)}`)
    else setLastError(null)
  } catch (err: any) {
    setLastError(`Red: ${err?.message ?? 'fetch falló'}`)
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null

/** Debounced push — called after every store write. */
export function schedulePush() {
  if (!cloudEnabled() || !currentUserKey) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { void pushState() }, 1500)
}

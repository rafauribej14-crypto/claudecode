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
  localStorage.removeItem('sync_key_ts')
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

// ── Per-key timestamps: each synced section carries its own updated_at so
//    devices merge by "newest version of each section wins" instead of one
//    device's whole snapshot clobbering another's.

const TS_KEY = 'sync_key_ts'

function getTsMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(TS_KEY) ?? '{}') } catch { return {} }
}
function setTs(key: string, ts: string) {
  const map = getTsMap()
  map[key] = ts
  localStorage.setItem(TS_KEY, JSON.stringify(map))
}

/** Record that a section changed locally right now (called from store.save). */
export function markChanged(key: string) {
  if (SYNC_KEYS.includes(key)) setTs(key, new Date().toISOString())
}

/**
 * Pull cloud state into localStorage, merging PER SECTION by newest timestamp.
 * - 'found': cloud data existed; newer cloud sections were applied
 * - 'empty': no cloud record yet for this user (safe to seed)
 * - 'error': request failed — keep local data, don't push
 */
export async function pullState(userKey: string): Promise<PullResult> {
  if (!cloudEnabled() || !userKey) return 'empty'
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_kv?user_id=eq.${encodeURIComponent(userKey)}&select=key,value,updated_at`,
      { headers: headers() },
    )
    if (!res.ok) {
      setLastError(`Al leer: ${await describeError(res)}`)
      return 'error'
    }
    const rows = await res.json()
    setLastError(null)

    if (Array.isArray(rows) && rows.length > 0) {
      const tsMap = getTsMap()
      for (const row of rows) {
        if (!SYNC_KEYS.includes(row.key) || row.value == null) continue
        const localTs = tsMap[row.key]
        // Apply the cloud version only if it's newer than what this device has.
        if (!localTs || row.updated_at > localTs) {
          localStorage.setItem(row.key, row.value)
          setTs(row.key, row.updated_at)
        }
      }
      return 'found'
    }

    // Legacy migration: fall back to the old whole-blob table once, then seed user_kv.
    const legacy = await fetch(
      `${SUPABASE_URL}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userKey)}&select=data`,
      { headers: headers() },
    )
    if (legacy.ok) {
      const legacyRows = await legacy.json()
      if (Array.isArray(legacyRows) && legacyRows.length > 0 && legacyRows[0].data) {
        hydrate(legacyRows[0].data as Record<string, string>)
        void pushState()
        return 'found'
      }
    }
    return 'empty'
  } catch (err: any) {
    setLastError(`Red: ${err?.message ?? 'fetch falló'}`)
    return 'error'
  }
}

/** Upsert every present section to the cloud, each with its own timestamp. */
export async function pushState(): Promise<void> {
  if (!cloudEnabled() || !currentUserKey) return
  const tsMap = getTsMap()
  const now = new Date().toISOString()
  const rows = []
  for (const k of SYNC_KEYS) {
    const v = localStorage.getItem(k)
    if (v == null) continue
    rows.push({ user_id: currentUserKey, key: k, value: v, updated_at: tsMap[k] ?? now })
  }
  if (rows.length === 0) return
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_kv`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    })
    if (!res.ok) setLastError(`Al guardar: ${await describeError(res)}`)
    else setLastError(null)
  } catch (err: any) {
    setLastError(`Red: ${err?.message ?? 'fetch falló'}`)
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null

/** Debounced push — called after every store write. */
export function schedulePush(changedKey?: string) {
  if (changedKey) markChanged(changedKey)
  if (!cloudEnabled() || !currentUserKey) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { void pushState() }, 1500)
}

// Cross-device sync via Supabase (optional — activates when env vars are set).
// Stores the whole app state as a single JSON blob keyed by the user's Google id.
// If VITE_SUPABASE_* are absent, every function is a no-op and the app keeps
// working purely on localStorage (single-device), exactly as before.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

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

/** Pull cloud state into localStorage. Returns true if a cloud record existed. */
export async function pullState(userKey: string): Promise<boolean> {
  if (!cloudEnabled() || !userKey) return false
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userKey)}&select=data`,
      { headers: headers() },
    )
    if (!res.ok) return false
    const rows = await res.json()
    if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
      hydrate(rows[0].data as Record<string, string>)
      return true
    }
    return false
  } catch {
    return false
  }
}

/** Upsert the current localStorage snapshot to the cloud (last-write-wins). */
export async function pushState(): Promise<void> {
  if (!cloudEnabled() || !currentUserKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/user_state`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: currentUserKey,
        data: snapshot(),
        updated_at: new Date().toISOString(),
      }),
    })
  } catch {
    // offline or transient — next save will retry
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null

/** Debounced push — called after every store write. */
export function schedulePush() {
  if (!cloudEnabled() || !currentUserKey) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { void pushState() }, 1500)
}

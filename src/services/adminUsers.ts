// Lightweight admin view over the user_state table — lists how many accounts
// exist in the cloud and a few non-sensitive facts extracted from each blob.
// Read-only. Uses the same anon key as the rest of the app.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export interface CloudAccountSummary {
  user_id: string
  name: string | null
  country: string | null
  updated_at: string
}

export async function listCloudAccounts(): Promise<{ ok: true; accounts: CloudAccountSummary[] } | { ok: false; error: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { ok: false, error: 'Sincronización no configurada.' }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_state?select=user_id,data,updated_at&order=updated_at.desc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}` }
    }
    const rows = await res.json()
    const accounts: CloudAccountSummary[] = (rows as any[]).map(r => {
      let name: string | null = null
      let country: string | null = null
      try {
        const profile = JSON.parse(r.data?.profile ?? 'null')
        name = profile?.name || null
        country = profile?.country || null
      } catch { /* ignore malformed blob */ }
      return { user_id: r.user_id, name, country, updated_at: r.updated_at }
    })
    return { ok: true, accounts }
  } catch (err: any) {
    return { ok: false, error: `Red: ${err?.message ?? 'fetch falló'}` }
  }
}

/** Permanently deletes a cloud account's data by its sync key (user_id). */
export async function deleteCloudAccount(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { ok: false, error: 'Sincronización no configurada.' }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userId)}`,
      { method: 'DELETE', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}` }
    }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: `Red: ${err?.message ?? 'fetch falló'}` }
  }
}

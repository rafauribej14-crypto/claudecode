// Community price intelligence (optional — activates with Supabase env vars).
// Anonymous: stores only product/store/price observations, never a user id,
// so the "where to buy cheapest" planner can learn from ALL users' receipts.

import { SUPABASE_URL, SUPABASE_ANON_KEY, cloudEnabled } from './cloudSync'

const enabled = cloudEnabled

function headers(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
}

export interface PriceContribution {
  country: string
  store: string
  product_name: string
  unit: string
  unit_price: number
}

/** Fire-and-forget: contribute anonymized price observations from a receipt. */
export async function contributePrices(entries: PriceContribution[]): Promise<void> {
  if (!enabled() || entries.length === 0) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/price_intel`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(
        entries
          .filter(e => e.product_name && e.unit_price > 0)
          .map(e => ({ ...e, product_name: e.product_name.toLowerCase().trim() })),
      ),
    })
  } catch {
    // best-effort; never blocks the purchase flow
  }
}

export interface CommunityStorePrice {
  store: string
  unit_price: number
}

/** Best (cheapest) community unit price per store for each ingredient name, in a country. */
export async function fetchCommunityPrices(
  country: string,
  names: string[],
): Promise<Record<string, CommunityStorePrice[]>> {
  const result: Record<string, CommunityStorePrice[]> = {}
  if (!enabled() || names.length === 0) return result
  for (const name of names) {
    const needle = name.toLowerCase().trim()
    if (!needle) continue
    try {
      const q = encodeURIComponent(`%${needle}%`)
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/price_intel?country=eq.${encodeURIComponent(country)}&product_name=ilike.${q}&select=store,unit_price&order=observed_at.desc&limit=100`,
        { headers: headers() },
      )
      if (!res.ok) continue
      const rows = await res.json()
      const byStore = new Map<string, CommunityStorePrice>()
      for (const r of rows) {
        const price = Number(r.unit_price)
        if (!(price > 0)) continue
        const ex = byStore.get(r.store)
        if (!ex || price < ex.unit_price) byStore.set(r.store, { store: r.store, unit_price: price })
      }
      if (byStore.size > 0) result[name] = [...byStore.values()]
    } catch {
      // skip this ingredient on error
    }
  }
  return result
}

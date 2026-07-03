import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { store } from '@/store'
import { formatCurrency } from '@/lib/utils'
import type { UserProfile, Purchase, Product, EatingOutEntry } from '@/types'
import { Wallet, Camera, UtensilsCrossed, ArrowRight, ShoppingCart, TrendingDown, TrendingUp } from 'lucide-react'

const CATEGORY_META: Record<string, { label: string; color: string; bar: string }> = {
  proteina: { label: 'Proteína', color: 'text-rose-600', bar: 'bg-rose-400' },
  grano: { label: 'Granos', color: 'text-amber-600', bar: 'bg-amber-400' },
  lacteo: { label: 'Lácteos', color: 'text-sky-600', bar: 'bg-sky-400' },
  fruta: { label: 'Frutas', color: 'text-emerald-600', bar: 'bg-emerald-400' },
  verdura: { label: 'Verduras', color: 'text-lime-600', bar: 'bg-lime-500' },
  otro: { label: 'Otros', color: 'text-violet-600', bar: 'bg-violet-400' },
  antojos: { label: 'Antojos (restaurantes)', color: 'text-pink-600', bar: 'bg-pink-400' },
}

export function Money() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [eatingOut, setEatingOut] = useState<EatingOutEntry[]>([])

  useEffect(() => {
    setProfile(store.getProfile())
    setPurchases(store.getPurchases())
    setProducts(store.getProducts())
    setEatingOut(store.getEatingOut())
  }, [])

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthName = now.toLocaleDateString('es', { month: 'long', year: 'numeric' })

  const monthPurchases = purchases.filter(p => p.purchased_at >= monthStart)
  const groceriesSpent = monthPurchases.reduce((s, p) => s + p.total, 0)

  const monthEatingOut = eatingOut.filter(e => e.date >= monthStart.split('T')[0])
  const eatingOutSpent = monthEatingOut.reduce((s, e) => s + e.amount, 0)

  const budget = (profile?.monthly_budget ?? 0) + (profile?.budget_carryover ?? 0)
  const totalSpent = groceriesSpent + eatingOutSpent
  const remaining = budget - groceriesSpent
  const spentPct = budget > 0 ? Math.min(groceriesSpent / budget, 1) : 0

  // Category breakdown from purchase items
  const byCategory: Record<string, number> = {}
  for (const purchase of monthPurchases) {
    for (const item of purchase.items) {
      const product = products.find(p => p.id === item.product_id)
      const cat = product?.category ?? 'otro'
      byCategory[cat] = (byCategory[cat] ?? 0) + item.price_paid
    }
  }
  if (eatingOutSpent > 0) byCategory['antojos'] = eatingOutSpent
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const maxCat = categories.length > 0 ? categories[0][1] : 1

  // Donut geometry
  const R = 70
  const CIRC = 2 * Math.PI * R
  const dashSpent = spentPct * CIRC

  // Recent movements (purchases + eating out, merged, newest first)
  const movements = [
    ...monthPurchases.map(p => ({ id: p.id, date: p.purchased_at, label: p.store || 'Mercado', amount: p.total, type: 'grocery' as const })),
    ...monthEatingOut.map(e => ({ id: e.id, date: e.date, label: e.place || 'Restaurante', amount: e.amount, type: 'antojo' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center gap-2">
        <Wallet className="text-primary" size={24} />
        <div>
          <h1 className="text-2xl font-bold">Dinero</h1>
          <p className="text-xs text-muted-foreground capitalize">{monthName}</p>
        </div>
      </div>

      {/* Monefy-style donut */}
      <Card className="flex flex-col items-center py-6">
        <div className="relative w-52 h-52">
          <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
            <circle cx="90" cy="90" r={R} fill="none" strokeWidth="16" className="stroke-emerald-100" />
            <circle
              cx="90" cy="90" r={R} fill="none" strokeWidth="16" strokeLinecap="round"
              strokeDasharray={`${dashSpent} ${CIRC - dashSpent}`}
              className={spentPct >= 0.9 ? 'stroke-red-400' : spentPct >= 0.7 ? 'stroke-amber-400' : 'stroke-emerald-500'}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] text-muted-foreground">Restante</span>
            <span className={`text-2xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(remaining)}</span>
            <span className="text-[11px] text-muted-foreground mt-1">de {formatCurrency(budget)}</span>
          </div>
        </div>
        <div className="flex gap-6 mt-4 text-center">
          <div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><TrendingDown size={11} className="text-emerald-500" /> Mercado</p>
            <p className="font-bold text-sm">{formatCurrency(groceriesSpent)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><UtensilsCrossed size={11} className="text-pink-500" /> Antojos</p>
            <p className="font-bold text-sm">{formatCurrency(eatingOutSpent)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><TrendingUp size={11} className="text-violet-500" /> Total comida</p>
            <p className="font-bold text-sm">{formatCurrency(totalSpent)}</p>
          </div>
        </div>
      </Card>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <Card>
          <h3 className="font-semibold text-sm mb-3">¿En qué se fue la plata?</h3>
          <div className="space-y-2.5">
            {categories.map(([cat, amount]) => {
              const meta = CATEGORY_META[cat] ?? CATEGORY_META.otro
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                    <span className="text-muted-foreground">{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${(amount / maxCat) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/capture">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group h-full">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-xl"><Camera className="text-primary" size={18} /></div>
              <div className="flex-1">
                <p className="font-semibold text-xs">Registrar compra</p>
              </div>
              <ArrowRight size={14} className="text-muted-foreground" />
            </div>
          </Card>
        </Link>
        <Link to="/eating-out">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group h-full">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-pink-100 rounded-xl"><UtensilsCrossed className="text-pink-600" size={18} /></div>
              <div className="flex-1">
                <p className="font-semibold text-xs">Registrar antojo</p>
              </div>
              <ArrowRight size={14} className="text-muted-foreground" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Recent movements */}
      <Card>
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <ShoppingCart size={15} className="text-muted-foreground" /> Movimientos del mes
        </h3>
        {movements.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Aún no hay movimientos este mes. Registra tu primera compra.</p>
        ) : (
          <div className="space-y-1.5">
            {movements.map(m => (
              <div key={m.id} className="flex justify-between items-center p-2.5 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${m.type === 'grocery' ? 'bg-emerald-100' : 'bg-pink-100'}`}>
                    {m.type === 'grocery' ? <ShoppingCart size={13} className="text-emerald-600" /> : <UtensilsCrossed size={13} className="text-pink-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(m.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">-{formatCurrency(m.amount)}</span>
                  {m.type === 'antojo' && <Badge variant="warning">Antojo</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

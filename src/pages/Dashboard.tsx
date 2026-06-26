import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { store } from '@/store'
import { formatCurrency, daysBetween } from '@/lib/utils'
import type { UserProfile, InventoryItem, Product } from '@/types'
import { DollarSign, Package, AlertTriangle, TrendingUp, Camera, ChefHat, ArrowRight } from 'lucide-react'

export function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [totalSpent, setTotalSpent] = useState(0)

  useEffect(() => {
    setProfile(store.getProfile())
    setInventory(store.getInventory())
    setProducts(store.getProducts())
    const purchases = store.getPurchases()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const spent = purchases
      .filter(p => p.purchased_at >= monthStart)
      .reduce((sum, p) => sum + p.total, 0)
    setTotalSpent(spent)
  }, [])

  const budget = profile?.monthly_budget ?? 0
  const remaining = budget + (profile?.budget_carryover ?? 0) - totalSpent
  const budgetPct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0
  const today = new Date().toISOString().split('T')[0]

  const expiringSoon = inventory.filter(i => {
    if (!i.expiry_estimate) return false
    return daysBetween(today, i.expiry_estimate) <= 3
  })
  const lowStock = inventory.filter(i => i.qty_remaining < 100 && i.qty_remaining > 0)
  const getProductName = (id: string) => products.find(p => p.id === id)?.name ?? 'Producto'
  const activeItems = inventory.filter(i => i.qty_remaining > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {profile?.name || 'Chef'} 👋</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Tu resumen de esta semana</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100"><DollarSign className="text-emerald-600" size={18} /></div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">Restante</p>
              <p className="text-lg font-bold text-emerald-700 leading-none">{formatCurrency(remaining)}</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-100"><Package className="text-sky-600" size={18} /></div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">Inventario</p>
              <p className="text-lg font-bold text-sky-700 leading-none">{activeItems.length}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100"><AlertTriangle className="text-amber-600" size={18} /></div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">Por caducar</p>
              <p className="text-lg font-bold text-amber-700 leading-none">{expiringSoon.length}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-violet-50 to-white border-violet-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-100"><TrendingUp className="text-violet-600" size={18} /></div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">Precios</p>
              <p className="text-lg font-bold text-violet-700 leading-none">{store.getPrices().length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to="/capture">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group border-dashed border-primary/30 bg-primary/[0.03]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <Camera className="text-primary" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Registrar compra</p>
                <p className="text-xs text-muted-foreground">Foto de factura o ingreso manual</p>
              </div>
              <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Card>
        </Link>

        <Link to="/recipes">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group border-dashed border-accent/30 bg-accent/[0.03]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent/10 rounded-xl group-hover:bg-accent/20 transition-colors">
                <ChefHat className="text-accent" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Ver recetas</p>
                <p className="text-xs text-muted-foreground">Cocina con lo que tienes</p>
              </div>
              <ArrowRight size={16} className="text-muted-foreground group-hover:text-accent transition-colors" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Alerts */}
      {expiringSoon.length > 0 && (
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
            <AlertTriangle className="text-amber-500" size={16} />
            Próximos a caducar
          </h3>
          <div className="space-y-2">
            {expiringSoon.map(item => (
              <div key={item.id} className="flex justify-between items-center p-2.5 rounded-xl bg-amber-50/80 border border-amber-100">
                <span className="text-sm font-medium">{getProductName(item.product_id)}</span>
                <Badge variant="warning">{daysBetween(today, item.expiry_estimate!)}d</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {lowStock.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3 text-sm">Recompra sugerida</h3>
          <div className="space-y-2">
            {lowStock.map(item => (
              <div key={item.id} className="flex justify-between items-center p-2.5 rounded-xl bg-red-50/80 border border-red-100">
                <span className="text-sm font-medium">{getProductName(item.product_id)}</span>
                <Badge variant="destructive">{item.qty_remaining.toFixed(0)}g</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeItems.length === 0 && (
        <Card className="text-center py-10 bg-gradient-to-br from-emerald-50/50 to-amber-50/30 border-dashed border-2 border-border">
          <p className="text-muted-foreground">
            Tu inventario está vacío. <Link to="/capture" className="text-primary font-medium hover:underline">Registra tu primera compra</Link> para empezar.
          </p>
        </Card>
      )}
    </div>
  )
}

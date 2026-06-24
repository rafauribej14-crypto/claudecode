import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { store } from '@/store'
import { formatCurrency, daysBetween } from '@/lib/utils'
import type { UserProfile, InventoryItem, Product } from '@/types'
import { DollarSign, Package, AlertTriangle, TrendingUp } from 'lucide-react'

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

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <DollarSign className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Presupuesto restante</p>
              <p className="text-xl font-bold">{formatCurrency(remaining)}</p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(totalSpent)} de {formatCurrency(budget)} usado
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-500/10">
              <Package className="text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Productos en inventario</p>
              <p className="text-xl font-bold">{inventory.length}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-yellow-500/10">
              <AlertTriangle className="text-yellow-400" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Por caducar (3 días)</p>
              <p className="text-xl font-bold">{expiringSoon.length}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-purple-500/10">
              <TrendingUp className="text-purple-400" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Precios registrados</p>
              <p className="text-xl font-bold">{store.getPrices().length}</p>
            </div>
          </div>
        </Card>
      </div>

      {expiringSoon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-warning" size={18} />
              Próximos a caducar
            </CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {expiringSoon.map(item => (
              <div key={item.id} className="flex justify-between items-center p-2 rounded bg-muted">
                <span>{getProductName(item.product_id)}</span>
                <Badge variant="warning">
                  {daysBetween(today, item.expiry_estimate!)} días
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {lowStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stock bajo — Recompra sugerida</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {lowStock.map(item => (
              <div key={item.id} className="flex justify-between items-center p-2 rounded bg-muted">
                <span>{getProductName(item.product_id)}</span>
                <Badge variant="destructive">{item.qty_remaining.toFixed(0)}g</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {inventory.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            ¡Bienvenido! Empieza registrando tu primera compra en <strong>Captura</strong>.
          </p>
        </Card>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { store } from '@/store'
import { formatCurrency, daysBetween } from '@/lib/utils'
import type { UserProfile, InventoryItem, Product } from '@/types'
import { DollarSign, Package, AlertTriangle, TrendingUp, Leaf } from 'lucide-react'

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
      <div className="flex items-center gap-2">
        <Leaf className="text-primary" size={24} />
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100">
              <DollarSign className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Presupuesto restante</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(remaining)}</p>
            </div>
          </div>
          <div className="mt-3 h-2.5 bg-green-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(totalSpent)} de {formatCurrency(budget)} usado
          </p>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100">
              <Package className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En inventario</p>
              <p className="text-xl font-bold text-blue-700">{inventory.length}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100">
              <AlertTriangle className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Por caducar (3d)</p>
              <p className="text-xl font-bold text-amber-700">{expiringSoon.length}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100">
              <TrendingUp className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Precios registrados</p>
              <p className="text-xl font-bold text-purple-700">{store.getPrices().length}</p>
            </div>
          </div>
        </Card>
      </div>

      {expiringSoon.length > 0 && (
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="text-amber-500" size={18} />
            Próximos a caducar
          </h3>
          <div className="space-y-2">
            {expiringSoon.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-amber-50 border border-amber-100">
                <span className="font-medium">{getProductName(item.product_id)}</span>
                <Badge variant="warning">{daysBetween(today, item.expiry_estimate!)} días</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {lowStock.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Recompra sugerida</h3>
          <div className="space-y-2">
            {lowStock.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-red-50 border border-red-100">
                <span className="font-medium">{getProductName(item.product_id)}</span>
                <Badge variant="destructive">{item.qty_remaining.toFixed(0)}g</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {inventory.length === 0 && (
        <Card className="text-center py-12 bg-gradient-to-br from-green-50 to-orange-50 border-dashed border-2 border-primary/20">
          <p className="text-lg text-muted-foreground">
            Empieza registrando tu primera compra en <strong className="text-primary">Captura</strong> 📸
          </p>
        </Card>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { store } from '@/store'
import { formatDate, daysBetween } from '@/lib/utils'
import type { InventoryItem, Product } from '@/types'
import { Package } from 'lucide-react'

export function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    setInventory(store.getInventory())
    setProducts(store.getProducts())
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const getProduct = (id: string) => products.find(p => p.id === id)

  const getExpiryBadge = (item: InventoryItem) => {
    if (!item.expiry_estimate) return null
    const days = daysBetween(today, item.expiry_estimate)
    if (days <= 0) return <Badge variant="destructive">Caducado</Badge>
    if (days <= 3) return <Badge variant="warning">{days}d para caducar</Badge>
    return <Badge variant="success">{days}d</Badge>
  }

  const formatQty = (item: InventoryItem) => {
    const product = getProduct(item.product_id)
    const unit = product?.base_unit ?? 'g'
    if (unit === 'g' && item.qty_remaining >= 1000) return `${(item.qty_remaining / 1000).toFixed(1)} kg`
    if (unit === 'ml' && item.qty_remaining >= 1000) return `${(item.qty_remaining / 1000).toFixed(1)} L`
    return `${item.qty_remaining.toFixed(0)} ${unit}`
  }

  const sorted = [...inventory]
    .filter(i => i.qty_remaining > 0)
    .sort((a, b) => {
      if (a.expiry_estimate && b.expiry_estimate) return a.expiry_estimate.localeCompare(b.expiry_estimate)
      if (a.expiry_estimate) return -1
      return 1
    })

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-bold">Inventario</h1>

      {sorted.length === 0 ? (
        <Card className="text-center py-12">
          <Package className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="text-muted-foreground">No hay productos en inventario. Registra una compra primero.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(item => {
            const product = getProduct(item.product_id)
            return (
              <Card key={item.id}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{product?.name ?? 'Producto'}</h3>
                    <p className="text-sm text-muted-foreground">{product?.category}</p>
                  </div>
                  {getExpiryBadge(item)}
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold">{formatQty(item)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Adquirido: {formatDate(item.acquired_at)}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

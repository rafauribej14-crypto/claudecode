import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { formatDate, daysBetween, formatCurrency } from '@/lib/utils'
import type { InventoryItem, Product } from '@/types'
import { Package, Minus } from 'lucide-react'

export function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [useProduct, setUseProduct] = useState<string | null>(null)
  const [useQty, setUseQty] = useState(0)
  const [useUnit, setUseUnit] = useState('g')

  const reload = () => {
    setInventory(store.getInventory())
    setProducts(store.getProducts())
  }

  useEffect(reload, [])

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

  const handleUse = (itemId: string) => {
    if (useQty <= 0) return
    const inv = store.getInventory()
    const item = inv.find(i => i.id === itemId)
    if (!item) return

    const product = getProduct(item.product_id)
    let deductQty = useQty
    if (useUnit === 'kg') deductQty *= 1000
    if (useUnit === 'L') deductQty *= 1000

    item.qty_remaining = Math.max(0, item.qty_remaining - deductQty)
    store.saveInventory(inv)
    setUseProduct(null)
    setUseQty(0)
    reload()
  }

  const getLatestPrice = (productId: string) => {
    const prices = store.getPrices().filter(p => p.product_id === productId)
    if (prices.length === 0) return null
    return prices.sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0]
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
      <div className="flex items-center gap-2">
        <Package className="text-primary" size={24} />
        <h1 className="text-2xl font-bold">Inventario</h1>
        <Badge className="ml-2">{sorted.length} productos</Badge>
      </div>

      {sorted.length === 0 ? (
        <Card className="text-center py-12 bg-gradient-to-br from-green-50 to-orange-50 border-dashed border-2 border-primary/20">
          <Package className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="text-muted-foreground">No hay productos en inventario. Registra una compra en <strong className="text-primary">Captura</strong>.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(item => {
            const product = getProduct(item.product_id)
            const price = getLatestPrice(item.product_id)
            const isUsing = useProduct === item.id

            return (
              <Card key={item.id} className="relative">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{product?.name ?? 'Producto'}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{product?.category}</p>
                  </div>
                  {getExpiryBadge(item)}
                </div>

                <div className="mt-3">
                  <p className="text-2xl font-bold text-primary">{formatQty(item)}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>Adquirido: {formatDate(item.acquired_at)}</span>
                    {price && <span>Último precio: {formatCurrency(price.price)}</span>}
                  </div>
                </div>

                {isUsing ? (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <p className="text-sm font-medium">¿Cuánto usaste?</p>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={useQty || ''}
                        onChange={e => setUseQty(+e.target.value)}
                        placeholder="Cantidad"
                        className="flex-1"
                        autoFocus
                      />
                      <Select value={useUnit} onChange={e => setUseUnit(e.target.value)} className="w-20">
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="L">L</option>
                        <option value="unit">und</option>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleUse(item.id)} className="flex-1">Descontar</Button>
                      <Button size="sm" variant="outline" onClick={() => { setUseProduct(null); setUseQty(0) }}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => { setUseProduct(item.id); setUseUnit(product?.base_unit === 'ml' ? 'ml' : 'g') }}
                    >
                      <Minus size={14} className="mr-1" /> Usar producto
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

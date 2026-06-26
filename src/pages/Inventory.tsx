import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { formatDate, daysBetween, formatCurrency } from '@/lib/utils'
import type { InventoryItem, Product } from '@/types'
import { Package, Minus, Pencil, Trash2, Check, X } from 'lucide-react'

export function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [useProduct, setUseProduct] = useState<string | null>(null)
  const [useQty, setUseQty] = useState(0)
  const [useUnit, setUseUnit] = useState('g')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editQty, setEditQty] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

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
    if (days <= 3) return <Badge variant="warning">{days}d</Badge>
    return <Badge variant="success">{days}d</Badge>
  }

  const formatQty = (qty: number, productId: string) => {
    const product = getProduct(productId)
    const unit = product?.base_unit ?? 'g'
    if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toFixed(1)} kg`
    if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(1)} L`
    return `${qty.toFixed(0)} ${unit}`
  }

  const handleUse = (itemId: string) => {
    if (useQty <= 0) return
    const inv = store.getInventory()
    const item = inv.find(i => i.id === itemId)
    if (!item) return
    let deductQty = useQty
    if (useUnit === 'kg') deductQty *= 1000
    if (useUnit === 'L') deductQty *= 1000
    item.qty_remaining = Math.max(0, item.qty_remaining - deductQty)
    store.saveInventory(inv)
    setUseProduct(null)
    setUseQty(0)
    reload()
  }

  const handleEditSave = (itemId: string) => {
    const inv = store.getInventory()
    const item = inv.find(i => i.id === itemId)
    if (!item) return
    item.qty_remaining = Math.max(0, editQty)
    store.saveInventory(inv)
    setEditingItem(null)
    reload()
  }

  const handleDelete = (itemId: string) => {
    const inv = store.getInventory().filter(i => i.id !== itemId)
    store.saveInventory(inv)
    setConfirmDelete(null)
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

  const depleted = inventory.filter(i => i.qty_remaining <= 0)

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center gap-2">
        <Package className="text-primary" size={24} />
        <h1 className="text-2xl font-bold">Inventario</h1>
        <Badge className="ml-2">{sorted.length} activos</Badge>
      </div>

      {sorted.length === 0 ? (
        <Card className="text-center py-12 bg-gradient-to-br from-emerald-50/50 to-amber-50/30 border-dashed border-2 border-border">
          <Package className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="text-muted-foreground">No hay productos. Registra una compra en <strong className="text-primary">Captura</strong>.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(item => {
            const product = getProduct(item.product_id)
            const price = getLatestPrice(item.product_id)
            const isUsing = useProduct === item.id
            const isEditing = editingItem === item.id
            const isDeleting = confirmDelete === item.id

            return (
              <Card key={item.id} className="relative">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{product?.name ?? 'Producto'}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{product?.category}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {getExpiryBadge(item)}
                    <button
                      onClick={() => { setEditingItem(item.id); setEditQty(item.qty_remaining); setUseProduct(null); setConfirmDelete(null) }}
                      className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { setConfirmDelete(item.id); setEditingItem(null); setUseProduct(null) }}
                      className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div className="mt-3">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={editQty}
                        onChange={e => setEditQty(+e.target.value)}
                        className="flex-1 h-9"
                        autoFocus
                      />
                      <span className="text-sm text-muted-foreground">{product?.base_unit ?? 'g'}</span>
                      <button onClick={() => handleEditSave(item.id)} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"><Check size={16} /></button>
                      <button onClick={() => setEditingItem(null)} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer"><X size={16} /></button>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-primary">{formatQty(item.qty_remaining, item.product_id)}</p>
                  )}
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>Adquirido: {formatDate(item.acquired_at)}</span>
                    {price && <span>{formatCurrency(price.price)}</span>}
                  </div>
                </div>

                {/* Delete confirm */}
                {isDeleting && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-destructive mb-2">¿Eliminar este producto del inventario?</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id)} className="flex-1">Eliminar</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {/* Use product */}
                {!isEditing && !isDeleting && (
                  <>
                    {isUsing ? (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <p className="text-sm font-medium">¿Cuánto usaste?</p>
                        <div className="flex gap-2">
                          <Input type="number" value={useQty || ''} onChange={e => setUseQty(+e.target.value)} placeholder="Cantidad" className="flex-1" autoFocus />
                          <Select value={useUnit} onChange={e => setUseUnit(e.target.value)} className="w-20">
                            <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="unit">und</option>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleUse(item.id)} className="flex-1">Descontar</Button>
                          <Button size="sm" variant="outline" onClick={() => { setUseProduct(null); setUseQty(0) }}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-border">
                        <Button size="sm" variant="outline" className="w-full" onClick={() => { setUseProduct(item.id); setUseUnit(product?.base_unit === 'ml' ? 'ml' : 'g'); setEditingItem(null); setConfirmDelete(null) }}>
                          <Minus size={14} className="mr-1" /> Usar producto
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Depleted products */}
      {depleted.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Agotados ({depleted.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {depleted.map(item => {
              const product = getProduct(item.product_id)
              return (
                <Card key={item.id} className="opacity-60 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{product?.name ?? 'Producto'}</p>
                      <p className="text-xs text-muted-foreground">Agotado · {formatDate(item.acquired_at)}</p>
                    </div>
                    <button onClick={() => handleDelete(item.id)} className="p-1 text-muted-foreground hover:text-destructive cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

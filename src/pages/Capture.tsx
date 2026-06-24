import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { generateId, formatCurrency } from '@/lib/utils'
import type { PurchaseItem } from '@/types'
import { Plus, Trash2, ShoppingBag } from 'lucide-react'

interface LineItem {
  tempId: string
  product_name: string
  qty: number
  unit: string
  price_paid: number
  category: string
}

const STORES = ['Super99', 'El Rey', 'PriceSmart', 'Riba Smith', 'Otro']

export function Capture() {
  const [selectedStore, setSelectedStore] = useState(STORES[0])
  const [lines, setLines] = useState<LineItem[]>([
    { tempId: generateId(), product_name: '', qty: 0, unit: 'g', price_paid: 0, category: 'otro' },
  ])
  const [submitted, setSubmitted] = useState(false)

  const total = lines.reduce((s, l) => s + l.price_paid, 0)

  const updateLine = (id: string, patch: Partial<LineItem>) => {
    setLines(prev => prev.map(l => l.tempId === id ? { ...l, ...patch } : l))
  }

  const addLine = () => {
    setLines(prev => [...prev, { tempId: generateId(), product_name: '', qty: 0, unit: 'g', price_paid: 0, category: 'otro' }])
  }

  const removeLine = (id: string) => {
    setLines(prev => prev.filter(l => l.tempId !== id))
  }

  const handleSubmit = () => {
    const validLines = lines.filter(l => l.product_name && l.qty > 0 && l.price_paid > 0)
    if (validLines.length === 0) return

    const items: PurchaseItem[] = validLines.map(l => {
      const unitType = l.unit === 'ml' || l.unit === 'L' ? 'volume' as const : l.unit === 'unit' ? 'count' as const : 'mass' as const
      const baseUnit = unitType === 'volume' ? 'ml' : unitType === 'count' ? 'unit' : 'g'
      let qty = l.qty
      if (l.unit === 'kg') qty *= 1000
      if (l.unit === 'L') qty *= 1000

      const product = store.findOrCreateProduct(l.product_name, l.category, unitType, baseUnit)
      return {
        id: generateId(),
        purchase_id: '',
        product_id: product.id,
        qty,
        unit: baseUnit,
        price_paid: l.price_paid,
        product_name: l.product_name,
      }
    })

    store.addPurchase({
      user_id: 'default-user',
      store: selectedStore,
      total,
      purchased_at: new Date().toISOString(),
      source: 'manual',
      receipt_image_url: null,
      items,
    })

    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setLines([{ tempId: generateId(), product_name: '', qty: 0, unit: 'g', price_paid: 0, category: 'otro' }])
    }, 2000)
  }

  return (
    <div className="space-y-6 max-w-3xl pb-20 md:pb-0">
      <h1 className="text-2xl font-bold">Registrar compra</h1>

      <Card>
        <CardHeader><CardTitle>Tienda</CardTitle></CardHeader>
        <Select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
          {STORES.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Productos</span>
            <Button onClick={addLine} size="sm" variant="outline">
              <Plus size={16} className="mr-1" /> Agregar
            </Button>
          </CardTitle>
        </CardHeader>

        <div className="space-y-4">
          {lines.map((line, idx) => (
            <div key={line.tempId} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted rounded-lg">
              <div className="col-span-12 sm:col-span-4">
                <label className="text-xs text-muted-foreground">Producto</label>
                <Input
                  value={line.product_name}
                  onChange={e => updateLine(line.tempId, { product_name: e.target.value })}
                  placeholder="Nombre del producto"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Cantidad</label>
                <Input
                  type="number"
                  value={line.qty || ''}
                  onChange={e => updateLine(line.tempId, { qty: +e.target.value })}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Unidad</label>
                <Select value={line.unit} onChange={e => updateLine(line.tempId, { unit: e.target.value })}>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="unit">unidad</option>
                </Select>
              </div>
              <div className="col-span-3 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Precio $</label>
                <Input
                  type="number"
                  step="0.01"
                  value={line.price_paid || ''}
                  onChange={e => updateLine(line.tempId, { price_paid: +e.target.value })}
                />
              </div>
              <div className="col-span-1 sm:col-span-2 flex items-center gap-2">
                <Select value={line.category} onChange={e => updateLine(line.tempId, { category: e.target.value })} className="hidden sm:flex">
                  <option value="proteina">Proteína</option>
                  <option value="grano">Grano</option>
                  <option value="lacteo">Lácteo</option>
                  <option value="fruta">Fruta</option>
                  <option value="verdura">Verdura</option>
                  <option value="otro">Otro</option>
                </Select>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(line.tempId)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
        </div>
        <Button onClick={handleSubmit} size="lg" disabled={submitted}>
          <ShoppingBag size={18} className="mr-2" />
          {submitted ? '✓ Registrado' : 'Confirmar compra'}
        </Button>
      </Card>
    </div>
  )
}

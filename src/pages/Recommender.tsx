import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { store } from '@/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Product, PriceObservation } from '@/types'
import { ShoppingCart, TrendingDown, AlertCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

interface Recommendation {
  product: Product
  reason: string
  estimated_price: number
  confidence: 'confirmed' | 'estimated'
  suggested_qty: string
}

export function Recommender() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [budget, setBudget] = useState(0)
  const [showPrices, setShowPrices] = useState(false)
  const [prices, setPrices] = useState<PriceObservation[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

  const reload = () => {
    const profile = store.getProfile()
    const inventory = store.getInventory()
    const allPrices = store.getPrices()
    const allProducts = store.getProducts()
    setPrices(allPrices)
    setProducts(allProducts)

    const freqDivisor = profile.shopping_frequency === 'weekly' ? 4 : profile.shopping_frequency === 'biweekly' ? 2 : 1
    const tripBudget = (profile.monthly_budget + profile.budget_carryover) / freqDivisor
    setBudget(tripBudget)

    const recs: Recommendation[] = []
    const lowStockProducts = inventory.filter(i => i.qty_remaining < 200 && i.qty_remaining > 0)
    for (const item of lowStockProducts) {
      const product = allProducts.find(p => p.id === item.product_id)
      if (!product) continue
      const latestPrice = getLatestPrice(allPrices, item.product_id)
      recs.push({
        product, reason: `Stock bajo: ${item.qty_remaining.toFixed(0)}${product.base_unit} restantes`,
        estimated_price: latestPrice?.price ?? 0, confidence: latestPrice ? 'confirmed' : 'estimated',
        suggested_qty: `500${product.base_unit}`,
      })
    }
    const outOfStock = allProducts.filter(p => !inventory.find(i => i.product_id === p.id && i.qty_remaining > 0))
    for (const product of outOfStock.slice(0, 5)) {
      const latestPrice = getLatestPrice(allPrices, product.id)
      if (!latestPrice) continue
      recs.push({
        product, reason: 'Agotado en inventario', estimated_price: latestPrice.price,
        confidence: 'confirmed', suggested_qty: `1000${product.base_unit}`,
      })
    }
    setRecommendations(recs)
  }

  useEffect(reload, [])

  const getLatestPrice = (allPrices: PriceObservation[], productId: string) =>
    allPrices.filter(p => p.product_id === productId).sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0] ?? null

  const deletePrice = (id: string) => {
    const updated = store.getPrices().filter(p => p.id !== id)
    store.savePrices(updated)
    reload()
  }

  const totalEstimated = recommendations.reduce((s, r) => s + r.estimated_price, 0)

  const productPriceGroups = products
    .map(p => ({ product: p, prices: prices.filter(pr => pr.product_id === p.id).sort((a, b) => b.observed_at.localeCompare(a.observed_at)) }))
    .filter(g => g.prices.length > 0)

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="text-primary" size={24} />
          <h1 className="text-2xl font-bold">Recomendador</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowPrices(!showPrices)}>
          <TrendingDown size={14} className="mr-1" /> {showPrices ? 'Cerrar precios' : 'Historial de precios'}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <p className="text-xs text-muted-foreground">Presupuesto esta salida</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(budget)}</p>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-100">
          <p className="text-xs text-muted-foreground">Estimado de la lista</p>
          <p className="text-xl font-bold text-sky-700">{formatCurrency(totalEstimated)}</p>
          <p className={`text-xs mt-1 ${totalEstimated <= budget ? 'text-emerald-600' : 'text-destructive'}`}>
            {totalEstimated <= budget ? 'Dentro del presupuesto' : 'Excede el presupuesto'}
          </p>
        </Card>
      </div>

      {recommendations.length === 0 ? (
        <Card className="text-center py-10 border-dashed border-2">
          <ShoppingCart className="mx-auto text-muted-foreground mb-3" size={36} />
          <p className="text-muted-foreground text-sm">No hay recomendaciones. Registra compras para que el sistema aprenda.</p>
          <p className="text-xs text-muted-foreground mt-1"><AlertCircle size={12} className="inline mr-1" />Con IA se generará una lista de compra inteligente.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <Card key={i} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{rec.product.name}</h3>
                  <Badge variant={rec.confidence === 'confirmed' ? 'success' : 'warning'}>
                    {rec.confidence === 'confirmed' ? 'Confirmado' : 'Estimado'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                <p className="text-[11px] text-muted-foreground">Sugerido: {rec.suggested_qty}</p>
              </div>
              <p className="text-lg font-bold text-primary">{formatCurrency(rec.estimated_price)}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Price History */}
      {showPrices && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingDown size={16} /> Memoria de precios</CardTitle></CardHeader>
          {productPriceGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos de precios aún.</p>
          ) : (
            <div className="space-y-2">
              {productPriceGroups.map(group => {
                const isOpen = expandedProduct === group.product.id
                const avgPrice = group.prices.reduce((s, p) => s + p.unit_price, 0) / group.prices.length
                return (
                  <div key={group.product.id} className="border border-border rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedProduct(isOpen ? null : group.product.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer text-left">
                      <div>
                        <span className="font-medium text-sm">{group.product.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{group.prices.length} registros</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Prom: {formatCurrency(avgPrice)}/{group.product.base_unit}</span>
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border p-3 bg-muted/20 space-y-1">
                        {group.prices.map(price => (
                          <div key={price.id} className="flex items-center justify-between text-sm py-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="accent" className="text-[10px]">{price.store}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(price.observed_at)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatCurrency(price.price)}</span>
                              <span className="text-xs text-muted-foreground">({price.package_size}{group.product.base_unit})</span>
                              <button onClick={() => deletePrice(price.id)} className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      <Card className="bg-gradient-to-r from-emerald-50 to-amber-50 border-emerald-100">
        <div className="flex items-start gap-3">
          <TrendingDown className="text-primary mt-0.5" size={18} />
          <div>
            <h3 className="font-medium text-sm">Tu memoria de precios crece contigo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cada compra registrada mejora las recomendaciones. Mes 1 = estimados. Mes 2+ = precios reales de tus facturas.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

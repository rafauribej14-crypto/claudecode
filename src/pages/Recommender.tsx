import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { store } from '@/store'
import { formatCurrency } from '@/lib/utils'
import type { Product, PriceObservation, InventoryItem } from '@/types'
import { ShoppingCart, TrendingDown, AlertCircle } from 'lucide-react'

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

  useEffect(() => {
    const profile = store.getProfile()
    const inventory = store.getInventory()
    const prices = store.getPrices()
    const products = store.getProducts()

    const freqDivisor = profile.shopping_frequency === 'weekly' ? 4 : profile.shopping_frequency === 'biweekly' ? 2 : 1
    const tripBudget = (profile.monthly_budget + profile.budget_carryover) / freqDivisor
    setBudget(tripBudget)

    const recs: Recommendation[] = []

    const lowStockProducts = inventory.filter(i => i.qty_remaining < 200 && i.qty_remaining > 0)
    for (const item of lowStockProducts) {
      const product = products.find(p => p.id === item.product_id)
      if (!product) continue
      const latestPrice = getLatestPrice(prices, item.product_id)
      recs.push({
        product,
        reason: `Stock bajo: ${item.qty_remaining.toFixed(0)}${product.base_unit} restantes`,
        estimated_price: latestPrice?.price ?? 0,
        confidence: latestPrice ? 'confirmed' : 'estimated',
        suggested_qty: `500${product.base_unit}`,
      })
    }

    const outOfStock = products.filter(p => !inventory.find(i => i.product_id === p.id && i.qty_remaining > 0))
    for (const product of outOfStock.slice(0, 5)) {
      const latestPrice = getLatestPrice(prices, product.id)
      if (!latestPrice) continue
      recs.push({
        product,
        reason: 'Agotado en inventario',
        estimated_price: latestPrice.price,
        confidence: 'confirmed',
        suggested_qty: `1000${product.base_unit}`,
      })
    }

    setRecommendations(recs)
  }, [])

  const getLatestPrice = (prices: PriceObservation[], productId: string) => {
    return prices
      .filter(p => p.product_id === productId)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0] ?? null
  }

  const totalEstimated = recommendations.reduce((s, r) => s + r.estimated_price, 0)

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-bold">Recomendador</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Presupuesto esta salida</p>
          <p className="text-2xl font-bold">{formatCurrency(budget)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Estimado de la lista</p>
          <p className="text-2xl font-bold">{formatCurrency(totalEstimated)}</p>
          <p className={`text-sm ${totalEstimated <= budget ? 'text-green-400' : 'text-red-400'}`}>
            {totalEstimated <= budget ? 'Dentro del presupuesto' : 'Excede el presupuesto'}
          </p>
        </Card>
      </div>

      {recommendations.length === 0 ? (
        <Card className="text-center py-12">
          <ShoppingCart className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="text-muted-foreground">
            No hay recomendaciones aún. Registra compras para que el sistema aprenda tus patrones.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <AlertCircle size={14} className="inline mr-1" />
            Con la integración de IA, aquí aparecerá una lista de compra inteligente.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <Card key={i} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{rec.product.name}</h3>
                  <Badge variant={rec.confidence === 'confirmed' ? 'success' : 'warning'}>
                    {rec.confidence === 'confirmed' ? 'Precio confirmado' : 'Estimado'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>
                <p className="text-xs text-muted-foreground">Sugerido: {rec.suggested_qty}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(rec.estimated_price)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-dashed border-2">
        <div className="flex items-start gap-3">
          <TrendingDown className="text-primary mt-0.5" size={20} />
          <div>
            <h3 className="font-medium">Memoria de precios</h3>
            <p className="text-sm text-muted-foreground">
              Con cada compra registrada, la app aprende tus precios reales. En el mes 1 los precios son estimados;
              desde el mes 2 se usan tus datos confirmados para recomendaciones más precisas.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

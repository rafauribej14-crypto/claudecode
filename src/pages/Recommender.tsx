import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { store } from '@/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { recommendWhereToBuy, hasGrokKey } from '@/services/grok'
import { fetchCommunityPrices } from '@/services/priceIntel'
import type { ShoppingNeedItem, ShoppingPlanResult } from '@/services/grok'
import type { Product, PriceObservation, Recipe, InventoryItem } from '@/types'
import { ShoppingCart, TrendingDown, AlertCircle, ChevronDown, ChevronUp, Trash2, Sparkles, Loader2, MapPin, Store as StoreIcon } from 'lucide-react'

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
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([])
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const [plan, setPlan] = useState<ShoppingPlanResult | null>(null)

  const reload = () => {
    const profile = store.getProfile()
    const inventory = store.getInventory()
    const allPrices = store.getPrices()
    const allProducts = store.getProducts()
    setPrices(allPrices)
    setProducts(allProducts)
    setRecipes(store.getRecipes())
    setInventory(inventory)

    const freqDivisor = profile.shopping_frequency === 'weekly' ? 4 : profile.shopping_frequency === 'biweekly' ? 2 : 1
    const tripBudget = (profile.monthly_budget + profile.budget_carryover) / freqDivisor
    setBudget(tripBudget)

    const recs: Recommendation[] = []
    // Unit-aware low-stock thresholds (same as the dashboard) — 12 eggs are NOT low stock.
    const isLowStock = (qty: number, baseUnit: string) => {
      if (baseUnit === 'unit') return qty <= 1
      if (baseUnit === 'ml') return qty < 200
      return qty < 150
    }
    for (const item of inventory) {
      if (item.qty_remaining <= 0) continue
      const product = allProducts.find(p => p.id === item.product_id)
      if (!product || !isLowStock(item.qty_remaining, product.base_unit)) continue
      const latestPrice = getLatestPrice(allPrices, item.product_id)
      recs.push({
        product, reason: `Stock bajo: ${item.qty_remaining.toFixed(0)}${product.base_unit} restantes`,
        estimated_price: latestPrice?.price ?? 0, confidence: latestPrice ? 'confirmed' : 'estimated',
        suggested_qty: product.base_unit === 'unit' ? '6 unidades' : `500${product.base_unit}`,
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

  const toggleRecipe = (id: string) => {
    setSelectedRecipes(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])
    setPlan(null)
  }

  const findInventoryFor = (ingredientName: string) => {
    const lower = ingredientName.toLowerCase()
    return inventory.find(i => {
      if (i.qty_remaining <= 0) return false
      const p = products.find(pr => pr.id === i.product_id)
      if (!p) return false
      const pName = p.name.toLowerCase()
      return pName.includes(lower) || lower.includes(pName)
    })
  }

  const handleGeneratePlan = async () => {
    setPlanError('')
    setPlanLoading(true)
    setPlan(null)
    try {
      const profile = store.getProfile()
      const chosen = recipes.filter(r => selectedRecipes.includes(r.id))

      // Aggregate missing ingredients across selected recipes
      const needed = new Map<string, { name: string; qty: number; unit: string }>()
      for (const recipe of chosen) {
        for (const ing of recipe.ingredients) {
          const inv = ing.product_id
            ? inventory.find(i => i.product_id === ing.product_id)
            : findInventoryFor(ing.ingredient_name)
          const have = inv?.qty_remaining ?? 0
          const missing = ing.qty - have
          if (missing <= 0) continue
          const key = ing.ingredient_name.toLowerCase()
          const prev = needed.get(key)
          if (prev) prev.qty += missing
          else needed.set(key, { name: ing.ingredient_name, qty: missing, unit: ing.unit })
        }
      }

      if (needed.size === 0) {
        setPlanError('¡Ya tienes todo para esas recetas! No necesitas comprar nada.')
        return
      }

      const country = profile.country ?? (profile.currency === 'COP' ? 'CO' : 'PA')
      const neededNames = [...needed.values()].map(n => n.name)

      // Pull community prices (best per store) for these ingredients in the user's country.
      const community = await fetchCommunityPrices(country, neededNames)

      // Attach price history: best unit price per store, combining the user's own
      // receipts with the anonymous community data.
      const items: ShoppingNeedItem[] = [...needed.values()].map(n => {
        const lower = n.name.toLowerCase()
        const matchedProducts = products.filter(p => {
          const pName = p.name.toLowerCase()
          return pName.includes(lower) || lower.includes(pName)
        })
        const byStore = new Map<string, { store: string; unit_price: number; last_seen: string }>()
        for (const p of matchedProducts) {
          for (const obs of prices.filter(pr => pr.product_id === p.id)) {
            const existing = byStore.get(obs.store)
            if (!existing || obs.unit_price < existing.unit_price) {
              byStore.set(obs.store, { store: obs.store, unit_price: obs.unit_price, last_seen: obs.observed_at })
            }
          }
        }
        // Merge community observations (keep the cheapest per store).
        for (const cp of community[n.name] ?? []) {
          const existing = byStore.get(cp.store)
          if (!existing || cp.unit_price < existing.unit_price) {
            byStore.set(cp.store, { store: cp.store, unit_price: cp.unit_price, last_seen: 'comunidad' })
          }
        }
        return { name: n.name, qty: Math.round(n.qty), unit: n.unit, history: [...byStore.values()] }
      })

      const result = await recommendWhereToBuy({
        items,
        country,
        budget,
        currency: profile.currency,
      })
      setPlan(result)
    } catch (err: any) {
      setPlanError(err.message ?? 'Error al generar el plan')
    } finally {
      setPlanLoading(false)
    }
  }

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

      {/* ¿Dónde compro? — AI shopping plan */}
      {hasGrokKey() && recipes.length > 0 && (
        <Card className="bg-gradient-to-r from-teal-50 to-emerald-50 border-teal-100">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              {planLoading ? <Loader2 className="text-teal-600 animate-spin" size={18} /> : <MapPin className="text-teal-600" size={18} />}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-teal-800 text-sm">¿Dónde compro más barato?</h3>
              <p className="text-xs text-teal-600 mt-0.5">Elige las recetas que quieres hacer y la IA arma tu plan de compra usando tus precios históricos y los supermercados de tu país.</p>

              <div className="flex flex-wrap gap-2 mt-3">
                {recipes.map(r => (
                  <button
                    key={r.id}
                    onClick={() => toggleRecipe(r.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                      selectedRecipes.includes(r.id)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-teal-700 border-teal-200 hover:border-teal-400'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>

              {planError && <p className="text-xs text-amber-700 mt-2 bg-amber-50 px-2 py-1 rounded-lg">{planError}</p>}

              <Button
                variant="primary"
                className="w-full mt-3"
                disabled={planLoading || selectedRecipes.length === 0}
                onClick={handleGeneratePlan}
              >
                {planLoading
                  ? <><Loader2 size={14} className="mr-2 animate-spin" /> Comparando precios...</>
                  : <><Sparkles size={14} className="mr-2" /> Armar plan de compra ({selectedRecipes.length} receta{selectedRecipes.length !== 1 ? 's' : ''})</>}
              </Button>
            </div>
          </div>

          {plan && (
            <div className="mt-4 pt-4 border-t border-teal-200 space-y-3">
              {plan.plan.map((storePlan, i) => (
                <div key={i} className="bg-white rounded-xl border border-teal-100 overflow-hidden">
                  <div className="flex justify-between items-center px-3 py-2 bg-teal-50/50">
                    <span className="font-semibold text-sm text-teal-800 flex items-center gap-1.5">
                      <StoreIcon size={14} /> {storePlan.store}
                    </span>
                    <span className="font-bold text-sm text-teal-700">{formatCurrency(storePlan.subtotal)}</span>
                  </div>
                  <div className="p-2 space-y-1">
                    {storePlan.items.map((item, j) => (
                      <div key={j} className="flex justify-between items-center text-xs px-2 py-1.5 rounded-lg hover:bg-muted/40">
                        <div className="flex-1">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground ml-1.5">{item.qty}</span>
                          {item.note && <p className="text-[10px] text-muted-foreground mt-0.5">{item.note}</p>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={item.source === 'historial' ? 'success' : 'warning'}>
                            {item.source === 'historial' ? 'Tu precio' : 'Estimado'}
                          </Badge>
                          <span className="font-semibold">{formatCurrency(item.est_price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className={`flex justify-between items-center px-3 py-2.5 rounded-xl ${plan.fits_budget ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <span className="text-sm font-medium">{plan.fits_budget ? '✓ Dentro de tu presupuesto' : '⚠ Excede tu presupuesto'}</span>
                <span className={`font-bold ${plan.fits_budget ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(plan.total)}</span>
              </div>

              {plan.advice && (
                <p className="text-xs text-teal-700 bg-teal-50 px-3 py-2 rounded-lg">💡 {plan.advice}</p>
              )}
            </div>
          )}
        </Card>
      )}

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

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { store } from '@/store'
import { formatCurrency, daysBetween } from '@/lib/utils'
import { checkMonthlyCarryover, dismissCarryover } from '@/services/budget'
import type { UserProfile, InventoryItem, Product } from '@/types'
import { DollarSign, Package, AlertTriangle, TrendingUp, Camera, ChefHat, ArrowRight, Sparkles, X, ShoppingCart, Pencil, Check, Plus } from 'lucide-react'
import { Select } from '@/components/ui/select'

export function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [totalSpent, setTotalSpent] = useState(0)
  const [carryover, setCarryover] = useState(checkMonthlyCarryover())
  const [editingInv, setEditingInv] = useState<string | null>(null)
  const [editQty, setEditQty] = useState(0)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetEdit, setBudgetEdit] = useState(0)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickQty, setQuickQty] = useState(0)
  const [quickUnit, setQuickUnit] = useState('g')

  const reload = () => {
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
  }

  useEffect(reload, [])

  const budget = profile?.monthly_budget ?? 0
  const remaining = budget + (profile?.budget_carryover ?? 0) - totalSpent
  const budgetPct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0
  const today = new Date().toISOString().split('T')[0]
  const getProductName = (id: string) => products.find(p => p.id === id)?.name ?? 'Producto'
  const getProduct = (id: string) => products.find(p => p.id === id)
  const activeItems = inventory.filter(i => i.qty_remaining > 0)

  const expiringSoon = inventory.filter(i => {
    if (!i.expiry_estimate || i.qty_remaining <= 0) return false
    return daysBetween(today, i.expiry_estimate) <= 3
  })

  const lowStock = activeItems.filter(i => {
    const product = getProduct(i.product_id)
    if (!product) return false
    if (product.base_unit === 'unit') return i.qty_remaining <= 1
    if (product.base_unit === 'ml') return i.qty_remaining < 200
    return i.qty_remaining < 150
  })

  const formatQty = (qty: number, productId: string) => {
    const product = getProduct(productId)
    const unit = product?.base_unit ?? 'g'
    if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toFixed(1)} kg`
    if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(1)} L`
    return `${qty.toFixed(0)} ${unit}`
  }

  const handleDismissCarryover = () => {
    dismissCarryover()
    setCarryover({ ...carryover, show: false })
    reload()
  }

  const handleEditSave = (itemId: string) => {
    const inv = store.getInventory()
    const item = inv.find(i => i.id === itemId)
    if (!item) return
    item.qty_remaining = Math.max(0, editQty)
    store.saveInventory(inv)
    setEditingInv(null)
    reload()
  }

  const handleBudgetSave = () => {
    if (!profile) return
    store.saveProfile({ ...profile, monthly_budget: Math.max(0, budgetEdit) })
    setEditingBudget(false)
    reload()
  }

  const handleQuickAdd = () => {
    if (!quickName.trim() || quickQty <= 0) return
    const unitType = quickUnit === 'ml' || quickUnit === 'L' ? 'volume' as const : quickUnit === 'unit' ? 'count' as const : 'mass' as const
    const baseUnit = unitType === 'volume' ? 'ml' : unitType === 'count' ? 'unit' : 'g'
    let qty = quickQty
    if (quickUnit === 'kg') qty *= 1000
    if (quickUnit === 'L') qty *= 1000
    const product = store.findOrCreateProduct(quickName, 'otro', unitType, baseUnit)
    store.addInventoryItem({
      user_id: 'default-user',
      product_id: product.id,
      qty_remaining: qty,
      acquired_at: new Date().toISOString(),
      expiry_estimate: null,
    })
    setQuickName('')
    setQuickQty(0)
    setShowQuickAdd(false)
    reload()
  }

  const daysUntilNextShopping = () => {
    if (!profile) return null
    const freq = profile.shopping_frequency
    const days = freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : 30
    const purchases = store.getPurchases()
    if (purchases.length === 0) return null
    const lastPurchase = purchases.sort((a, b) => b.purchased_at.localeCompare(a.purchased_at))[0]
    const lastDate = new Date(lastPurchase.purchased_at)
    const nextDate = new Date(lastDate.getTime() + days * 86400000)
    const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / 86400000)
    return daysLeft
  }

  const shoppingDays = daysUntilNextShopping()

  const budgetPerDay = () => {
    if (remaining <= 0) return null
    const now = new Date()
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1
    return remaining / daysLeft
  }
  const dailyBudget = budgetPerDay()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {profile?.name || 'Chef'} 👋</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Tu resumen de esta semana</p>
      </div>

      {/* Savings banner */}
      {carryover.show && (
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 relative">
          <button onClick={handleDismissCarryover} className="absolute top-3 right-3 p-1 text-emerald-400 hover:text-emerald-600 cursor-pointer"><X size={16} /></button>
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl shrink-0">
              <Sparkles className="text-emerald-600" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-emerald-800 text-sm">¡Ahorraste {formatCurrency(carryover.savings)}! 🎉</h3>
              <p className="text-sm text-emerald-700 mt-1">{carryover.message}</p>
              <Button size="sm" variant="outline" className="mt-3 border-emerald-300 text-emerald-700 hover:bg-emerald-100" onClick={handleDismissCarryover}>
                Aplicar ahorro al mes actual
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100"><DollarSign className="text-emerald-600" size={18} /></div>
              <div>
                <p className="text-[11px] text-muted-foreground leading-none mb-1">Restante</p>
                <p className="text-lg font-bold text-emerald-700 leading-none">{formatCurrency(remaining)}</p>
              </div>
            </div>
            {!editingBudget && (
              <button onClick={() => { setEditingBudget(true); setBudgetEdit(budget) }} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer">
                <Pencil size={12} />
              </button>
            )}
          </div>
          {editingBudget ? (
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Presupuesto mensual ({profile?.currency ?? 'USD'})</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="number" value={budgetEdit || ''} onChange={e => setBudgetEdit(+e.target.value)} className="flex-1 h-8 text-sm" autoFocus />
                  <button onClick={handleBudgetSave} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"><Check size={14} /></button>
                  <button onClick={() => setEditingBudget(false)} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer"><X size={14} /></button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${budgetPct >= 90 ? 'bg-red-400' : budgetPct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${budgetPct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Gastado {formatCurrency(totalSpent)} de {formatCurrency(budget)}</p>
              {dailyBudget !== null && dailyBudget > 0 && (
                <p className="text-[10px] text-emerald-600 mt-0.5">~{formatCurrency(dailyBudget)}/día disponible</p>
              )}
            </>
          )}
        </Card>

        <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-100"><Package className="text-sky-600" size={18} /></div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">Inventario</p>
              <p className="text-lg font-bold text-sky-700 leading-none">{activeItems.length}</p>
            </div>
          </div>
          {lowStock.length > 0 && (
            <p className="text-[10px] text-amber-600 mt-2">{lowStock.length} por agotarse</p>
          )}
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
          {shoppingDays !== null && shoppingDays > 0 && (
            <p className="text-[10px] text-violet-600 mt-2">Próxima compra en ~{shoppingDays}d</p>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/capture">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group border-dashed border-primary/30 bg-primary/[0.03]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <Camera className="text-primary" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Registrar compra</p>
                <p className="text-xs text-muted-foreground">Foto o ingreso manual</p>
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
                <p className="font-semibold text-sm">Recetas IA</p>
                <p className="text-xs text-muted-foreground">Cocina con lo que tienes</p>
              </div>
              <ArrowRight size={16} className="text-muted-foreground group-hover:text-accent transition-colors" />
            </div>
          </Card>
        </Link>

        <button onClick={() => setShowQuickAdd(!showQuickAdd)} className="text-left cursor-pointer">
          <Card className="hover:shadow-md transition-shadow group border-dashed border-violet-200 bg-violet-50/30 h-full">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-100 rounded-xl group-hover:bg-violet-200 transition-colors">
                <Plus className="text-violet-600" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Agregar al inventario</p>
                <p className="text-xs text-muted-foreground">Compra extra o regalo</p>
              </div>
            </div>
          </Card>
        </button>
      </div>

      {/* Quick Add to Inventory */}
      {showQuickAdd && (
        <Card className="border-violet-200 bg-violet-50/30">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Plus className="text-violet-600" size={16} />
            Agregar producto al inventario
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Para cosas que compraste fuera del presupuesto, regalos, o productos que ya tenías.</p>
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-5">
              <label className="text-[10px] text-muted-foreground font-medium">Producto</label>
              <Input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="Ej: Arroz arborio" autoFocus />
            </div>
            <div className="col-span-3">
              <label className="text-[10px] text-muted-foreground font-medium">Cantidad</label>
              <Input type="number" value={quickQty || ''} onChange={e => setQuickQty(+e.target.value)} placeholder="500" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground font-medium">Unidad</label>
              <select value={quickUnit} onChange={e => setQuickUnit(e.target.value)} className="flex h-10 w-full rounded-xl border border-border bg-white px-2 py-2 text-sm">
                <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="unit">und</option>
              </select>
            </div>
            <div className="col-span-2">
              <Button onClick={handleQuickAdd} className="w-full">
                <Check size={14} />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <h3 className="font-semibold flex items-center gap-2 mb-1 text-sm">
            <ShoppingCart className="text-orange-500" size={16} />
            Productos por agotarse
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Estos productos están bajos. Considera reponerlos en tu próxima compra.</p>
          <div className="space-y-2">
            {lowStock.map(item => {
              const isEditing = editingInv === item.id
              return (
                <div key={item.id} className="flex justify-between items-center p-2.5 rounded-xl bg-white border border-orange-100">
                  <div>
                    <span className="text-sm font-medium">{getProductName(item.product_id)}</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input type="number" value={editQty} onChange={e => setEditQty(+e.target.value)} className="w-24 h-7 text-xs" autoFocus />
                        <span className="text-xs text-muted-foreground">{getProduct(item.product_id)?.base_unit ?? 'g'}</span>
                        <button onClick={() => handleEditSave(item.id)} className="p-1 text-primary hover:bg-primary/10 rounded cursor-pointer"><Check size={12} /></button>
                        <button onClick={() => setEditingInv(null)} className="p-1 text-muted-foreground hover:bg-muted rounded cursor-pointer"><X size={12} /></button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Quedan {formatQty(item.qty_remaining, item.product_id)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <button onClick={() => { setEditingInv(item.id); setEditQty(item.qty_remaining) }} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer">
                        <Pencil size={13} />
                      </button>
                    )}
                    <Badge variant="warning">Bajo</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Expiring Soon */}
      {expiringSoon.length > 0 && (
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-1 text-sm">
            <AlertTriangle className="text-amber-500" size={16} />
            Próximos a caducar
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Úsalos pronto o genera recetas con la IA para aprovecharlos.</p>
          <div className="space-y-2">
            {expiringSoon.map(item => (
              <div key={item.id} className="flex justify-between items-center p-2.5 rounded-xl bg-amber-50/80 border border-amber-100">
                <div>
                  <span className="text-sm font-medium">{getProductName(item.product_id)}</span>
                  <p className="text-xs text-muted-foreground">{formatQty(item.qty_remaining, item.product_id)} disponible</p>
                </div>
                <Badge variant="warning">{daysBetween(today, item.expiry_estimate!)}d</Badge>
              </div>
            ))}
            <Link to="/recipes">
              <Button size="sm" variant="outline" className="w-full mt-1 text-amber-700 border-amber-200 hover:bg-amber-50">
                <ChefHat size={14} className="mr-1" /> Generar recetas para usar estos productos
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Budget warning */}
      {budgetPct >= 80 && remaining > 0 && (
        <Card className="border-red-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-xl shrink-0">
              <DollarSign className="text-red-600" size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-red-800 text-sm">Presupuesto casi agotado</h3>
              <p className="text-xs text-red-700 mt-1">
                Has gastado el {budgetPct.toFixed(0)}% de tu presupuesto. Te quedan {formatCurrency(remaining)} para el resto del mes.
                {dailyBudget !== null && ` Eso es ~${formatCurrency(dailyBudget)} por día.`}
              </p>
            </div>
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

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { store } from '@/store'
import { formatCurrency, daysBetween } from '@/lib/utils'
import { checkMonthlyCarryover, dismissCarryover } from '@/services/budget'
import { getNutritionTargets } from '@/services/nutrition'
import { parseInventoryFromText, analyzeQuickMeal, hasGrokKey } from '@/services/grok'
import type { UserProfile, InventoryItem, Product } from '@/types'
import { DollarSign, Package, AlertTriangle, TrendingUp, Camera, ChefHat, ArrowRight, Sparkles, X, ShoppingCart, Pencil, Check, Plus, Mic, MicOff, Loader2, MessageSquare, Cookie, Utensils } from 'lucide-react'

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
  const [editingSpent, setEditingSpent] = useState(false)
  const [spentEdit, setSpentEdit] = useState(0)
  const [editingRemaining, setEditingRemaining] = useState(false)
  const [remainingEdit, setRemainingEdit] = useState(0)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickQty, setQuickQty] = useState(0)
  const [quickUnit, setQuickUnit] = useState('g')
  const [showDictation, setShowDictation] = useState(false)
  const [dictText, setDictText] = useState('')
  const [dictLoading, setDictLoading] = useState(false)
  const [dictResult, setDictResult] = useState('')
  const [dictError, setDictError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const listeningRef = useRef(false)
  const dictBaseRef = useRef('')
  const dictFinalRef = useRef('')
  // Quick "what did you eat?" logging
  const [mealText, setMealText] = useState('')
  const [mealLoading, setMealLoading] = useState(false)
  const [mealResult, setMealResult] = useState('')
  const [mealError, setMealError] = useState('')
  const [mealListening, setMealListening] = useState(false)
  const mealRecogRef = useRef<any>(null)
  const mealListeningRef = useRef(false)
  const mealBaseRef = useRef('')
  const mealFinalRef = useRef('')

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

  const SNACK_CATEGORIES = ['fruta', 'otro']
  const SNACK_KEYWORDS = ['galleta', 'banana', 'banano', 'manzana', 'pera', 'uva', 'fresa', 'naranja', 'mandarina', 'durazno', 'snack', 'cereal', 'yogurt', 'yogur', 'granola', 'barra', 'chocolate', 'pan', 'queso', 'jamón', 'jamon', 'huevo', 'nuez', 'nueces', 'almendra', 'maní', 'mani', 'frutos secos', 'chips', 'tostada']

  const snackableItems = activeItems.filter(i => {
    const product = getProduct(i.product_id)
    if (!product) return false
    const name = product.name.toLowerCase()
    const isCat = SNACK_CATEGORIES.includes(product.category)
    const isKeyword = SNACK_KEYWORDS.some(k => name.includes(k))
    const isUnit = product.base_unit === 'unit'
    return isCat || isKeyword || isUnit
  })

  const lastSnackCheck = localStorage.getItem('snack_check_date')
  const daysSinceCheck = lastSnackCheck ? daysBetween(lastSnackCheck, today) : 999
  const showSnackCheck = snackableItems.length > 0 && daysSinceCheck >= 7
  const [snackUpdates, setSnackUpdates] = useState<Record<string, number>>({})
  const [snackCheckVisible, setSnackCheckVisible] = useState(showSnackCheck)

  const handleSnackUpdate = (itemId: string, newQty: number) => {
    setSnackUpdates(prev => ({ ...prev, [itemId]: Math.max(0, newQty) }))
  }

  const handleSnackSave = () => {
    const inv = store.getInventory()
    for (const [itemId, qty] of Object.entries(snackUpdates)) {
      const item = inv.find(i => i.id === itemId)
      if (item) item.qty_remaining = qty
    }
    store.saveInventory(inv)
    localStorage.setItem('snack_check_date', today)
    setSnackCheckVisible(false)
    setSnackUpdates({})
    reload()
  }

  const handleSnackDismiss = () => {
    localStorage.setItem('snack_check_date', today)
    setSnackCheckVisible(false)
  }

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

  const handleSpentSave = () => {
    if (!profile) return
    const adjustment = spentEdit - totalSpent
    store.saveProfile({ ...profile, budget_carryover: (profile.budget_carryover ?? 0) - adjustment })
    setEditingSpent(false)
    reload()
  }

  const handleRemainingSave = () => {
    if (!profile) return
    const newCarryover = remainingEdit - (budget - totalSpent)
    store.saveProfile({ ...profile, budget_carryover: newCarryover })
    setEditingRemaining(false)
    reload()
  }

  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setDictError('Tu navegador no soporta dictado por voz. Escribe en el recuadro, o abre la app en Chrome.')
      return
    }

    // Stop if already listening
    if (listeningRef.current) {
      listeningRef.current = false
      try { recognitionRef.current?.stop() } catch { /* ignore */ }
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition

    // Preserve whatever the user already has; append dictation onto it.
    dictBaseRef.current = dictText.trim() ? dictText.trim() + ' ' : ''
    dictFinalRef.current = ''
    setDictError('')

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (res.isFinal) dictFinalRef.current += res[0].transcript + ' '
        else interim += res[0].transcript
      }
      setDictText((dictBaseRef.current + dictFinalRef.current + interim).replace(/\s+/g, ' ').trimStart())
    }

    recognition.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        listeningRef.current = false
        setIsListening(false)
        setDictError('Permite el acceso al micrófono en tu navegador para poder dictar.')
      }
      // 'no-speech' / 'aborted' are transient — onend will restart if still listening.
    }

    recognition.onend = () => {
      // Mobile browsers stop after each phrase; restart while the user still wants to listen.
      if (listeningRef.current) {
        try { recognition.start() } catch { /* already starting */ }
      } else {
        setIsListening(false)
      }
    }

    try {
      recognition.start()
      listeningRef.current = true
      setIsListening(true)
    } catch {
      setDictError('No se pudo iniciar el micrófono. Intenta de nuevo.')
    }
  }

  const handleDictSubmit = async () => {
    if (!dictText.trim()) return
    // Stop any active dictation before processing.
    if (listeningRef.current) {
      listeningRef.current = false
      try { recognitionRef.current?.stop() } catch { /* ignore */ }
      setIsListening(false)
    }
    setDictLoading(true)
    setDictError('')
    setDictResult('')
    try {
      const items = await parseInventoryFromText(dictText)
      if (items.length === 0) {
        setDictError('No se detectaron productos. Intenta ser más específico.')
        return
      }
      for (const item of items) {
        const unitType = item.unit === 'ml' ? 'volume' as const : item.unit === 'unit' ? 'count' as const : 'mass' as const
        const product = store.findOrCreateProduct(item.name, item.category, unitType, item.unit)
        store.addInventoryItem({
          user_id: 'default-user',
          product_id: product.id,
          qty_remaining: item.qty,
          acquired_at: new Date().toISOString(),
          expiry_estimate: null,
        })
      }
      setDictResult(`✓ ${items.length} productos agregados: ${items.map(i => i.name).join(', ')}`)
      setDictText('')
      dictBaseRef.current = ''
      dictFinalRef.current = ''
      reload()
    } catch (err: any) {
      setDictError(err.message ?? 'Error al procesar')
    } finally {
      setDictLoading(false)
    }
  }

  const toggleMealVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMealError('Tu navegador no soporta dictado por voz. Escribe lo que comiste, o usa Chrome.')
      return
    }
    if (mealListeningRef.current) {
      mealListeningRef.current = false
      try { mealRecogRef.current?.stop() } catch { /* ignore */ }
      setMealListening(false)
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true
    mealRecogRef.current = recognition
    mealBaseRef.current = mealText.trim() ? mealText.trim() + ' ' : ''
    mealFinalRef.current = ''
    setMealError('')
    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (res.isFinal) mealFinalRef.current += res[0].transcript + ' '
        else interim += res[0].transcript
      }
      setMealText((mealBaseRef.current + mealFinalRef.current + interim).replace(/\s+/g, ' ').trimStart())
    }
    recognition.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        mealListeningRef.current = false
        setMealListening(false)
        setMealError('Permite el acceso al micrófono para dictar.')
      }
    }
    recognition.onend = () => {
      if (mealListeningRef.current) { try { recognition.start() } catch { /* ignore */ } }
      else setMealListening(false)
    }
    try {
      recognition.start()
      mealListeningRef.current = true
      setMealListening(true)
    } catch {
      setMealError('No se pudo iniciar el micrófono. Intenta de nuevo.')
    }
  }

  const handleMealSubmit = async () => {
    if (!mealText.trim()) return
    if (mealListeningRef.current) {
      mealListeningRef.current = false
      try { mealRecogRef.current?.stop() } catch { /* ignore */ }
      setMealListening(false)
    }
    setMealLoading(true)
    setMealError('')
    setMealResult('')
    try {
      const meal = await analyzeQuickMeal(mealText)
      store.addMealLog({
        user_id: 'default-user',
        date: new Date().toISOString().split('T')[0],
        recipe_id: null,
        recipe_name: meal.name,
        calories: meal.calories,
        protein_g: meal.protein_g,
      })
      setMealResult(`✓ ${meal.name}: +${meal.calories} kcal, +${meal.protein_g}g proteína${meal.note ? ` · ${meal.note}` : ''}`)
      setMealText('')
      mealBaseRef.current = ''
      mealFinalRef.current = ''
      reload()
    } catch (err: any) {
      setMealError(err.message ?? 'Error al procesar')
    } finally {
      setMealLoading(false)
    }
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
  const nutrition = profile ? getNutritionTargets(profile) : null

  // Today's consumption: cooked recipes + restaurant meals
  const PROTEIN_BY_LEVEL: Record<string, number> = { low: 12, med: 25, high: 40 }
  const todayMeals = store.getMealLog().filter(m => m.date === today)
  const todayEatingOut = store.getEatingOut().filter(e => e.date === today)
  const consumedKcal = todayMeals.reduce((s, m) => s + m.calories, 0)
    + todayEatingOut.reduce((s, e) => s + e.est_calories, 0)
  const consumedProtein = todayMeals.reduce((s, m) => s + m.protein_g, 0)
    + todayEatingOut.reduce((s, e) => s + (PROTEIN_BY_LEVEL[e.est_protein] ?? 0), 0)
  const kcalPct = nutrition ? Math.min((consumedKcal / nutrition.tdee) * 100, 100) : 0
  const proteinPct = nutrition ? Math.min((consumedProtein / nutrition.proteinG) * 100, 100) : 0

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

      {/* Nutrition targets — MyFitnessPal style */}
      {nutrition && (
        <Card className="bg-gradient-to-r from-orange-50 to-rose-50 border-orange-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ChefHat className="text-orange-500" size={16} />
              Tu meta de hoy
            </h3>
            <Badge variant="warning">{nutrition.goalLabel}</Badge>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-white/70 rounded-xl py-2">
              <p className="text-base font-bold text-orange-600 leading-none">{nutrition.tdee}</p>
              <p className="text-[10px] text-muted-foreground mt-1">kcal/día</p>
            </div>
            <div className="bg-white/70 rounded-xl py-2">
              <p className="text-base font-bold text-rose-600 leading-none">{nutrition.proteinG}g</p>
              <p className="text-[10px] text-muted-foreground mt-1">proteína</p>
            </div>
            <div className="bg-white/70 rounded-xl py-2">
              <p className="text-base font-bold text-amber-600 leading-none">{nutrition.carbG}g</p>
              <p className="text-[10px] text-muted-foreground mt-1">carbos</p>
            </div>
            <div className="bg-white/70 rounded-xl py-2">
              <p className="text-base font-bold text-sky-600 leading-none">{nutrition.fatG}g</p>
              <p className="text-[10px] text-muted-foreground mt-1">grasa</p>
            </div>
          </div>
          {/* Today's progress */}
          <div className="mt-3 space-y-2">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-medium text-orange-700">Calorías de hoy</span>
                <span className="text-muted-foreground">{consumedKcal} / {nutrition.tdee} kcal ({Math.round(kcalPct)}%)</span>
              </div>
              <div className="h-2 bg-white/70 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${kcalPct >= 100 ? 'bg-red-400' : 'bg-orange-400'}`} style={{ width: `${kcalPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-medium text-rose-700">Proteína de hoy</span>
                <span className="text-muted-foreground">{consumedProtein}g / {nutrition.proteinG}g ({Math.round(proteinPct)}%)</span>
              </div>
              <div className="h-2 bg-white/70 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${proteinPct}%` }} />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {consumedKcal === 0
              ? 'Marca una receta como "Cocinado" o registra un antojo y tu progreso aparece aquí.'
              : todayMeals.length > 0
                ? `Hoy: ${todayMeals.map(m => m.recipe_name).join(', ')}${todayEatingOut.length > 0 ? ` + ${todayEatingOut.length} antojo(s)` : ''}`
                : `Hoy: ${todayEatingOut.length} antojo(s) registrado(s)`}
          </p>
        </Card>
      )}

      {/* Quick "what did you eat?" logging */}
      {hasGrokKey() && (
        <Card className="border-rose-200 bg-gradient-to-r from-rose-50/60 to-orange-50/40">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-rose-100 rounded-lg"><Utensils className="text-rose-600" size={15} /></div>
            <h3 className="font-semibold text-sm">¿Qué comiste?</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2">Escribe o dicta lo que comiste y la IA lo suma a tu día. Ej: "una arepa con queso y un jugo".</p>
          <div className="relative">
            <Input
              value={mealText}
              onChange={e => setMealText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !mealLoading) handleMealSubmit() }}
              placeholder="Ej: pechuga a la plancha con arroz y ensalada"
              className="bg-white/80 border-rose-200 pr-11"
            />
            <button
              onClick={toggleMealVoice}
              className={`absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-lg transition-colors cursor-pointer ${mealListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-rose-100 text-rose-600 hover:bg-rose-200'}`}
              title={mealListening ? 'Detener' : 'Dictar por voz'}
            >
              {mealListening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          </div>
          {mealListening && <p className="text-xs text-red-600 flex items-center gap-1 mt-1.5"><Mic size={10} className="animate-pulse" /> Escuchando...</p>}
          {mealError && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg mt-1.5">{mealError}</p>}
          {mealResult && <p className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg mt-1.5">{mealResult}</p>}
          <Button
            onClick={handleMealSubmit}
            className="w-full mt-2"
            disabled={!mealText.trim() || mealLoading}
          >
            {mealLoading
              ? <><Loader2 size={14} className="mr-2 animate-spin" /> Estimando...</>
              : <><Sparkles size={14} className="mr-2" /> Registrar comida</>}
          </Button>
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
                {editingRemaining ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input type="number" value={remainingEdit || ''} onChange={e => setRemainingEdit(+e.target.value)} className="w-24 h-7 text-sm" autoFocus />
                    <button onClick={handleRemainingSave} className="p-1 text-primary hover:bg-primary/10 rounded cursor-pointer"><Check size={12} /></button>
                    <button onClick={() => setEditingRemaining(false)} className="p-1 text-muted-foreground hover:bg-muted rounded cursor-pointer"><X size={12} /></button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingRemaining(true); setRemainingEdit(remaining); setEditingSpent(false); setEditingBudget(false) }} className="text-lg font-bold text-emerald-700 leading-none hover:underline decoration-dashed cursor-pointer">
                    {formatCurrency(remaining)}
                  </button>
                )}
              </div>
            </div>
            {!editingBudget && !editingRemaining && !editingSpent && (
              <button onClick={() => { setEditingBudget(true); setBudgetEdit(budget) }} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer" title="Editar presupuesto mensual">
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
              <div className="flex items-center justify-between mt-1.5">
                {editingSpent ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Gastado</span>
                    <Input type="number" value={spentEdit || ''} onChange={e => setSpentEdit(+e.target.value)} className="w-20 h-6 text-[10px]" autoFocus />
                    <button onClick={handleSpentSave} className="p-0.5 text-primary hover:bg-primary/10 rounded cursor-pointer"><Check size={10} /></button>
                    <button onClick={() => setEditingSpent(false)} className="p-0.5 text-muted-foreground hover:bg-muted rounded cursor-pointer"><X size={10} /></button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingSpent(true); setSpentEdit(totalSpent); setEditingRemaining(false); setEditingBudget(false) }} className="text-[10px] text-muted-foreground hover:text-primary cursor-pointer hover:underline decoration-dashed">
                    Gastado {formatCurrency(totalSpent)} de {formatCurrency(budget)}
                  </button>
                )}
              </div>
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

      {/* Dictation: Ya tengo cosas */}
      <Card className="border-sky-200 bg-gradient-to-r from-sky-50/50 to-violet-50/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <MessageSquare className="text-sky-600" size={16} />
            ¿Ya tienes cosas en casa?
          </h3>
          <button onClick={() => setShowDictation(!showDictation)} className="text-xs text-sky-600 hover:text-sky-800 cursor-pointer hover:underline">
            {showDictation ? 'Cerrar' : 'Cuéntanos'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Escribe o dicta lo que tienes en la despensa y la IA lo agrega al inventario automáticamente.</p>

        {showDictation && (
          <div className="mt-3 space-y-3">
            <div className="relative">
              <textarea
                value={dictText}
                onChange={e => setDictText(e.target.value)}
                placeholder='Ej: "Tengo 2 kilos de arroz, un pollo entero, medio litro de aceite, 500 gramos de pasta, 3 latas de atún y una bolsa de lentejas"'
                className="flex w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm min-h-[80px] focus-visible:ring-2 focus-visible:ring-sky-300 pr-12"
              />
              <button
                onClick={toggleVoice}
                className={`absolute bottom-2 right-2 p-2 rounded-xl transition-colors cursor-pointer ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-sky-100 text-sky-600 hover:bg-sky-200'}`}
                title={isListening ? 'Detener' : 'Dictar por voz'}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            </div>
            {isListening && <p className="text-xs text-red-600 flex items-center gap-1"><Mic size={10} className="animate-pulse" /> Escuchando... habla y describe lo que tienes</p>}
            {dictError && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">{dictError}</p>}
            {dictResult && <p className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">{dictResult}</p>}
            <Button
              onClick={handleDictSubmit}
              className="w-full"
              disabled={!dictText.trim() || dictLoading || !hasGrokKey()}
            >
              {dictLoading
                ? <><Loader2 size={14} className="mr-2 animate-spin" /> La IA está procesando...</>
                : <><Sparkles size={14} className="mr-2" /> Agregar todo al inventario</>}
            </Button>
          </div>
        )}
      </Card>

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

      {/* Snack Check */}
      {snackCheckVisible && (
        <Card className="border-pink-200 bg-gradient-to-r from-pink-50 to-orange-50">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Cookie className="text-pink-500" size={16} />
              Chequeo semanal de snacks
            </h3>
            <button onClick={handleSnackDismiss} className="text-xs text-muted-foreground hover:text-pink-600 cursor-pointer">
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">¿Ya te comiste algo de esto durante la semana? Actualiza las cantidades para mantener tu inventario al día.</p>
          <div className="space-y-2">
            {snackableItems.map(item => {
              const currentQty = snackUpdates[item.id] ?? item.qty_remaining
              const product = getProduct(item.product_id)
              const unit = product?.base_unit ?? 'g'
              return (
                <div key={item.id} className="flex justify-between items-center p-2.5 rounded-xl bg-white border border-pink-100">
                  <div className="flex-1">
                    <span className="text-sm font-medium">{getProductName(item.product_id)}</span>
                    <p className="text-[10px] text-muted-foreground">Tenías: {formatQty(item.qty_remaining, item.product_id)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleSnackUpdate(item.id, currentQty - (unit === 'unit' ? 1 : unit === 'ml' ? 250 : 100))} className="w-7 h-7 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center text-sm font-bold cursor-pointer hover:bg-pink-200">−</button>
                    <span className="text-xs font-medium w-16 text-center">
                      {unit === 'g' && currentQty >= 1000 ? `${(currentQty / 1000).toFixed(1)} kg` : unit === 'ml' && currentQty >= 1000 ? `${(currentQty / 1000).toFixed(1)} L` : `${currentQty.toFixed(0)} ${unit}`}
                    </span>
                    <button onClick={() => handleSnackUpdate(item.id, currentQty + (unit === 'unit' ? 1 : unit === 'ml' ? 250 : 100))} className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold cursor-pointer hover:bg-emerald-200">+</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={handleSnackSave} className="flex-1">
              <Check size={14} className="mr-1" /> Actualizar inventario
            </Button>
            <Button variant="outline" onClick={handleSnackDismiss}>Todo igual</Button>
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

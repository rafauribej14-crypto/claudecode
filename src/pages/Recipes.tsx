import { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { generateId } from '@/lib/utils'
import { generateRecipes as generateRecipesAI, hasGrokKey, analyzeDishNeeds } from '@/services/grok'
import type { DishAnalysisResult } from '@/services/grok'
import { getNutritionTargets } from '@/services/nutrition'
import type { Recipe, RecipeIngredient, MealType, CookingLevel, Product, InventoryItem } from '@/types'
import { ChefHat, Plus, Clock, Flame, Users, Sparkles, CheckCircle, Trash2, Pencil, X, Eye, EyeOff, Loader2, Heart, Search, ShoppingCart, PackageCheck } from 'lucide-react'

function IngredientAutocomplete({ value, onChange, products, inventory }: {
  value: string
  onChange: (name: string, productId: string | null) => void
  products: Product[]
  inventory: InventoryItem[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setSearch(value) }, [value])
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const available = products.filter(p => {
    const inv = inventory.find(i => i.product_id === p.id)
    return inv && inv.qty_remaining > 0
  })
  const filtered = search.trim() ? available.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : available
  const getQty = (pid: string) => {
    const inv = inventory.find(i => i.product_id === pid)
    if (!inv) return ''
    const p = products.find(pr => pr.id === pid)
    const u = p?.base_unit ?? 'g'
    if (u === 'g' && inv.qty_remaining >= 1000) return `${(inv.qty_remaining / 1000).toFixed(1)} kg`
    return `${inv.qty_remaining.toFixed(0)} ${u}`
  }

  return (
    <div ref={ref} className="relative">
      <Input value={search} onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value, null) }} onFocus={() => setOpen(true)} placeholder="Buscar producto..." />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-48 overflow-auto">
          {filtered.map(p => (
            <button key={p.id} type="button" className="w-full flex justify-between items-center px-3 py-2 hover:bg-primary/5 text-left text-sm cursor-pointer" onClick={() => { setSearch(p.name); onChange(p.name, p.id); setOpen(false) }}>
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{getQty(p.id)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const emptyForm = { name: '', meal_type: 'lunch' as MealType, cooking_level: 'basic' as CookingLevel, instructions: '', est_calories: 0, protein_level: 'med' as 'low' | 'med' | 'high', prep_minutes: 30, servings: 4, days_covered: 3 }
const emptyIngredient = () => ({ name: '', qty: 0, unit: 'g', product_id: null as string | null })

export function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiRequest, setAiRequest] = useState('')
  const [showCustomField, setShowCustomField] = useState(false)
  const [dishQuery, setDishQuery] = useState('')
  const [dishLoading, setDishLoading] = useState(false)
  const [dishResult, setDishResult] = useState<DishAnalysisResult | null>(null)
  const [dishError, setDishError] = useState('')

  const reload = () => { setRecipes(store.getRecipes()); setProducts(store.getProducts()); setInventory(store.getInventory()) }
  useEffect(reload, [])

  const [form, setForm] = useState(emptyForm)
  const [ingredients, setIngredients] = useState([emptyIngredient()])

  const openCreate = () => {
    setForm(emptyForm)
    setIngredients([emptyIngredient()])
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (recipe: Recipe) => {
    setForm({
      name: recipe.name, meal_type: recipe.meal_type, cooking_level: recipe.cooking_level,
      instructions: recipe.instructions, est_calories: recipe.est_calories, protein_level: recipe.protein_level,
      prep_minutes: recipe.prep_minutes, servings: recipe.servings, days_covered: recipe.days_covered,
    })
    setIngredients(recipe.ingredients.map(i => ({ name: i.ingredient_name, qty: i.qty, unit: i.unit, product_id: i.product_id })))
    setEditingId(recipe.id)
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.name) return
    const recipeIngredients: RecipeIngredient[] = ingredients
      .filter(i => i.name && i.qty > 0)
      .map(i => ({
        id: generateId(), recipe_id: '', product_id: i.product_id,
        ingredient_name: i.name,
        qty: i.unit === 'kg' ? i.qty * 1000 : i.unit === 'L' ? i.qty * 1000 : i.qty,
        unit: i.unit === 'kg' ? 'g' : i.unit === 'L' ? 'ml' : i.unit,
      }))

    if (editingId) {
      const all = store.getRecipes()
      const idx = all.findIndex(r => r.id === editingId)
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...form, ingredients: recipeIngredients }
        store.saveRecipes(all)
      }
    } else {
      store.addRecipe({ ...form, ai_generated: false, saved: false, ingredients: recipeIngredients })
    }

    setShowForm(false)
    setEditingId(null)
    reload()
  }

  const handleDelete = (id: string) => {
    const all = store.getRecipes().filter(r => r.id !== id)
    store.saveRecipes(all)
    setConfirmDelete(null)
    reload()
  }

  const [cookedMsg, setCookedMsg] = useState<Record<string, string>>({})

  // Only use a real AI/user-provided gram value. Never fabricate a number from protein_level.
  const proteinOf = (recipe: Recipe): number | null => recipe.est_protein_g ?? null

  const markCooked = (recipe: Recipe) => {
    const inv = store.getInventory()
    const prods = store.getProducts()
    const deducted: string[] = []
    const skipped: string[] = []
    const unitMismatch: string[] = []

    for (const ing of recipe.ingredients) {
      // Match by linked product_id, or fall back to name matching
      let item = ing.product_id ? inv.find(i => i.product_id === ing.product_id && i.qty_remaining > 0) : undefined
      if (!item) {
        const lower = ing.ingredient_name.toLowerCase()
        item = inv.find(i => {
          if (i.qty_remaining <= 0) return false
          const p = prods.find(pr => pr.id === i.product_id)
          if (!p) return false
          const pName = p.name.toLowerCase()
          return pName.includes(lower) || lower.includes(pName)
        })
      }
      if (item) {
        // Normalize the ingredient qty to the product's base unit before subtracting,
        // so "0.2 kg" correctly deducts 200 g and "0.25 L" deducts 250 ml.
        const product = prods.find(pr => pr.id === item.product_id)
        const base = product?.base_unit ?? 'g'
        const isCount = (u: string) => u === 'unit' || u === 'und'
        if (isCount(ing.unit) !== isCount(base)) {
          // "¼ unidad de mantequilla" vs stock en gramos: restar 0.25 g sería
          // mentira. Mejor no tocar el stock y avisar para ajuste manual.
          unitMismatch.push(`${ing.ingredient_name} (${ing.qty} ${ing.unit})`)
          continue
        }
        let qtyInBase = ing.qty
        if ((ing.unit === 'kg' && base === 'g') || (ing.unit === 'L' && base === 'ml')) {
          qtyInBase = ing.qty * 1000
        }
        item.qty_remaining = Math.max(0, item.qty_remaining - qtyInBase)
        deducted.push(ing.ingredient_name)
      } else {
        skipped.push(ing.ingredient_name)
      }
    }

    store.saveInventory(inv)

    // Log one serving to today's meal log (fuels the dashboard progress)
    const protein = proteinOf(recipe)
    store.addMealLog({
      user_id: 'default-user',
      date: new Date().toISOString().split('T')[0],
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      calories: recipe.est_calories,
      protein_g: protein ?? 0,
    })

    const parts: string[] = [
      protein !== null
        ? `🍽 +${recipe.est_calories} kcal y +${protein}g proteína registrados hoy`
        : `🍽 +${recipe.est_calories} kcal registrados hoy (sin dato de proteína)`,
    ]
    if (deducted.length > 0) parts.push(`✓ Descontado: ${deducted.join(', ')}`)
    if (unitMismatch.length > 0) parts.push(`⚠ Ajusta a mano en Despensa (unidad no comparable): ${unitMismatch.join(', ')}`)
    if (skipped.length > 0) parts.push(`No estaban (quizá los sustituiste): ${skipped.join(', ')}`)
    setCookedMsg(prev => ({ ...prev, [recipe.id]: parts.join(' · ') || 'Nada que descontar' }))
    setTimeout(() => setCookedMsg(prev => { const { [recipe.id]: _, ...rest } = prev; return rest }), 6000)
    reload()
  }

  // Convert an ingredient qty to the product's base unit (kg->g, L->ml) for correct comparison.
  const qtyInBaseUnit = (ing: { qty: number; unit: string }, productId: string | null) => {
    const product = products.find(p => p.id === productId)
    const base = product?.base_unit ?? 'g'
    if ((ing.unit === 'kg' && base === 'g') || (ing.unit === 'L' && base === 'ml')) return ing.qty * 1000
    return ing.qty
  }

  // An ingredient counts as "missing" if the AI flagged have:false, or if it's
  // linked to inventory but there isn't enough. Unlinked basics (salt, oil) are assumed present.
  const isMissing = (ing: Recipe['ingredients'][number]) => {
    if (ing.have === false) return true
    if (!ing.product_id) return false
    const item = inventory.find(i => i.product_id === ing.product_id)
    return !item || item.qty_remaining < qtyInBaseUnit(ing, ing.product_id)
  }

  const canCook = (recipe: Recipe) => recipe.ingredients.every(ing => !isMissing(ing))
  const getMissing = (recipe: Recipe) => recipe.ingredients.filter(isMissing)

  const handleGenerateAI = async () => {
    setAiError('')
    setAiLoading(true)
    try {
      const profile = store.getProfile()
      const aiRecipes = await generateRecipesAI({ inventory, products, profile, customRequest: aiRequest })
      const current = store.getRecipes()
      const kept = current.filter(r => !r.ai_generated || r.saved)
      store.saveRecipes([...kept, ...aiRecipes])
      reload()
    } catch (err: any) {
      setAiError(err.message ?? 'Error al generar recetas')
    } finally {
      setAiLoading(false)
    }
  }

  const toggleSaved = (id: string) => {
    const all = store.getRecipes()
    const recipe = all.find(r => r.id === id)
    if (recipe) {
      recipe.saved = !recipe.saved
      store.saveRecipes(all)
      reload()
    }
  }

  const handleDishSearch = async () => {
    if (!dishQuery.trim()) return
    setDishError('')
    setDishLoading(true)
    setDishResult(null)
    try {
      const profile = store.getProfile()
      const result = await analyzeDishNeeds(dishQuery, profile.cooking_level)
      setDishResult(result)
    } catch (err: any) {
      setDishError(err.message ?? 'Error al analizar el plato')
    } finally {
      setDishLoading(false)
    }
  }

  const matchInventory = (ingredientName: string) => {
    const lower = ingredientName.toLowerCase()
    for (const inv of inventory) {
      if (inv.qty_remaining <= 0) continue
      const product = products.find(p => p.id === inv.product_id)
      if (!product) continue
      const pName = product.name.toLowerCase()
      if (pName.includes(lower) || lower.includes(pName)) {
        return { product, inv }
      }
    }
    return null
  }

  const saveDishAsRecipe = () => {
    if (!dishResult) return
    const recipeIngredients: RecipeIngredient[] = dishResult.ingredients.map(ing => {
      const match = matchInventory(ing.name)
      return {
        id: generateId(),
        recipe_id: '',
        product_id: match?.product.id ?? null,
        ingredient_name: ing.name,
        qty: ing.qty,
        unit: ing.unit,
      }
    })
    const proteinLevel = dishResult.est_protein_g >= 30 ? 'high' : dishResult.est_protein_g >= 15 ? 'med' : 'low'
    store.addRecipe({
      name: dishResult.dish_name,
      meal_type: 'lunch',
      cooking_level: store.getProfile().cooking_level,
      instructions: dishResult.instructions,
      est_calories: dishResult.est_calories,
      est_protein_g: dishResult.est_protein_g || undefined,
      protein_level: proteinLevel,
      prep_minutes: dishResult.prep_minutes,
      servings: dishResult.servings,
      days_covered: 1,
      ai_generated: true,
      saved: false,
      ingredients: recipeIngredients,
    })
    reload()
    setDishResult(null)
    setDishQuery('')
  }

  const mealLabel: Record<string, string> = { lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snack' }
  const proteinLabel: Record<string, string> = { low: 'Baja', med: 'Media', high: 'Alta' }
  const targets = getNutritionTargets(store.getProfile())

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="text-primary" size={24} />
          <h1 className="text-2xl font-bold">Recetas</h1>
          <Badge className="ml-1">{recipes.length}</Badge>
        </div>
        <Button onClick={() => showForm ? setShowForm(false) : openCreate()} variant={showForm ? 'outline' : 'primary'}>
          {showForm ? <><X size={16} className="mr-1" /> Cancelar</> : <><Plus size={16} className="mr-1" /> Nueva</>}
        </Button>
      </div>

      {/* AI Banner */}
      <Card className="bg-gradient-to-r from-violet-50 to-sky-50 border-violet-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-violet-100 rounded-xl">
            {aiLoading ? <Loader2 className="text-violet-600 animate-spin" size={18} /> : <Sparkles className="text-violet-600" size={18} />}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-violet-800 text-sm">Recetas con IA</h3>
            <p className="text-xs text-violet-600 mt-0.5">
              {!hasGrokKey()
                ? 'La IA no está disponible. Contacta al administrador para configurarla.'
                : inventory.filter(i => i.qty_remaining > 0).length > 0
                  ? `${inventory.filter(i => i.qty_remaining > 0).length} productos disponibles. La IA generará recetas con lo que tienes.`
                  : 'Agrega productos al inventario para que la IA sugiera recetas.'}
            </p>
            {aiError && <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded-lg">{aiError}</p>}

            {hasGrokKey() && inventory.filter(i => i.qty_remaining > 0).length > 0 && (
              <div className="mt-3 space-y-2">
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={aiLoading}
                  onClick={handleGenerateAI}
                >
                  {aiLoading
                    ? <><Loader2 size={14} className="mr-2 animate-spin" /> Generando recetas personalizadas...</>
                    : <><Sparkles size={14} className="mr-2" /> {aiRequest.trim() ? 'Generar con mi pedido' : 'Generar recetas personalizadas'}</>}
                </Button>
                <button
                  type="button"
                  onClick={() => { setShowCustomField(!showCustomField); if (showCustomField) setAiRequest('') }}
                  className="text-[11px] text-violet-500 hover:text-violet-700 cursor-pointer flex items-center gap-1"
                >
                  <Sparkles size={10} />
                  {showCustomField ? 'Cerrar personalización' : '¿Quieres pedir algo específico? (opcional)'}
                </button>
                {showCustomField && (
                  <Input
                    value={aiRequest}
                    onChange={e => setAiRequest(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !aiLoading) handleGenerateAI() }}
                    placeholder='Ej: "algo con el pollo", "antojo tailandés", "bajo en carbohidratos"'
                    className="bg-white/70 border-violet-200 text-sm"
                    autoFocus
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Quiero hacer... */}
      {hasGrokKey() && (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              {dishLoading ? <Loader2 className="text-amber-600 animate-spin" size={18} /> : <Search className="text-amber-600" size={18} />}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 text-sm">¿Quieres hacer un plato?</h3>
              <p className="text-xs text-amber-600 mt-0.5">Dime qué quieres cocinar y te digo qué necesitas. Te mostraré qué ya tienes y qué te falta.</p>
              <div className="mt-3 flex gap-2">
                <Input
                  value={dishQuery}
                  onChange={e => setDishQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !dishLoading) handleDishSearch() }}
                  placeholder='Ej: "risotto", "tacos al pastor", "pasta carbonara"'
                  className="bg-white/70 border-amber-200 text-sm flex-1"
                />
                <Button variant="primary" disabled={dishLoading || !dishQuery.trim()} onClick={handleDishSearch} className="shrink-0">
                  {dishLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </Button>
              </div>
              {dishError && <p className="text-xs text-red-600 mt-2 bg-red-50 px-2 py-1 rounded-lg">{dishError}</p>}
            </div>
          </div>

          {dishResult && (
            <div className="mt-4 pt-4 border-t border-amber-200 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-amber-900">{dishResult.dish_name}</h4>
                <div className="flex gap-2 text-xs text-amber-700">
                  <span className="flex items-center gap-1"><Clock size={12} />{dishResult.prep_minutes}min</span>
                  <span className="flex items-center gap-1"><Users size={12} />{dishResult.servings} porc.</span>
                  {dishResult.est_calories > 0 && <span className="flex items-center gap-1"><Flame size={12} />~{dishResult.est_calories} cal</span>}
                  {dishResult.est_protein_g > 0 && <span className="flex items-center gap-1 font-medium text-rose-600">{dishResult.est_protein_g}g prot</span>}
                </div>
              </div>

              <div className="space-y-1.5">
                {dishResult.ingredients.map((ing, i) => {
                  const match = matchInventory(ing.name)
                  const hasEnough = match ? match.inv.qty_remaining >= ing.qty : false
                  const hasPartial = match && !hasEnough ? match.inv.qty_remaining > 0 : false

                  return (
                    <div key={i} className={`flex justify-between items-center text-sm px-3 py-2 rounded-lg ${hasEnough ? 'bg-emerald-50 border border-emerald-100' : hasPartial ? 'bg-yellow-50 border border-yellow-100' : 'bg-red-50 border border-red-100'}`}>
                      <div className="flex items-center gap-2">
                        {hasEnough ? <PackageCheck size={14} className="text-emerald-600" /> : <ShoppingCart size={14} className={hasPartial ? 'text-yellow-600' : 'text-red-500'} />}
                        <span className={hasEnough ? 'text-emerald-800' : hasPartial ? 'text-yellow-800' : 'text-red-800'}>{ing.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-xs">{ing.qty} {ing.unit}</span>
                        {match && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (tienes {match.inv.qty_remaining}{match.product.base_unit})
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {(() => {
                const needToBuy = dishResult.ingredients.filter(ing => !matchInventory(ing.name) || matchInventory(ing.name)!.inv.qty_remaining < ing.qty)
                const alreadyHave = dishResult.ingredients.filter(ing => { const m = matchInventory(ing.name); return m && m.inv.qty_remaining >= ing.qty })
                return (
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">Ya tienes {alreadyHave.length} ingredientes</span>
                    {needToBuy.length > 0 && <span className="text-red-700 bg-red-50 px-2 py-1 rounded-full">Te faltan {needToBuy.length}</span>}
                  </div>
                )
              })()}

              {dishResult.tips && (
                <p className="text-xs text-amber-700 bg-amber-100/50 px-3 py-2 rounded-lg">💡 {dishResult.tips}</p>
              )}

              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" onClick={saveDishAsRecipe}>
                  <Heart size={14} className="mr-1" /> Guardar como receta
                </Button>
                <Button variant="outline" onClick={() => { setDishResult(null); setDishQuery('') }}>
                  <X size={14} />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle>{editingId ? 'Editar receta' : 'Nueva receta'}</CardTitle></CardHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nombre</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Comida</label>
                <Select value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value as MealType }))} className="mt-1">
                  <option value="lunch">Almuerzo</option><option value="dinner">Cena</option><option value="snack">Snack</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nivel</label>
                <Select value={form.cooking_level} onChange={e => setForm(f => ({ ...f, cooking_level: e.target.value as CookingLevel }))} className="mt-1">
                  <option value="basic">Básico</option><option value="medium">Medio</option><option value="experienced">Experimentado</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Proteína</label>
                <Select value={form.protein_level} onChange={e => setForm(f => ({ ...f, protein_level: e.target.value as 'low' | 'med' | 'high' }))} className="mt-1">
                  <option value="low">Baja</option><option value="med">Media</option><option value="high">Alta</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Minutos</label>
                <Input type="number" value={form.prep_minutes} onChange={e => setForm(f => ({ ...f, prep_minutes: +e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Porciones</label>
                <Input type="number" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: +e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Días que cubre</label>
                <Input type="number" value={form.days_covered} onChange={e => setForm(f => ({ ...f, days_covered: +e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Calorías est.</label>
                <Input type="number" value={form.est_calories || ''} onChange={e => setForm(f => ({ ...f, est_calories: +e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Instrucciones</label>
              <textarea className="flex w-full rounded-xl border border-border bg-white px-3 py-2 text-sm min-h-[80px] mt-1 focus-visible:ring-2 focus-visible:ring-primary/30" value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Ingredientes <span className="text-primary">(busca del inventario)</span></label>
                <Button size="sm" variant="ghost" onClick={() => setIngredients(prev => [...prev, emptyIngredient()])}><Plus size={14} /></Button>
              </div>
              {ingredients.map((ing, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-end">
                  <div className="col-span-5">
                    <IngredientAutocomplete value={ing.name} products={products} inventory={inventory} onChange={(name, pid) => {
                      const copy = [...ingredients]; copy[i] = { ...copy[i], name, product_id: pid ?? copy[i].product_id }; setIngredients(copy)
                    }} />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" placeholder="Cant." value={ing.qty || ''} onChange={e => { const c = [...ingredients]; c[i].qty = +e.target.value; setIngredients(c) }} />
                  </div>
                  <div className="col-span-3">
                    <Select value={ing.unit} onChange={e => { const c = [...ingredients]; c[i].unit = e.target.value; setIngredients(c) }}>
                      <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="unit">und</option>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    {ingredients.length > 1 && (
                      <button onClick={() => setIngredients(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"><Trash2 size={14} /></button>
                    )}
                  </div>
                  {ing.product_id && <div className="col-span-12"><span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={11} /> Vinculado — se descuenta al cocinar</span></div>}
                </div>
              ))}
            </div>

            <Button onClick={handleSave} className="w-full">{editingId ? 'Guardar cambios' : 'Crear receta'}</Button>
          </div>
        </Card>
      )}

      {/* Recipe Cards */}
      {recipes.length === 0 && !showForm ? (
        <Card className="text-center py-12 border-dashed border-2">
          <ChefHat className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="text-muted-foreground">No hay recetas. Crea una o espera la IA.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map(recipe => {
            const cookable = canCook(recipe)
            const missing = getMissing(recipe)
            const isExpanded = expandedId === recipe.id
            const isDeleting = confirmDelete === recipe.id

            return (
              <Card key={recipe.id} className="flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{recipe.name}</h3>
                  <div className="flex items-center gap-1">
                    <Badge>{mealLabel[recipe.meal_type]}</Badge>
                    <button onClick={() => toggleSaved(recipe.id)} className={`p-1 rounded-lg cursor-pointer transition-colors ${recipe.saved ? 'text-red-500 bg-red-50' : 'text-muted-foreground hover:text-red-400 hover:bg-red-50'}`}>
                      <Heart size={13} fill={recipe.saved ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => openEdit(recipe)} className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"><Pencil size={13} /></button>
                    <button onClick={() => setConfirmDelete(recipe.id)} className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 cursor-pointer"><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1"><Clock size={12} />{recipe.prep_minutes}min</span>
                  <span className="flex items-center gap-1"><Flame size={12} />{proteinLabel[recipe.protein_level]}</span>
                  <span className="flex items-center gap-1"><Users size={12} />{recipe.servings}</span>
                </div>

                {/* Expandable details */}
                <button onClick={() => setExpandedId(isExpanded ? null : recipe.id)} className="text-xs text-primary flex items-center gap-1 mb-2 cursor-pointer hover:underline">
                  {isExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                  {isExpanded ? 'Ocultar detalles' : `Ver ${recipe.ingredients.length} ingredientes`}
                </button>

                {isExpanded && (
                  <div className="mb-3 space-y-2">
                    {recipe.chef_note && (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 p-2 rounded-lg">👨‍🍳 {recipe.chef_note}</p>
                    )}
                    {recipe.instructions && (
                      <p className="text-xs text-muted-foreground bg-muted p-2 rounded-lg">{recipe.instructions}</p>
                    )}
                    <div className="space-y-1">
                      {recipe.ingredients.map((ing, idx) => {
                        const missing = isMissing(ing)
                        return (
                          <div key={idx} className={`flex justify-between items-center text-xs px-2 py-1 rounded-lg ${missing ? 'bg-red-50' : 'bg-emerald-50'}`}>
                            <span className="flex items-center gap-1.5">
                              {ing.ingredient_name}
                              {missing && <span className="text-[9px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">te falta</span>}
                            </span>
                            <span className="font-medium">{ing.qty}{ing.unit}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Delete confirm */}
                {isDeleting && (
                  <div className="mb-3 p-3 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-sm text-destructive mb-2">¿Eliminar esta receta?</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(recipe.id)} className="flex-1">Eliminar</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>No</Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto pt-3 border-t border-border space-y-2">
                  {(recipe.est_calories > 0 || proteinOf(recipe) !== null) && (
                    <div className={`grid gap-2 ${proteinOf(recipe) !== null ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {recipe.est_calories > 0 && (
                        <div className="bg-orange-50 rounded-lg px-2 py-1.5 text-center">
                          <p className="text-sm font-bold text-orange-600 leading-none">{recipe.est_calories} kcal</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {targets ? `${Math.round((recipe.est_calories / targets.tdee) * 100)}% de tu día` : 'por porción'}
                          </p>
                        </div>
                      )}
                      {proteinOf(recipe) !== null && (
                        <div className="bg-rose-50 rounded-lg px-2 py-1.5 text-center">
                          <p className="text-sm font-bold text-rose-600 leading-none">{proteinOf(recipe)}g prot</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {targets ? `${Math.round((proteinOf(recipe)! / targets.proteinG) * 100)}% de tu meta` : 'por porción'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Cubre {recipe.days_covered} días</span>
                    {recipe.est_calories > 0 && <span>por porción</span>}
                  </div>
                  {missing.length > 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100">
                      Falta: {missing.map(m => m.ingredient_name).join(', ')} — puedes cocinarla igual si los sustituiste
                    </div>
                  )}
                  {cookedMsg[recipe.id] && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                      {cookedMsg[recipe.id]}
                    </div>
                  )}
                  <Button size="sm" className="w-full" variant={cookable ? 'primary' : 'outline'} onClick={() => markCooked(recipe)}>
                    <CheckCircle size={14} className="mr-1" />
                    {cookable ? 'Cocinado (descontar)' : 'Cociné igual (descontar lo que tengo)'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

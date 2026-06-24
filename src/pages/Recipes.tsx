import { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { generateId } from '@/lib/utils'
import type { Recipe, RecipeIngredient, MealType, CookingLevel, Product, InventoryItem } from '@/types'
import { ChefHat, Plus, Clock, Flame, Users, Sparkles, CheckCircle, Trash2 } from 'lucide-react'

function IngredientAutocomplete({
  value,
  onChange,
  products,
  inventory,
}: {
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
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const availableProducts = products.filter(p => {
    const inv = inventory.find(i => i.product_id === p.id)
    return inv && inv.qty_remaining > 0
  })

  const filtered = search.trim()
    ? availableProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : availableProducts

  const getQty = (productId: string) => {
    const inv = inventory.find(i => i.product_id === productId)
    if (!inv) return ''
    const p = products.find(pr => pr.id === productId)
    const unit = p?.base_unit ?? 'g'
    if (unit === 'g' && inv.qty_remaining >= 1000) return `${(inv.qty_remaining / 1000).toFixed(1)} kg`
    return `${inv.qty_remaining.toFixed(0)} ${unit}`
  }

  return (
    <div ref={ref} className="relative">
      <Input
        value={search}
        onChange={e => {
          setSearch(e.target.value)
          setOpen(true)
          onChange(e.target.value, null)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Escribe para buscar..."
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full flex justify-between items-center px-3 py-2 hover:bg-primary/5 text-left text-sm cursor-pointer"
              onClick={() => {
                setSearch(p.name)
                onChange(p.name, p.id)
                setOpen(false)
              }}
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {getQty(p.id)} disponible
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [showForm, setShowForm] = useState(false)

  const reload = () => {
    setRecipes(store.getRecipes())
    setProducts(store.getProducts())
    setInventory(store.getInventory())
  }

  useEffect(reload, [])

  const [form, setForm] = useState({
    name: '',
    meal_type: 'lunch' as MealType,
    cooking_level: 'basic' as CookingLevel,
    instructions: '',
    est_calories: 0,
    protein_level: 'med' as 'low' | 'med' | 'high',
    prep_minutes: 30,
    servings: 4,
    days_covered: 3,
  })
  const [ingredients, setIngredients] = useState<{ name: string; qty: number; unit: string; product_id: string | null }[]>([
    { name: '', qty: 0, unit: 'g', product_id: null },
  ])

  const handleSave = () => {
    if (!form.name) return
    const recipeIngredients: RecipeIngredient[] = ingredients
      .filter(i => i.name && i.qty > 0)
      .map(i => ({
        id: generateId(),
        recipe_id: '',
        product_id: i.product_id,
        ingredient_name: i.name,
        qty: i.unit === 'kg' ? i.qty * 1000 : i.unit === 'L' ? i.qty * 1000 : i.qty,
        unit: i.unit === 'kg' ? 'g' : i.unit === 'L' ? 'ml' : i.unit,
      }))

    const recipe = store.addRecipe({
      ...form,
      ai_generated: false,
      ingredients: recipeIngredients,
    })

    setRecipes(prev => [...prev, recipe])
    setShowForm(false)
    setForm({ name: '', meal_type: 'lunch', cooking_level: 'basic', instructions: '', est_calories: 0, protein_level: 'med', prep_minutes: 30, servings: 4, days_covered: 3 })
    setIngredients([{ name: '', qty: 0, unit: 'g', product_id: null }])
  }

  const markCooked = (recipe: Recipe) => {
    const inv = store.getInventory()
    for (const ing of recipe.ingredients) {
      if (!ing.product_id) continue
      const item = inv.find(i => i.product_id === ing.product_id)
      if (item) {
        item.qty_remaining = Math.max(0, item.qty_remaining - ing.qty)
      }
    }
    store.saveInventory(inv)
    reload()
  }

  const canCook = (recipe: Recipe) => {
    return recipe.ingredients.every(ing => {
      if (!ing.product_id) return true
      const item = inventory.find(i => i.product_id === ing.product_id)
      return item && item.qty_remaining >= ing.qty
    })
  }

  const getMissingIngredients = (recipe: Recipe) => {
    return recipe.ingredients.filter(ing => {
      if (!ing.product_id) return false
      const item = inventory.find(i => i.product_id === ing.product_id)
      return !item || item.qty_remaining < ing.qty
    })
  }

  const mealLabel: Record<string, string> = { lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snack' }
  const proteinLabel: Record<string, string> = { low: 'Baja', med: 'Media', high: 'Alta' }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="text-primary" size={24} />
          <h1 className="text-2xl font-bold">Recetas</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'primary'}>
          <Plus size={16} className="mr-1" /> {showForm ? 'Cancelar' : 'Nueva receta'}
        </Button>
      </div>

      {/* AI Suggestion Banner */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Sparkles className="text-purple-600" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-purple-800">Recetas sugeridas por IA</h3>
            <p className="text-sm text-purple-600 mt-1">
              {inventory.filter(i => i.qty_remaining > 0).length > 0
                ? `Tienes ${inventory.filter(i => i.qty_remaining > 0).length} productos en inventario. Cuando conectes la API de Claude, la IA generará recetas personalizadas con lo que tienes en casa, según tu nivel de cocina y meta nutricional.`
                : 'Registra productos en tu inventario para que la IA pueda sugerirte recetas con lo que tienes.'}
            </p>
            <Button size="sm" variant="outline" className="mt-3 border-purple-300 text-purple-700" disabled>
              <Sparkles size={14} className="mr-1" /> Generar recetas con IA (próximamente)
            </Button>
          </div>
        </div>
      </Card>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nueva receta</CardTitle></CardHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Comida</label>
                <Select value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value as MealType }))} className="mt-1">
                  <option value="lunch">Almuerzo</option>
                  <option value="dinner">Cena</option>
                  <option value="snack">Snack</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nivel</label>
                <Select value={form.cooking_level} onChange={e => setForm(f => ({ ...f, cooking_level: e.target.value as CookingLevel }))} className="mt-1">
                  <option value="basic">Básico</option>
                  <option value="medium">Medio</option>
                  <option value="experienced">Experimentado</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Proteína</label>
                <Select value={form.protein_level} onChange={e => setForm(f => ({ ...f, protein_level: e.target.value as 'low' | 'med' | 'high' }))} className="mt-1">
                  <option value="low">Baja</option>
                  <option value="med">Media</option>
                  <option value="high">Alta</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Minutos</label>
                <Input type="number" value={form.prep_minutes} onChange={e => setForm(f => ({ ...f, prep_minutes: +e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Porciones</label>
                <Input type="number" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: +e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Días que cubre</label>
                <Input type="number" value={form.days_covered} onChange={e => setForm(f => ({ ...f, days_covered: +e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Calorías est.</label>
                <Input type="number" value={form.est_calories || ''} onChange={e => setForm(f => ({ ...f, est_calories: +e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Instrucciones</label>
              <textarea
                className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground min-h-[80px] mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={form.instructions}
                onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Ingredientes
                  <span className="text-xs ml-2 text-primary">(escribe para buscar del inventario)</span>
                </label>
                <Button size="sm" variant="ghost" onClick={() => setIngredients(prev => [...prev, { name: '', qty: 0, unit: 'g', product_id: null }])}>
                  <Plus size={14} className="mr-1" /> Agregar
                </Button>
              </div>
              {ingredients.map((ing, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-end">
                  <div className="col-span-5">
                    <IngredientAutocomplete
                      value={ing.name}
                      products={products}
                      inventory={inventory}
                      onChange={(name, productId) => {
                        const copy = [...ingredients]
                        copy[i] = { ...copy[i], name, product_id: productId ?? copy[i].product_id }
                        setIngredients(copy)
                      }}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" placeholder="Cant." value={ing.qty || ''} onChange={e => { const copy = [...ingredients]; copy[i].qty = +e.target.value; setIngredients(copy) }} />
                  </div>
                  <div className="col-span-3">
                    <Select value={ing.unit} onChange={e => { const copy = [...ingredients]; copy[i].unit = e.target.value; setIngredients(copy) }}>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="L">L</option>
                      <option value="unit">unidad</option>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    {ingredients.length > 1 && (
                      <button
                        onClick={() => setIngredients(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  {ing.product_id && (
                    <div className="col-span-12">
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle size={12} /> Vinculado al inventario — se descontará al cocinar
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button onClick={handleSave} className="w-full">Guardar receta</Button>
          </div>
        </Card>
      )}

      {recipes.length === 0 && !showForm ? (
        <Card className="text-center py-12 border-dashed border-2">
          <ChefHat className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="text-muted-foreground">No hay recetas aún. Crea una manualmente o espera la integración con IA.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map(recipe => {
            const cookable = canCook(recipe)
            const missing = getMissingIngredients(recipe)

            return (
              <Card key={recipe.id} className="flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{recipe.name}</h3>
                  <Badge>{mealLabel[recipe.meal_type]}</Badge>
                </div>
                <div className="flex gap-3 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Clock size={14} />{recipe.prep_minutes}min</span>
                  <span className="flex items-center gap-1"><Flame size={14} />{proteinLabel[recipe.protein_level]} prot.</span>
                  <span className="flex items-center gap-1"><Users size={14} />{recipe.servings} porc.</span>
                </div>

                {recipe.instructions && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {recipe.instructions.slice(0, 80)}{recipe.instructions.length > 80 ? '...' : ''}
                  </p>
                )}

                <div className="mt-auto pt-3 border-t border-border space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {recipe.ingredients.length} ingredientes · Cubre {recipe.days_covered} días
                  </div>

                  {missing.length > 0 && (
                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      Falta: {missing.map(m => m.ingredient_name).join(', ')}
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    variant={cookable ? 'primary' : 'outline'}
                    onClick={() => { if (cookable) markCooked(recipe) }}
                    disabled={!cookable}
                  >
                    <CheckCircle size={14} className="mr-1" />
                    {cookable ? 'Marcar cocinado (descuenta inventario)' : 'Ingredientes insuficientes'}
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

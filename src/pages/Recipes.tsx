import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { generateId } from '@/lib/utils'
import type { Recipe, RecipeIngredient, MealType, CookingLevel } from '@/types'
import { ChefHat, Plus, Clock, Flame, Users } from 'lucide-react'

export function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    setRecipes(store.getRecipes())
  }, [])

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
  const [ingredients, setIngredients] = useState<{ name: string; qty: number; unit: string }[]>([
    { name: '', qty: 0, unit: 'g' },
  ])

  const handleSave = () => {
    if (!form.name) return
    const recipeIngredients: RecipeIngredient[] = ingredients
      .filter(i => i.name && i.qty > 0)
      .map(i => ({
        id: generateId(),
        recipe_id: '',
        product_id: null,
        ingredient_name: i.name,
        qty: i.qty,
        unit: i.unit,
      }))

    const recipe = store.addRecipe({
      ...form,
      ai_generated: false,
      ingredients: recipeIngredients,
    })

    setRecipes(prev => [...prev, recipe])
    setShowForm(false)
    setForm({ name: '', meal_type: 'lunch', cooking_level: 'basic', instructions: '', est_calories: 0, protein_level: 'med', prep_minutes: 30, servings: 4, days_covered: 3 })
    setIngredients([{ name: '', qty: 0, unit: 'g' }])
  }

  const mealLabel = { lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snack' }
  const proteinLabel = { low: 'Baja', med: 'Media', high: 'Alta' }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recetas</h1>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'primary'}>
          <Plus size={16} className="mr-1" /> {showForm ? 'Cancelar' : 'Nueva receta'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nueva receta</CardTitle></CardHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Nombre</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Comida</label>
                <Select value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value as MealType }))}>
                  <option value="lunch">Almuerzo</option>
                  <option value="dinner">Cena</option>
                  <option value="snack">Snack</option>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Nivel</label>
                <Select value={form.cooking_level} onChange={e => setForm(f => ({ ...f, cooking_level: e.target.value as CookingLevel }))}>
                  <option value="basic">Básico</option>
                  <option value="medium">Medio</option>
                  <option value="experienced">Experimentado</option>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Proteína</label>
                <Select value={form.protein_level} onChange={e => setForm(f => ({ ...f, protein_level: e.target.value as 'low' | 'med' | 'high' }))}>
                  <option value="low">Baja</option>
                  <option value="med">Media</option>
                  <option value="high">Alta</option>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Minutos</label>
                <Input type="number" value={form.prep_minutes} onChange={e => setForm(f => ({ ...f, prep_minutes: +e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Porciones</label>
                <Input type="number" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: +e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Días que cubre</label>
                <Input type="number" value={form.days_covered} onChange={e => setForm(f => ({ ...f, days_covered: +e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Calorías est.</label>
                <Input type="number" value={form.est_calories || ''} onChange={e => setForm(f => ({ ...f, est_calories: +e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Instrucciones</label>
              <textarea
                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground min-h-[80px]"
                value={form.instructions}
                onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-muted-foreground">Ingredientes</label>
                <Button size="sm" variant="ghost" onClick={() => setIngredients(prev => [...prev, { name: '', qty: 0, unit: 'g' }])}>
                  <Plus size={14} /> Agregar
                </Button>
              </div>
              {ingredients.map((ing, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                  <Input className="col-span-6" placeholder="Ingrediente" value={ing.name} onChange={e => { const copy = [...ingredients]; copy[i].name = e.target.value; setIngredients(copy) }} />
                  <Input className="col-span-3" type="number" value={ing.qty || ''} onChange={e => { const copy = [...ingredients]; copy[i].qty = +e.target.value; setIngredients(copy) }} />
                  <Select className="col-span-3" value={ing.unit} onChange={e => { const copy = [...ingredients]; copy[i].unit = e.target.value; setIngredients(copy) }}>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="unit">unidad</option>
                  </Select>
                </div>
              ))}
            </div>

            <Button onClick={handleSave} className="w-full">Guardar receta</Button>
          </div>
        </Card>
      )}

      {recipes.length === 0 && !showForm ? (
        <Card className="text-center py-12">
          <ChefHat className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="text-muted-foreground">No hay recetas. Crea una o espera la integración con IA.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map(recipe => (
            <Card key={recipe.id} className="flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium">{recipe.name}</h3>
                <Badge>{mealLabel[recipe.meal_type]}</Badge>
              </div>
              <div className="flex gap-3 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><Clock size={14} />{recipe.prep_minutes}min</span>
                <span className="flex items-center gap-1"><Flame size={14} />{proteinLabel[recipe.protein_level]} prot.</span>
                <span className="flex items-center gap-1"><Users size={14} />{recipe.servings} porc.</span>
              </div>
              <p className="text-sm text-muted-foreground flex-1">{recipe.instructions.slice(0, 100)}{recipe.instructions.length > 100 ? '...' : ''}</p>
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {recipe.ingredients.length} ingredientes · Cubre {recipe.days_covered} días
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

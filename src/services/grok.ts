import type { InventoryItem, Product, UserProfile, Recipe, RecipeIngredient } from '@/types'
import { generateId } from '@/lib/utils'

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions'

function getGrokKey(): string {
  return import.meta.env.VITE_GROK_API_KEY ?? ''
}

export function hasGrokKey(): boolean {
  return getGrokKey().length > 0
}

interface GenerateRecipesInput {
  inventory: InventoryItem[]
  products: Product[]
  profile: UserProfile
}

export async function generateRecipes(input: GenerateRecipesInput): Promise<Recipe[]> {
  const apiKey = getGrokKey()
  if (!apiKey) throw new Error('No hay API key de Grok configurada. Contacta al administrador.')

  const availableProducts = input.inventory
    .filter(i => i.qty_remaining > 0)
    .map(i => {
      const product = input.products.find(p => p.id === i.product_id)
      if (!product) return null
      const qty = product.base_unit === 'g' && i.qty_remaining >= 1000
        ? `${(i.qty_remaining / 1000).toFixed(1)} kg`
        : `${i.qty_remaining.toFixed(0)} ${product.base_unit}`
      return { name: product.name, quantity: qty, category: product.category, product_id: product.id }
    })
    .filter(Boolean)

  if (availableProducts.length === 0) throw new Error('No hay productos en inventario para generar recetas.')

  const levelDesc = { basic: 'básico (recetas simples, pocos pasos)', medium: 'medio (puede seguir recetas con algo de técnica)', experienced: 'experimentado (técnicas avanzadas y combinaciones creativas)' }
  const goalDesc = { muscle_gain: 'ganar masa muscular (priorizar proteína)', fat_loss: 'perder grasa (control calórico, más fibra)', maintenance: 'mantenimiento (balance equilibrado)' }

  const prompt = `Eres un chef nutricionista. Genera 3 recetas usando SOLO los ingredientes disponibles del usuario.

INGREDIENTES DISPONIBLES:
${availableProducts.map(p => `- ${p!.name}: ${p!.quantity} (${p!.category})`).join('\n')}

PERFIL DEL USUARIO:
- Nivel de cocina: ${levelDesc[input.profile.cooking_level]}
- Meta corporal: ${goalDesc[input.profile.goal_type]}
- Estilo: meal prep en lote (cocinar una vez, comer varios días)
- Comidas: almuerzo, cena y snacks (sin desayuno)
- Restricciones: ${input.profile.restrictions.length > 0 ? input.profile.restrictions.join(', ') : 'ninguna'}
${input.profile.habits ? `- Hábitos: ${input.profile.habits}` : ''}

REGLAS:
1. SOLO usa ingredientes de la lista. Puedes asumir que hay básicos (sal, aceite, especias).
2. Cada receta debe ser para meal prep (varias porciones).
3. Las cantidades de ingredientes NO deben exceder lo disponible.
4. Ajusta complejidad al nivel de cocina.
5. Prioriza la meta corporal del usuario.

Responde SOLO con un JSON array válido (sin markdown, sin backticks), con este formato exacto:
[
  {
    "name": "Nombre de la receta",
    "meal_type": "lunch|dinner|snack",
    "cooking_level": "basic|medium|experienced",
    "instructions": "Paso 1... Paso 2...",
    "est_calories": 350,
    "protein_level": "low|med|high",
    "prep_minutes": 30,
    "servings": 4,
    "days_covered": 3,
    "ingredients": [
      { "ingredient_name": "Arroz blanco", "qty": 400, "unit": "g", "product_name": "Arroz blanco" }
    ]
  }
]`

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente de cocina. Responde SOLO con JSON válido, sin markdown.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    if (response.status === 401) throw new Error('API key de Grok inválida. Revísala en Ajustes.')
    if (response.status === 429) throw new Error('Límite de uso alcanzado. Intenta en unos minutos.')
    throw new Error(`Error de Grok API: ${response.status} ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content ?? ''

  let parsed: any[]
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('La IA no devolvió un formato válido. Intenta de nuevo.')
  }

  if (!Array.isArray(parsed)) throw new Error('Respuesta inesperada de la IA.')

  return parsed.map((r: any) => {
    const recipeId = generateId()
    const ingredients: RecipeIngredient[] = (r.ingredients ?? []).map((ing: any) => {
      const matchedProduct = availableProducts.find(p => p!.name.toLowerCase() === (ing.product_name ?? ing.ingredient_name ?? '').toLowerCase())
      return {
        id: generateId(),
        recipe_id: recipeId,
        product_id: matchedProduct?.product_id ?? null,
        ingredient_name: ing.ingredient_name ?? ing.product_name ?? 'Ingrediente',
        qty: ing.qty ?? 0,
        unit: ing.unit ?? 'g',
      }
    })

    return {
      id: recipeId,
      name: r.name ?? 'Receta sin nombre',
      meal_type: r.meal_type ?? 'lunch',
      cooking_level: r.cooking_level ?? input.profile.cooking_level,
      instructions: r.instructions ?? '',
      est_calories: r.est_calories ?? 0,
      protein_level: r.protein_level ?? 'med',
      prep_minutes: r.prep_minutes ?? 30,
      servings: r.servings ?? 4,
      days_covered: r.days_covered ?? 3,
      ai_generated: true,
      ingredients,
    }
  })
}

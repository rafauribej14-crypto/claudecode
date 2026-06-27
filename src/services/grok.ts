import type { InventoryItem, Product, UserProfile, Recipe, RecipeIngredient } from '@/types'
import { generateId } from '@/lib/utils'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const TEXT_MODEL = 'llama-3.3-70b-versatile'
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

function getGroqKey(): string {
  return import.meta.env.VITE_GROQ_API_KEY ?? ''
}

export function hasGrokKey(): boolean {
  return getGroqKey().length > 0
}

function cleanJson(content: string): string {
  return content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

async function callGroq(body: object): Promise<string> {
  const apiKey = getGroqKey()
  if (!apiKey) throw new Error('No hay API key de Groq configurada. Contacta al administrador.')

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.text()
    if (response.status === 401) throw new Error('API key de Groq inválida.')
    if (response.status === 429) throw new Error('Límite de uso alcanzado. Intenta en unos minutos.')
    throw new Error(`Error de Groq API: ${response.status} ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ─────────────────────────────────────────────────────────
//  ANÁLISIS DE FACTURA (visión)
// ─────────────────────────────────────────────────────────

export interface ReceiptItem {
  product_name: string
  qty: number
  unit: string
  price_paid: number
  category: string
}

export interface ReceiptResult {
  store: string | null
  total: number | null
  items: ReceiptItem[]
}

export async function analyzeReceipt(imageDataUrl: string): Promise<ReceiptResult> {
  const prompt = `Eres un asistente que lee facturas de supermercado (Panamá). Analiza la imagen y extrae cada producto comprado.

Para cada producto identifica:
- product_name: nombre limpio del producto (en español, sin códigos)
- qty: cantidad numérica (si dice "2 lb" pon 2, si dice "500g" pon 500, si es 1 unidad pon 1)
- unit: una de estas: "g", "kg", "ml", "L", "unit" (lb conviértelo a kg aproximado, oz a g)
- price_paid: precio total pagado por ese producto (solo el número, sin símbolo de moneda)
- category: una de: "proteina", "grano", "lacteo", "fruta", "verdura", "otro"

También identifica:
- store: nombre de la tienda (Super99, El Rey, PriceSmart, Riba Smith, u otro)
- total: total de la factura (solo el número)

Responde SOLO con JSON válido (sin markdown, sin backticks) con este formato exacto:
{
  "store": "Super99",
  "total": 45.30,
  "items": [
    { "product_name": "Pechuga de pollo", "qty": 2, "unit": "kg", "price_paid": 12.50, "category": "proteina" }
  ]
}

Si no puedes leer algún dato, usa null para store/total y omite los items que no entiendas. Nunca inventes productos.`

  const content = await callGroq({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    temperature: 0.2,
  })

  let parsed: any
  try {
    parsed = JSON.parse(cleanJson(content))
  } catch {
    throw new Error('No se pudo leer la factura. Intenta con una foto más clara.')
  }

  const items: ReceiptItem[] = (parsed.items ?? []).map((it: any) => ({
    product_name: it.product_name ?? '',
    qty: Number(it.qty) || 0,
    unit: ['g', 'kg', 'ml', 'L', 'unit'].includes(it.unit) ? it.unit : 'unit',
    price_paid: Number(it.price_paid) || 0,
    category: ['proteina', 'grano', 'lacteo', 'fruta', 'verdura', 'otro'].includes(it.category) ? it.category : 'otro',
  })).filter((it: ReceiptItem) => it.product_name)

  return {
    store: parsed.store ?? null,
    total: parsed.total != null ? Number(parsed.total) : null,
    items,
  }
}

// ─────────────────────────────────────────────────────────
//  GENERACIÓN DE RECETAS (texto)
// ─────────────────────────────────────────────────────────

interface GenerateRecipesInput {
  inventory: InventoryItem[]
  products: Product[]
  profile: UserProfile
  customRequest?: string
}

export async function generateRecipes(input: GenerateRecipesInput): Promise<Recipe[]> {
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

  const customBlock = input.customRequest?.trim()
    ? `\nPETICIÓN ESPECIAL DEL USUARIO (priorízala): "${input.customRequest.trim()}"\n`
    : ''

  const prompt = `Eres un chef nutricionista. Genera 3 recetas usando SOLO los ingredientes disponibles del usuario.

INGREDIENTES DISPONIBLES:
${availableProducts.map(p => `- ${p!.name}: ${p!.quantity} (${p!.category})`).join('\n')}

PERFIL DEL USUARIO:
- Nivel de cocina: ${levelDesc[input.profile.cooking_level]}
- Meta corporal: ${goalDesc[input.profile.goal_type]}
${input.profile.weight_kg > 0 ? `- Peso actual: ${input.profile.weight_kg} kg` : ''}
${input.profile.height_cm > 0 ? `- Altura: ${input.profile.height_cm} cm` : ''}
- Estilo: meal prep en lote (cocinar una vez, comer varios días)
- Comidas: almuerzo, cena y snacks (sin desayuno)
- Restricciones: ${input.profile.restrictions.length > 0 ? input.profile.restrictions.join(', ') : 'ninguna'}
${input.profile.habits ? `- Hábitos: ${input.profile.habits}` : ''}
${input.profile.weight_kg > 0 && input.profile.height_cm > 0 ? '- Usa el peso y la altura para estimar porciones y calorías adecuadas a su meta (más proteína por kg si busca masa muscular, déficit moderado si busca perder grasa).' : ''}
${customBlock}
REGLAS:
1. SOLO usa ingredientes de la lista. Puedes asumir que hay básicos (sal, aceite, especias).
2. Cada receta debe ser para meal prep (varias porciones).
3. Las cantidades de ingredientes NO deben exceder lo disponible.
4. Ajusta complejidad al nivel de cocina.
5. Prioriza la meta corporal del usuario${input.customRequest?.trim() ? ' y especialmente la petición especial' : ''}.

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

  const content = await callGroq({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: 'Eres un asistente de cocina. Responde SOLO con JSON válido, sin markdown.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
  })

  let parsed: any[]
  try {
    parsed = JSON.parse(cleanJson(content))
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

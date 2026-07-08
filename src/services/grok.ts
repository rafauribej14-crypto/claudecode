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

/**
 * Best-effort JSON parse: tries the cleaned string, then falls back to
 * extracting the outermost object/array if the model wrapped it in prose.
 * Returns null if nothing parses.
 */
function extractJson(content: string): any {
  const cleaned = cleanJson(content)
  try { return JSON.parse(cleaned) } catch { /* try harder below */ }
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const start = cleaned.indexOf(open)
    const end = cleaned.lastIndexOf(close)
    if (start !== -1 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { /* ignore */ }
    }
  }
  return null
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

export const STORES_BY_COUNTRY: Record<string, string[]> = {
  PA: ['Super99', 'El Rey', 'PriceSmart', 'Riba Smith', 'Xtra', 'Machetazo'],
  CO: ['Éxito', 'Carulla', 'D1', 'Ara'],
}

export function getCountryStores(country?: string): string[] {
  return STORES_BY_COUNTRY[country ?? 'PA'] ?? STORES_BY_COUNTRY.PA
}

export async function analyzeReceipt(imageDataUrl: string, country?: string): Promise<ReceiptResult> {
  const stores = getCountryStores(country)
  const countryName = country === 'CO' ? 'Colombia' : 'Panamá'
  const prompt = `Eres un asistente que lee facturas de supermercado (${countryName}). Analiza la imagen y extrae cada producto comprado.

Para cada producto identifica:
- product_name: nombre limpio del producto (en español, sin códigos)
- qty: cantidad numérica (si dice "2 lb" pon 2, si dice "500g" pon 500, si es 1 unidad pon 1)
- unit: una de estas: "g", "kg", "ml", "L", "unit" (lb conviértelo a kg aproximado, oz a g)
- price_paid: precio total pagado por ese producto (solo el número, sin símbolo de moneda)
- category: una de: "proteina", "grano", "lacteo", "fruta", "verdura", "otro"

También identifica:
- store: nombre de la tienda (${stores.join(', ')}, u otro)
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
//  ANÁLISIS DE FACTURA DE RESTAURANTE (visión)
// ─────────────────────────────────────────────────────────

export interface RestaurantReceiptResult {
  place: string | null
  total: number | null
  items: string[]
}

export async function analyzeRestaurantReceipt(imageDataUrl: string): Promise<RestaurantReceiptResult> {
  const prompt = `Eres un asistente que lee facturas de restaurantes. Analiza la imagen y extrae:

- place: nombre del restaurante o establecimiento
- total: monto total pagado (solo el número, sin símbolo de moneda)
- items: lista de los platos/bebidas ordenados (nombres limpios en español)

Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "place": "Nombre del restaurante",
  "total": 25.50,
  "items": ["Pollo a la plancha", "Coca Cola", "Ensalada César"]
}

Si no puedes leer algún dato, usa null para place/total y array vacío para items. Nunca inventes.`

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

  return {
    place: parsed.place ?? null,
    total: parsed.total != null ? Number(parsed.total) : null,
    items: Array.isArray(parsed.items) ? parsed.items.filter((i: any) => typeof i === 'string' && i.trim()) : [],
  }
}

// ─────────────────────────────────────────────────────────
//  ASISTENTE POR VOZ — diálogo que ejecuta acciones
// ─────────────────────────────────────────────────────────

export type AssistantAction =
  | { type: 'log_meal'; name: string; calories: number; protein_g: number }
  | { type: 'add_inventory'; name: string; qty: number; unit: string; category: string }
  | { type: 'consume_inventory'; name: string; qty: number; unit: string }

export interface AssistantTurnResult {
  reply: string
  actions: AssistantAction[]
}

export interface AssistantMessage { role: 'user' | 'assistant'; content: string }

export async function assistantTurn(
  history: AssistantMessage[],
  userMessage: string,
  context: { inventory: string[]; consumedKcal: number; targetKcal: number; goal: string },
): Promise<AssistantTurnResult> {
  const systemPrompt = `Eres el asistente de voz de freshapp, una app de cocina, nutrición e inventario. Hablas español, cálido y breve, como un amigo que ayuda. Tu trabajo es entender lo que el usuario dice y, cuando corresponda, EJECUTAR acciones.

CONTEXTO ACTUAL DEL USUARIO:
- Meta: ${context.goal}
- Hoy lleva ${context.consumedKcal} de ${context.targetKcal} kcal
- En su despensa tiene: ${context.inventory.length > 0 ? context.inventory.join(', ') : '(vacía)'}

ACCIONES QUE PUEDES DEVOLVER (en el array "actions"):
1. log_meal — cuando el usuario dice que comió algo. Estima calorías y proteína REALES según los alimentos y cantidades (ej: pechuga pollo ≈31g proteína/100g, arroz cocido ≈2.7g/100g, arepa ≈6g/100g y 220kcal/100g, huevo ≈13g/100g). Nunca inventes números redondos.
   { "type": "log_meal", "name": "Nombre corto", "calories": 480, "protein_g": 18 }
2. add_inventory — cuando dice que compró o tiene algo nuevo. unit: "g", "ml" o "unit" (convierte kg→g, L→ml).
   { "type": "add_inventory", "name": "Arroz", "qty": 1000, "unit": "g", "category": "grano|proteina|lacteo|fruta|verdura|otro" }
3. consume_inventory — cuando usó/gastó algo de la despensa. Usa el nombre tal como aparece en la despensa si coincide.
   { "type": "consume_inventory", "name": "Arroz", "qty": 200, "unit": "g" }

REGLAS:
- Eres un asistente conversacional COMPLETO: además de registrar, RESUELVES DUDAS de nutrición, cocina y de la app. Si te preguntan algo (aunque no haya acción), SIEMPRE responde de forma útil y concreta en "reply".
- Cuando el usuario mencione una comida (aunque sea una pregunta como "¿cuánta proteína tiene un huevo?"), da SIEMPRE un estimado aproximado de calorías y proteína en "reply", con números realistas.
- Si el usuario dice que COMIÓ algo, registra con log_meal Y en "reply" dile el aproximado de kcal y proteína que acabas de registrar.
- Un mismo mensaje puede generar VARIAS acciones (ej: "me comí pollo con arroz y saqué el arroz de la despensa").
- Entiende el español coloquial de Latinoamérica (ej: "un cuarto de pollo" ≈ 250-300g de pollo, "apanado/apando" = empanizado y frito, "presa" = pieza). Nunca respondas que no entendiste sin intentar interpretarlo.
- NO inventes productos que el usuario no mencionó.
- Aunque no haya nada que registrar, NUNCA dejes "reply" vacío ni digas que no entendiste: responde lo mejor que puedas.

Responde SOLO con JSON válido (sin markdown, sin backticks):
{ "reply": "...", "actions": [ ... ] }`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ]

  const content = await callGroq({ model: TEXT_MODEL, messages, temperature: 0.3, response_format: { type: 'json_object' } })

  const parsed = extractJson(content)
  if (!parsed) {
    // The model answered but not as JSON — use its text as a conversational reply
    // instead of a canned "no entendí".
    const text = cleanJson(content)
    return { reply: text || 'No pude procesar eso. ¿Puedes darme un poco más de detalle?', actions: [] }
  }

  const validCat = ['proteina', 'grano', 'lacteo', 'fruta', 'verdura', 'otro']
  const actions: AssistantAction[] = (Array.isArray(parsed.actions) ? parsed.actions : [])
    .map((a: any): AssistantAction | null => {
      if (a.type === 'log_meal') {
        return { type: 'log_meal', name: String(a.name ?? 'Comida'), calories: Math.max(0, Math.round(Number(a.calories) || 0)), protein_g: Math.max(0, Math.round(Number(a.protein_g) || 0)) }
      }
      if (a.type === 'add_inventory') {
        return { type: 'add_inventory', name: String(a.name ?? '').trim(), qty: Number(a.qty) || 1, unit: ['g', 'ml', 'unit'].includes(a.unit) ? a.unit : 'g', category: validCat.includes(a.category) ? a.category : 'otro' }
      }
      if (a.type === 'consume_inventory') {
        return { type: 'consume_inventory', name: String(a.name ?? '').trim(), qty: Number(a.qty) || 0, unit: a.unit ?? 'g' }
      }
      return null
    })
    .filter((a: AssistantAction | null): a is AssistantAction => a !== null && (a.type !== 'add_inventory' || a.name.length > 0))

  return { reply: parsed.reply ?? 'Listo.', actions }
}

export interface QuickMealResult {
  name: string
  calories: number
  protein_g: number
  note: string
}

/**
 * Estimates calories + protein for a free-text meal the user just ate
 * ("me comí una arepa con queso y un jugo"). Grounded in real per-100g values.
 */
export async function analyzeQuickMeal(description: string): Promise<QuickMealResult> {
  const prompt = `El usuario describe algo que acaba de comer. Estima sus calorías y proteína reales.

COMIDA: "${description}"

Calcula sumando el aporte real de cada alimento según su cantidad y datos nutricionales conocidos (ej: pechuga pollo cocida ≈31g proteína/100g y ≈165 kcal/100g, arepa ≈6g/100g y ≈220 kcal/100g, queso ≈25g/100g, huevo ≈13g/100g y ≈155 kcal/100g, arroz cocido ≈2.7g/100g, jugo de fruta ≈0.5g/100g y ≈50 kcal/100g). NUNCA inventes números redondos sin relación con lo que se comió.

Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "name": "Nombre corto y limpio de la comida",
  "calories": 480,
  "protein_g": 22,
  "note": "una frase muy corta y amable, opcional"
}`

  const content = await callGroq({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: 'Eres un nutricionista. Responde SOLO con JSON válido.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  })

  let parsed: any
  try {
    parsed = JSON.parse(cleanJson(content))
  } catch {
    throw new Error('No se pudo estimar la comida. Intenta describirla de otra forma.')
  }

  return {
    name: parsed.name?.trim() || description.slice(0, 40),
    calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
    protein_g: Math.max(0, Math.round(Number(parsed.protein_g) || 0)),
    note: parsed.note ?? '',
  }
}

/**
 * Analyzes a photo of a meal and estimates its nutrition (calories + protein),
 * so the quick-access assistant can log what someone ate from a picture.
 */
export async function analyzeFoodPhoto(imageDataUrl: string): Promise<QuickMealResult> {
  const prompt = `Eres un nutricionista. Mira la foto de comida y estima el aporte nutricional de la porción que se ve.

1. Identifica los alimentos visibles y su cantidad aproximada (porciones típicas).
2. Suma calorías y proteína de forma realista según datos por 100g conocidos (ej: pechuga pollo ≈31g proteína y 165 kcal/100g, arroz cocido ≈2.7g/100g, carne de res ≈26g/100g, frijoles ≈9g/100g, huevo ≈13g/100g).

Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "name": "Nombre corto de lo que se ve en el plato",
  "calories": 620,
  "protein_g": 38,
  "note": "una frase corta y amable describiendo lo que ves"
}

Si la imagen NO muestra comida claramente, pon calories 0, protein_g 0 y explica en note que no reconociste comida.`

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

  const parsed = extractJson(content)
  if (!parsed) throw new Error('No pude analizar la foto. Intenta con una imagen más clara.')

  return {
    name: parsed.name?.trim() || 'Comida',
    calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
    protein_g: Math.max(0, Math.round(Number(parsed.protein_g) || 0)),
    note: parsed.note ?? '',
  }
}

export interface MealNutritionResult {
  est_calories: number
  protein_level: 'low' | 'med' | 'high'
  rating: 'good' | 'neutral' | 'bad'
  verdict: string
}

export async function analyzeMealNutrition(
  description: string,
  goalType: string,
): Promise<MealNutritionResult> {
  const goalDesc: Record<string, string> = {
    muscle_gain: 'ganar masa muscular (necesita alta proteína, calorías moderadas-altas)',
    fat_loss: 'perder grasa (necesita déficit calórico, alta proteína, evitar fritos y excesos)',
    maintenance: 'mantenimiento (balance equilibrado de macros)',
  }

  const prompt = `Eres un nutricionista. Analiza esta comida de restaurante y evalúa si se alinea con la meta del usuario.

COMIDA: "${description}"
META DEL USUARIO: ${goalDesc[goalType] ?? 'mantenimiento'}

Estima:
- est_calories: calorías aproximadas del plato (número entero)
- protein_level: "low" (menos de 15g), "med" (15-30g), "high" (más de 30g)
- rating: "good" si se alinea con la meta, "neutral" si es aceptable, "bad" si va en contra
- verdict: una frase corta y directa (máx 15 palabras) evaluando la comida vs la meta. Sé honesto pero no regañes. Ejemplos: "Buena elección, alta en proteína y baja en grasa", "Demasiados carbohidratos simples para tu meta", "Aceptable, pero podrías pedir sin la salsa cremosa"

Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "est_calories": 450,
  "protein_level": "high",
  "rating": "good",
  "verdict": "Buena elección, alta en proteína"
}`

  const content = await callGroq({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: 'Eres un nutricionista. Responde SOLO con JSON válido.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  })

  let parsed: any
  try {
    parsed = JSON.parse(cleanJson(content))
  } catch {
    return { est_calories: 0, protein_level: 'med', rating: 'neutral', verdict: 'No se pudo analizar' }
  }

  return {
    est_calories: Number(parsed.est_calories) || 0,
    protein_level: ['low', 'med', 'high'].includes(parsed.protein_level) ? parsed.protein_level : 'med',
    rating: ['good', 'neutral', 'bad'].includes(parsed.rating) ? parsed.rating : 'neutral',
    verdict: parsed.verdict ?? '',
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

// ─────────────────────────────────────────────────────────
//  PARSEO DE INVENTARIO EN LENGUAJE NATURAL (texto/voz)
// ─────────────────────────────────────────────────────────

export interface ParsedInventoryItem {
  name: string
  qty: number
  unit: string
  category: string
}

export async function parseInventoryFromText(text: string): Promise<ParsedInventoryItem[]> {
  const prompt = `El usuario describe lo que tiene en su despensa o nevera. Extrae cada producto con su cantidad y unidad.

TEXTO DEL USUARIO: "${text}"

Para cada producto identifica:
- name: nombre limpio del producto en español
- qty: cantidad numérica (si dice "medio litro" pon 500, si dice "2 kilos" pon 2000, si dice "un paquete" pon 1, si no dice cantidad pon 1)
- unit: unidad base. Convierte a: "g" (gramos), "ml" (mililitros), o "unit" (unidades). Si dice kg conviértelo a g (1kg=1000g), si dice litros conviértelo a ml (1L=1000ml), si dice lb conviértelo a g (1lb=454g).
- category: una de: "proteina", "grano", "lacteo", "fruta", "verdura", "otro"

Responde SOLO con un JSON array válido (sin markdown, sin backticks):
[
  { "name": "Arroz blanco", "qty": 2000, "unit": "g", "category": "grano" },
  { "name": "Pechuga de pollo", "qty": 1000, "unit": "g", "category": "proteina" }
]

Si no entiendes algo, ignóralo. No inventes productos que el usuario no mencionó.`

  const content = await callGroq({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: 'Eres un asistente de inventario de cocina. Responde SOLO con JSON válido.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  })

  let parsed: any[]
  try {
    parsed = JSON.parse(cleanJson(content))
  } catch {
    throw new Error('No se pudieron interpretar los productos. Intenta ser más específico.')
  }

  if (!Array.isArray(parsed)) throw new Error('Respuesta inesperada.')

  return parsed
    .filter((it: any) => it.name?.trim())
    .map((it: any) => ({
      name: it.name.trim(),
      qty: Number(it.qty) || 1,
      unit: ['g', 'ml', 'unit'].includes(it.unit) ? it.unit : 'g',
      category: ['proteina', 'grano', 'lacteo', 'fruta', 'verdura', 'otro'].includes(it.category) ? it.category : 'otro',
    }))
}

// ─────────────────────────────────────────────────────────
//  PLAN DE COMPRA — dónde comprar más barato
// ─────────────────────────────────────────────────────────

export interface ShoppingNeedItem {
  name: string
  qty: number
  unit: string
  /** Historial del usuario: mejor precio unitario visto por tienda */
  history: { store: string; unit_price: number; last_seen: string }[]
}

export interface ShoppingPlanItem {
  name: string
  qty: string
  est_price: number
  source: 'historial' | 'estimado'
  note: string
}

export interface ShoppingPlanStore {
  store: string
  items: ShoppingPlanItem[]
  subtotal: number
}

export interface ShoppingPlanResult {
  plan: ShoppingPlanStore[]
  total: number
  fits_budget: boolean
  advice: string
}

export async function recommendWhereToBuy(input: {
  items: ShoppingNeedItem[]
  country?: string
  budget: number
  currency: string
}): Promise<ShoppingPlanResult> {
  const stores = getCountryStores(input.country)
  const countryName = input.country === 'CO' ? 'Colombia' : 'Panamá'

  const itemLines = input.items.map(it => {
    const hist = it.history.length > 0
      ? ` | HISTORIAL DEL USUARIO: ${it.history.map(h => `${h.store}: ${h.unit_price.toFixed(2)}/${it.unit} (visto ${h.last_seen.split('T')[0]})`).join('; ')}`
      : ' | Sin historial — estima según precios típicos del país'
    return `- ${it.name}: necesita ${it.qty} ${it.unit}${hist}`
  }).join('\n')

  const prompt = `Eres un experto en compras de supermercado en ${countryName}. El usuario necesita comprar estos productos y quiere saber DÓNDE comprarlos más barato sin sacrificar calidad.

SUPERMERCADOS DISPONIBLES: ${stores.join(', ')}
PRESUPUESTO DISPONIBLE: ${input.budget.toFixed(2)} ${input.currency}

PRODUCTOS NECESARIOS:
${itemLines}

REGLAS:
1. PRIORIZA el historial de precios del usuario cuando exista — son precios REALES que él pagó (source: "historial").
2. Sin historial, usa tu conocimiento de precios típicos en ${countryName} (source: "estimado"). Ej: en Colombia D1 y Ara son económicos, Carulla es premium; en Panamá Xtra y Machetazo son económicos, Riba Smith es premium.
3. Agrupa por tienda para minimizar el número de tiendas a visitar (máximo 2-3 tiendas). Si la diferencia de precio es pequeña, consolida en una sola tienda.
4. Los precios en ${input.currency}. Sé realista con los precios de ${countryName}.
5. Si el total excede el presupuesto, sugiere en advice qué ajustar (marcas económicas, menos cantidad).
6. En note escribe algo corto y útil (máx 10 palabras). Ej: "Tu mejor precio histórico", "D1 suele tenerlo más barato".

Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "plan": [
    {
      "store": "D1",
      "items": [
        { "name": "Arroz blanco", "qty": "1000 g", "est_price": 4500, "source": "historial", "note": "Tu mejor precio histórico" }
      ],
      "subtotal": 4500
    }
  ],
  "total": 4500,
  "fits_budget": true,
  "advice": "Consejo corto sobre esta compra"
}`

  const content = await callGroq({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: 'Eres un experto en compras y precios de supermercados. Responde SOLO con JSON válido.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  })

  let parsed: any
  try {
    parsed = JSON.parse(cleanJson(content))
  } catch {
    throw new Error('No se pudo generar el plan de compra. Intenta de nuevo.')
  }

  const plan: ShoppingPlanStore[] = (parsed.plan ?? []).map((s: any) => ({
    store: s.store ?? 'Tienda',
    items: (s.items ?? []).map((it: any) => ({
      name: it.name ?? '',
      qty: String(it.qty ?? ''),
      est_price: Number(it.est_price) || 0,
      source: it.source === 'historial' ? 'historial' : 'estimado',
      note: it.note ?? '',
    })).filter((it: ShoppingPlanItem) => it.name),
    subtotal: Number(s.subtotal) || 0,
  }))

  return {
    plan,
    total: Number(parsed.total) || plan.reduce((s, p) => s + p.subtotal, 0),
    fits_budget: Boolean(parsed.fits_budget),
    advice: parsed.advice ?? '',
  }
}

// ─────────────────────────────────────────────────────────
//  "QUIERO HACER X" — análisis de ingredientes necesarios
// ─────────────────────────────────────────────────────────

export interface DishIngredient {
  name: string
  qty: number
  unit: string
}

export interface DishAnalysisResult {
  dish_name: string
  ingredients: DishIngredient[]
  instructions: string
  est_calories: number
  est_protein_g: number
  prep_minutes: number
  servings: number
  tips: string
}

export async function analyzeDishNeeds(dishName: string, cookingLevel: string): Promise<DishAnalysisResult> {
  const levelDesc: Record<string, string> = {
    basic: 'básico (recetas simples)',
    medium: 'medio (algo de técnica)',
    experienced: 'experimentado (técnicas avanzadas)',
  }

  const prompt = `El usuario quiere preparar: "${dishName}"
Nivel de cocina: ${levelDesc[cookingLevel] ?? 'medio'}

Lista TODOS los ingredientes necesarios para preparar este plato (4 porciones).
Incluye cantidades exactas. No incluyas básicos de cocina (sal, pimienta, aceite).

Calcula est_calories y est_protein_g POR PORCIÓN sumando el aporte real de cada ingrediente según su cantidad y datos nutricionales reales conocidos (ej: pechuga de pollo cocida ≈ 31g proteína/100g, arroz cocido ≈ 2.7g/100g, plátano ≈ 1.3g/100g, huevo ≈ 13g/100g, frijoles cocidos ≈ 9g/100g, queso ≈ 25g/100g), luego divide entre las porciones. NUNCA inventes un número genérico — un plato sin proteína animal/vegetal significativa debe reflejar proteína baja real (1-5g), no un valor promedio arbitrario.

Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "dish_name": "Nombre correcto del plato",
  "ingredients": [
    { "name": "Arroz arborio", "qty": 400, "unit": "g" },
    { "name": "Caldo de pollo", "qty": 1000, "unit": "ml" }
  ],
  "instructions": "Paso 1... Paso 2...",
  "est_calories": 450,
  "est_protein_g": 12,
  "prep_minutes": 35,
  "servings": 4,
  "tips": "Un consejo útil corto para este plato"
}`

  const content = await callGroq({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: 'Eres un chef profesional. Responde SOLO con JSON válido.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
  })

  let parsed: any
  try {
    parsed = JSON.parse(cleanJson(content))
  } catch {
    throw new Error('No se pudo analizar el plato. Intenta con otro nombre.')
  }

  return {
    dish_name: parsed.dish_name ?? dishName,
    ingredients: (parsed.ingredients ?? []).map((i: any) => ({
      name: i.name ?? '',
      qty: Number(i.qty) || 0,
      unit: i.unit ?? 'g',
    })).filter((i: DishIngredient) => i.name),
    instructions: parsed.instructions ?? '',
    est_calories: Number(parsed.est_calories) || 0,
    est_protein_g: Number(parsed.est_protein_g) || 0,
    prep_minutes: Number(parsed.prep_minutes) || 30,
    servings: Number(parsed.servings) || 4,
    tips: parsed.tips ?? '',
  }
}

// ─────────────────────────────────────────────────────────
//  GENERACIÓN DE RECETAS (texto)
// ─────────────────────────────────────────────────────────

function buildNutritionBlock(profile: UserProfile): string {
  const { weight_kg, height_cm, goal_type } = profile
  if (weight_kg <= 0 || height_cm <= 0) return ''

  const bmi = weight_kg / ((height_cm / 100) ** 2)
  const bmiCategory = bmi < 18.5 ? 'bajo peso' : bmi < 25 ? 'peso normal' : bmi < 30 ? 'sobrepeso' : 'obesidad'

  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * 30 + 5
  let tdee: number
  let macroGuide: string

  if (goal_type === 'muscle_gain') {
    tdee = Math.round(bmr * 1.55 + 300)
    const proteinG = Math.round(weight_kg * 2)
    const fatG = Math.round(weight_kg * 0.9)
    const carbG = Math.round((tdee - proteinG * 4 - fatG * 9) / 4)
    macroGuide = `Superávit calórico moderado (+300 kcal). Macros objetivo: ~${proteinG}g proteína (2g/kg), ~${fatG}g grasa, ~${carbG}g carbohidratos.`
  } else if (goal_type === 'fat_loss') {
    tdee = Math.round(bmr * 1.4 - 400)
    const proteinG = Math.round(weight_kg * 1.8)
    const fatG = Math.round(weight_kg * 0.7)
    const carbG = Math.round((tdee - proteinG * 4 - fatG * 9) / 4)
    macroGuide = `Déficit calórico moderado (-400 kcal). Macros objetivo: ~${proteinG}g proteína (1.8g/kg para preservar masa), ~${fatG}g grasa, ~${carbG}g carbohidratos. Priorizar fibra y volumen.`
  } else {
    tdee = Math.round(bmr * 1.5)
    const proteinG = Math.round(weight_kg * 1.5)
    const fatG = Math.round(weight_kg * 0.8)
    const carbG = Math.round((tdee - proteinG * 4 - fatG * 9) / 4)
    macroGuide = `Mantenimiento calórico. Macros objetivo: ~${proteinG}g proteína, ~${fatG}g grasa, ~${carbG}g carbohidratos.`
  }

  return `
ANÁLISIS NUTRICIONAL AUTOMÁTICO:
- IMC: ${bmi.toFixed(1)} (${bmiCategory})
- Calorías diarias estimadas: ~${tdee} kcal/día
- ${macroGuide}
- Distribuye las calorías entre las comidas del día (almuerzo ~40%, cena ~35%, snacks ~25%).
- Ajusta las porciones de cada receta para que la suma diaria se acerque a las ${tdee} kcal.`
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

  const nutritionBlock = buildNutritionBlock(input.profile)

  const customBlock = input.customRequest?.trim()
    ? `\nPETICIÓN ESPECIAL DEL USUARIO (priorízala): "${input.customRequest.trim()}"\n`
    : ''

  const systemPrompt = `Eres un chef profesional con formación clásica y criterio culinario real. Recomiendas platos que un cocinero de verdad serviría, no mezclas al azar.

REGLA DE ORO — EL SABOR MANDA:
Cada receta debe ser un PLATO REAL Y RECONOCIBLE, inspirado en la cocina de verdad (tradicional latinoamericana, mediterránea, asiática, etc.) o en técnicas de chefs reales. NUNCA combines ingredientes solo porque están en la despensa. Si dos ingredientes no van bien juntos, NO los juntes. Ejemplos de lo que JAMÁS debes hacer: yogur griego con salsa de jalapeño, atún con leche, banano con pollo. Antes de proponer un plato, pregúntate: "¿un chef serviría esto? ¿yo me lo comería con gusto?". Si la respuesta es no, descártalo.

CÓMO USAR LA DESPENSA:
- La despensa es tu GUÍA de qué priorizar, NO una obligación de usar todo.
- Prioriza platos donde la mayoría de los ingredientes principales ya los tiene el usuario.
- Es preferible una receta rica que use 3 cosas de la despensa, que un engendro que use 6.
- Si un buen plato necesita 1 o 2 ingredientes que el usuario NO tiene (una especia, un vegetal, una salsa base), ESTÁ PERMITIDO incluirlos: márcalos con "have": false. Mejor una receta buena a la que le falte poco, que una asquerosa con todo a la mano.
- Puedes asumir básicos siempre disponibles: sal, pimienta, aceite, ajo, cebolla, especias comunes.

PRINCIPIOS:
- Genera 3 recetas variadas y apetitosas (idealmente 1 almuerzo, 1 cena, 1 snack).
- Adapta la técnica al nivel de cocina del usuario.
- Ajusta porciones y calorías a la meta corporal y los datos del usuario.
- Respeta las restricciones de forma ESTRICTA.
- Instrucciones claras paso a paso.

Responde SOLO con JSON válido, sin markdown.`

  const prompt = `INGREDIENTES DISPONIBLES EN LA DESPENSA:
${availableProducts.map(p => `- ${p!.name}: ${p!.quantity} (${p!.category})`).join('\n')}

PERFIL COMPLETO DEL USUARIO:
- Nombre: ${input.profile.name || 'Usuario'}
- Nivel de cocina: ${levelDesc[input.profile.cooking_level]}
- Meta corporal: ${goalDesc[input.profile.goal_type]}
${input.profile.weight_kg > 0 ? `- Peso actual: ${input.profile.weight_kg} kg` : ''}
${input.profile.height_cm > 0 ? `- Altura: ${input.profile.height_cm} cm` : ''}
- Estilo: meal prep en lote (cocinar una vez, comer varios días)
- Comidas planificadas: almuerzo, cena y snacks (sin desayuno)
- Restricciones: ${input.profile.restrictions.length > 0 ? input.profile.restrictions.join(', ') : 'ninguna'}
${input.profile.habits ? `- Hábitos alimenticios: ${input.profile.habits}` : ''}
${nutritionBlock}
${customBlock}
REGLAS:
1. Cada receta debe ser un PLATO REAL Y APETITOSO (ver regla de oro). El sabor y la coherencia culinaria mandan sobre "usar todo el inventario".
2. Prioriza ingredientes de la despensa, pero puedes incluir 1-2 que falten si el plato lo merece. Marca cada ingrediente con "have": true (lo tiene) o "have": false (le falta). NO abuses de "have": false — máximo 2 por receta.
3. Las cantidades de ingredientes que SÍ tiene no deben exceder lo disponible.
4. Recetas para meal prep (3-4 porciones), adaptadas al nivel de cocina.
5. est_calories y est_protein_g son POR PORCIÓN. Calcúlalos sumando el aporte real de cada ingrediente según su cantidad exacta y datos nutricionales reales conocidos (ej: pechuga de pollo cocida ≈ 31g proteína/100g, arroz cocido ≈ 2.7g proteína/100g, plátano ≈ 1.3g proteína/100g, huevo ≈ 13g/100g, frijoles cocidos ≈ 9g/100g), luego divide entre el número de porciones. NUNCA uses un número genérico o redondo sin relación con los ingredientes reales.
6. Prioriza la meta corporal del usuario en la selección de recetas y porciones.
7. Varía los tipos de comida (no 3 almuerzos iguales).
8. En "chef_note" escribe una frase corta explicando por qué el plato tiene sentido o de qué cocina viene (ej: "Clásico salteado asiático, el jengibre realza el pollo"). Si a la receta le falta algún ingrediente, menciónalo aquí de forma natural.

Responde SOLO con un JSON array válido (sin markdown, sin backticks), con este formato exacto:
[
  {
    "name": "Nombre de la receta",
    "meal_type": "lunch|dinner|snack",
    "cooking_level": "basic|medium|experienced",
    "chef_note": "Por qué este plato tiene sentido; menciona lo que falte si aplica",
    "instructions": "Paso 1... Paso 2...",
    "est_calories": 350,
    "est_protein_g": 32,
    "protein_level": "low|med|high",
    "prep_minutes": 30,
    "servings": 4,
    "days_covered": 3,
    "ingredients": [
      { "ingredient_name": "Arroz blanco", "qty": 400, "unit": "g", "product_name": "Arroz blanco", "have": true }
    ]
  }
]`

  const content = await callGroq({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
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
      // The AI flags whether the user has it; if not flagged, infer from an inventory match.
      const have = ing.have === false ? false : (ing.have === true ? true : !!matchedProduct)
      return {
        id: generateId(),
        recipe_id: recipeId,
        product_id: matchedProduct?.product_id ?? null,
        ingredient_name: ing.ingredient_name ?? ing.product_name ?? 'Ingrediente',
        qty: ing.qty ?? 0,
        unit: ing.unit ?? 'g',
        have,
      }
    })

    return {
      id: recipeId,
      name: r.name ?? 'Receta sin nombre',
      meal_type: r.meal_type ?? 'lunch',
      cooking_level: r.cooking_level ?? input.profile.cooking_level,
      instructions: r.instructions ?? '',
      chef_note: r.chef_note ?? undefined,
      est_calories: r.est_calories ?? 0,
      est_protein_g: Number(r.est_protein_g) || undefined,
      protein_level: r.protein_level ?? 'med',
      prep_minutes: r.prep_minutes ?? 30,
      servings: r.servings ?? 4,
      days_covered: r.days_covered ?? 3,
      ai_generated: true,
      saved: false,
      ingredients,
    }
  })
}

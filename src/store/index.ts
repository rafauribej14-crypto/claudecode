import type {
  UserProfile,
  Product,
  PriceObservation,
  InventoryItem,
  Purchase,
  Recipe,
  MealPlan,
  BasicPantryItem,
  EatingOutEntry,
} from '@/types'
import { generateId } from '@/lib/utils'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data))
}

const USER_ID = 'default-user'

const defaultProfile: UserProfile = {
  id: USER_ID,
  name: '',
  currency: 'USD',
  monthly_budget: 300,
  budget_carryover: 0,
  shopping_frequency: 'weekly',
  goal_type: 'maintenance',
  weight_kg: 0,
  height_cm: 0,
  nutrition_guidance: {},
  cooking_level: 'basic',
  cooking_style: 'meal_prep',
  meals_planned: ['lunch', 'dinner', 'snack'],
  habits: '',
  restrictions: [],
}

export const store = {
  getProfile: (): UserProfile => load('profile', defaultProfile),
  saveProfile: (p: UserProfile) => save('profile', p),

  getProducts: (): Product[] => load('products', []),
  saveProducts: (p: Product[]) => save('products', p),
  addProduct: (p: Omit<Product, 'id'>): Product => {
    const products = store.getProducts()
    const product = { ...p, id: generateId() }
    products.push(product)
    store.saveProducts(products)
    return product
  },
  findOrCreateProduct: (name: string, category: string, unit_type: Product['unit_type'], base_unit: string): Product => {
    const products = store.getProducts()
    const existing = products.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing
    return store.addProduct({ name, category, brand: null, unit_type, base_unit, shelf_life_days: null })
  },

  getPrices: (): PriceObservation[] => load('prices', []),
  savePrices: (p: PriceObservation[]) => save('prices', p),
  addPrice: (p: Omit<PriceObservation, 'id'>) => {
    const prices = store.getPrices()
    prices.push({ ...p, id: generateId() })
    store.savePrices(prices)
  },

  getInventory: (): InventoryItem[] => load('inventory', []),
  saveInventory: (i: InventoryItem[]) => save('inventory', i),
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => {
    const inv = store.getInventory()
    const existing = inv.find(i => i.product_id === item.product_id)
    if (existing) {
      existing.qty_remaining += item.qty_remaining
    } else {
      inv.push({ ...item, id: generateId() })
    }
    store.saveInventory(inv)
  },

  getPurchases: (): Purchase[] => load('purchases', []),
  savePurchases: (p: Purchase[]) => save('purchases', p),
  addPurchase: (p: Omit<Purchase, 'id'>): Purchase => {
    const purchases = store.getPurchases()
    const purchase = { ...p, id: generateId() }
    purchases.push(purchase)
    store.savePurchases(purchases)

    for (const item of p.items) {
      const product = store.getProducts().find(pr => pr.id === item.product_id)
      if (!product) continue

      if (item.price_paid > 0) {
        store.addPrice({
          user_id: USER_ID,
          product_id: item.product_id,
          store: p.store,
          price: item.price_paid,
          package_size: item.qty,
          unit_price: item.price_paid / item.qty,
          source: p.source,
          observed_at: p.purchased_at,
        })
      }

      store.addInventoryItem({
        user_id: USER_ID,
        product_id: item.product_id,
        qty_remaining: item.qty,
        acquired_at: p.purchased_at,
        expiry_estimate: product.shelf_life_days
          ? new Date(Date.now() + product.shelf_life_days * 86400000).toISOString().split('T')[0]
          : null,
      })
    }

    return purchase
  },

  getRecipes: (): Recipe[] => load('recipes', []),
  saveRecipes: (r: Recipe[]) => save('recipes', r),
  addRecipe: (r: Omit<Recipe, 'id'>): Recipe => {
    const recipes = store.getRecipes()
    const recipe = { ...r, id: generateId() }
    recipes.push(recipe)
    store.saveRecipes(recipes)
    return recipe
  },

  getMealPlans: (): MealPlan[] => load('meal_plans', []),
  saveMealPlans: (m: MealPlan[]) => save('meal_plans', m),

  markCooked: (mealPlanId: string) => {
    const plans = store.getMealPlans()
    const plan = plans.find(p => p.id === mealPlanId)
    if (!plan) return
    plan.status = 'cooked'
    store.saveMealPlans(plans)

    const recipes = store.getRecipes()
    const recipe = recipes.find(r => r.id === plan.recipe_id)
    if (!recipe) return

    const inv = store.getInventory()
    for (const ing of recipe.ingredients) {
      if (!ing.product_id) continue
      const invItem = inv.find(i => i.product_id === ing.product_id)
      if (invItem) {
        invItem.qty_remaining = Math.max(0, invItem.qty_remaining - ing.qty)
      }
    }
    store.saveInventory(inv)
  },

  getPantry: (): BasicPantryItem[] => load('pantry', []),
  savePantry: (p: BasicPantryItem[]) => save('pantry', p),

  getEatingOut: (): EatingOutEntry[] => load('eating_out', []),
  saveEatingOut: (e: EatingOutEntry[]) => save('eating_out', e),
  addEatingOut: (e: Omit<EatingOutEntry, 'id'>): EatingOutEntry => {
    const entries = store.getEatingOut()
    const entry = { ...e, id: generateId() }
    entries.push(entry)
    store.saveEatingOut(entries)
    return entry
  },
}

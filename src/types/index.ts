export type Currency = 'USD' | 'COP'
export type ShoppingFrequency = 'weekly' | 'biweekly' | 'monthly'
export type GoalType = 'muscle_gain' | 'fat_loss' | 'maintenance'
export type CookingLevel = 'basic' | 'medium' | 'experienced'
export type MealType = 'lunch' | 'dinner' | 'snack'
export type UnitType = 'mass' | 'volume' | 'count'
export type PriceConfidence = 'confirmed' | 'estimated'
export type PurchaseSource = 'receipt_scan' | 'manual'
export type MealStatus = 'planned' | 'cooked' | 'skipped'

export interface UserProfile {
  id: string
  name: string
  currency: Currency
  monthly_budget: number
  budget_carryover: number
  shopping_frequency: ShoppingFrequency
  goal_type: GoalType
  weight_kg: number
  height_cm: number
  nutrition_guidance: Record<string, string>
  cooking_level: CookingLevel
  cooking_style: string
  meals_planned: MealType[]
  habits: string
  restrictions: string[]
}

export interface Product {
  id: string
  name: string
  category: string
  brand: string | null
  unit_type: UnitType
  base_unit: string
  shelf_life_days: number | null
}

export interface PriceObservation {
  id: string
  user_id: string
  product_id: string
  store: string
  price: number
  package_size: number
  unit_price: number
  source: PurchaseSource | 'research'
  observed_at: string
}

export interface InventoryItem {
  id: string
  user_id: string
  product_id: string
  qty_remaining: number
  acquired_at: string
  expiry_estimate: string | null
  product?: Product
}

export interface Purchase {
  id: string
  user_id: string
  store: string
  total: number
  purchased_at: string
  source: PurchaseSource
  receipt_image_url: string | null
  items: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  product_id: string
  qty: number
  unit: string
  price_paid: number
  product_name?: string
}

export interface Recipe {
  id: string
  name: string
  meal_type: MealType
  cooking_level: CookingLevel
  instructions: string
  est_calories: number
  protein_level: 'low' | 'med' | 'high'
  prep_minutes: number
  servings: number
  days_covered: number
  ai_generated: boolean
  ingredients: RecipeIngredient[]
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  product_id: string | null
  ingredient_name: string
  qty: number
  unit: string
}

export interface MealPlan {
  id: string
  user_id: string
  date: string
  recipe_id: string
  status: MealStatus
  recipe?: Recipe
}

export interface BasicPantryItem {
  id: string
  user_id: string
  product_id: string
  min_level: number
  product?: Product
}

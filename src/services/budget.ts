import { store } from '@/store'
import { formatCurrency } from '@/lib/utils'

interface BudgetCarryoverResult {
  show: boolean
  savings: number
  newBudget: number
  originalBudget: number
  message: string
}

export function checkMonthlyCarryover(): BudgetCarryoverResult {
  const profile = store.getProfile()
  const dismissedKey = 'carryover_dismissed'
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const dismissed = localStorage.getItem(dismissedKey)
  if (dismissed === currentMonth) {
    return { show: false, savings: 0, newBudget: 0, originalBudget: 0, message: '' }
  }

  const purchases = store.getPurchases()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const lastMonthStart = lastMonth.toISOString()
  const lastMonthEndStr = lastMonthEnd.toISOString()

  const lastMonthSpent = purchases
    .filter(p => p.purchased_at >= lastMonthStart && p.purchased_at <= lastMonthEndStr)
    .reduce((sum, p) => sum + p.total, 0)

  if (lastMonthSpent === 0 && profile.budget_carryover === 0) {
    return { show: false, savings: 0, newBudget: 0, originalBudget: 0, message: '' }
  }

  const budget = profile.monthly_budget
  const savings = Math.max(0, budget - lastMonthSpent)

  if (savings <= 0) {
    return { show: false, savings: 0, newBudget: budget, originalBudget: budget, message: '' }
  }

  const newBudget = budget - savings

  return {
    show: true,
    savings,
    newBudget,
    originalBudget: budget,
    message: `El mes pasado ahorraste ${formatCurrency(savings)} de tu presupuesto. Este mes solo necesitas presupuestar ${formatCurrency(newBudget)} de tus ${formatCurrency(budget)} — el resto ya lo tienes cubierto.`,
  }
}

export function dismissCarryover() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  localStorage.setItem('carryover_dismissed', currentMonth)

  const profile = store.getProfile()
  const purchases = store.getPurchases()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const lastMonthSpent = purchases
    .filter(p => p.purchased_at >= lastMonth.toISOString() && p.purchased_at <= lastMonthEnd.toISOString())
    .reduce((sum, p) => sum + p.total, 0)

  const savings = Math.max(0, profile.monthly_budget - lastMonthSpent)
  if (savings > 0) {
    store.saveProfile({ ...profile, budget_carryover: savings })
  }
}

import type { UserProfile } from '@/types'

export interface NutritionTargets {
  bmi: number
  bmiCategory: string
  tdee: number
  proteinG: number
  fatG: number
  carbG: number
  goalLabel: string
}

export function getNutritionTargets(profile: UserProfile): NutritionTargets | null {
  const { weight_kg, height_cm, goal_type } = profile
  if (weight_kg <= 0 || height_cm <= 0) return null

  const bmi = weight_kg / ((height_cm / 100) ** 2)
  const bmiCategory = bmi < 18.5 ? 'bajo peso' : bmi < 25 ? 'peso normal' : bmi < 30 ? 'sobrepeso' : 'obesidad'

  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * 30 + 5
  let tdee: number
  let proteinG: number
  let fatG: number
  let goalLabel: string

  if (goal_type === 'muscle_gain') {
    tdee = Math.round(bmr * 1.55 + 300)
    proteinG = Math.round(weight_kg * 2)
    fatG = Math.round(weight_kg * 0.9)
    goalLabel = 'Ganancia muscular'
  } else if (goal_type === 'fat_loss') {
    tdee = Math.round(bmr * 1.4 - 400)
    proteinG = Math.round(weight_kg * 1.8)
    fatG = Math.round(weight_kg * 0.7)
    goalLabel = 'Pérdida de grasa'
  } else {
    tdee = Math.round(bmr * 1.5)
    proteinG = Math.round(weight_kg * 1.5)
    fatG = Math.round(weight_kg * 0.8)
    goalLabel = 'Mantenimiento'
  }

  const carbG = Math.round((tdee - proteinG * 4 - fatG * 9) / 4)

  return { bmi, bmiCategory, tdee, proteinG, fatG, carbG, goalLabel }
}

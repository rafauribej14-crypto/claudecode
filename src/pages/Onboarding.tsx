import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { completeOnboarding } from '@/store/auth'
import type { UserProfile } from '@/types'
import { ArrowRight, ArrowLeft, Check, User, DollarSign, Target, ChefHat } from 'lucide-react'

export function Onboarding({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<UserProfile>({
    id: userId,
    name: '',
    currency: 'USD',
    country: 'PA',
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
  })
  const [newRestriction, setNewRestriction] = useState('')

  const update = (patch: Partial<UserProfile>) => setProfile(prev => ({ ...prev, ...patch }))

  const addRestriction = () => {
    if (!newRestriction.trim()) return
    update({ restrictions: [...profile.restrictions, newRestriction.trim()] })
    setNewRestriction('')
  }

  const finish = () => {
    store.saveProfile(profile)
    completeOnboarding(profile.name)
    onComplete()
  }

  const steps = [
    {
      icon: <User className="text-primary" size={28} />,
      title: '¿Cómo te llamas?',
      subtitle: 'Personalicemos tu experiencia',
      content: (
        <div className="space-y-4">
          <Input
            value={profile.name}
            onChange={e => update({ name: e.target.value })}
            placeholder="Tu nombre"
            className="text-lg h-12"
            autoFocus
          />
        </div>
      ),
      valid: profile.name.trim().length > 0,
    },
    {
      icon: <DollarSign className="text-accent" size={28} />,
      title: 'Tu presupuesto para el mercado',
      subtitle: '¿Cuál es tu presupuesto mensual para el mercado?',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            freshapp te ayuda a planear el mercado, controlar tu inventario en casa y cocinar rico con lo que ya tienes, sin pasarte del presupuesto.
          </p>
          <div>
            <label className="text-sm font-medium text-muted-foreground">¿Dónde vives?</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([
                { value: 'PA', label: 'Panamá', flag: '🇵🇦', currency: 'USD' },
                { value: 'CO', label: 'Colombia', flag: '🇨🇴', currency: 'COP' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ country: opt.value, currency: opt.currency })}
                  className={`flex items-center justify-center gap-2 h-12 rounded-lg border-2 transition-all cursor-pointer text-sm font-medium ${
                    (profile.country ?? 'PA') === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  <span className="text-lg">{opt.flag}</span> {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Define tu moneda y los supermercados que la IA usará para compararte precios</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Presupuesto mensual para el mercado ({profile.currency})</label>
            <Input
              type="number"
              value={profile.monthly_budget || ''}
              onChange={e => update({ monthly_budget: +e.target.value })}
              placeholder="0"
              className="text-lg h-12 mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">¿Cada cuánto haces mercado?</label>
            <Select
              value={profile.shopping_frequency}
              onChange={e => update({ shopping_frequency: e.target.value as UserProfile['shopping_frequency'] })}
              className="h-12 mt-1"
            >
              <option value="weekly">Cada semana</option>
              <option value="biweekly">Cada quincena</option>
              <option value="monthly">Una vez al mes</option>
            </Select>
          </div>
        </div>
      ),
      valid: profile.monthly_budget > 0,
    },
    {
      icon: <Target className="text-primary" size={28} />,
      title: 'Tu meta corporal',
      subtitle: 'Así ajustamos las recomendaciones nutricionales',
      content: (
        <div className="space-y-4">
          {([
            { value: 'muscle_gain', label: 'Ganar masa muscular', emoji: '💪', desc: 'Más proteína, más calorías' },
            { value: 'fat_loss', label: 'Perder grasa', emoji: '🔥', desc: 'Control calórico, más fibra' },
            { value: 'maintenance', label: 'Mantenerme', emoji: '⚖️', desc: 'Balance equilibrado' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ goal_type: opt.value })}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left cursor-pointer ${
                profile.goal_type === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-sm text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Peso actual (kg)</label>
              <Input
                type="number"
                value={profile.weight_kg || ''}
                onChange={e => update({ weight_kg: +e.target.value })}
                placeholder="Ej: 70"
                className="h-12 mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Altura (cm)</label>
              <Input
                type="number"
                value={profile.height_cm || ''}
                onChange={e => update({ height_cm: +e.target.value })}
                placeholder="Ej: 175"
                className="h-12 mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">La IA usa estos datos para ajustar porciones y calorías a tu objetivo.</p>
        </div>
      ),
      valid: true,
    },
    {
      icon: <ChefHat className="text-accent" size={28} />,
      title: 'Tu cocina',
      subtitle: 'Para darte recetas a tu nivel',
      content: (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nivel de cocina</label>
            <Select
              value={profile.cooking_level}
              onChange={e => update({ cooking_level: e.target.value as UserProfile['cooking_level'] })}
              className="h-12 mt-1"
            >
              <option value="basic">Básico — recetas simples y rápidas</option>
              <option value="medium">Medio — me defiendo bien</option>
              <option value="experienced">Experimentado — me gusta innovar</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Restricciones alimenticias</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newRestriction}
                onChange={e => setNewRestriction(e.target.value)}
                placeholder="Ej: sin cerdo, sin gluten"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRestriction())}
              />
              <Button onClick={addRestriction} variant="outline">Agregar</Button>
            </div>
            {profile.restrictions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.restrictions.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm">
                    {r}
                    <button onClick={() => update({ restrictions: profile.restrictions.filter((_, idx) => idx !== i) })} className="ml-1 hover:text-destructive cursor-pointer">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Hábitos (opcional)</label>
            <Input
              value={profile.habits}
              onChange={e => update({ habits: e.target.value })}
              placeholder="Ej: almuerzo fuera entre semana"
              className="mt-1"
            />
          </div>
        </div>
      ),
      valid: true,
    },
  ]

  const current = steps[step]

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50/80 via-background to-amber-50/50">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center mb-2">
          <span className="text-lg font-bold tracking-tight">fresh<span className="text-primary">app</span></span>
        </div>
        <div className="flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i <= step ? 'bg-primary w-8' : 'bg-border w-4'
              }`}
            />
          ))}
        </div>

        <Card className="shadow-lg border-border/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-muted rounded-lg">{current.icon}</div>
            <div>
              <h2 className="text-xl font-bold">{current.title}</h2>
              <p className="text-sm text-muted-foreground">{current.subtitle}</p>
            </div>
          </div>

          {current.content}

          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft size={16} className="mr-1" /> Atrás
              </Button>
            ) : <div />}

            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!current.valid}>
                Siguiente <ArrowRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button onClick={finish}>
                Empezar <Check size={16} className="ml-1" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

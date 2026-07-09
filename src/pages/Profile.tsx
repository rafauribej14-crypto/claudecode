import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { updateUserName } from '@/store/auth'
import { bodyDataValid } from '@/services/nutrition'
import type { UserProfile } from '@/types'
import { Save, ArrowLeft, User, DollarSign, Target, ChefHat } from 'lucide-react'

export function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile>(store.getProfile())
  const [saved, setSaved] = useState(false)
  const [newRestriction, setNewRestriction] = useState('')

  useEffect(() => { setProfile(store.getProfile()) }, [])

  const update = (patch: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...patch }))
    setSaved(false)
  }

  const handleSave = () => {
    if (!bodyDataValid(profile)) return // inline error is already visible
    // If the user typed a restriction but didn't press "Agregar", save it anyway.
    const pending = newRestriction.trim()
    const toSave = pending && !profile.restrictions.includes(pending)
      ? { ...profile, restrictions: [...profile.restrictions, pending] }
      : profile
    if (pending) { setProfile(toSave); setNewRestriction('') }
    store.saveProfile(toSave)
    updateUserName(toSave.name)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addRestriction = () => {
    if (!newRestriction.trim()) return
    update({ restrictions: [...profile.restrictions, newRestriction.trim()] })
    setNewRestriction('')
  }

  return (
    <div className="space-y-6 max-w-2xl pb-20 md:pb-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <User className="text-primary" size={24} />
        <h1 className="text-2xl font-bold">Mi perfil</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User size={16} className="text-muted-foreground" /> Datos personales</CardTitle></CardHeader>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Nombre</label>
          <Input value={profile.name} onChange={e => update({ name: e.target.value })} className="mt-1" />
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign size={16} className="text-muted-foreground" /> Presupuesto y frecuencia</CardTitle></CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">País</label>
            <Select
              value={profile.country ?? (profile.currency === 'COP' ? 'CO' : 'PA')}
              onChange={e => {
                const country = e.target.value as 'PA' | 'CO'
                update({ country, currency: country === 'CO' ? 'COP' : 'USD' })
              }}
              className="mt-1"
            >
              <option value="PA">Panamá 🇵🇦</option>
              <option value="CO">Colombia 🇨🇴</option>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Define los supermercados y la moneda de la app</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Moneda</label>
            <Select value={profile.currency} onChange={e => update({ currency: e.target.value as UserProfile['currency'] })} className="mt-1">
              <option value="USD">Dólar (USD)</option>
              <option value="COP">Peso colombiano (COP)</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Presupuesto mensual para el mercado ({profile.currency})</label>
            <Input type="number" value={profile.monthly_budget || ''} onChange={e => update({ monthly_budget: +e.target.value })} placeholder="0" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Acumulado anterior</label>
            <Input type="number" value={profile.budget_carryover || ''} onChange={e => update({ budget_carryover: +e.target.value })} placeholder="0" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Frecuencia de mercado</label>
            <Select value={profile.shopping_frequency} onChange={e => update({ shopping_frequency: e.target.value as UserProfile['shopping_frequency'] })} className="mt-1">
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Target size={16} className="text-muted-foreground" /> Meta y nutrición</CardTitle></CardHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Meta corporal</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
              {([
                { value: 'muscle_gain', label: 'Aumento', emoji: '💪', desc: 'Más proteína' },
                { value: 'fat_loss', label: 'Definición', emoji: '🔥', desc: 'Control calórico' },
                { value: 'maintenance', label: 'Mantenimiento', emoji: '⚖️', desc: 'Balance' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ goal_type: opt.value })}
                  className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border-2 transition-all cursor-pointer text-center ${
                    profile.goal_type === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Peso actual (kg)</label>
              <Input type="number" min={25} max={350} value={profile.weight_kg || ''} onChange={e => update({ weight_kg: +e.target.value })} placeholder="Ej: 70" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Altura (cm)</label>
              <Input type="number" min={90} max={250} value={profile.height_cm || ''} onChange={e => update({ height_cm: +e.target.value })} placeholder="Ej: 175" className="mt-1" />
            </div>
          </div>
          {!bodyDataValid(profile) && (
            <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">Revisa los datos: peso entre 25 y 350 kg, altura entre 90 y 250 cm (o déjalos vacíos).</p>
          )}
          <p className="text-xs text-muted-foreground">La IA usa estos datos para ajustar porciones y calorías a tu objetivo.</p>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ChefHat size={16} className="text-muted-foreground" /> Cocina, restricciones y hábitos</CardTitle></CardHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nivel de cocina</label>
            <Select value={profile.cooking_level} onChange={e => update({ cooking_level: e.target.value as UserProfile['cooking_level'] })} className="mt-1">
              <option value="basic">Básico</option>
              <option value="medium">Medio</option>
              <option value="experienced">Experimentado</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Hábitos</label>
            <Input value={profile.habits} onChange={e => update({ habits: e.target.value })} placeholder="Ej: almuerzo fuera entre semana" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Restricciones</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newRestriction}
                onChange={e => setNewRestriction(e.target.value)}
                placeholder="Ej: sin cerdo"
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
        </div>
      </Card>

      <Button onClick={handleSave} size="lg" className="w-full">
        <Save size={16} className="mr-2" />
        {saved ? '✓ Guardado' : 'Guardar cambios'}
      </Button>
    </div>
  )
}

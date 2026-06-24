import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import type { UserProfile } from '@/types'

export function Profile() {
  const [profile, setProfile] = useState<UserProfile>(store.getProfile())
  const [saved, setSaved] = useState(false)
  const [newRestriction, setNewRestriction] = useState('')

  useEffect(() => {
    setProfile(store.getProfile())
  }, [])

  const update = (patch: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...patch }))
    setSaved(false)
  }

  const handleSave = () => {
    store.saveProfile(profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addRestriction = () => {
    if (!newRestriction.trim()) return
    update({ restrictions: [...profile.restrictions, newRestriction.trim()] })
    setNewRestriction('')
  }

  const removeRestriction = (idx: number) => {
    update({ restrictions: profile.restrictions.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-6 max-w-2xl pb-20 md:pb-0">
      <h1 className="text-2xl font-bold">Perfil</h1>

      <Card>
        <CardHeader><CardTitle>Información personal</CardTitle></CardHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Nombre</label>
            <Input value={profile.name} onChange={e => update({ name: e.target.value })} placeholder="Tu nombre" />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Presupuesto</CardTitle></CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Presupuesto mensual (USD)</label>
            <Input type="number" value={profile.monthly_budget} onChange={e => update({ monthly_budget: +e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Acumulado anterior</label>
            <Input type="number" value={profile.budget_carryover} onChange={e => update({ budget_carryover: +e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Frecuencia de mercado</label>
            <Select value={profile.shopping_frequency} onChange={e => update({ shopping_frequency: e.target.value as UserProfile['shopping_frequency'] })}>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Meta y nutrición</CardTitle></CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Meta corporal</label>
            <Select value={profile.goal_type} onChange={e => update({ goal_type: e.target.value as UserProfile['goal_type'] })}>
              <option value="muscle_gain">Ganancia de masa</option>
              <option value="fat_loss">Pérdida de grasa</option>
              <option value="maintenance">Mantenimiento</option>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Nivel de cocina</label>
            <Select value={profile.cooking_level} onChange={e => update({ cooking_level: e.target.value as UserProfile['cooking_level'] })}>
              <option value="basic">Básico</option>
              <option value="medium">Medio</option>
              <option value="experienced">Experimentado</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Hábitos y restricciones</CardTitle></CardHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Hábitos alimenticios</label>
            <Input value={profile.habits} onChange={e => update({ habits: e.target.value })} placeholder="Ej: almuerzo fuera entre semana" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Restricciones</label>
            <div className="flex gap-2">
              <Input
                value={newRestriction}
                onChange={e => setNewRestriction(e.target.value)}
                placeholder="Ej: sin cerdo"
                onKeyDown={e => e.key === 'Enter' && addRestriction()}
              />
              <Button onClick={addRestriction} size="sm">Agregar</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.restrictions.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-muted px-3 py-1 rounded-full text-sm">
                  {r}
                  <button onClick={() => removeRestriction(i)} className="text-muted-foreground hover:text-foreground ml-1">&times;</button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} size="lg" className="w-full">
        {saved ? '✓ Guardado' : 'Guardar perfil'}
      </Button>
    </div>
  )
}

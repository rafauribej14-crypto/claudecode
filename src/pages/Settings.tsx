import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { updateUserName, logout } from '@/store/auth'
import type { UserProfile } from '@/types'
import { Settings as SettingsIcon, Save, LogOut, Trash2 } from 'lucide-react'

export function Settings() {
  const [profile, setProfile] = useState<UserProfile>(store.getProfile())
  const [saved, setSaved] = useState(false)
  const [newRestriction, setNewRestriction] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => { setProfile(store.getProfile()) }, [])

  const update = (patch: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...patch }))
    setSaved(false)
  }

  const handleSave = () => {
    store.saveProfile(profile)
    updateUserName(profile.name)
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
        <SettingsIcon className="text-primary" size={24} />
        <h1 className="text-2xl font-bold">Ajustes</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Información personal</CardTitle></CardHeader>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Nombre</label>
          <Input value={profile.name} onChange={e => update({ name: e.target.value })} className="mt-1" />
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Presupuesto y frecuencia</CardTitle></CardHeader>
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
            <label className="text-sm font-medium text-muted-foreground">Presupuesto mensual ({profile.currency})</label>
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
        <CardHeader><CardTitle>Meta y nutrición</CardTitle></CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Meta corporal</label>
            <Select value={profile.goal_type} onChange={e => update({ goal_type: e.target.value as UserProfile['goal_type'] })} className="mt-1">
              <option value="muscle_gain">Ganancia de masa</option>
              <option value="fat_loss">Pérdida de grasa</option>
              <option value="maintenance">Mantenimiento</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nivel de cocina</label>
            <Select value={profile.cooking_level} onChange={e => update({ cooking_level: e.target.value as UserProfile['cooking_level'] })} className="mt-1">
              <option value="basic">Básico</option>
              <option value="medium">Medio</option>
              <option value="experienced">Experimentado</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Peso actual (kg)</label>
            <Input type="number" value={profile.weight_kg || ''} onChange={e => update({ weight_kg: +e.target.value })} placeholder="Ej: 70" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Altura (cm)</label>
            <Input type="number" value={profile.height_cm || ''} onChange={e => update({ height_cm: +e.target.value })} placeholder="Ej: 175" className="mt-1" />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Restricciones y hábitos</CardTitle></CardHeader>
        <div className="space-y-4">
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

      {/* Session & Account */}
      <Card className="border-red-100">
        <CardHeader><CardTitle className="text-red-700">Sesión y cuenta</CardTitle></CardHeader>
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => { logout(); window.location.reload() }}
          >
            <LogOut size={16} className="mr-2" />
            Cerrar sesión
          </Button>

          {!confirmReset ? (
            <Button
              variant="outline"
              className="w-full border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => setConfirmReset(true)}
            >
              <Trash2 size={16} className="mr-2" />
              Reiniciar cuenta (borrar todo)
            </Button>
          ) : (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-2">
              <p className="text-sm text-red-800 font-medium">¿Seguro? Esto borra todo: perfil, inventario, recetas, compras y antojos.</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    localStorage.clear()
                    window.location.reload()
                  }}
                >
                  Sí, borrar todo
                </Button>
                <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

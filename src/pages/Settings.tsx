import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { updateUserName } from '@/store/auth'
import { getGrokKey, setGrokKey, hasGrokKey } from '@/services/grok'
import type { UserProfile } from '@/types'
import { Settings as SettingsIcon, Save, Key, Eye, EyeOff, CheckCircle } from 'lucide-react'

export function Settings() {
  const [profile, setProfile] = useState<UserProfile>(store.getProfile())
  const [saved, setSaved] = useState(false)
  const [newRestriction, setNewRestriction] = useState('')
  const [grokKey, setGrokKeyState] = useState(getGrokKey())
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)

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
            <label className="text-sm font-medium text-muted-foreground">Presupuesto mensual (USD)</label>
            <Input type="number" value={profile.monthly_budget} onChange={e => update({ monthly_budget: +e.target.value })} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Acumulado anterior</label>
            <Input type="number" value={profile.budget_carryover} onChange={e => update({ budget_carryover: +e.target.value })} className="mt-1" />
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

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Key size={18} /> API de Grok (IA)</CardTitle></CardHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Conecta tu API key de Grok para generar recetas con IA basadas en tu inventario.
            Obtén tu key gratis en <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer" className="text-primary underline">console.x.ai</a>
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={grokKey}
                onChange={e => { setGrokKeyState(e.target.value); setKeySaved(false) }}
                placeholder="xai-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setGrokKey(grokKey.trim())
                setKeySaved(true)
                setTimeout(() => setKeySaved(false), 2000)
              }}
            >
              {keySaved ? <CheckCircle size={16} className="text-emerald-600" /> : 'Guardar'}
            </Button>
          </div>
          {hasGrokKey() && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle size={12} /> API key configurada — la IA está lista
            </p>
          )}
        </div>
      </Card>

      <Button onClick={handleSave} size="lg" className="w-full">
        <Save size={16} className="mr-2" />
        {saved ? '✓ Guardado' : 'Guardar cambios'}
      </Button>
    </div>
  )
}

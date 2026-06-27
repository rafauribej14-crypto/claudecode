import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { EatingOutEntry, EatingOutRating, MealType, UserProfile } from '@/types'
import { UtensilsCrossed, Plus, Trash2, X, TrendingUp, Target, ThumbsUp, ThumbsDown, Minus } from 'lucide-react'

const ratingConfig: Record<EatingOutRating, { label: string; emoji: string; color: string; badgeVariant: 'success' | 'warning' | 'destructive' }> = {
  good: { label: 'Alineado con mi meta', emoji: '✅', color: 'text-emerald-700', badgeVariant: 'success' },
  neutral: { label: 'Más o menos', emoji: '😐', color: 'text-amber-700', badgeVariant: 'warning' },
  bad: { label: 'Fuera de mi meta', emoji: '🍔', color: 'text-red-700', badgeVariant: 'destructive' },
}

const goalTips: Record<string, string> = {
  muscle_gain: 'Busca opciones con bastante proteína: pollo, carne, huevos, legumbres. Evita las salsas pesadas.',
  fat_loss: 'Prefiere ensaladas con proteína, evita fritos y porciones grandes de carbohidratos. Pide sin salsas o al lado.',
  maintenance: 'Mantén un balance — una porción de proteína, vegetales y un carbohidrato moderado.',
}

const mealLabel: Record<string, string> = { lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snack' }

export function EatingOut() {
  const [entries, setEntries] = useState<EatingOutEntry[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    place: '',
    description: '',
    amount: 0,
    meal_type: 'lunch' as MealType,
    rating: 'neutral' as EatingOutRating,
    notes: '',
  })

  const reload = () => {
    setEntries(store.getEatingOut())
    setProfile(store.getProfile())
  }
  useEffect(reload, [])

  const handleSave = () => {
    if (!form.place.trim() || form.amount <= 0) return
    store.addEatingOut({
      user_id: 'default-user',
      date: new Date().toISOString(),
      ...form,
    })
    setForm({ place: '', description: '', amount: 0, meal_type: 'lunch', rating: 'neutral', notes: '' })
    setShowForm(false)
    reload()
  }

  const handleDelete = (id: string) => {
    store.saveEatingOut(entries.filter(e => e.id !== id))
    setConfirmDelete(null)
    reload()
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thisMonth = entries.filter(e => e.date >= monthStart)
  const totalThisMonth = thisMonth.reduce((s, e) => s + e.amount, 0)
  const countThisMonth = thisMonth.length

  const goodCount = thisMonth.filter(e => e.rating === 'good').length
  const badCount = thisMonth.filter(e => e.rating === 'bad').length
  const alignmentPct = countThisMonth > 0 ? Math.round((goodCount / countThisMonth) * 100) : 0

  const grocerySpent = store.getPurchases()
    .filter(p => p.purchased_at >= monthStart)
    .reduce((s, p) => s + p.total, 0)

  const totalFood = grocerySpent + totalThisMonth
  const eatingOutPct = totalFood > 0 ? Math.round((totalThisMonth / totalFood) * 100) : 0

  return (
    <div className="space-y-6 max-w-3xl pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="text-primary" size={24} />
          <h1 className="text-2xl font-bold">Comida afuera</h1>
          <Badge className="ml-1">{entries.length}</Badge>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'primary'}>
          {showForm ? <><X size={16} className="mr-1" /> Cancelar</> : <><Plus size={16} className="mr-1" /> Registrar</>}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100">
          <p className="text-[11px] text-muted-foreground mb-1">Gastado este mes</p>
          <p className="text-lg font-bold text-orange-700">{formatCurrency(totalThisMonth)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{countThisMonth} salidas</p>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-white border-violet-100">
          <p className="text-[11px] text-muted-foreground mb-1">% en restaurantes</p>
          <p className="text-lg font-bold text-violet-700">{eatingOutPct}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">del gasto total en comida</p>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <p className="text-[11px] text-muted-foreground mb-1">Alineación con meta</p>
          <p className="text-lg font-bold text-emerald-700">{alignmentPct}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{goodCount} buenas / {badCount} malas</p>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-100">
          <p className="text-[11px] text-muted-foreground mb-1">Mercado vs. afuera</p>
          <p className="text-lg font-bold text-sky-700">{formatCurrency(grocerySpent)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">en mercado este mes</p>
        </Card>
      </div>

      {/* Tip */}
      {profile && goalTips[profile.goal_type] && (
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-xl shrink-0"><Target className="text-primary" size={16} /></div>
            <div>
              <p className="text-sm font-semibold text-primary">Tip para tu meta</p>
              <p className="text-xs text-muted-foreground mt-0.5">{goalTips[profile.goal_type]}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Registrar comida afuera</CardTitle></CardHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Restaurante / lugar</label>
                <Input value={form.place} onChange={e => setForm(f => ({ ...f, place: e.target.value }))} placeholder="Ej: McDonald's, restaurante italiano" className="mt-1" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Monto ({profile?.currency ?? 'USD'})</label>
                <Input type="number" step="0.01" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} placeholder="0" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">¿Qué comiste?</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ej: Pollo a la plancha con ensalada" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo de comida</label>
                <Select value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value as MealType }))} className="mt-1">
                  <option value="lunch">Almuerzo</option>
                  <option value="dinner">Cena</option>
                  <option value="snack">Snack</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">¿Se alineó con tu meta?</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(ratingConfig) as [EatingOutRating, typeof ratingConfig['good']][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, rating: key }))}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all cursor-pointer text-sm font-medium ${
                      form.rating === key ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <span>{cfg.emoji}</span>
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Notas (opcional)</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ej: Era un cumpleaños, valió la pena" className="mt-1" />
            </div>

            <Button onClick={handleSave} className="w-full" disabled={!form.place.trim() || form.amount <= 0}>
              Registrar comida
            </Button>
          </div>
        </Card>
      )}

      {/* Entries */}
      {entries.length === 0 && !showForm ? (
        <Card className="text-center py-12 border-dashed border-2">
          <UtensilsCrossed className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="text-muted-foreground">No hay registros. Agrega tu primera comida afuera.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...entries].reverse().map(entry => {
            const cfg = ratingConfig[entry.rating]
            const isDeleting = confirmDelete === entry.id
            return (
              <Card key={entry.id} className="relative">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{entry.place}</h3>
                      <Badge variant={cfg.badgeVariant}>{cfg.emoji} {cfg.label}</Badge>
                    </div>
                    <p className="text-sm text-foreground">{entry.description || 'Sin descripción'}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{formatDate(entry.date)}</span>
                      <span>{mealLabel[entry.meal_type]}</span>
                      {entry.notes && <span className="italic">"{entry.notes}"</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">{formatCurrency(entry.amount)}</span>
                    <button onClick={() => setConfirmDelete(entry.id)} className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </div>
                {isDeleting && (
                  <div className="mt-3 pt-3 border-t border-border bg-red-50 -mx-4 -mb-4 px-4 py-3 rounded-b-xl">
                    <p className="text-sm text-destructive mb-2">¿Eliminar este registro?</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(entry.id)} className="flex-1">Eliminar</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Monthly insight */}
      {countThisMonth >= 3 && (
        <Card className={`border-2 ${alignmentPct >= 70 ? 'border-emerald-200 bg-emerald-50/50' : alignmentPct >= 40 ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl ${alignmentPct >= 70 ? 'bg-emerald-100' : alignmentPct >= 40 ? 'bg-amber-100' : 'bg-red-100'}`}>
              {alignmentPct >= 70 ? <ThumbsUp size={18} className="text-emerald-600" /> : alignmentPct >= 40 ? <Minus size={18} className="text-amber-600" /> : <ThumbsDown size={18} className="text-red-600" />}
            </div>
            <div>
              <p className="font-semibold text-sm">
                {alignmentPct >= 70
                  ? '¡Vas muy bien comiendo afuera!'
                  : alignmentPct >= 40
                    ? 'Podrías mejorar tus decisiones al comer afuera'
                    : 'La mayoría de tus comidas afuera no se alinean con tu meta'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Este mes has comido afuera {countThisMonth} veces por {formatCurrency(totalThisMonth)}.
                {eatingOutPct > 40 && ' Eso es más del 40% de tu gasto en comida — considera cocinar más en casa.'}
                {eatingOutPct <= 40 && ` Eso es el ${eatingOutPct}% de tu gasto total en comida — buen balance.`}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

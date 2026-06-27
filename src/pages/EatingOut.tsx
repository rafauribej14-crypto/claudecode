import { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { store } from '@/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { analyzeRestaurantReceipt, analyzeMealNutrition, hasGrokKey } from '@/services/grok'
import type { EatingOutEntry, EatingOutRating, MealType, UserProfile } from '@/types'
import { UtensilsCrossed, Plus, Trash2, X, Target, ThumbsUp, ThumbsDown, Minus, Camera, Image, Sparkles, Loader2, Users, Flame, Drumstick } from 'lucide-react'

const ratingConfig: Record<EatingOutRating, { label: string; emoji: string; badgeVariant: 'success' | 'warning' | 'destructive' }> = {
  good: { label: 'Alineado', emoji: '✅', badgeVariant: 'success' },
  neutral: { label: 'Aceptable', emoji: '😐', badgeVariant: 'warning' },
  bad: { label: 'Fuera de meta', emoji: '🍔', badgeVariant: 'destructive' },
}

const proteinLabel: Record<string, string> = { low: 'Baja', med: 'Media', high: 'Alta' }

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
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeMsg, setAnalyzeMsg] = useState('')
  const [analyzeError, setAnalyzeError] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [aiVerdict, setAiVerdict] = useState('')
  const [shared, setShared] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    place: '',
    description: '',
    amount: 0,
    meal_type: 'lunch' as MealType,
    notes: '',
  })

  const reload = () => {
    setEntries(store.getEatingOut())
    setProfile(store.getProfile())
  }
  useEffect(reload, [])

  const resetForm = () => {
    setForm({ place: '', description: '', amount: 0, meal_type: 'lunch', notes: '' })
    setPhotoPreview(null)
    setAnalyzeMsg('')
    setAnalyzeError('')
    setAiVerdict('')
    setShared(false)
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleAnalyze = async () => {
    if (!photoPreview) return
    setAnalyzeError('')
    setAnalyzeMsg('')
    setAnalyzing(true)
    try {
      const result = await analyzeRestaurantReceipt(photoPreview)
      if (result.place) setForm(f => ({ ...f, place: result.place! }))
      if (result.total) setForm(f => ({ ...f, amount: result.total! }))
      if (result.items.length > 0) setForm(f => ({ ...f, description: result.items.join(', ') }))
      setAnalyzeMsg(`✓ ${result.items.length} platos detectados${result.place ? ` en ${result.place}` : ''}. Revisa y confirma.`)
    } catch (err: any) {
      setAnalyzeError(err.message ?? 'Error al analizar la factura')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!form.place.trim() || form.amount <= 0) return
    setSaving(true)
    setAiVerdict('')

    let rating: EatingOutRating = 'neutral'
    let est_calories = 0
    let est_protein = 'med'
    let verdict = ''

    if (form.description.trim() && hasGrokKey() && profile) {
      try {
        const nutrition = await analyzeMealNutrition(form.description, profile.goal_type)
        rating = nutrition.rating
        est_calories = nutrition.est_calories
        est_protein = nutrition.protein_level
        verdict = nutrition.verdict
        setAiVerdict(verdict)
      } catch {
        // silently fallback
      }
    }

    store.addEatingOut({
      user_id: 'default-user',
      date: new Date().toISOString(),
      ...form,
      rating,
      est_calories,
      est_protein,
      shared,
    })

    setSaving(false)

    if (verdict) {
      setTimeout(() => {
        resetForm()
        setShowForm(false)
        reload()
      }, 2500)
    } else {
      resetForm()
      setShowForm(false)
      reload()
    }
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

  const totalCalories = thisMonth.reduce((s, e) => s + (e.est_calories || 0), 0)
  const avgCalories = countThisMonth > 0 ? Math.round(totalCalories / countThisMonth) : 0

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
          <div>
            <h1 className="text-2xl font-bold">Mis antojos</h1>
            <p className="text-xs text-muted-foreground -mt-0.5">Restaurantes, delivery y comida preparada</p>
          </div>
        </div>
        <Button onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }} variant={showForm ? 'outline' : 'primary'}>
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
          <p className="text-[11px] text-muted-foreground mb-1">% en antojos</p>
          <p className="text-lg font-bold text-violet-700">{eatingOutPct}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">del gasto total en comida</p>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <p className="text-[11px] text-muted-foreground mb-1">Alineación con meta</p>
          <p className="text-lg font-bold text-emerald-700">{alignmentPct}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{goodCount} buenas / {badCount} malas</p>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-100">
          <p className="text-[11px] text-muted-foreground mb-1">Promedio por salida</p>
          <p className="text-lg font-bold text-sky-700">{avgCalories > 0 ? `~${avgCalories}` : '—'} cal</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">estimadas por la IA</p>
        </Card>
      </div>

      {/* Tip */}
      {profile && goalTips[profile.goal_type] && (
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-xl shrink-0"><Target className="text-primary" size={16} /></div>
            <div>
              <p className="text-sm font-semibold text-primary">Tip para cuando comas afuera</p>
              <p className="text-xs text-muted-foreground mt-0.5">{goalTips[profile.goal_type]}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Registrar antojo</CardTitle></CardHeader>
          <div className="space-y-4">
            {/* Photo capture */}
            <div className="border-2 border-dashed border-primary/20 rounded-xl p-4 bg-primary/[0.02]">
              <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Camera className="text-primary" size={14} /> Foto de la factura (opcional — la IA llena todo)
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-primary/30 rounded-xl hover:bg-primary/5 transition-all cursor-pointer gap-1">
                  <Camera className="text-primary" size={18} />
                  <span className="text-[9px] text-primary font-medium">Cámara</span>
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-accent/30 rounded-xl hover:bg-accent/5 transition-all cursor-pointer gap-1">
                  <Image className="text-accent" size={18} />
                  <span className="text-[9px] text-accent font-medium">Galería</span>
                </button>
                {photoPreview && (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border shadow-sm">
                    <img src={photoPreview} alt="Factura" className="w-full h-full object-cover" />
                    <button onClick={() => { setPhotoPreview(null); setAnalyzeMsg(''); setAnalyzeError('') }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-destructive cursor-pointer"><X size={10} /></button>
                  </div>
                )}
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />

              {photoPreview && (
                <div className="mt-3 p-3 bg-gradient-to-r from-violet-50 to-sky-50 rounded-xl border border-violet-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="text-violet-600" size={14} />
                      <span className="text-sm font-medium text-violet-800">Leer factura con IA</span>
                    </div>
                    <Button size="sm" onClick={handleAnalyze} disabled={analyzing || !hasGrokKey()} className="bg-violet-600 hover:bg-violet-700 text-white">
                      {analyzing ? <><Loader2 size={14} className="mr-1 animate-spin" /> Analizando...</> : <><Sparkles size={14} className="mr-1" /> Analizar</>}
                    </Button>
                  </div>
                  {analyzeError && <p className="text-xs text-red-600 mt-2 bg-red-50 px-2 py-1 rounded-lg">{analyzeError}</p>}
                  {analyzeMsg && <p className="text-xs text-emerald-700 mt-2 bg-emerald-50 px-2 py-1 rounded-lg">{analyzeMsg}</p>}
                </div>
              )}
            </div>

            {/* Form fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Restaurante / lugar</label>
                <Input value={form.place} onChange={e => setForm(f => ({ ...f, place: e.target.value }))} placeholder="Ej: McDonald's, sushi bar" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Monto ({profile?.currency ?? 'USD'})</label>
                <Input type="number" step="0.01" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} placeholder="0" className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">¿Qué comiste?</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ej: Pollo a la plancha con ensalada y jugo" className="mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">La IA estimará calorías, proteína y si se alinea con tu meta</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo de comida</label>
                <Select value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value as MealType }))} className="mt-1">
                  <option value="lunch">Almuerzo</option>
                  <option value="dinner">Cena</option>
                  <option value="snack">Snack</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notas (opcional)</label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ej: Cumpleaños de un amigo" className="mt-1" />
              </div>
            </div>

            {/* Shared meal */}
            <div className="border border-border rounded-xl p-3 bg-muted/30">
              <button
                type="button"
                onClick={() => setShared(!shared)}
                className={`w-full flex items-center gap-3 text-left cursor-pointer transition-colors rounded-lg p-1 ${shared ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <div className={`p-2 rounded-xl transition-colors ${shared ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Users size={16} className={shared ? 'text-primary' : 'text-muted-foreground'} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">¿Compartiste la cuenta?</p>
                  <p className="text-xs text-muted-foreground">
                    {shared
                      ? 'Solo registraremos lo que comiste tú. Asegúrate de que el monto sea solo tu parte.'
                      : 'Si fuiste con alguien, activa esto para registrar solo tu parte.'}
                  </p>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${shared ? 'bg-primary justify-end' : 'bg-border justify-start'}`}>
                  <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </div>
              </button>
              {shared && (
                <p className="text-[10px] text-primary mt-2 ml-12">Escribe en "¿Qué comiste?" solo lo que pediste tú, y pon solo tu parte del monto.</p>
              )}
            </div>

            {/* AI verdict (shown after save) */}
            {aiVerdict && (
              <div className="p-3 bg-gradient-to-r from-violet-50 to-sky-50 rounded-xl border border-violet-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-violet-600" size={14} />
                  <p className="text-sm font-medium text-violet-800">Veredicto de la IA</p>
                </div>
                <p className="text-sm text-violet-700 mt-1">{aiVerdict}</p>
                <p className="text-[10px] text-violet-500 mt-1">Registrado exitosamente ✓</p>
              </div>
            )}

            <Button onClick={handleSave} className="w-full" disabled={!form.place.trim() || form.amount <= 0 || saving}>
              {saving
                ? <><Loader2 size={14} className="mr-2 animate-spin" /> La IA está analizando tu comida...</>
                : 'Registrar y analizar'}
            </Button>
          </div>
        </Card>
      )}

      {/* Entries */}
      {entries.length === 0 && !showForm ? (
        <Card className="text-center py-12 border-dashed border-2">
          <UtensilsCrossed className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="text-muted-foreground">No hay registros. Agrega tu primer antojo.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...entries].reverse().map(entry => {
            const cfg = ratingConfig[entry.rating]
            const isDeleting = confirmDelete === entry.id
            return (
              <Card key={entry.id} className="relative">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm">{entry.place}</h3>
                      <Badge variant={cfg.badgeVariant}>{cfg.emoji} {cfg.label}</Badge>
                      {entry.shared && <Badge variant="accent"><Users size={10} className="mr-1" /> Compartido</Badge>}
                    </div>
                    <p className="text-sm text-foreground">{entry.description || 'Sin descripción'}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span>{formatDate(entry.date)}</span>
                      <span>{mealLabel[entry.meal_type]}</span>
                      {(entry.est_calories ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5"><Flame size={10} /> ~{entry.est_calories} cal</span>
                      )}
                      {entry.est_protein && (
                        <span className="flex items-center gap-0.5"><Drumstick size={10} /> Proteína {proteinLabel[entry.est_protein] ?? entry.est_protein}</span>
                      )}
                    </div>
                    {entry.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{entry.notes}"</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
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
                  ? '¡Comes bien incluso afuera!'
                  : alignmentPct >= 40
                    ? 'Podrías elegir mejor cuando comes afuera'
                    : 'Tus antojos están afectando tu meta'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Este mes: {countThisMonth} salidas por {formatCurrency(totalThisMonth)}
                {avgCalories > 0 && `, ~${avgCalories} cal promedio`}.
                {eatingOutPct > 40 && ' Más del 40% de tu gasto en comida es afuera — considera cocinar más.'}
                {eatingOutPct <= 40 && ` El ${eatingOutPct}% de tu gasto total — buen balance.`}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

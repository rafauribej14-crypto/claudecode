import { useState, useRef, useEffect } from 'react'
import { store } from '@/store'
import { getNutritionTargets } from '@/services/nutrition'
import { assistantTurn, hasGrokKey, type AssistantAction, type AssistantMessage } from '@/services/grok'
import { Mic, MicOff, Send, X, Sparkles, Loader2, ChefHat } from 'lucide-react'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const GREETING = '¡Hola! Cuéntame qué comiste o qué cambió en tu despensa. Por ejemplo: "me comí pollo con arroz" o "compré 2 kilos de arroz".'

function normalizeToBase(qty: number, unit: string, baseUnit: string): number {
  if ((unit === 'kg' && baseUnit === 'g') || (unit === 'L' && baseUnit === 'ml')) return qty * 1000
  return qty
}

/** Executes the actions returned by the assistant. Returns a short human summary. */
function runActions(actions: AssistantAction[]): void {
  for (const action of actions) {
    if (action.type === 'log_meal') {
      store.addMealLog({
        user_id: 'default-user',
        date: new Date().toISOString().split('T')[0],
        recipe_id: null,
        recipe_name: action.name,
        calories: action.calories,
        protein_g: action.protein_g,
      })
    } else if (action.type === 'add_inventory') {
      const unitType = action.unit === 'ml' ? 'volume' as const : action.unit === 'unit' ? 'count' as const : 'mass' as const
      const product = store.findOrCreateProduct(action.name, action.category, unitType, action.unit)
      store.addInventoryItem({
        user_id: 'default-user',
        product_id: product.id,
        qty_remaining: action.qty,
        acquired_at: new Date().toISOString(),
        expiry_estimate: null,
      })
    } else if (action.type === 'consume_inventory') {
      const inv = store.getInventory()
      const products = store.getProducts()
      const lower = action.name.toLowerCase()
      const item = inv.find(i => {
        if (i.qty_remaining <= 0) return false
        const p = products.find(pr => pr.id === i.product_id)
        if (!p) return false
        const n = p.name.toLowerCase()
        return n.includes(lower) || lower.includes(n)
      })
      if (item) {
        const p = products.find(pr => pr.id === item.product_id)
        const base = p?.base_unit ?? 'g'
        item.qty_remaining = Math.max(0, item.qty_remaining - normalizeToBase(action.qty, action.unit, base))
        store.saveInventory(inv)
      }
    }
  }
  if (actions.length > 0) window.dispatchEvent(new Event('freshapp:data'))
}

export function AssistantChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)

  const recogRef = useRef<any>(null)
  const listeningRef = useRef(false)
  const baseRef = useRef('')
  const finalRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  if (!hasGrokKey()) return null

  // When the user edits the field by hand, re-baseline the voice buffers so
  // deleted text is NOT re-added by the next speech result.
  const onManualEdit = (v: string) => {
    setInput(v)
    baseRef.current = v.trim() ? v.trim() + ' ' : ''
    finalRef.current = ''
  }

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setInput('(Tu navegador no soporta voz — escribe el mensaje)'); return }
    if (listeningRef.current) {
      listeningRef.current = false
      try { recogRef.current?.stop() } catch { /* ignore */ }
      setListening(false)
      return
    }
    const recognition = new SR()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true
    recogRef.current = recognition
    baseRef.current = input.trim() ? input.trim() + ' ' : ''
    finalRef.current = ''
    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) finalRef.current += r[0].transcript + ' '
        else interim += r[0].transcript
      }
      setInput((baseRef.current + finalRef.current + interim).replace(/\s+/g, ' ').trimStart())
    }
    recognition.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        listeningRef.current = false
        setListening(false)
      }
    }
    recognition.onend = () => {
      if (listeningRef.current) { try { recognition.start() } catch { /* ignore */ } }
      else setListening(false)
    }
    try { recognition.start(); listeningRef.current = true; setListening(true) } catch { /* ignore */ }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    if (listeningRef.current) {
      listeningRef.current = false
      try { recogRef.current?.stop() } catch { /* ignore */ }
      setListening(false)
    }
    const userMsg: ChatMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    baseRef.current = ''
    finalRef.current = ''
    setLoading(true)
    try {
      const profile = store.getProfile()
      const products = store.getProducts()
      const inventory = store.getInventory()
      const invNames = inventory
        .filter(i => i.qty_remaining > 0)
        .map(i => products.find(p => p.id === i.product_id)?.name)
        .filter((n): n is string => !!n)
      const targets = getNutritionTargets(profile)
      const today = new Date().toISOString().split('T')[0]
      const consumedKcal = store.getMealLog().filter(m => m.date === today).reduce((s, m) => s + m.calories, 0)
      const goalLabel = { muscle_gain: 'ganar músculo', fat_loss: 'perder grasa', maintenance: 'mantenimiento' }[profile.goal_type] ?? 'mantenimiento'

      const history: AssistantMessage[] = messages.map(m => ({ role: m.role, content: m.content }))
      const result = await assistantTurn(history, text, {
        inventory: invNames,
        consumedKcal,
        targetKcal: targets?.tdee ?? 0,
        goal: goalLabel,
      })
      runActions(result.actions)
      setMessages([...nextMessages, { role: 'assistant', content: result.reply }])
    } catch (err: any) {
      setMessages([...nextMessages, { role: 'assistant', content: err?.message ?? 'Uy, algo falló. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button — chef you can talk to */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-[60] bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          aria-label="Abrir asistente de cocina"
        >
          <ChefHat size={24} />
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow">
            <Mic size={11} className="text-primary" />
          </span>
        </button>
      )}

      {/* Backdrop — tap to close */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[59] bg-black/30 md:bg-transparent"
          aria-hidden
        />
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed z-[60] inset-x-0 bottom-0 md:inset-auto md:bottom-6 md:right-6 md:w-96 bg-white md:rounded-2xl rounded-t-2xl shadow-2xl border border-border flex flex-col max-h-[80vh] md:max-h-[600px] h-[70vh] md:h-[600px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5 md:rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg"><ChefHat className="text-primary" size={16} /></div>
              <span className="font-semibold text-sm">Asistente freshapp</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/70 rounded-full pl-2 pr-2.5 py-1.5 cursor-pointer"
            >
              <X size={16} /> Cerrar
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted px-3 py-2 rounded-2xl rounded-bl-sm">
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleVoice}
                className={`p-2.5 rounded-xl shrink-0 transition-colors cursor-pointer ${listening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                title={listening ? 'Detener' : 'Hablar'}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <input
                value={input}
                onChange={e => onManualEdit(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send() }}
                placeholder={listening ? 'Escuchando...' : 'Escribe o habla...'}
                className="flex-1 h-11 rounded-xl border border-border bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary/30 outline-none"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-primary text-white shrink-0 disabled:opacity-40 cursor-pointer"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

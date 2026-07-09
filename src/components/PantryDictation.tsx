import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { store } from '@/store'
import { parseInventoryFromText, hasGrokKey } from '@/services/grok'
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react'

interface Props {
  /** Called after items are added, with how many and their names. */
  onAdded?: (count: number, names: string[]) => void
  submitLabel?: string
  placeholder?: string
}

const DEFAULT_PLACEHOLDER =
  'Ej: "media bolsa de sal, como 2 kg de costilla y uno de lomo, arroz, aceite y unos huevos"'

/**
 * Voice-or-text pantry capture: the user describes what they already have and
 * the AI parses it into inventory items. Shared by the dashboard, the pantry
 * page and onboarding.
 *
 * Voice fix: when the user edits the text by hand, we re-baseline AND abort the
 * live recognition so a word deleted mid-dictation is NOT re-appended when the
 * browser finalizes it a moment later.
 */
export function PantryDictation({ onAdded, submitLabel = 'Agregar todo al inventario', placeholder = DEFAULT_PLACEHOLDER }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [listening, setListening] = useState(false)

  const recognitionRef = useRef<any>(null)
  const listeningRef = useRef(false)
  const baseRef = useRef('')
  const finalRef = useRef('')

  // Manual edit: re-baseline the buffers, and if the mic is live, abort the
  // current recognition so pending (about-to-finalize) words are discarded.
  const onManualEdit = (v: string) => {
    setText(v)
    baseRef.current = v.trim() ? v.trim() + ' ' : ''
    finalRef.current = ''
    if (listeningRef.current) {
      try { recognitionRef.current?.abort() } catch { /* onend will restart */ }
    }
  }

  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Tu navegador no soporta dictado por voz. Escribe lo que tienes, o usa Chrome.')
      return
    }
    if (listeningRef.current) {
      listeningRef.current = false
      try { recognitionRef.current?.stop() } catch { /* ignore */ }
      setListening(false)
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition

    baseRef.current = text.trim() ? text.trim() + ' ' : ''
    finalRef.current = ''
    setError('')

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (res.isFinal) finalRef.current += res[0].transcript + ' '
        else interim += res[0].transcript
      }
      setText((baseRef.current + finalRef.current + interim).replace(/\s+/g, ' ').trimStart())
    }
    recognition.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        listeningRef.current = false
        setListening(false)
        setError('Permite el acceso al micrófono en tu navegador para poder dictar.')
      }
    }
    recognition.onend = () => {
      if (listeningRef.current) {
        try { recognition.start() } catch { /* already starting */ }
      } else {
        setListening(false)
      }
    }
    try {
      recognition.start()
      listeningRef.current = true
      setListening(true)
    } catch {
      setError('No se pudo iniciar el micrófono. Intenta de nuevo.')
    }
  }

  const handleSubmit = async () => {
    if (!text.trim()) return
    if (listeningRef.current) {
      listeningRef.current = false
      try { recognitionRef.current?.stop() } catch { /* ignore */ }
      setListening(false)
    }
    setLoading(true)
    setError('')
    setResult('')
    try {
      const items = await parseInventoryFromText(text)
      if (items.length === 0) {
        setError('No se detectaron productos. Intenta ser más específico.')
        return
      }
      for (const item of items) {
        const unitType = item.unit === 'ml' ? 'volume' as const : item.unit === 'unit' ? 'count' as const : 'mass' as const
        const product = store.findOrCreateProduct(item.name, item.category, unitType, item.unit)
        store.addInventoryItem({
          user_id: 'default-user',
          product_id: product.id,
          qty_remaining: item.qty,
          acquired_at: new Date().toISOString(),
          expiry_estimate: null,
        })
      }
      setResult(`✓ ${items.length} producto(s) agregado(s): ${items.map(i => i.name).join(', ')}`)
      setText('')
      baseRef.current = ''
      finalRef.current = ''
      window.dispatchEvent(new Event('freshapp:data'))
      onAdded?.(items.length, items.map(i => i.name))
    } catch (err: any) {
      setError(err?.message ?? 'Error al procesar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={text}
          onChange={e => onManualEdit(e.target.value)}
          placeholder={placeholder}
          className="flex w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm min-h-[80px] focus-visible:ring-2 focus-visible:ring-sky-300 pr-12 outline-none"
        />
        <button
          type="button"
          onClick={toggleVoice}
          className={`absolute bottom-2 right-2 p-2 rounded-xl transition-colors cursor-pointer ${listening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-sky-100 text-sky-600 hover:bg-sky-200'}`}
          title={listening ? 'Detener' : 'Dictar por voz'}
        >
          {listening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
      </div>
      {listening && <p className="text-xs text-red-600 flex items-center gap-1"><Mic size={10} className="animate-pulse" /> Escuchando... habla y describe lo que tienes</p>}
      {error && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">{error}</p>}
      {result && <p className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">{result}</p>}
      <Button type="button" onClick={handleSubmit} className="w-full" disabled={!text.trim() || loading || !hasGrokKey()}>
        {loading
          ? <><Loader2 size={14} className="mr-2 animate-spin" /> La IA está procesando...</>
          : <><Sparkles size={14} className="mr-2" /> {submitLabel}</>}
      </Button>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { store } from '@/store'
import { generateId, formatCurrency, formatDate } from '@/lib/utils'
import { analyzeReceipt, hasGrokKey } from '@/services/grok'
import type { PurchaseItem, Purchase } from '@/types'
import { Plus, Trash2, ShoppingBag, Camera, Image, X, History, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react'

interface LineItem {
  tempId: string
  product_name: string
  qty: number
  unit: string
  price_paid: number
  category: string
}

interface StoredPhoto {
  id: string
  dataUrl: string
  name: string
  date: string
  purchaseId?: string
}

const STORES = ['Super99', 'El Rey', 'PriceSmart', 'Riba Smith', 'Otro']

function loadPhotos(): StoredPhoto[] {
  try { return JSON.parse(localStorage.getItem('photos') ?? '[]') } catch { return [] }
}
function savePhotos(photos: StoredPhoto[]) { localStorage.setItem('photos', JSON.stringify(photos)) }

export function Capture() {
  const [selectedStore, setSelectedStore] = useState(STORES[0])
  const [lines, setLines] = useState<LineItem[]>([
    { tempId: generateId(), product_name: '', qty: 0, unit: 'g', price_paid: 0, category: 'otro' },
  ])
  const [submitted, setSubmitted] = useState(false)
  const [sessionPhotos, setSessionPhotos] = useState<{ id: string; dataUrl: string; name: string }[]>([])
  const [allPhotos, setAllPhotos] = useState<StoredPhoto[]>([])
  const [showGallery, setShowGallery] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null)
  const [confirmDeletePurchase, setConfirmDeletePurchase] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [analyzeOk, setAnalyzeOk] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAllPhotos(loadPhotos())
    setPurchases(store.getPurchases())
  }, [])

  const total = lines.reduce((s, l) => s + l.price_paid, 0)

  const updateLine = (id: string, patch: Partial<LineItem>) => {
    setLines(prev => prev.map(l => l.tempId === id ? { ...l, ...patch } : l))
  }

  const addLine = () => {
    setLines(prev => [...prev, { tempId: generateId(), product_name: '', qty: 0, unit: 'g', price_paid: 0, category: 'otro' }])
  }

  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.tempId !== id))

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        setSessionPhotos(prev => [...prev, { id: generateId(), dataUrl, name: file.name }])
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const removeSessionPhoto = (id: string) => setSessionPhotos(prev => prev.filter(p => p.id !== id))

  const analyzeWithAI = async (dataUrl: string) => {
    setAnalyzeError('')
    setAnalyzeOk('')
    setAnalyzing(true)
    try {
      const result = await analyzeReceipt(dataUrl)
      if (result.items.length === 0) {
        setAnalyzeError('No se detectaron productos en la foto. Verifica que sea una factura legible.')
        return
      }
      if (result.store && STORES.includes(result.store)) setSelectedStore(result.store)
      setLines(result.items.map(it => ({
        tempId: generateId(),
        product_name: it.product_name,
        qty: it.qty,
        unit: it.unit,
        price_paid: it.price_paid,
        category: it.category,
      })))
      setAnalyzeOk(`✓ ${result.items.length} productos detectados. Revisa y confirma la compra.`)
    } catch (err: any) {
      setAnalyzeError(err.message ?? 'Error al analizar la factura')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSubmit = () => {
    const validLines = lines.filter(l => l.product_name && l.qty > 0 && l.price_paid > 0)
    if (validLines.length === 0) return

    const purchaseId = generateId()
    const items: PurchaseItem[] = validLines.map(l => {
      const unitType = l.unit === 'ml' || l.unit === 'L' ? 'volume' as const : l.unit === 'unit' ? 'count' as const : 'mass' as const
      const baseUnit = unitType === 'volume' ? 'ml' : unitType === 'count' ? 'unit' : 'g'
      let qty = l.qty
      if (l.unit === 'kg') qty *= 1000
      if (l.unit === 'L') qty *= 1000
      const product = store.findOrCreateProduct(l.product_name, l.category, unitType, baseUnit)
      return { id: generateId(), purchase_id: purchaseId, product_id: product.id, qty, unit: baseUnit, price_paid: l.price_paid, product_name: l.product_name }
    })

    store.addPurchase({
      user_id: 'default-user', store: selectedStore, total, purchased_at: new Date().toISOString(),
      source: sessionPhotos.length > 0 ? 'receipt_scan' : 'manual', receipt_image_url: null, items,
    })

    const storedPhotos = loadPhotos()
    for (const photo of sessionPhotos) {
      storedPhotos.push({ id: photo.id, dataUrl: photo.dataUrl, name: photo.name, date: new Date().toISOString(), purchaseId })
    }
    savePhotos(storedPhotos)
    setAllPhotos(storedPhotos)

    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setLines([{ tempId: generateId(), product_name: '', qty: 0, unit: 'g', price_paid: 0, category: 'otro' }])
      setSessionPhotos([])
      setPurchases(store.getPurchases())
    }, 2000)
  }

  const deletePhoto = (id: string) => {
    const updated = allPhotos.filter(p => p.id !== id)
    savePhotos(updated)
    setAllPhotos(updated)
  }

  const deletePurchase = (id: string) => {
    const updated = store.getPurchases().filter(p => p.id !== id)
    store.savePurchases(updated)
    setPurchases(updated)
    setConfirmDeletePurchase(null)
  }

  const products = store.getProducts()
  const getProductName = (pid: string) => products.find(p => p.id === pid)?.name ?? 'Producto'

  return (
    <div className="space-y-6 max-w-3xl pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Registrar compra</h1>
        <Button size="sm" variant="outline" onClick={() => setShowHistory(!showHistory)}>
          <History size={14} className="mr-1" /> Historial
        </Button>
      </div>

      {/* Photo capture */}
      <Card className="border-dashed border-2 border-primary/20 bg-primary/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><Camera className="text-primary" size={18} /> Fotos</span>
            {allPhotos.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setShowGallery(!showGallery)} className="text-xs">
                {showGallery ? 'Cerrar galería' : `Galería (${allPhotos.length})`}
              </Button>
            )}
          </CardTitle>
        </CardHeader>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-primary/30 rounded-xl hover:bg-primary/5 transition-all cursor-pointer gap-1">
            <Camera className="text-primary" size={22} />
            <span className="text-[10px] text-primary font-medium">Cámara</span>
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-accent/30 rounded-xl hover:bg-accent/5 transition-all cursor-pointer gap-1">
            <Image className="text-accent" size={22} />
            <span className="text-[10px] text-accent font-medium">Galería</span>
          </button>

          {sessionPhotos.map(photo => (
            <div key={photo.id} className="relative w-24 h-24 rounded-xl overflow-hidden border border-border shadow-sm">
              <img src={photo.dataUrl} alt={photo.name} className="w-full h-full object-cover" />
              <button onClick={() => removeSessionPhoto(photo.id)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-destructive transition-colors cursor-pointer"><X size={12} /></button>
            </div>
          ))}
        </div>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhoto} className="hidden" />

        {/* Analizar con IA */}
        {sessionPhotos.length > 0 && (
          <div className="mt-4 p-3 bg-gradient-to-r from-violet-50 to-sky-50 rounded-xl border border-violet-100">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="text-violet-600" size={16} />
                <span className="text-sm font-medium text-violet-800">Leer factura con IA</span>
              </div>
              <Button
                size="sm"
                onClick={() => analyzeWithAI(sessionPhotos[sessionPhotos.length - 1].dataUrl)}
                disabled={analyzing || !hasGrokKey()}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {analyzing
                  ? <><Loader2 size={14} className="mr-1 animate-spin" /> Analizando...</>
                  : <><Sparkles size={14} className="mr-1" /> Analizar y llenar</>}
              </Button>
            </div>
            {!hasGrokKey() && <p className="text-[11px] text-violet-600 mt-2">La IA no está configurada. Contacta al administrador.</p>}
            {analyzeError && <p className="text-xs text-red-600 mt-2 bg-red-50 px-2 py-1 rounded-lg">{analyzeError}</p>}
            {analyzeOk && <p className="text-xs text-emerald-700 mt-2 bg-emerald-50 px-2 py-1 rounded-lg">{analyzeOk}</p>}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-3">
          Toma una foto de tu factura y la IA llenará los productos automáticamente. Las fotos se guardan localmente.
        </p>
      </Card>

      {/* Photo Gallery */}
      {showGallery && allPhotos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Galería de fotos ({allPhotos.length})</CardTitle></CardHeader>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {allPhotos.map(photo => (
              <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden border border-border group">
                <img src={photo.dataUrl} alt={photo.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                  <button onClick={() => deletePhoto(photo.id)} className="opacity-0 group-hover:opacity-100 bg-white text-destructive p-1.5 rounded-full shadow cursor-pointer transition-opacity"><Trash2 size={14} /></button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] px-1 py-0.5 truncate">{formatDate(photo.date)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Store */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Tienda</CardTitle></CardHeader>
        <div className="flex flex-wrap gap-2">
          {STORES.map(s => (
            <button key={s} type="button" onClick={() => setSelectedStore(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer ${selectedStore === s ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground hover:border-primary/30'}`}
            >{s}</button>
          ))}
        </div>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Productos</span>
            <Button onClick={addLine} size="sm" variant="outline"><Plus size={14} className="mr-1" /> Agregar</Button>
          </CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {lines.map(line => (
            <div key={line.tempId} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-xl">
              <div className="col-span-12 sm:col-span-4">
                <label className="text-[10px] text-muted-foreground font-medium">Producto</label>
                <Input value={line.product_name} onChange={e => updateLine(line.tempId, { product_name: e.target.value })} placeholder="Nombre" />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="text-[10px] text-muted-foreground font-medium">Cantidad</label>
                <Input type="number" value={line.qty || ''} onChange={e => updateLine(line.tempId, { qty: +e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="text-[10px] text-muted-foreground font-medium">Unidad</label>
                <Select value={line.unit} onChange={e => updateLine(line.tempId, { unit: e.target.value })}>
                  <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="unit">unidad</option>
                </Select>
              </div>
              <div className="col-span-3 sm:col-span-2">
                <label className="text-[10px] text-muted-foreground font-medium">Precio $</label>
                <Input type="number" step="0.01" value={line.price_paid || ''} onChange={e => updateLine(line.tempId, { price_paid: +e.target.value })} />
              </div>
              <div className="col-span-1 sm:col-span-2 flex items-center gap-1">
                <Select value={line.category} onChange={e => updateLine(line.tempId, { category: e.target.value })} className="hidden sm:flex text-xs">
                  <option value="proteina">Proteína</option><option value="grano">Grano</option><option value="lacteo">Lácteo</option>
                  <option value="fruta">Fruta</option><option value="verdura">Verdura</option><option value="otro">Otro</option>
                </Select>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(line.tempId)} className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Total & Submit */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
        </div>
        <Button onClick={handleSubmit} size="lg" disabled={submitted}>
          <ShoppingBag size={18} className="mr-2" />
          {submitted ? '✓ Registrado' : 'Confirmar compra'}
        </Button>
      </Card>

      {/* Purchase History */}
      {showHistory && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><History size={16} /> Historial de compras</CardTitle></CardHeader>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay compras registradas.</p>
          ) : (
            <div className="space-y-3">
              {[...purchases].reverse().map(purchase => {
                const isExpanded = expandedPurchase === purchase.id
                const isDeleting = confirmDeletePurchase === purchase.id
                return (
                  <div key={purchase.id} className="border border-border rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedPurchase(isExpanded ? null : purchase.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer text-left">
                      <div className="flex items-center gap-3">
                        <Badge variant="accent">{purchase.store}</Badge>
                        <span className="text-sm">{formatDate(purchase.purchased_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{formatCurrency(purchase.total)}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border p-3 bg-muted/20">
                        <div className="space-y-1 mb-3">
                          {purchase.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{item.product_name || getProductName(item.product_id)}</span>
                              <span className="text-muted-foreground">{item.qty}{item.unit} · {formatCurrency(item.price_paid)}</span>
                            </div>
                          ))}
                        </div>

                        {isDeleting ? (
                          <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                            <p className="text-sm text-destructive mb-2">¿Eliminar esta compra? (no revierte el inventario)</p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" onClick={() => deletePurchase(purchase.id)} className="flex-1">Eliminar</Button>
                              <Button size="sm" variant="outline" onClick={() => setConfirmDeletePurchase(null)}>Cancelar</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setConfirmDeletePurchase(purchase.id)} className="w-full text-destructive border-red-200 hover:bg-red-50">
                            <Trash2 size={13} className="mr-1" /> Eliminar compra
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

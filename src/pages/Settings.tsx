import { useState, useRef } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { logout, getCurrentUser, updateUserAvatar, changePassword, hasPassword } from '@/store/auth'
import { cloudEnabled, getLastSyncError } from '@/services/cloudSync'
import { Settings as SettingsIcon, LogOut, Trash2, Cloud, CloudOff, Camera, KeyRound, Check } from 'lucide-react'

/** Downscale an image file to a small square-ish data URL so it fits in localStorage. */
function fileToAvatar(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('image'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('read'))
    reader.readAsDataURL(file)
  })
}

export function Settings() {
  const [user, setUser] = useState(getCurrentUser())
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Password change
  const canChangePassword = hasPassword()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const avatar = await fileToAvatar(file)
      updateUserAvatar(avatar)
      setUser(getCurrentUser())
    } catch { /* ignore bad images */ }
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleChangePassword = () => {
    setPwError('')
    if (newPw !== confirmPw) { setPwError('Las contraseñas nuevas no coinciden'); return }
    const result = changePassword(currentPw, newPw)
    if (!result.ok) { setPwError(result.error); return }
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
    setPwSaved(true)
    setTimeout(() => setPwSaved(false), 2000)
  }

  const initial = (user?.name || user?.username || '?').charAt(0).toUpperCase()

  return (
    <div className="space-y-6 max-w-2xl pb-20 md:pb-0">
      <div className="flex items-center gap-3">
        <SettingsIcon className="text-primary" size={24} />
        <h1 className="text-2xl font-bold">Ajustes</h1>
      </div>

      {/* Profile photo */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Camera size={16} className="text-muted-foreground" /> Foto de perfil</CardTitle></CardHeader>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden shrink-0">
            {user?.avatar
              ? <img src={user.avatar} alt="Foto de perfil" className="w-full h-full object-cover" />
              : <span className="text-xl font-bold text-primary">{initial}</span>}
          </div>
          <div className="space-y-1">
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Camera size={16} className="mr-2" />
              {user?.avatar ? 'Cambiar foto' : 'Subir foto'}
            </Button>
            <p className="text-[11px] text-muted-foreground">JPG o PNG, se ajusta automáticamente.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound size={16} className="text-muted-foreground" /> Contraseña</CardTitle></CardHeader>
        {canChangePassword ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Contraseña actual</label>
              <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••" className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nueva contraseña</label>
                <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mínimo 4 caracteres" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Confirmar nueva</label>
                <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repite la nueva" className="mt-1" />
              </div>
            </div>
            {pwError && <p className="text-sm text-destructive bg-red-50 px-3 py-2 rounded-xl border border-red-100">{pwError}</p>}
            <Button onClick={handleChangePassword} variant="outline" className="w-full" disabled={!currentPw || !newPw || !confirmPw}>
              {pwSaved ? <><Check size={16} className="mr-2" /> Contraseña actualizada</> : 'Actualizar contraseña'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Tu cuenta inicia sesión con Google, por lo que la contraseña se gestiona desde tu cuenta de Google.</p>
        )}
      </Card>

      {/* Cloud sync status (general app setting) */}
      <Card className={cloudEnabled() ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}>
        <div className="flex items-center gap-3">
          {cloudEnabled()
            ? <div className="p-2 bg-emerald-100 rounded-xl"><Cloud className="text-emerald-600" size={18} /></div>
            : <div className="p-2 bg-amber-100 rounded-xl"><CloudOff className="text-amber-600" size={18} /></div>}
          <div>
            <p className="font-semibold text-sm">
              {cloudEnabled() ? 'Sincronización activa' : 'Sincronización inactiva'}
            </p>
            <p className="text-xs text-muted-foreground">
              {cloudEnabled()
                ? 'Tus datos se guardan en la nube y aparecen en cualquier dispositivo con tu cuenta.'
                : 'Tus datos solo están en este dispositivo. Faltan las variables de Supabase en el despliegue.'}
            </p>
            {cloudEnabled() && getLastSyncError() && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1 mt-2">
                Último error: {getLastSyncError()}
              </p>
            )}
          </div>
        </div>
      </Card>

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

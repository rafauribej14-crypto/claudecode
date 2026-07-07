import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login, signup, loginWithGoogle, type AuthUser } from '@/store/auth'
import { ArrowRight } from 'lucide-react'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '910402518107-mu83apdl4il5vvco26n8ugopj1pmsqmc.apps.googleusercontent.com'

export function Login({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [isSignup, setIsSignup] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const initGoogle = () => {
      if (typeof google === 'undefined' || !googleBtnRef.current) return
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          const result = loginWithGoogle(response.credential)
          if (result.ok) onAuth(result.user)
          else setError(result.error)
        },
      })
      google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        shape: 'pill',
        text: 'continue_with',
      })
    }
    const timer = setInterval(() => {
      if (typeof google !== 'undefined') { initGoogle(); clearInterval(timer) }
    }, 100)
    return () => clearInterval(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) { setError('Completa todos los campos'); return }
    if (isSignup && password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    if (isSignup && password.length < 4) { setError('Mínimo 4 caracteres'); return }
    setLoading(true)
    try {
      const result = isSignup
        ? await signup(username.trim(), password)
        : await login(username.trim(), password)
      if (!result.ok) { setError(result.error); return }
      onAuth(result.user)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50/80 via-background to-amber-50/50">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo & Tagline */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img src="/logo.svg" alt="freshapp" className="w-16 h-16 drop-shadow-sm" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              fresh<span className="text-primary">app</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Registra · Crea con IA · Mejora contigo</p>
          </div>
        </div>

        <Card className="shadow-md border-border/60">
          {/* Tab Switch */}
          <div className="flex mb-6 bg-muted rounded-xl p-1">
            <button
              type="button"
              onClick={() => { setIsSignup(false); setError('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${!isSignup ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => { setIsSignup(true); setError('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${isSignup ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Crear cuenta
            </button>
          </div>

          {/* Google Sign-In */}
          <div className="flex justify-center mb-4">
            <div ref={googleBtnRef} />
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">o</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Usuario</label>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="tu_usuario" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Contraseña</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" />
            </div>
            {isSignup && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirmar contraseña</label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••" />
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive bg-red-50 px-3 py-2 rounded-xl border border-red-100">{error}</div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (isSignup ? 'Creando…' : 'Entrando…') : (isSignup ? 'Crear cuenta' : 'Entrar')}
              {!loading && <ArrowRight size={16} />}
            </Button>
          </form>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/60">
          Presupuesto · Nutrición · Inventario · Recetas — todo en un solo lugar
        </p>
      </div>
    </div>
  )
}

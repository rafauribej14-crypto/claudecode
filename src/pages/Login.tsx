import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login, signup, type AuthUser } from '@/store/auth'
import { ArrowRight } from 'lucide-react'

export function Login({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [isSignup, setIsSignup] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) { setError('Completa todos los campos'); return }
    if (isSignup) {
      if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
      if (password.length < 4) { setError('Mínimo 4 caracteres'); return }
      const result = signup(username.trim(), password)
      if (!result.ok) { setError(result.error); return }
      onAuth(result.user)
    } else {
      const result = login(username.trim(), password)
      if (!result.ok) { setError(result.error); return }
      onAuth(result.user)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50/80 via-background to-amber-50/50">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo & Tagline */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img src="/logo.svg" alt="FreshPlan" className="w-16 h-16 drop-shadow-sm" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Fresh<span className="text-primary">Plan</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Planifica, compra y cocina inteligentemente</p>
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
          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-white hover:bg-muted/50 transition-all duration-200 text-sm font-medium text-foreground cursor-pointer mb-4"
            onClick={() => alert('Google Sign-In se activará con Supabase Auth. Por ahora usa usuario/contraseña.')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

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

            <Button type="submit" size="lg" className="w-full">
              {isSignup ? 'Crear cuenta' : 'Entrar'}
              <ArrowRight size={16} />
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

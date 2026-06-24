import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login, signup, type AuthUser } from '@/store/auth'
import { ShoppingCart, Leaf, ArrowRight } from 'lucide-react'

export function Login({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [isSignup, setIsSignup] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Completa todos los campos')
      return
    }

    if (isSignup) {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden')
        return
      }
      if (password.length < 4) {
        setError('La contraseña debe tener al menos 4 caracteres')
        return
      }
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 via-background to-orange-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
            <ShoppingCart className="text-primary" size={20} />
            <Leaf className="text-primary" size={18} />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Mercado Inteligente</h1>
          <p className="text-muted-foreground">Tu asistente personal de compras saludables</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <div className="flex mb-6 bg-muted rounded-lg p-1">
            <button
              type="button"
              onClick={() => { setIsSignup(false); setError('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${!isSignup ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => { setIsSignup(true); setError('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${isSignup ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Usuario</label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="tu_usuario"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Contraseña</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="mt-1"
              />
            </div>
            {isSignup && (
              <div>
                <label className="text-sm font-medium text-foreground">Confirmar contraseña</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••"
                  className="mt-1"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-red-50 px-3 py-2 rounded-md">{error}</p>
            )}

            <Button type="submit" size="lg" className="w-full">
              {isSignup ? 'Crear cuenta' : 'Entrar'}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Presupuesto + nutrición + inventario, todo en un solo lugar
        </p>
      </div>
    </div>
  )
}

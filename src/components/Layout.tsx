import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Camera, Package, ChefHat, UtensilsCrossed, ShoppingCart, Settings, LogOut, Wallet, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/store/auth'

const desktopLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/money', icon: Wallet, label: 'Dinero' },
  { to: '/capture', icon: Camera, label: 'Registrar compra' },
  { to: '/inventory', icon: Package, label: 'Despensa' },
  { to: '/recipes', icon: ChefHat, label: 'Recetas' },
  { to: '/eating-out', icon: UtensilsCrossed, label: 'Antojos' },
  { to: '/recommender', icon: ShoppingCart, label: 'Lista de compras' },
]

const mobileLeft = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/money', icon: Wallet, label: 'Dinero' },
]
const mobileRight = [
  { to: '/inventory', icon: Package, label: 'Despensa' },
  { to: '/recipes', icon: ChefHat, label: 'Recetas' },
]

export function Layout({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const navigate = useNavigate()

  const mobileTab = (l: { to: string; icon: typeof LayoutDashboard; label: string }) => (
    <NavLink
      key={l.to}
      to={l.to}
      end={l.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-0.5 text-[10px] py-1 flex-1 rounded-xl transition-all duration-200',
          isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
        )
      }
    >
      <l.icon size={20} />
      <span>{l.label}</span>
    </NavLink>
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="freshapp" className="w-8 h-8" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            fresh<span className="text-primary">app</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-full">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {(user.name || user.username).charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-secondary-foreground">{user.name || user.username}</span>
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) => cn(
              'p-2 rounded-xl transition-all duration-200',
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Settings size={18} />
          </NavLink>
          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-red-50 transition-all duration-200 cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="hidden md:flex flex-col w-52 border-r border-border bg-white p-3 gap-0.5">
          {desktopLinks.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )
              }
            >
              <l.icon size={18} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 p-4 md:p-6 overflow-auto pb-28 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav — Monefy style with center action button */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-border flex items-end px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 z-50">
        {mobileLeft.map(mobileTab)}
        <div className="flex-1 flex justify-center">
          <button
            onClick={() => navigate('/capture')}
            className="w-14 h-14 -mt-7 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            aria-label="Registrar compra"
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>
        {mobileRight.map(mobileTab)}
      </nav>
    </div>
  )
}

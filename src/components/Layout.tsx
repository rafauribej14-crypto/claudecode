import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Camera, Package, ChefHat, ShoppingCart, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/store/auth'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/capture', icon: Camera, label: 'Captura' },
  { to: '/inventory', icon: Package, label: 'Inventario' },
  { to: '/recipes', icon: ChefHat, label: 'Recetas' },
  { to: '/recommender', icon: ShoppingCart, label: 'Recomendador' },
]

export function Layout({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-white px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛒</span>
          <span className="text-lg font-bold text-primary">Mercado Inteligente</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">Hola, <strong className="text-foreground">{user.name || user.username}</strong></span>
          <NavLink
            to="/settings"
            className={({ isActive }) => cn('p-2 rounded-md transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
          >
            <Settings size={18} />
          </NavLink>
          <button onClick={onLogout} className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="hidden md:flex flex-col w-56 border-r border-border bg-white p-3 gap-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )
              }
            >
              <l.icon size={18} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around py-2 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 text-xs',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <l.icon size={20} />
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

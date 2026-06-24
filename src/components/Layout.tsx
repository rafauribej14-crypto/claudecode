import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, User, Camera, Package, ChefHat, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profile', icon: User, label: 'Perfil' },
  { to: '/capture', icon: Camera, label: 'Captura' },
  { to: '/inventory', icon: Package, label: 'Inventario' },
  { to: '/recipes', icon: ChefHat, label: 'Recetas' },
  { to: '/recommender', icon: ShoppingCart, label: 'Recomendador' },
]

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <span className="text-xl font-bold text-primary">🛒</span>
        <span className="text-lg font-semibold">Mercado Inteligente</span>
      </header>

      <div className="flex flex-1">
        <nav className="hidden md:flex flex-col w-56 border-r border-border p-3 gap-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border flex justify-around py-2 z-50">
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

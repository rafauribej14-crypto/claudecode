import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Capture } from '@/pages/Capture'
import { Inventory } from '@/pages/Inventory'
import { Recipes } from '@/pages/Recipes'
import { Recommender } from '@/pages/Recommender'
import { EatingOut } from '@/pages/EatingOut'
import { Money } from '@/pages/Money'
import { Settings } from '@/pages/Settings'
import { Login } from '@/pages/Login'
import { Onboarding } from '@/pages/Onboarding'
import { getCurrentUser, logout, markOnboarded, type AuthUser } from '@/store/auth'
import { cloudEnabled, setSyncUser, pullState, pushState, clearLocalUserData } from '@/services/cloudSync'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const existing = getCurrentUser()
    if (existing) void handleAuth(existing)
    else setLoading(false)
  }, [])

  // On auth: pull cloud data into this device, or seed the cloud from local data.
  const handleAuth = async (u: AuthUser) => {
    if (cloudEnabled() && u.sync_key) {
      setSyncing(true)
      setSyncUser(u.sync_key)
      const result = await pullState(u.sync_key)
      if (result === 'found') {
        // Existing account restored on this device — if a profile came down, they're onboarded.
        try {
          const profile = JSON.parse(localStorage.getItem('profile') ?? 'null')
          if (localStorage.getItem('onboarded_flag') === '1' || profile?.name) markOnboarded()
        } catch { /* ignore */ }
        // Upload the merged result so sections that were newer on THIS device reach the cloud too.
        void pushState()
        setUser(getCurrentUser())
      } else if (result === 'empty') {
        // Confirmed no cloud record yet — safe to seed the cloud from this device.
        void pushState()
        setUser(u)
      } else {
        // Network error — do NOT push (would risk clobbering good cloud data).
        // Use whatever is local for now; the next successful save will sync.
        setUser(u)
      }
      setSyncing(false)
    } else {
      setUser(u)
    }
    setLoading(false)
  }

  const onAuth = (u: AuthUser) => { void handleAuth(u) }

  if (loading || syncing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <img src="/logo.svg" alt="freshapp" className="w-12 h-12 animate-pulse" />
        {syncing && <p className="text-sm text-muted-foreground">Sincronizando tus datos…</p>}
      </div>
    )
  }

  if (!user) {
    return <Login onAuth={onAuth} />
  }

  if (!user.onboarded) {
    return (
      <Onboarding
        userId={user.id}
        onComplete={() => setUser(getCurrentUser())}
      />
    )
  }

  const handleLogout = () => {
    logout()
    setSyncUser(null)
    if (cloudEnabled()) clearLocalUserData()
    setUser(null)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout user={user} onLogout={handleLogout} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/eating-out" element={<EatingOut />} />
          <Route path="/money" element={<Money />} />
          <Route path="/recommender" element={<Recommender />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

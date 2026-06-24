import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Capture } from '@/pages/Capture'
import { Inventory } from '@/pages/Inventory'
import { Recipes } from '@/pages/Recipes'
import { Recommender } from '@/pages/Recommender'
import { Settings } from '@/pages/Settings'
import { Login } from '@/pages/Login'
import { Onboarding } from '@/pages/Onboarding'
import { getCurrentUser, logout, type AuthUser } from '@/store/auth'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(getCurrentUser())
    setLoading(false)
  }, [])

  if (loading) return null

  if (!user) {
    return <Login onAuth={setUser} />
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
          <Route path="/recommender" element={<Recommender />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

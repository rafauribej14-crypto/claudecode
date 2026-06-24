import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Profile } from '@/pages/Profile'
import { Capture } from '@/pages/Capture'
import { Inventory } from '@/pages/Inventory'
import { Recipes } from '@/pages/Recipes'
import { Recommender } from '@/pages/Recommender'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recommender" element={<Recommender />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

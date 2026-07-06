import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Google OAuth only allows registered origins. Vercel per-deploy URLs
// (claudecode-<hash>-...vercel.app) change every deploy and can't all be
// registered, causing "origin_mismatch". Redirect any *.vercel.app preview
// host to the stable production domain where the origin IS registered.
const CANONICAL_HOST = import.meta.env.VITE_CANONICAL_HOST ?? 'cookeasy-smart.vercel.app'
const host = window.location.hostname
if (host.endsWith('.vercel.app') && host !== CANONICAL_HOST) {
  window.location.replace(`https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}`)
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}

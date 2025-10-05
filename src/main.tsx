// src/main.tsx
// POC: Route to full PoC UI (no auth, no Supabase) or normal app

import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const root = document.getElementById('root')!
// POC: Boot full app for /plot, /sandbox, and /sandbox-v1
const forceSandbox = 
  location.hash.startsWith('#/plot') ||
  location.hash.startsWith('#/sandbox')
const isPoc =
  forceSandbox ||
  (typeof import.meta !== 'undefined' &&
   (import.meta as any)?.env?.VITE_POC_ONLY === '1') ||
  (typeof import.meta !== 'undefined' &&
   (import.meta as any)?.env?.VITE_AUTH_MODE === 'guest')

// POC: Signal HTML failsafe immediately
try { (window as any).__APP_MOUNTED__?.() } catch {}

if (isPoc) {
  // POC: Load full PoC UI (no auth, no Supabase)
  ;(async () => {
    try {
      const { default: AppPoC } = await import('./poc/AppPoC')
      const reactRoot = createRoot(root)
      reactRoot.render(
        <StrictMode>
          <AppPoC />
        </StrictMode>
      )
    } catch (e) {
      console.error('POC: Failed to load AppPoC', e)
      // POC: Fallback to minimal panel
      root.innerHTML = `
        <div style="padding:20px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
          <h2 style="margin:0 0 12px 0;color:#991b1b">PoC UI Failed to Load</h2>
          <p>Error: ${String(e)}</p>
          <p>Visit <a href="/poc" style="color:#10b981">Static PoC</a> for a zero-dependency fallback.</p>
        </div>
      `
    }
  })()
} else {
  // Non-PoC: tiny message with links (never blank)
  root.innerHTML = `
    <div style="padding:20px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <h2 style="margin:0 0 12px 0">DecisionGuide.AI</h2>
      <p>PoC surfaces:</p>
      <ul>
        <li><a href="/poc" style="color:#10b981">Static PoC</a> (zero dependencies)</li>
        <li><a href="/#/plot" style="color:#10b981">Plot Showcase</a> (full styled UI)</li>
        <li><a href="/#/sandbox" style="color:#10b981">SPA Sandbox</a> (full PoC UI)</li>
      </ul>
    </div>
  `
}
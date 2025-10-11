// src/main.tsx
// POC: Route to full PoC UI (no auth, no Supabase) or normal app

import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const root = document.getElementById('root')!
// PLC: Dedicated route independent of PoC surfaces
const isPlc = location.hash.startsWith('#/plc')
const plcEnabled = (() => {
  try {
    const qs = new URLSearchParams(location.search)
    if (qs.get('plc') === '1' || qs.get('dev') === '1' || qs.get('e2e') === '1') return true
    return localStorage.getItem('PLC_ENABLED') === '1'
  } catch {
    return false
  }
})()
// POC: Boot full app for /plot, /sandbox, and /sandbox-v1
const forceSandbox = 
  location.hash.startsWith('#/plot') ||
  location.hash.startsWith('#/sandbox') ||
  location.hash.startsWith('#/test')
const isPoc =
  forceSandbox ||
  (typeof import.meta !== 'undefined' &&
   (import.meta as any)?.env?.VITE_POC_ONLY === '1') ||
  (typeof import.meta !== 'undefined' &&
   (import.meta as any)?.env?.VITE_AUTH_MODE === 'guest')

// POC: Signal HTML failsafe immediately
try { (window as any).__APP_MOUNTED__?.() } catch {}

if (isPlc && plcEnabled) {
  ;(async () => {
    try {
      const { default: PlcLab } = await import('./routes/PlcLab')
      const reactRoot = createRoot(root)
      reactRoot.render(
        <StrictMode>
          <PlcLab />
        </StrictMode>
      )
    } catch (e) {
      console.error('PLC: Failed to load PlcLab', e)
      root.innerHTML = `
        <div style="padding:20px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
          <h2 style="margin:0 0 12px 0;color:#991b1b">PLC UI Failed to Load</h2>
          <p>Error: ${String(e)}</p>
        </div>
      `
    }
  })()
} else if (isPlc) {
  root.innerHTML = `
    <div style="padding:20px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <h2 style="margin:0 0 12px 0">PLC Lab</h2>
      <p>PLC is disabled. Enable via <code>localStorage.PLC_ENABLED = '1'</code> or add <code>?dev=1</code> to the URL.</p>
    </div>
  `
} else if (isPoc) {
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
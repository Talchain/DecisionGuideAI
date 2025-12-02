// src/poc/safe/safe-entry.ts
// PURE DOM ONLY — do not import React, Zustand, React Flow, Sentry, etc.

/**
 * Shows the safe screen using pure DOM manipulation.
 * This function MUST NOT import any React/Zustand/React Flow dependencies.
 */
export function showSafe(): void {
  // Add Sentry breadcrumb for field triage (safe, doesn't throw)
  try {
    (window as any).Sentry?.addBreadcrumb?.({
      category: 'safe',
      level: 'info',
      message: 'safe-screen:shown'
    })
  } catch {
    // Ignore - Sentry may not be loaded
  }
  
  const root = document.getElementById('root') || document.body
  const el = document.createElement('div')
  el.id = 'safe-screen'
  el.setAttribute('data-testid', 'safe-screen')
  
  // Get build ID from meta tag or use placeholder
  const buildId = document.querySelector('meta[name="build-id"]')?.getAttribute('content') || 'dev'
  
  el.innerHTML = `
    <pre style="white-space:pre-wrap;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Oxygen,Ubuntu,Cantarell,'Open Sans','Helvetica Neue',sans-serif;padding:2rem">
PoC HTML Safe Screen
build: ${buildId}
edge: /engine
OK via proxy
</pre>`
  
  root.appendChild(el)
}

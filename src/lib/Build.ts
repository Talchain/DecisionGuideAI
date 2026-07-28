// src/lib/Build.ts
// Build stamp and acceptance logging

export const BUILD_ID = (typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown')

export function logAcceptance() {
  try {
    // ⚠ NAMED, LITERAL env reads only — `(import.meta as any)?.env || {}` puts the
    // env object in VALUE position, which Vite cannot narrow, so it inlined every
    // VITE_* the deploy defines into this chunk. See `src/lib/plotAuthHeaders.ts`.
    const poc = import.meta.env?.VITE_POC_ONLY
    const authMode = import.meta.env?.VITE_AUTH_MODE
    const edge = import.meta.env?.VITE_EDGE_GATEWAY_URL
    const line = `UI_POC: build=${BUILD_ID}, url=${location.href}, poc=${poc}, auth=${authMode}, edge=${edge || '(unset)'}`
    console.info(line)
    ;(window as any).__BUILD_ID__ = BUILD_ID
  } catch (e) {
    console.error('Failed to log acceptance:', e)
  }
}

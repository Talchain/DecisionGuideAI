// src/lib/Build.ts
// Build stamp and acceptance logging

export const BUILD_ID = (typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown')

export function logAcceptance() {
  try {
    const env = (import.meta as any)?.env || {}
    const line = `UI_POC: build=${BUILD_ID}, url=${location.href}, poc=${env?.VITE_POC_ONLY}, auth=${env?.VITE_AUTH_MODE}, edge=${env?.VITE_EDGE_GATEWAY_URL || '(unset)'}`
    console.info(line)
    ;(window as any).__BUILD_ID__ = BUILD_ID
  } catch (e) {
    console.error('Failed to log acceptance:', e)
  }
}

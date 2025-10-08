// src/lib/config.ts
// Centralized gateway base URL helper. No PII; swallow errors.

export function getGatewayBaseUrl(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const fromLs = localStorage.getItem('cfg.gateway') || ''
      if (typeof fromLs === 'string' && fromLs.trim().length > 0) return fromLs.trim()
    }
  } catch {}
  // In test runs, Vitest/Vite may inject a default dev URL. Treat that as no override.
  try {
    const mode = (import.meta as any)?.env?.MODE
    const injected = (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL
    if (mode === 'test' && injected === 'http://127.0.0.1:4311') return ''
  } catch {}
  try {
    const env = (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL
    if (typeof env === 'string' && env.trim().length > 0) return env.trim()
  } catch {}
  // Empty means relative
  return ''
}

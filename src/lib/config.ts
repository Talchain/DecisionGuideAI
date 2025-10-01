// src/lib/config.ts
// Centralized gateway base URL helper. No PII; swallow errors.

export function getGatewayBaseUrl(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const fromLs = localStorage.getItem('cfg.gateway') || ''
      if (typeof fromLs === 'string' && fromLs.trim().length > 0) return fromLs.trim()
    }
  } catch {}
  // process.env override (useful in tests and Node)
  try {
    const penv = (typeof process !== 'undefined' ? (process as any).env?.VITE_EDGE_GATEWAY_URL : undefined)
    if (typeof penv === 'string' && penv.trim().length > 0) return penv.trim()
  } catch {}
  try {
    const env = (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL
    if (typeof env === 'string' && env.trim().length > 0) return env.trim()
  } catch {}
  // Empty means relative
  return ''
}

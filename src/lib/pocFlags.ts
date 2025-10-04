// src/lib/pocFlags.ts
// POC: Feature flag helpers for PoC mode

export function isPoC(): boolean {
  return (
    (import.meta as any)?.env?.VITE_POC_ONLY === '1' ||
    (import.meta as any)?.env?.VITE_AUTH_MODE === 'guest'
  )
}

export function feature(name: string): boolean {
  const env = (import.meta as any)?.env
  if (!env) return false
  
  // Check if feature is explicitly enabled
  const value = env[name]
  return value === '1' || value === 'true'
}

export function getEdgeBase(): string {
  return (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '/engine'
}

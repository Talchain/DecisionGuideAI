// src/lib/poc.ts
// PoC-only mode: renders only the Scenario Sandbox with no login/nav/landing

export const isPocOnly = 
  (import.meta.env.VITE_POC_ONLY ?? '0') === '1'

export const isGuestAuth = 
  isPocOnly ||
  (import.meta.env.VITE_AUTH_MODE ?? 'guest') === 'guest' ||
  String(import.meta.env.VITE_SUPABASE_URL || '').includes('/dummy')

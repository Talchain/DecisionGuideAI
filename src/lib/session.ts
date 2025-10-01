// src/lib/session.ts
// Centralized session/org defaults with safe overrides.

export type SessionOrg = { sessionId: string; org: string }

export function getDefaults(overrides?: Partial<SessionOrg>): SessionOrg {
  const base: SessionOrg = { sessionId: 'sandbox', org: 'local' }

  // Env overrides (optional)
  let env: Partial<SessionOrg> = {}
  try {
    const im = (import.meta as any)
    const e = im?.env
    if (e) {
      const sid = typeof e.VITE_SESSION_ID === 'string' && e.VITE_SESSION_ID.length > 0 ? e.VITE_SESSION_ID : undefined
      const org = typeof e.VITE_ORG === 'string' && e.VITE_ORG.length > 0 ? e.VITE_ORG : undefined
      env = { sessionId: sid, org }
    }
  } catch {}
  // Fallback to Node-style process.env for test/runtime environments
  try {
    const p = (typeof process !== 'undefined' && (process as any)?.env) ? (process as any).env : undefined
    if (p) {
      const sid = typeof p.VITE_SESSION_ID === 'string' && p.VITE_SESSION_ID.length > 0 ? p.VITE_SESSION_ID : undefined
      const org = typeof p.VITE_ORG === 'string' && p.VITE_ORG.length > 0 ? p.VITE_ORG : undefined
      env = { sessionId: env.sessionId ?? sid, org: env.org ?? org }
    }
  } catch {}

  // LocalStorage overrides (optional)
  let ls: Partial<SessionOrg> = {}
  try {
    if (typeof window !== 'undefined' && window?.localStorage) {
      const sid = window.localStorage.getItem('session.id') ?? undefined
      const org = window.localStorage.getItem('session.org') ?? undefined
      ls = { sessionId: sid || undefined, org: org || undefined }
    }
  } catch {}

  return {
    sessionId: overrides?.sessionId ?? ls.sessionId ?? env.sessionId ?? base.sessionId,
    org: overrides?.org ?? ls.org ?? env.org ?? base.org,
  }
}

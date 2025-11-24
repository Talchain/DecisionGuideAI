export type IdempotencyKey = string

/**
 * Generate a cryptographically strong idempotency key where possible.
 *
 * Uses crypto.randomUUID() when available (modern browsers and Node).
 * Falls back to a timestamp + random suffix combination in older
 * environments. The exact format is opaque to callers.
 */
export function generateIdempotencyKey(): IdempotencyKey {
  try {
    // Prefer Web Crypto API / modern runtimes
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID()
    }
  } catch {
    // Ignore and fall through to fallback implementation
  }

  // Fallback: time-based with random component (best-effort uniqueness)
  const timePart = Date.now().toString(16)
  const randomPart = Math.random().toString(16).slice(2)
  return `idk_${timePart}_${randomPart}`
}

const CEE_IDEMPOTENCY_DISABLED_KEY = 'debug.cee.idempotency.disabled'

/**
 * Determine whether CEE idempotency (Idempotency-Key header) should be
 * enabled for Engine runs.
 *
 * Behaviour:
 * - In production, CEE idempotency is always enabled.
 * - In development/test, a localStorage flag is honoured so that
 *   developers can temporarily disable sending the header.
 */
export function isCeeIdempotencyEnabled(): boolean {
  // Never allow UI toggles to disable CEE in production builds.
  if (import.meta.env.PROD) return true

  if (typeof window === 'undefined') return true

  try {
    const raw = window.localStorage.getItem(CEE_IDEMPOTENCY_DISABLED_KEY)
    // When flag is present and truthy, treat CEE as disabled.
    if (raw === '1' || raw === 'true') {
      return false
    }
  } catch {
    // If storage is unavailable, default to enabled.
  }

  return true
}

/**
 * Dev-only control for enabling/disabling CEE idempotency.
 *
 * - In production this is a no-op.
 * - In dev/test, writes a localStorage flag that isCeeIdempotencyEnabled
 *   will subsequently read.
 */
export function setCeeIdempotencyEnabled(enabled: boolean): void {
  if (import.meta.env.PROD) return
  if (typeof window === 'undefined') return

  try {
    if (enabled) {
      window.localStorage.removeItem(CEE_IDEMPOTENCY_DISABLED_KEY)
    } else {
      window.localStorage.setItem(CEE_IDEMPOTENCY_DISABLED_KEY, '1')
    }
  } catch {
    // Swallow storage errors; this facility is best-effort only.
  }
}

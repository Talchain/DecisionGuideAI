// src/lib/pocFlags.ts
// POC: Feature flag helpers for PoC mode

import { FLAG_ENV } from './flagEnv'

export function isPoC(): boolean {
  return (
    (import.meta as any)?.env?.VITE_POC_ONLY === '1' ||
    (import.meta as any)?.env?.VITE_AUTH_MODE === 'guest'
  )
}

/**
 * Dynamic feature lookup by env-var NAME.
 *
 * ⚠ Sourced from `FLAG_ENV`, NOT from `import.meta.env`. This read
 * `const env = (import.meta as any)?.env`, which puts the env object in VALUE
 * position — Vite cannot statically narrow that, so it inlined the ENTIRE env
 * object (every VITE_* the deploy defines, WITH ITS VALUE) into this chunk purely
 * to support a lookup by name. `FLAG_ENV` is generated from `src/flags.ts` +
 * `netlify.toml` and provides the same dynamic lookup over named literal reads.
 *
 * Consequence: `name` must be a DECLARED flag key. Both call sites
 * (`src/poc/AppPoC.tsx` — VITE_FEATURE_SCENARIO_SANDBOX, VITE_FEATURE_SSE) are
 * declared. An undeclared name now returns false instead of reading a
 * dashboard-only variable; declare it in `netlify.toml` (which `pnpm flags:check`
 * already pushes towards) and regenerate.
 */
export function feature(name: string): boolean {
  const value = FLAG_ENV[name]
  return value === '1' || value === 'true'
}

export function getEdgeBase(): string {
  return (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '/engine'
}

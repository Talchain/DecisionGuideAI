/** Explicit deployment slot; never infer an upstream from a caller-controlled host. */
import { BACKEND_SLOT } from './backend-slot.generated.ts'
type Backend = 'cee' | 'plot' | 'isl'

const TARGETS = {
  staging: {
    cee: 'https://cee-staging.onrender.com',
    plot: 'https://plot-lite-service-staging.onrender.com',
    isl: 'https://isl-staging.onrender.com',
  },
  'manual-test': {
    cee: 'https://olumi-assistants-service.onrender.com',
    plot: 'https://plot-lite-service.onrender.com',
    isl: 'https://isl-production.onrender.com',
  },
} as const

export function resolveBackendTarget(backend: Backend, slot: string = BACKEND_SLOT): string {
  // Selection is bundled at build time. CONTEXT is not guaranteed at the edge;
  // absent runtime variables must never turn a manual-test deployment into staging.
  if (slot === 'staging' || slot === 'manual-test') return TARGETS[slot][backend]
  throw new Error('Invalid OLUMI_BACKEND_SLOT')
}

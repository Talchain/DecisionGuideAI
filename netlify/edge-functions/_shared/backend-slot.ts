/** Explicit deployment slot; never infer an upstream from a caller-controlled host. */
type Backend = 'cee' | 'plot' | 'isl'
type ReadEnv = (name: string) => string | undefined

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

const runtimeEnv: ReadEnv = (name) => {
  const runtime = globalThis as typeof globalThis & {
    Netlify?: { env?: { get(name: string): string | undefined } }
    Deno?: { env?: { get(name: string): string | undefined } }
  }
  return runtime.Netlify?.env?.get(name) ?? runtime.Deno?.env?.get(name)
}

export function resolveBackendTarget(backend: Backend, read: ReadEnv = runtimeEnv): string {
  const slot = read('OLUMI_BACKEND_SLOT')
  const context = read('CONTEXT')
  // Existing staging/local builds retain their upstreams. Production must opt
  // into the dedicated slot: missing or misspelt configuration fails closed.
  if (context === 'production' && slot !== 'manual-test') {
    throw new Error('Production requires OLUMI_BACKEND_SLOT=manual-test')
  }
  if (slot === undefined || slot === 'staging') return TARGETS.staging[backend]
  if (slot === 'manual-test') return TARGETS['manual-test'][backend]
  throw new Error('Invalid OLUMI_BACKEND_SLOT')
}

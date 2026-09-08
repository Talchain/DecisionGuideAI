import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolveBackendTarget } from '../../netlify/edge-functions/_shared/backend-slot.ts'

const read = (values: Record<string, string>) => (key: string) => values[key]
const targets = {
  cee: 'https://olumi-assistants-service.onrender.com',
  plot: 'https://plot-lite-service.onrender.com',
  isl: 'https://isl-production.onrender.com',
} as const

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe('explicit stable manual-test deployment slot', () => {
  it('retains all existing staging upstreams', () => {
    expect(resolveBackendTarget('cee', read({}))).toBe('https://cee-staging.onrender.com')
    expect(resolveBackendTarget('plot', read({ CONTEXT: 'branch-deploy' }))).toBe('https://plot-lite-service-staging.onrender.com')
    expect(resolveBackendTarget('isl', read({ OLUMI_BACKEND_SLOT: 'staging' }))).toBe('https://isl-staging.onrender.com')
  })

  it.each(['cee', 'plot', 'isl'] as const)('pins %s to the dedicated production service', (service) => {
    expect(resolveBackendTarget(service, read({ CONTEXT: 'production', OLUMI_BACKEND_SLOT: 'manual-test' }))).toBe(targets[service])
  })

  it.each([undefined, '', 'manual-tset', 'staging'])('production never falls back when slot is %s', (slot) => {
    const values: Record<string, string> = { CONTEXT: 'production' }
    if (slot !== undefined) values.OLUMI_BACKEND_SLOT = slot
    expect(() => resolveBackendTarget('cee', read(values))).toThrow()
  })

  it('rejects arbitrary endpoint-like slot values', () => {
    expect(() => resolveBackendTarget('cee', read({ OLUMI_BACKEND_SLOT: 'https://example.com' }))).toThrow()
  })

  it.each([
    ['cee-proxy', '/bff/cee/graph-readiness', 'cee'],
    ['plot-proxy', '/bff/engine/health', 'plot'],
    ['isl-proxy', '/bff/isl/health', 'isl'],
    ['collab-proxy', '/bff/collab/rounds/round-id/preview', 'cee'],
  ] as const)('%s forwards an allowed request only to the configured slot', async (file, path, service) => {
    vi.stubGlobal('Deno', { env: { get: read({ CONTEXT: 'production', OLUMI_BACKEND_SLOT: 'manual-test', ASSIST_API_KEY: 'test-key', PLOT_AUTH_TOKEN: 'test-key', ISL_API_KEY: 'test-key' }) } })
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const handler = (await import(`../../netlify/edge-functions/${file}.ts`)).default
    const response = await handler(new Request(`https://olumi.netlify.app${path}`, { method: file === 'cee-proxy' ? 'POST' : 'GET', headers: { Origin: 'https://olumi.netlify.app' }, ...(file === 'cee-proxy' ? {body:'{}'} : {}) }), {})
    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledOnce()
    expect(new URL(String(fetch.mock.calls[0][0])).origin).toBe(targets[service])
  })

  it('keeps the retired orchestrator proxy closed in the manual-test slot', async () => {
    vi.stubGlobal('Deno', { env: { get: read({ CONTEXT: 'production', OLUMI_BACKEND_SLOT: 'manual-test' }) } })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { default: handler } = await import('../../netlify/edge-functions/orchestrator-proxy.ts')
    const response = await handler(new Request('https://olumi.netlify.app/bff/orchestrate/v2/turn', { method: 'POST', headers: { Origin:'https://olumi.netlify.app' }, body:'{}' }), {} as never)
    expect(response.status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['https://olumi-assistants-service.onrender.com/proxy/v5/turn', 0],
    ['https://cee-staging.onrender.com/proxy/v5/turn', 1],
    ['', 1],
  ])('the build binds the direct V5 route as well as the edge routes (%s)', (endpoint, status) => {
    const result = spawnSync(process.execPath, ['scripts/ci/assert-v5-endpoint-configured.mjs'], {
      env: { ...process.env, NETLIFY: 'true', OLUMI_BACKEND_SLOT: 'manual-test', VITE_V5_ENDPOINT: endpoint },
      encoding: 'utf8',
    })
    expect(result.status).toBe(status)
  })
})

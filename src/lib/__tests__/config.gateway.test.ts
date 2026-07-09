import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ROADMAP 1.26 chronic-CI-red triage: the "no overrides" case previously
// mutated a copy of `import.meta.env` by hand (`delete (import.meta as
// any).env.VITE_EDGE_GATEWAY_URL`). Vite statically inlines
// `import.meta.env.VITE_*` reads at transform time from the real process
// env, so that mutation never actually reached the compiled `../config`
// module — it only ever passed locally because no developer had
// VITE_EDGE_GATEWAY_URL set. staging-full-tests.yml's own env block sets
// VITE_EDGE_GATEWAY_URL="http://localhost:3001" for the whole job, so this
// test has been failing (or would fail) in the real CI environment
// whenever the full suite actually ran to completion. `vi.stubEnv` /
// `vi.unstubAllEnvs` is vitest's supported mechanism for this — it patches
// the value vitest's transform actually serves, unlike a plain object copy.
describe('getGatewayBaseUrl precedence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    try { localStorage.clear() } catch {}
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    try { localStorage.clear() } catch {}
  })

  it('default empty string when no overrides', async () => {
    vi.stubEnv('VITE_EDGE_GATEWAY_URL', '')
    const { getGatewayBaseUrl } = await import('../config')
    expect(getGatewayBaseUrl()).toBe('')
  })

  it('env only', async () => {
    vi.stubEnv('VITE_EDGE_GATEWAY_URL', 'https://api.example.com')
    const { getGatewayBaseUrl } = await import('../config')
    expect(getGatewayBaseUrl()).toBe('https://api.example.com')
  })

  it('localStorage only', async () => {
    vi.stubEnv('VITE_EDGE_GATEWAY_URL', '')
    try { localStorage.setItem('cfg.gateway', 'http://localhost:8787') } catch {}
    const { getGatewayBaseUrl } = await import('../config')
    expect(getGatewayBaseUrl()).toBe('http://localhost:8787')
  })

  it('localStorage overrides env', async () => {
    vi.stubEnv('VITE_EDGE_GATEWAY_URL', 'https://api.example.com')
    try { localStorage.setItem('cfg.gateway', 'http://localhost:8787') } catch {}
    const { getGatewayBaseUrl } = await import('../config')
    expect(getGatewayBaseUrl()).toBe('http://localhost:8787')
  })
})

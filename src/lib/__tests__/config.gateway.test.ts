import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('getGatewayBaseUrl precedence', () => {
  let origEnv: any
  let mod: any

  beforeEach(async () => {
    vi.resetModules()
    origEnv = (import.meta as any).env
    ;(import.meta as any).env = { ...(origEnv || {}) }
    // Ensure no default override leaks into the default-case test
    delete (import.meta as any).env.VITE_EDGE_GATEWAY_URL
    // fresh import each test to ensure fresh localStorage read
    mod = await import('../config')
    try { localStorage.clear() } catch {}
  })

  afterEach(() => {
    ;(import.meta as any).env = origEnv
    try { localStorage.clear() } catch {}
  })

  it('default empty string when no overrides', async () => {
    const { getGatewayBaseUrl } = mod
    expect(getGatewayBaseUrl()).toBe('')
  })

  it('env only', async () => {
    ;(import.meta as any).env.VITE_EDGE_GATEWAY_URL = 'https://api.example.com'
    if (typeof process !== 'undefined') {
      ;(process as any).env = { ...(process as any).env, VITE_EDGE_GATEWAY_URL: 'https://api.example.com' }
    }
    const { getGatewayBaseUrl } = await import('../config')
    expect(getGatewayBaseUrl()).toBe('https://api.example.com')
  })

  it('localStorage only', async () => {
    try { localStorage.setItem('cfg.gateway', 'http://localhost:8787') } catch {}
    const { getGatewayBaseUrl } = await import('../config')
    expect(getGatewayBaseUrl()).toBe('http://localhost:8787')
  })

  it('localStorage overrides env', async () => {
    ;(import.meta as any).env.VITE_EDGE_GATEWAY_URL = 'https://api.example.com'
    try { localStorage.setItem('cfg.gateway', 'http://localhost:8787') } catch {}
    const { getGatewayBaseUrl } = await import('../config')
    expect(getGatewayBaseUrl()).toBe('http://localhost:8787')
  })
})

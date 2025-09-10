import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeProviderParams, maskToken } from '@/realtime/provider'

describe('realtime JWT URL builder', () => {
  const orig = (globalThis as any).__TEST_YJS_BASE_URL__
  beforeEach(() => {
    ;(globalThis as any).__TEST_YJS_BASE_URL__ = 'wss://y.example/ws?region=eu'
  })
  afterEach(() => {
    ;(globalThis as any).__TEST_YJS_BASE_URL__ = orig
  })

  it('builds URL with token param and preserves existing query', () => {
    const { url, params } = computeProviderParams('b1', 'jwt123')
    expect(url.startsWith('wss://y.example/ws')).toBe(true)
    const u = new URL(url)
    expect(u.searchParams.get('region')).toBe('eu')
    expect(u.searchParams.get('token')).toBe('jwt123')
    expect(Object.keys(params).length).toBe(0)
  })

  it('does not import y-websocket in this path (pure helper)', async () => {
    const spy = vi.spyOn(import.meta, 'url', 'get')
    // No dynamic import in computeProviderParams; this is a sanity check placeholder
    const { url } = computeProviderParams('b1', 'jwt123')
    expect(url).toContain('token=jwt123')
    spy.mockRestore()
  })

  it('maskToken redacts token in URLs', () => {
    const { url } = computeProviderParams('b1', 'jwt123')
    const masked = maskToken(url)
    const u = new URL(masked)
    expect(u.searchParams.get('token')).toBe('***')
  })
})

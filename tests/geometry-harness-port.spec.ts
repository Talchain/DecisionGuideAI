import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const load = async () => {
  vi.resetModules()
  const mod = await import('../playwright.geometry.config')
  return mod.default as any
}
const orig = process.env.GEOMETRY_PORT
afterEach(() => { if (orig === undefined) delete process.env.GEOMETRY_PORT; else process.env.GEOMETRY_PORT = orig })
beforeEach(() => { delete process.env.GEOMETRY_PORT })

describe('GEOMETRY_PORT resolution', () => {
  it('defaults to 5189 across ALL THREE sites when unset', async () => {
    const c = await load()
    expect(c.webServer.port).toBe(5189)
    expect(c.webServer.command).toContain('--port 5189')
    expect(c.use.baseURL).toBe('http://localhost:5189')
  })
  it('treats an empty string as unset', async () => {
    process.env.GEOMETRY_PORT = ''
    expect((await load()).webServer.port).toBe(5189)
  })
  it('moves ALL THREE sites together when set', async () => {
    process.env.GEOMETRY_PORT = '5289'
    const c = await load()
    expect(c.webServer.port).toBe(5289)
    expect(c.webServer.command).toContain('--port 5289')
    expect(c.use.baseURL).toBe('http://localhost:5289')
  })
  it('THROWS at config load on a non-numeric value', async () => {
    process.env.GEOMETRY_PORT = 'not-a-port'
    await expect(load()).rejects.toThrow(/is not a usable port/)
  })
  it('THROWS at config load on a privileged port', async () => {
    process.env.GEOMETRY_PORT = '80'
    await expect(load()).rejects.toThrow(/is not a usable port/)
  })
})

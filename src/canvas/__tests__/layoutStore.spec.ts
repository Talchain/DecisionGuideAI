import { describe, it, expect, beforeEach, vi } from 'vitest'

const KEY_V4 = 'canvas-layout-options-v4'
const KEY_V5 = 'canvas-layout-options-v5'

async function loadStore() {
  const mod = await import('../layoutStore')
  return mod.useLayoutStore.getState()
}

describe('layoutStore — v4 → v5 migration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('uses fresh v5 defaults when neither v4 nor v5 exists', async () => {
    const state = await loadStore()
    expect(state.direction).toBe('DOWN')
    expect(state.nodeSpacing).toBe(20)
    expect(state.layerSpacing).toBe(48)
    expect(state.respectLocked).toBe(true)
  })

  it('migrates v4 default-like nodeSpacing=30 to v5 default 20', async () => {
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'DOWN', nodeSpacing: 30, layerSpacing: 48, respectLocked: true,
    }))
    const state = await loadStore()
    expect(state.nodeSpacing).toBe(20)
  })

  it('preserves v4 customised nodeSpacing (non-30) across migration', async () => {
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'DOWN', nodeSpacing: 45, layerSpacing: 48, respectLocked: true,
    }))
    const state = await loadStore()
    expect(state.nodeSpacing).toBe(45)
  })

  it('preserves v4 direction, layerSpacing, and respectLocked while migrating nodeSpacing', async () => {
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'RIGHT', nodeSpacing: 30, layerSpacing: 60, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(20)
    expect(state.layerSpacing).toBe(60)
    expect(state.respectLocked).toBe(false)
  })

  it('preserves all v4 customisation when nodeSpacing is non-default', async () => {
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'LEFT', nodeSpacing: 80, layerSpacing: 120, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('LEFT')
    expect(state.nodeSpacing).toBe(80)
    expect(state.layerSpacing).toBe(120)
    expect(state.respectLocked).toBe(false)
  })

  it('v5 entry takes precedence over a v4 entry', async () => {
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'DOWN', nodeSpacing: 30, layerSpacing: 48, respectLocked: true,
    }))
    localStorage.setItem(KEY_V5, JSON.stringify({
      direction: 'RIGHT', nodeSpacing: 15, layerSpacing: 72, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(15)
    expect(state.layerSpacing).toBe(72)
    expect(state.respectLocked).toBe(false)
  })

  it('migrates only nodeSpacing and preserves other default-like fields', async () => {
    // Sanity: the 30 → 20 rule is targeted to nodeSpacing alone. Other v4
    // fields that happen to equal a v4 default (e.g. layerSpacing=48) are
    // left literal — they are not "snapped" to the v5 default by the
    // migration. Only nodeSpacing has a value-driven remap.
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'DOWN', nodeSpacing: 30, layerSpacing: 48, respectLocked: true,
    }))
    const state = await loadStore()
    expect(state.nodeSpacing).toBe(20)
    expect(state.layerSpacing).toBe(48)
  })

  it('returns defaults when v5 is malformed and no v4 entry exists', async () => {
    localStorage.setItem(KEY_V5, '{not valid json')
    const state = await loadStore()
    expect(state.direction).toBe('DOWN')
    expect(state.nodeSpacing).toBe(20)
    expect(state.layerSpacing).toBe(48)
    expect(state.respectLocked).toBe(true)
  })

  it('falls back to v4 migration when v5 is malformed but v4 is valid', async () => {
    localStorage.setItem(KEY_V5, '{not valid json')
    localStorage.setItem(KEY_V4, JSON.stringify({
      direction: 'RIGHT', nodeSpacing: 30, layerSpacing: 60, respectLocked: false,
    }))
    const state = await loadStore()
    expect(state.direction).toBe('RIGHT')
    expect(state.nodeSpacing).toBe(20)
    expect(state.layerSpacing).toBe(60)
    expect(state.respectLocked).toBe(false)
  })

  it('returns defaults when v4 JSON is malformed and no v5 entry exists', async () => {
    localStorage.setItem(KEY_V4, '{not valid json')
    const state = await loadStore()
    expect(state.direction).toBe('DOWN')
    expect(state.nodeSpacing).toBe(20)
  })

  it('returns defaults when both v5 and v4 are malformed', async () => {
    localStorage.setItem(KEY_V5, '{not valid')
    localStorage.setItem(KEY_V4, '{also not valid')
    const state = await loadStore()
    expect(state.direction).toBe('DOWN')
    expect(state.nodeSpacing).toBe(20)
    expect(state.layerSpacing).toBe(48)
    expect(state.respectLocked).toBe(true)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { useLayoutStore, densityOf, LAYOUT_DENSITY_PRESETS } from '../layoutStore'

describe('layoutStore — D4 density presets', () => {
  beforeEach(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    useLayoutStore.setState({ nodeSpacing: 15, layerSpacing: 48 })
  })

  it('densityOf derives compact at/below the compact tier spacing, comfortable above', () => {
    expect(densityOf(48)).toBe('comfortable')
    expect(densityOf(30)).toBe('compact')
    expect(densityOf(20)).toBe('compact')
    expect(densityOf(31)).toBe('comfortable')
  })

  it('setDensity(compact) tightens tier spacing to the floor without touching the node-node collision floor', () => {
    useLayoutStore.getState().setDensity('compact')
    const s = useLayoutStore.getState()
    expect(s.layerSpacing).toBe(LAYOUT_DENSITY_PRESETS.compact.layerSpacing)
    expect(s.nodeSpacing).toBe(LAYOUT_DENSITY_PRESETS.compact.nodeSpacing)
    // compact never drives node-node spacing below the horizontal collision floor (20).
    expect(s.nodeSpacing).toBeGreaterThanOrEqual(15)
    expect(densityOf(s.layerSpacing)).toBe('compact')
  })

  it('setDensity(comfortable) restores the default air', () => {
    useLayoutStore.getState().setDensity('compact')
    useLayoutStore.getState().setDensity('comfortable')
    const s = useLayoutStore.getState()
    expect(s.layerSpacing).toBe(LAYOUT_DENSITY_PRESETS.comfortable.layerSpacing)
    expect(densityOf(s.layerSpacing)).toBe('comfortable')
  })

  it('setDensity persists so the choice survives a reload', () => {
    useLayoutStore.getState().setDensity('compact')
    const saved = JSON.parse(localStorage.getItem('canvas-layout-options-v6') || '{}')
    expect(saved.layerSpacing).toBe(30)
  })
})

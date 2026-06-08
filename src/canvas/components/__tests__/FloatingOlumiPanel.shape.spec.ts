import { describe, it, expect } from 'vitest'
import { buildPanelShapePath } from '../FloatingOlumiPanel'

// V4 "one continuous shape": the panel + its top-left tab bump are one rounded
// SVG outline. r/cf below mirror SHAPE_RADIUS(10) / SHAPE_FILLET(9). These guard
// the geometry so a future tweak can't silently reintroduce a pointed corner or
// break the concave tab join.
describe('buildPanelShapePath', () => {
  const d = buildPanelShapePath(400, 550, 36, 16, 104, 10, 9)

  it('is a closed path that starts after the top-left corner radius', () => {
    expect(d.startsWith('M 46 0')).toBe(true) // tabW(36) + r(10)
    expect(d.trim().endsWith('Z')).toBe(true)
  })

  it('rounds all six convex corners with one shared radius', () => {
    // panel TL/TR/BR/BL + tab TL/BL — every corner is `A 10 10 ... sweep 1`
    expect((d.match(/A 10 10 0 0 1/g) || []).length).toBe(6)
  })

  it('joins the tab to the body with two concave fillets', () => {
    // top + bottom of the bump — `A 9 9 ... sweep 0` (inward curve)
    expect((d.match(/A 9 9 0 0 0/g) || []).length).toBe(2)
  })

  it('tracks the panel size (right edge + bottom edge scale)', () => {
    const big = buildPanelShapePath(500, 600, 36, 16, 104, 10, 9)
    expect(big).toContain('H 526') // w(536) - r(10)
    expect(big).toContain('V 590') // h(600) - r(10)
  })

  it('stays geometrically valid at the panel minimum (no inverted left edge)', () => {
    // MIN 320x300: the left edge climbs from the BL corner (y=h-r=290) UP to
    // the bottom fillet (y=tabTop+tabH+cf=129) — strictly decreasing.
    const min = buildPanelShapePath(320, 300, 36, 16, 104, 10, 9)
    expect(min).toContain('V 290')
    expect(min).toContain('V 129')
  })
})

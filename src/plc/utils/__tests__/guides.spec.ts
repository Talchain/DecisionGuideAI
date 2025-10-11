import { describe, it, expect } from 'vitest'
import { computeGuides, type Rect } from '../../utils/guides'

describe('plc guides', () => {
  const W = 120, H = 40
  it('detects vertical center alignment within tolerance and computes snap X', () => {
    const moving: Rect = { x: 100, y: 100, w: W, h: H }
    const other: Rect = { x: 300, y: 50, w: W, h: H }
    // Move near other center-x (300+60 = 360); moving center is 100+60=160, need ~200 more -> we'll place within tol
    const tol = 6
    const m2: Rect = { ...moving, x: 360 - W / 2 + 5 } // 5px off center
    const g = computeGuides(m2, [other], tol)
    expect(g.v?.ref).toBe(other.x + other.w / 2)
    // snapTo should set left such that its center equals ref
    expect(Math.round(g.v!.snapTo + W / 2)).toBe(Math.round(other.x + other.w / 2))
  })

  it('detects horizontal top/center/bottom alignments within tolerance', () => {
    const moving: Rect = { x: 100, y: 100, w: W, h: H }
    const other: Rect = { x: 200, y: 200, w: W, h: H }
    const tol = 6

    // Align to other.top
    const gTop = computeGuides({ ...moving, y: 200 + 3 }, [other], tol)
    expect(gTop.h?.ref).toBe(200)

    // Align to other center-y
    const cy = other.y + other.h / 2
    const gCy = computeGuides({ ...moving, y: cy - H / 2 + 2 }, [other], tol)
    expect(Math.round(gCy.h!.ref)).toBe(Math.round(cy))

    // Align to other.bottom
    const bottom = other.y + other.h
    const gBottom = computeGuides({ ...moving, y: bottom - H + 1 }, [other], tol)
    expect(Math.round(gBottom.h!.ref)).toBe(Math.round(bottom))
  })
})

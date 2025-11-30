import { describe, it, expect } from 'vitest'
import { snapCoord, snapPoint } from '../../utils/snap'

describe('plc snap utils', () => {
  it('snapCoord snaps within tolerance to nearest grid', () => {
    expect(snapCoord(117, 10, 6)).toBe(120) // +3 within tol
    expect(snapCoord(113, 10, 6)).toBe(110) // -3 within tol
    expect(snapCoord(106, 10, 5)).toBe(110) // 4>5? No, 4<=5 so would snap; adjust case:
    expect(snapCoord(106, 10, 3)).toBe(106) // 4>3, no snap
  })

  it('snapPoint applies to both axes', () => {
    const p = snapPoint({ x: 117, y: 93 }, 10, 6)
    expect(p).toEqual({ x: 120, y: 90 })
  })
})

import { describe, expect, it } from 'vitest'
import { isLodZoom, LOD_ZOOM_THRESHOLD } from '../LodSync'

describe('isLodZoom — D2 threshold predicate', () => {
  it('activates below the threshold, not at or above it', () => {
    expect(isLodZoom(0.1)).toBe(true)
    expect(isLodZoom(LOD_ZOOM_THRESHOLD - 0.01)).toBe(true)
    expect(isLodZoom(LOD_ZOOM_THRESHOLD)).toBe(false)
    expect(isLodZoom(1)).toBe(false)
    expect(isLodZoom(4)).toBe(false)
  })
})

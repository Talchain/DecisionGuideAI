import { describe, expect, it } from 'vitest'
import { cameraDuration } from '../cameraMotion'

describe('cameraDuration — F1 reduced-motion camera guard', () => {
  it('preserves the base duration when reduced motion is off', () => {
    expect(cameraDuration(300, false)).toBe(300)
    expect(cameraDuration(200, false)).toBe(200)
  })

  it('collapses to an instant jump (0ms) when reduced motion is on', () => {
    expect(cameraDuration(300, true)).toBe(0)
    expect(cameraDuration(200, true)).toBe(0)
    expect(cameraDuration(0, true)).toBe(0)
  })
})

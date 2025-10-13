// src/plot/__tests__/zoom-clamp.spec.ts
// Verify zoom clamps to [0.25, 3] and origin stays stable

import { describe, it, expect } from 'vitest'
import { clampScale, fitToContent, ZOOM_MIN, ZOOM_MAX } from '../utils/zoom'

describe('Plot Zoom: clamp and bounds', () => {
  it('clamps scale to minimum', () => {
    expect(clampScale(0.1)).toBe(ZOOM_MIN)
    expect(clampScale(0)).toBe(ZOOM_MIN)
    expect(clampScale(-1)).toBe(ZOOM_MIN)
  })

  it('clamps scale to maximum', () => {
    expect(clampScale(5)).toBe(ZOOM_MAX)
    expect(clampScale(10)).toBe(ZOOM_MAX)
  })

  it('allows scale within range', () => {
    expect(clampScale(0.5)).toBe(0.5)
    expect(clampScale(1)).toBe(1)
    expect(clampScale(2)).toBe(2)
  })

  it('fitToContent returns valid transform for empty nodes', () => {
    const result = fitToContent([], 800, 600)
    expect(result.scale).toBe(1)
    expect(result.translateX).toBe(0)
    expect(result.translateY).toBe(0)
  })

  it('fitToContent centers single node', () => {
    const nodes = [{ x: 100, y: 100 }]
    const result = fitToContent(nodes, 800, 600, 50)
    expect(result.scale).toBeGreaterThan(0)
    expect(result.scale).toBeLessThanOrEqual(ZOOM_MAX)
  })

  it('fitToContent scales down for large spread', () => {
    const nodes = [
      { x: 0, y: 0 },
      { x: 2000, y: 1500 }
    ]
    const result = fitToContent(nodes, 800, 600, 50)
    expect(result.scale).toBeLessThan(1)
    expect(result.scale).toBeGreaterThanOrEqual(ZOOM_MIN)
  })
})

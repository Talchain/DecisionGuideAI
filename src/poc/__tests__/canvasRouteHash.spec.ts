import { describe, it, expect } from 'vitest'
import { isCanvasRouteHash } from '../canvasRouteHash'

describe('isCanvasRouteHash — where ⌘Z belongs to the canvas', () => {
  it.each([
    ['#/canvas', true],
    ['#/canvas?diag=1', true],
    ['#/scenario/3b6369b0-aaaa-4bbb-8ccc-dddddddddddd', true],
    ['#/scenario/abc?x=1', true],
    ['#/scenario/abc/panel', false],
    ['#/scenarios', false],
    ['#/', false],
    ['', false],
    ['#/sandbox', false],
  ])('%s → %s', (hash, expected) => {
    expect(isCanvasRouteHash(hash)).toBe(expected)
  })
})

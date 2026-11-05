/**
 * R5 (github-3c; set-visible.mjs check 3 on the head: Set 29 px below a 900 px window after the open editor's card grew): the smallest pan
 * that keeps a box wholly in the free canvas.
 */
import { describe, expect, it } from 'vitest'
import { panToKeepInView } from '../keepInView'

const free = { left: 80, top: 120, right: 1000, bottom: 880 }
describe('the smallest pan that keeps a box in the free canvas', () => {
  it('the witness case: a form whose foot is 49 px past the free bottom moves up 49 px, and not sideways', () => {
    expect(panToKeepInView({ left: 300, top: 700, right: 568, bottom: 929 }, free)).toEqual({ dx: 0, dy: -49 })
  })
  it('above the top bars: moves down; past the dock: moves left; past the left edge: moves right', () => {
    expect(panToKeepInView({ left: 300, top: 100, right: 568, bottom: 300 }, free)).toEqual({ dx: 0, dy: 20 })
    expect(panToKeepInView({ left: 900, top: 300, right: 1100, bottom: 400 }, free)).toEqual({ dx: -100, dy: 0 })
    expect(panToKeepInView({ left: 40, top: 300, right: 240, bottom: 400 }, free)).toEqual({ dx: 40, dy: 0 })
  })
  it('CONTRAST: a box already inside does not move; one taller than the canvas keeps its top in view', () => {
    expect(panToKeepInView({ left: 300, top: 200, right: 568, bottom: 400 }, free)).toEqual({ dx: 0, dy: 0 })
    expect(panToKeepInView({ left: 300, top: 300, right: 568, bottom: 1300 }, free)).toEqual({ dx: 0, dy: -180 })
  })
})

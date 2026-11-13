/**
 * ORDER-UI-3 (13 Nov, 1128x707, the acceptance store): a card's height follows the zoom, so re-fitting both ways had no resting point
 * (1 -> 0.51 -> 0.40 -> 0.36 -> 0.51, cards drawn over each other between frames, stopped by the fit cap with the board taller than the
 * canvas). Within one board a re-fit may only keep or lower the zoom: `frameFor` takes the previous fit's zoom as its ceiling.
 */
import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { frameFor } from '../ViewCanvas'

const pane = { width: 811, height: 707 }, free = { top: 120, right: 0, bottom: 60, left: 60 }
// The same board twice: drawn tall (the reduced face at ~0.5) and drawn short (bodies hidden at ~0.36), as measured on the store.
const board = (h: number): Node[] => [0, 1, 2, 3].flatMap((row) => [0, 1, 2, 3, 4].map((col): Node => ({ id: `c${row}${col}`, position: { x: col * 300, y: row * (h + 40) }, data: {}, measured: { width: 248, height: h } })))

describe('the core lane fit, one direction within a board', () => {
  it('CATCH: the short board would zoom IN past the previous fit; with that fit as its ceiling it never does', () => {
    const tall = frameFor(board(278), pane, free)!, short = frameFor(board(119), pane, free)!
    expect(short.zoom).toBeGreaterThan(tall.zoom) // the swing back up the camera used to take
    const held = frameFor(board(119), pane, free, tall.zoom)!
    expect(held.zoom).toBeLessThanOrEqual(tall.zoom)
  })
  it('INVARIANCE: a fit below the ceiling is unchanged; the default ceiling is 1 (a new board starts again)', () => {
    const tall = frameFor(board(278), pane, free)!
    expect(frameFor(board(278), pane, free, 1)).toEqual(tall)
    expect(frameFor(board(278), pane, free, tall.zoom + 0.2)).toEqual(tall)
  })
})

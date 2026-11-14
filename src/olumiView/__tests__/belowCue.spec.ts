/**
 * DL-538 item (1): the goal is reachable without hunting at 1128. Bound to the boxes the served build drew (fixtures/live-v4-face-boxes.json,
 * the full face at 2000 placed in the 1128 pane, see cameraFaces.spec): the cue counts a card cut at its foot, and one press brings the
 * board's foot (its last row: the measure and the goal) wholly into the free canvas when the rest is under one screen.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cardsBelowOf, FOOT_BAND, FREE_TOP, panUpOf } from '../BelowCue'

const F = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v4-face-boxes.json'), 'utf8'))
const boxes = (F.w2000.full.nodes as { y: number; h: number }[]).map((b) => ({ y: b.y, h: b.h }))
const H = 707, ZOOM = 0.917, top = Math.min(...boxes.map((b) => b.y)), TY = FREE_TOP - top * ZOOM
const foot = Math.max(...boxes.map((b) => b.y + b.h))

describe('the "more cards below" cue (DL-538)', () => {
  it('B1 a card cut at the free canvas\'s foot counts as below (a goal half in view was not counted)', () => {
    const cut = { y: (H - FOOT_BAND - 40 - TY) / ZOOM, h: 100 }
    expect(cardsBelowOf([cut], TY, ZOOM, H)).toBe(1)
    expect(cardsBelowOf([{ y: top, h: 10 }], TY, ZOOM, H), 'CONTRAST: a card wholly in view').toBe(0)
  })

  it('B2 one press brings the board\'s foot (its last row: the measure and the goal) wholly into view, however far below it is', () => {
    expect(foot * ZOOM + TY, 'precondition: the served board overflows at 1128').toBeGreaterThan(H - FOOT_BAND)
    const after = TY - panUpOf(boxes, TY, ZOOM, H)
    expect(cardsBelowOf(boxes, after, ZOOM, H)).toBe(0)
    expect(foot * ZOOM + after).toBeCloseTo(H - FOOT_BAND, 3)
    expect(panUpOf(boxes, after, ZOOM, H), 'nothing more to bring up once the foot is in view').toBe(0)
    // a board twice as tall: still one press
    const tall = [...boxes, { y: foot + 900, h: 200 }]
    expect(cardsBelowOf(tall, TY - panUpOf(tall, TY, ZOOM, H), ZOOM, H)).toBe(0)
  })
})

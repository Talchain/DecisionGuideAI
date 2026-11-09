/**
 * Nothing sits under an open form (DL round 5, 9 Nov; rehearsal 2b: the zoom row covered "Set figure / Try without saving" on the
 * "six mid-weight developers" card at 1232x704). The served board is asserted by the journey suite (e2e/v11 part1, step 2).
 */
import { describe, expect, it } from 'vitest'
import { FOOT_GAP, footOverlap } from '../clearOfFoot'

// Rehearsal 2b, measured: the editor's buttons at y 618-680 over x 66-240; the zoom row at x 15-170, y 626-662.
const ZOOM = { left: 15, right: 170, top: 626, bottom: 662 }
const CUE = { left: 380, right: 544, top: 628, bottom: 664 }

describe('a card\'s open form clears the canvas\'s foot controls', () => {
  it('a form over the zoom row moves up by exactly its overlap plus the gap', () => {
    const form = { left: 66, right: 240, top: 560, bottom: 680 }
    expect(footOverlap(form, [ZOOM, CUE])).toBe(680 - (626 - FOOT_GAP))
  })
  it('a form clear of them, or beside them in other columns, does not move', () => {
    expect(footOverlap({ left: 66, right: 240, top: 400, bottom: 600 }, [ZOOM, CUE])).toBe(0)
    expect(footOverlap({ left: 600, right: 800, top: 560, bottom: 690 }, [ZOOM, CUE])).toBe(0)
  })
  it('the more-below cue counts as a foot control too', () => {
    expect(footOverlap({ left: 420, right: 600, top: 560, bottom: 640 }, [ZOOM, CUE])).toBe(640 - (628 - FOOT_GAP))
  })
})

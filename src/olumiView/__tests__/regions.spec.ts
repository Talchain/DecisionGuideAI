/**
 * The canvas's regions and the z-order rule's mechanism (./regions.ts; DL layout pass, 9 Nov). Rehearsal 2b measured: the editor's
 * buttons at y 618-680 over x 66-240, the zoom row at x 15-170, y 626-662. The served board is asserted by the journey suite (step 2).
 */
import { describe, expect, it } from 'vitest'
import { BAND_GAP, REGION_GAP, clearOf, footNotchOf, headHeightOf, type Regions } from '../regions'

const R: Regions = {
  head: { left: 0, right: 925, top: 0, bottom: 104 },
  foot: [{ left: 15, right: 170, top: 626, bottom: 662 }, { left: 380, right: 544, top: 628, bottom: 664 }],
  dock: { left: 925, right: 1232, top: 0, bottom: 704 },
}

describe('clearOf: how far the board moves so an open card clears the regions', () => {
  it('a card over the zoom row moves up by its overlap plus the gap', () => {
    expect(clearOf({ left: 52, right: 252, top: 452, bottom: 704 }, R)).toEqual({ dx: 0, dy: -(704 - (626 - REGION_GAP)) })
  })
  it('a card clear of every region, or beside the foot controls in other columns, does not move', () => {
    expect(clearOf({ left: 52, right: 252, top: 112, bottom: 400 }, R)).toEqual({ dx: 0, dy: 0 })
    expect(clearOf({ left: 600, right: 800, top: 500, bottom: 700 }, R)).toEqual({ dx: 0, dy: 0 })
  })
  it('a card under the head band moves down until its top is below it', () => {
    expect(clearOf({ left: 300, right: 500, top: 60, bottom: 200 }, R)).toEqual({ dx: 0, dy: 104 - 60 })
  })
  it('a card taller than the free band keeps its top in view: it moves up only as far as the head allows', () => {
    expect(clearOf({ left: 52, right: 252, top: 150, bottom: 760 }, R)).toEqual({ dx: 0, dy: -(150 - 104) })
  })
  it('a card running into the dock moves left', () => {
    expect(clearOf({ left: 800, right: 1000, top: 200, bottom: 300 }, R)).toEqual({ dx: -(1000 - (925 - REGION_GAP)), dy: 0 })
  })
  it('the head band ends just below its lowest control; none drawn, no band', () => {
    expect(headHeightOf([96, 92])).toBe(96 + BAND_GAP)
    expect(headHeightOf([])).toBe(0)
  })
})

describe('link words keep clear of the words of the links before them (railBoxes.ts; the re-score\'s #1)', () => {
  it('a link sees only the boxes of lower-indexed links, and its key moves only when one of them moves', async () => {
    const { wordsBefore } = await import('../railBoxes')
    const b = (x: number) => ({ id: '', x, y: 0, w: 40, h: 16 })
    const boxes = { 0: b(10), 2: b(30), 5: b(50) }
    expect(wordsBefore(boxes, 3).list).toEqual([b(10), b(30)])
    expect(wordsBefore(boxes, 0).list).toEqual([])
    expect(wordsBefore({ ...boxes, 5: b(90) }, 3).key).toBe(wordsBefore(boxes, 3).key)
    expect(wordsBefore({ ...boxes, 2: b(31) }, 3).key).not.toBe(wordsBefore(boxes, 3).key)
  })
})

describe('DL 06:57Z (3): the board never draws under the foot controls', () => {
  // Measured on the twin at 1232x704 (14 Nov): the zoom row x 15–170, the "13 more cards below" control x 184–350, both y 627–663; the
  // view canvas's renderer is the window's canvas box (0,0)–(1232,704).
  const zoom = { left: 15, right: 170, top: 627, bottom: 663 }, cue = { left: 184, right: 350, top: 627, bottom: 663 }, area = { left: 0, right: 1232, top: 0, bottom: 704 }
  it('FN1 the notch spans both controls plus the gap each way, from the canvas foot: nothing of a card is drawn there', () => {
    expect(footNotchOf([zoom, cue], area)).toBe(`polygon(0 0, 100% 0, 100% 100%, ${350 + REGION_GAP}px 100%, ${350 + REGION_GAP}px calc(100% - ${704 - (627 - REGION_GAP)}px), 0 calc(100% - ${704 - (627 - REGION_GAP)}px))`)
  })
  it('FN1 CONTRAST: with no foot control drawn there is no notch; the zoom row alone notches only its own span', () => {
    expect(footNotchOf([], area)).toBeNull()
    expect(footNotchOf([zoom], area)).toContain(`${170 + REGION_GAP}px 100%`)
  })
})

/**
 * ⭐⭐⭐ THE `quiet` RUNG SPENDS ITSELF — measured root cause, not a preference.
 *
 * The ladder had three rungs and only `line` changed anything. `line` needs
 * `zoom < 0.5`; the product's own auto-fit clamps at exactly 0.5
 * (`useFitViewOnLayoutVersion` passes `minZoom: LABEL_LEGIBLE_ZOOM`, and xyflow
 * clamps to it). So the default camera parked inside the one rung that did
 * nothing, and every card rendered its full body, always.
 *
 * Neither half was wrong. They answered different questions and nothing joined
 * them. These tests pin the join.
 */
import { describe, it, expect } from 'vitest'
import {
  lensDetailSpentAt,
  selectLensDetailActive,
  resolveLodRung,
  lodBodyHiddenAt,
  LABEL_LEGIBLE_ZOOM,
  ICON_LEGIBLE_ZOOM,
  type LodRung,
} from '../utils/zoomLegibility'

const ALL_RUNGS: readonly LodRung[] = ['full', 'quiet', 'line']

describe('the rung the product actually parks on', () => {
  /**
   * ⛔ THE LOAD-BEARING ONE. If this ever fails, the change below is pointless
   * rather than wrong — the whole reason to spend `quiet` is that the auto-fit
   * lands there. Derived from the two constants, never a restated literal.
   */
  it('the auto-fit floor lands in `quiet`, which is why this change exists', () => {
    expect(resolveLodRung(LABEL_LEGIBLE_ZOOM)).toBe('quiet')
    expect(lodBodyHiddenAt(resolveLodRung(LABEL_LEGIBLE_ZOOM))).toBe(false)
    expect(LABEL_LEGIBLE_ZOOM).toBeLessThan(ICON_LEGIBLE_ZOOM)
  })

  it('`lensDetailSpentAt` is true at `quiet` and nowhere else', () => {
    expect(lensDetailSpentAt('quiet')).toBe(true)
    for (const r of ALL_RUNGS.filter(r => r !== 'quiet')) {
      expect(lensDetailSpentAt(r), `must not spend at ${r}`).toBe(false)
    }
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, a function returning `true`
   * everywhere passes the row above — and would blank bodies at `full`, which is
   * the opposite of the intent.
   */
  it('CONTRAST: zooming in past the icon floor restores every body', () => {
    expect(resolveLodRung(ICON_LEGIBLE_ZOOM)).toBe('full')
    expect(lensDetailSpentAt(resolveLodRung(ICON_LEGIBLE_ZOOM))).toBe(false)
  })
})

describe('selectLensDetailActive — the ONE thing the nodes and the notice share', () => {
  const dimmed = (...ids: string[]) => ({ _dimmedNodeIds: new Set(ids) })

  it('fires at `quiet` when the lens has set cards aside', () => {
    expect(selectLensDetailActive({ lodRung: 'quiet', lens: dimmed('a') })).toBe(true)
  })

  it('does NOT fire at `full` — zooming in is still a real remedy', () => {
    expect(selectLensDetailActive({ lodRung: 'full', lens: dimmed('a') })).toBe(false)
  })

  it('does NOT fire at `line` — the zoom notice owns that state and says more', () => {
    expect(selectLensDetailActive({ lodRung: 'line', lens: dimmed('a') })).toBe(false)
  })

  /**
   * ⭐ THE PRECONDITION THE SELECTOR'S HEADER PROMISES, PINNED IN-TEST.
   * It reads `_dimmedNodeIds.size` rather than the feature flag, on the grounds
   * that nothing populates that set with the lens off. That is a claim, so it is
   * asserted here: an empty set must read false even at the spending rung. If a
   * future change ever dims nodes with the lens disabled, this REDs rather than
   * the behaviour switching on silently.
   */
  it('an EMPTY lens set reads false at the spending rung', () => {
    expect(selectLensDetailActive({ lodRung: 'quiet', lens: dimmed() })).toBe(false)
  })

  it('tolerates a store double with no lens slice at all', () => {
    expect(selectLensDetailActive({ lodRung: 'quiet' })).toBe(false)
    expect(selectLensDetailActive({ lodRung: 'quiet', lens: null })).toBe(false)
    expect(selectLensDetailActive({})).toBe(false)
  })
})

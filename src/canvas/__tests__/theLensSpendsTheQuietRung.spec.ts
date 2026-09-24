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
  LOD_BODY_HIDDEN_ZOOM,
  type LodRung,
} from '../utils/zoomLegibility'

const ALL_RUNGS: readonly LodRung[] = ['full', 'quiet', 'line']

describe('the rung the product actually parks on', () => {
  /**
   * ⛔⛔ THIS WAS THE LOAD-BEARING CLAIM THAT JUSTIFIED SPENDING `quiet` ON THE
   * LENS, AND IT IS NOW REVERSED BY A LATER RULING (gap-audit row 3,
   * `canvas/gap-landing-normal`, 24 Sep 2026: "the landing view counts as
   * Normal zoom"). `resolveLodRung`'s `full` floor moved from
   * `ICON_LEGIBLE_ZOOM` to `LABEL_LEGIBLE_ZOOM`, so the auto-fit's 0.5 floor —
   * unchanged — now parks in `full`, not `quiet`.
   *
   * This does NOT undo the reasoning below it: `quiet` still exists, is still
   * reachable (by zooming OUT of the landing view, into
   * `[LOD_BODY_HIDDEN_ZOOM, LABEL_LEGIBLE_ZOOM)`), and the lens still spends it
   * there — see the CONTRAST case immediately below, now pinned at the new
   * boundary. What changed is only WHICH zoom the DEFAULT camera occupies, and
   * that is precisely the ruling's intended effect: first sight of a model is
   * now `full` — coaching icon, rail icons and driver cue all visible — and
   * the lens's reduced-detail view is one deliberate zoom-out away rather than
   * the first thing a user sees.
   */
  it('the auto-fit floor now lands in `full` — landing counts as Normal, so `quiet` no longer receives the default camera', () => {
    expect(resolveLodRung(LABEL_LEGIBLE_ZOOM)).toBe('full')
    expect(lodBodyHiddenAt(resolveLodRung(LABEL_LEGIBLE_ZOOM))).toBe(false)
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

  /**
   * ⭐ `quiet` IS STILL REACHABLE — this is what proves the lens-detail
   * mechanism did not become dead code when the default camera moved off it.
   * Its band narrowed to `[LOD_BODY_HIDDEN_ZOOM, LABEL_LEGIBLE_ZOOM)` (see
   * `zoomLadder.spec.ts`), but it is non-empty, and a zoom inside it still
   * spends lens detail exactly as before.
   */
  it('CONTRAST: a zoom-out past the landing floor still reaches `quiet`, and the lens still spends it there', () => {
    const midQuiet = (LOD_BODY_HIDDEN_ZOOM + LABEL_LEGIBLE_ZOOM) / 2
    expect(resolveLodRung(midQuiet)).toBe('quiet')
    expect(lensDetailSpentAt(resolveLodRung(midQuiet))).toBe(true)
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

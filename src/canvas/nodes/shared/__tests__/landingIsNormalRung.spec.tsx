/**
 * ⭐⭐ GAP row 3 (`DESIGN-GAP-AUDIT-20260924.md`, `canvas/gap-landing-normal`):
 * THE LANDING VIEW COUNTS AS "NORMAL" ZOOM — product ruling, Paul confirmed 24
 * Sep 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE GAP
 * ─────────────────────────────────────────────────────────────────────────────
 * Contract §02: "The coaching action remains available"; every fixture card has
 * a coaching icon. But the landing fit is clamped `[LABEL_LEGIBLE_ZOOM, 1]`
 * (`zoomLegibility.ts:198-209`) and fresh models land at ~0.5–0.53 — inside the
 * old `quiet` rung, which starts only at `ICON_LEGIBLE_ZOOM` (10/14 ≈ 0.714,
 * `:495`). `NodeCoachingIcon.tsx:125-126` returns `null` below `full`, and the
 * SAME gate (`selectRestingGlyphsShown`) hides the rail's evidence/behaviour
 * icons, the corner coaching marker and the "?" evidence-gap badge, and
 * `FactorNode`'s driver cue. So at first sight — the ONLY sight most sessions
 * ever see — no card shows any of them.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULING AND WHY IT DOES NOT REOPEN THE LEGIBILITY DEFECT
 * ─────────────────────────────────────────────────────────────────────────────
 * `ICON_LEGIBLE_ZOOM`'s derivation ("a 14px mark at zoom z occupies 14z screen
 * pixels") assumes an UNSCALED glyph. It does not describe the rail: every rail
 * glyph (`NodeCoachingIcon`, `NodeRailIcons`, `NodeCoachingMarker`, the driver
 * cue) is `CANVAS_GLYPH_SIZE_CLASSES[N]`, i.e. `calc(Npx *
 * var(--canvas-label-scale,1))` — counter-scaled by
 * `labelCounterScale(zoom)`, which is capped at `MAX_LABEL_COUNTER_SCALE`
 * (`= 1/LABEL_LEGIBLE_ZOOM = 2`) reached AT the landing floor. So a rail glyph's
 * RENDERED size at the landing floor is `declaredPx * 2 * 0.5 = declaredPx` —
 * already at its full declared size, not the unscaled `declaredPx * 0.5` the old
 * threshold assumed. The gate that hid the icon was never protecting its
 * legibility; the counter-scale already had.
 *
 * So the smallest correct fix moves the ONE threshold that decides `full` vs
 * `quiet` (`resolveLodRung`'s `iconFloor`) from `ICON_LEGIBLE_ZOOM` to
 * `LABEL_LEGIBLE_ZOOM` — the same floor the landing fit is clamped to — so a
 * card is on the `full` rung at every zoom the landing view can ever be at, and
 * relies on the counter-scale mechanism that already existed to keep the
 * glyphs legible there.
 *
 * ⛔ THE `line` RUNG AND ITS FOUNDER RULE ARE UNTOUCHED. `LOD_BODY_HIDDEN_ZOOM`
 * — the body-cliff, the ONLY thing that ever blanks a card — is not part of
 * this change. Below it the card still shows a title and one reduced line,
 * never nothing (Paul, 30 Aug: "the content in it shouldn't disappear").
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS RED ON HEAD (798fb324c)
 * ─────────────────────────────────────────────────────────────────────────────
 * Every test in `describe('RED-before …')` below fails on HEAD:
 * `resolveLodRung(0.5)` and `resolveLodRung(0.53)` are `'quiet'`, so the
 * coaching icon and the shared resting-glyph gate both read as hidden at the
 * exact zoom the product lands a fresh model at.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NodeCoachingIcon } from '../NodeCoachingIcon'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { selectRestingGlyphsShown } from '../restingGlyphRung'
import { NODE_RAIL_GLYPH_PX } from '../nodeCardRailStyles'
import {
  resolveLodRung,
  LABEL_LEGIBLE_ZOOM,
  LOD_BODY_HIDDEN_ZOOM,
  ICON_LEGIBLE_ZOOM,
  renderedLabelPx,
} from '../../../utils/zoomLegibility'

// The measured landing band this branch is built against
// (`SESSION-20260924-PM.md`, cited by the gap-audit row this closes).
const LANDING_ZOOMS = [0.5, 0.53] as const
// The far/`line` rung contrast — well below the body cliff, so the card is
// blanked to a title and one line, and the rail unmounts entirely.
const FAR_ZOOM = 0.3

const NODE = { id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }
const CHIPS = [{ id: 'evidence', label: 'What is the evidence?', message: 'What is the evidence for Hiring spend?', actionType: null }] as const

beforeEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [NODE], lodRung: 'full' } as never)
  useGuidanceStore.setState({
    _sendMessage: null, _prefillChat: vi.fn(), _dispatchAction: null, guidanceItems: [],
  } as never)
})

describe('resolveLodRung — the landing floor is now inside `full`, not `quiet`', () => {
  it('RED-before: the landing zoom band resolves to `full`', () => {
    for (const z of LANDING_ZOOMS) {
      expect(resolveLodRung(z), `zoom ${z} must be the Normal rung`).toBe('full')
    }
  })

  it('CONTRAST: the far/`line` rung is untouched — 0.3 is still `line`', () => {
    expect(resolveLodRung(FAR_ZOOM)).toBe('line')
  })

  it('the rung order is preserved: `quiet` is still a real, non-empty interval, just narrower', () => {
    // line < quiet < full, strictly, and `quiet`'s interval is now
    // [LOD_BODY_HIDDEN_ZOOM, LABEL_LEGIBLE_ZOOM) — the band between the body
    // cliff and the landing floor — rather than [LABEL_LEGIBLE_ZOOM,
    // ICON_LEGIBLE_ZOOM).
    expect(LOD_BODY_HIDDEN_ZOOM).toBeLessThan(LABEL_LEGIBLE_ZOOM)
    const midQuiet = (LOD_BODY_HIDDEN_ZOOM + LABEL_LEGIBLE_ZOOM) / 2
    expect(resolveLodRung(midQuiet)).toBe('quiet')
  })

  it('ICON_LEGIBLE_ZOOM is still a true, derived design-system fact — just no longer the rung boundary', () => {
    // Unmoved: it still states "a 14px UNSCALED mark reaches the 10px floor at
    // 10/14". What changed is that the rung gate no longer asks that question,
    // because the glyphs it gates are counter-scaled and this quotient never
    // described them.
    expect(resolveLodRung(ICON_LEGIBLE_ZOOM)).toBe('full')
  })
})

describe('selectRestingGlyphsShown — the ONE gate NodeRailIcons, NodeCoachingMarker, EvidenceGapBadge and the FactorNode driver cue all read', () => {
  it('RED-before: true at the landing zoom band, via the real resolver — not a hand-set rung', () => {
    for (const z of LANDING_ZOOMS) {
      expect(selectRestingGlyphsShown({ lodRung: resolveLodRung(z) })).toBe(true)
    }
  })

  it('CONTRAST: false at the far/`line` rung', () => {
    expect(selectRestingGlyphsShown({ lodRung: resolveLodRung(FAR_ZOOM) })).toBe(false)
  })
})

describe('the coaching icon, bound by testid identity, at the zoom the product actually lands a model at', () => {
  it.each(LANDING_ZOOMS)('RED-before: renders at zoom %s, driven through the real resolver', (z) => {
    useCanvasStore.setState({ lodRung: resolveLodRung(z) } as never)
    render(<NodeCoachingIcon nodeId="node-a" chips={CHIPS as never} />)
    expect(screen.getByTestId('node-coaching-icon-node-a')).toBeInTheDocument()
  })

  it('CONTRAST: stays hidden at the far/`line` rung (founder rule: never blank the card — but the rail still unmounts)', () => {
    useCanvasStore.setState({ lodRung: resolveLodRung(FAR_ZOOM) } as never)
    render(<NodeCoachingIcon nodeId="node-a" chips={CHIPS as never} />)
    expect(screen.queryByTestId('node-coaching-icon-node-a')).toBeNull()
  })
})

describe('legibility arithmetic — the reason the ruling does not reopen the old defect', () => {
  it('a rail glyph declared at NODE_RAIL_GLYPH_PX (14) renders at its full declared size at the landing floor, not half of it', () => {
    // The exact arithmetic `canvasGlyphScale.ts`'s CSS performs:
    // declaredPx * labelCounterScale(zoom) * zoom.
    expect(renderedLabelPx(NODE_RAIL_GLYPH_PX, LABEL_LEGIBLE_ZOOM)).toBe(NODE_RAIL_GLYPH_PX)
    for (const z of LANDING_ZOOMS) {
      expect(renderedLabelPx(NODE_RAIL_GLYPH_PX, z)).toBeGreaterThanOrEqual(10)
    }
  })

  it('the driver cue glyph (11px declared) also clears the 10px canvas text floor at the landing band', () => {
    const DRIVER_CUE_GLYPH_PX = 11
    for (const z of LANDING_ZOOMS) {
      expect(renderedLabelPx(DRIVER_CUE_GLYPH_PX, z)).toBeGreaterThanOrEqual(10)
    }
  })
})

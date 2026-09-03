/**
 * CanvasLodNotice — the canvas must say when it has stopped rendering labels.
 *
 * ⚠ THE LOAD-BEARING EVIDENCE FOR THIS COMPONENT IS THE REAL-BROWSER SWEEP, not
 * this file. jsdom cannot prove a label is illegible (CLAUDE.md trap 3); it has
 * no layout, so `visibility: hidden` and a fully readable label are the same
 * thing to it. The measurement that established the defect and proved the fix
 * lives in the PR body: real Chromium, the product's own 19-node example, the
 * real "Fit to view" control, five viewports.
 *
 * What this file pins is the one property jsdom CAN see and that the browser
 * sweep cannot pin against refactors: the notice is bound to the SAME store flag
 * the nodes blank themselves on. If it ever grew its own zoom predicate, it
 * could claim a state the nodes are not in — the mirror defect this estate keeps
 * paying for — and the browser sweep would not notice for months.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CanvasLodNotice, CANVAS_LOD_NOTICE_TESTID } from '../CanvasLodNotice'
import { useCanvasStore } from '../../store'
import { LABEL_LEGIBLE_ZOOM, ICON_LEGIBLE_ZOOM, resolveLodRung, selectLodBodyHidden } from '../../utils/zoomLegibility'
import { isLodZoom } from '../LodSync'

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ getViewport: () => ({ x: 0, y: 0, zoom: 0.3 }), setViewport: vi.fn() }),
}))

describe('CanvasLodNotice', () => {
  beforeEach(() => {
    useCanvasStore.setState({ lodRung: 'full' })
  })

  it('renders NOTHING while labels are being rendered', () => {
    render(<CanvasLodNotice />)
    expect(
      screen.queryByTestId(CANVAS_LOD_NOTICE_TESTID),
      'a notice that shows while labels are perfectly readable is noise, and it would train the user to ignore it',
    ).toBeNull()
  })

  it('renders the disclosure exactly when the nodes have blanked their labels', () => {
    useCanvasStore.setState({ lodRung: 'line' })
    render(<CanvasLodNotice />)
    const el = screen.getByTestId(CANVAS_LOD_NOTICE_TESTID)
    expect(el).toBeTruthy()
    // Bound by identity to the control, not by a text predicate another element
    // could satisfy.
    expect(screen.getByTestId(`${CANVAS_LOD_NOTICE_TESTID}-action`)).toBeTruthy()
  })

  it('is bound to the SAME selector BaseNode blanks on — not to a second zoom predicate of its own', () => {
    // The anti-mirror assertion, and the reason it is now stated over the RUNG.
    // `lodRung` is written by LodSync from `resolveLodRung(transform[2])`, and
    // BOTH this notice and `BaseNode` read it through the one exported
    // `selectLodBodyHidden`. Proving they agree at the boundary is what stops a
    // future refactor giving the notice its own threshold.
    expect(isLodZoom(LABEL_LEGIBLE_ZOOM - 0.01)).toBe(true)
    expect(isLodZoom(LABEL_LEGIBLE_ZOOM)).toBe(false)

    const rung = resolveLodRung(LABEL_LEGIBLE_ZOOM)
    useCanvasStore.setState({ lodRung: rung })
    render(<CanvasLodNotice />)
    expect(
      screen.queryByTestId(CANVAS_LOD_NOTICE_TESTID),
      'the notice claimed the labels were hidden at a zoom where BaseNode renders them',
    ).toBeNull()
  })

  it('stays SILENT on the new middle rung — its copy is a claim about the cards, and the cards are unchanged there', () => {
    // ⭐ THE ASSERTION THE THIRD RUNG MAKES NECESSARY. `quiet` is "simplified
    // canvas" in spirit but changes nothing about a card at this tip, so a
    // notice reading "showing less on each card" at `quiet` would be the fourth
    // time this component's copy asserted something the screen was not doing.
    // The notice is bound to the BODY-HIDDEN question, not to "is the ladder
    // below the top rung", and this pins that choice rather than leaving it to
    // whichever predicate a later edit reaches for (CLAUDE.md trap 21).
    expect(resolveLodRung((LABEL_LEGIBLE_ZOOM + ICON_LEGIBLE_ZOOM) / 2)).toBe('quiet')
    expect(selectLodBodyHidden({ lodRung: 'quiet' })).toBe(false)

    useCanvasStore.setState({ lodRung: 'quiet' })
    render(<CanvasLodNotice />)
    expect(
      screen.queryByTestId(CANVAS_LOD_NOTICE_TESTID),
      'the notice announced that cards are showing less, on a rung where every card renders identically to full zoom',
    ).toBeNull()
  })
})

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
import { LABEL_LEGIBLE_ZOOM } from '../../utils/zoomLegibility'
import { isLodZoom } from '../LodSync'

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ getViewport: () => ({ x: 0, y: 0, zoom: 0.3 }), setViewport: vi.fn() }),
}))

describe('CanvasLodNotice', () => {
  beforeEach(() => {
    useCanvasStore.setState({ lodActive: false })
  })

  it('renders NOTHING while labels are being rendered', () => {
    render(<CanvasLodNotice />)
    expect(
      screen.queryByTestId(CANVAS_LOD_NOTICE_TESTID),
      'a notice that shows while labels are perfectly readable is noise, and it would train the user to ignore it',
    ).toBeNull()
  })

  it('renders the disclosure exactly when the nodes have blanked their labels', () => {
    useCanvasStore.setState({ lodActive: true })
    render(<CanvasLodNotice />)
    const el = screen.getByTestId(CANVAS_LOD_NOTICE_TESTID)
    expect(el).toBeTruthy()
    // Bound by identity to the control, not by a text predicate another element
    // could satisfy.
    expect(screen.getByTestId(`${CANVAS_LOD_NOTICE_TESTID}-action`)).toBeTruthy()
  })

  it('is bound to the SAME flag BaseNode blanks on — not to a second zoom predicate of its own', () => {
    // The anti-mirror assertion. `lodActive` is written by LodSync from
    // `isLodZoom(transform[2])`, and `BaseNode` hides its title on that same
    // flag. Proving the two agree at the boundary is what stops a future
    // refactor giving the notice its own threshold.
    expect(isLodZoom(LABEL_LEGIBLE_ZOOM - 0.01)).toBe(true)
    expect(isLodZoom(LABEL_LEGIBLE_ZOOM)).toBe(false)

    useCanvasStore.setState({ lodActive: isLodZoom(LABEL_LEGIBLE_ZOOM) })
    render(<CanvasLodNotice />)
    expect(
      screen.queryByTestId(CANVAS_LOD_NOTICE_TESTID),
      'the notice claimed the labels were hidden at a zoom where BaseNode renders them',
    ).toBeNull()
  })
})

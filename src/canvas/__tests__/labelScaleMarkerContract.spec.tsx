/**
 * ⭐⭐ THE WRITER AND THE READER MUST AGREE ON WHICH CANVAS THEY MEAN — and this
 * file exists because a mutant proved nothing was making them.
 *
 * `measureNodeHeightsAtLabelBound` finds the MAIN canvas by walking up from
 * `CanvasLabelScaleSync`'s marker, deliberately rather than by
 * `document.querySelector('.react-flow')`, which in comparison mode binds to a
 * Compare-tab mini-map (see the measurer's header, and review finding F1).
 *
 * ⚠ THE MUTANT THAT SURVIVED: hand-write the marker's `data-testid` in
 * `CanvasLabelScaleSync` instead of deriving it from
 * `CANVAS_LABEL_SCALE_MARKER_TESTID`. Every unit test stayed GREEN — because the
 * measurer then finds NO marker, returns an empty map, and `getNodeDimensions`
 * quietly falls through to `measured.height`. **The whole fix goes dark, in the
 * exact silent way it was written to prevent, and nothing goes red.** A shared
 * constant is a contract only if something executes both ends of it.
 *
 * So this mounts the REAL component and runs the REAL measurer against what it
 * rendered. Nothing here restates the testid.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({
  // The component selects the QUANTISED SCALE from the React Flow store; the
  // value is irrelevant here, only that it renders its marker.
  useStore: (selector: (s: { transform: number[] }) => unknown) => selector({ transform: [0, 0, 0.5] }),
}))

import { CanvasLabelScaleSync } from '../components/CanvasLabelScaleSync'
import { measureNodeHeightsAtLabelBound } from '../utils/measureNodeHeightsAtLabelBound'

/**
 * A `.react-flow` root holding a node layer and — like the real tree — a
 * separate host for the sync. ⚠ React's `render` REPLACES its container's
 * children, so the sync gets its own child element; nodes appended to the root
 * itself would be wiped and the test would fail for the wrong reason.
 */
function mountRoot(heights: Record<string, number>): { root: HTMLElement; syncHost: HTMLElement } {
  const root = document.createElement('div')
  root.className = 'react-flow'
  const syncHost = document.createElement('div')
  root.appendChild(syncHost)
  for (const [id, h] of Object.entries(heights)) {
    const el = document.createElement('div')
    el.className = 'react-flow__node'
    el.dataset.id = id
    Object.defineProperty(el, 'offsetHeight', { get: () => h })
    root.appendChild(el)
  }
  document.body.appendChild(root)
  return { root, syncHost }
}

describe('the label-scale marker is a live contract between the sync and the measurer', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => { cleanup(); document.body.innerHTML = '' })

  it('the measurer finds the root through the marker the REAL component renders', () => {
    const { syncHost } = mountRoot({ a: 300, b: 210 })
    render(<CanvasLabelScaleSync />, { container: syncHost })

    const out = measureNodeHeightsAtLabelBound()

    expect(
      Object.fromEntries(out),
      'the measurer could not find the root through the marker the sync actually renders — the two ends of the contract have drifted, and the fix is now silently inert',
    ).toEqual({ a: 300, b: 210 })
  })

  it('CONTRAST CONTROL: with the sync NOT mounted, the same DOM measures nothing', () => {
    // Without this the test above would pass for a measurer that ignored the
    // marker entirely and took the first root — which is the defect (trap 13b:
    // ask what would have to be true for the guard to pass while the property
    // fails, then write that case).
    mountRoot({ a: 300, b: 210 })
    expect(measureNodeHeightsAtLabelBound().size).toBe(0)
  })
})

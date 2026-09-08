/**
 * AND THE STRIP ACTUALLY STOPS DENYING IT — the half the index test cannot see.
 *
 * `panelMentionsAreNotDenied.spec.ts` proves `buildNodeInsights` now knows the
 * node is mentioned. That is not the defect. The defect was a SENTENCE ON
 * SCREEN, and a builder that knows while a renderer still denies is exactly the
 * shape this estate ships most often. These cases drive the component.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const nodes: unknown[] = []
type MockState = { nodes: unknown; setHighlightedNodes: unknown }
const setHighlightedNodesSpy = vi.fn()
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes: setHighlightedNodesSpy })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))

import { ModelStrip } from '../sections/ModelStrip'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { NodeInsightIndex } from '../nodeInsights'

const TID = 'analysis-new-model-strip'
const PCF = 'f_pcf'

const index = (mentions: Array<{ id: string; section: 'keyInsights' | 'sensitivity'; headline: string }>): NodeInsightIndex =>
  new Map([[PCF, { driverLabel: null, findings: [], withheldFindings: 0, mentions }]])

const HINGE = {
  id: 'insight:hinge',
  section: 'keyInsights' as const,
  headline: 'Platform Capability Fit is the hinge',
}

function show(insights: NodeInsightIndex) {
  nodes.length = 0
  nodes.push({ id: PCF, type: 'factor', data: { label: 'Platform Capability Fit' } })
  render(<ModelStrip isPreRun={false} insights={insights} />)
  fireEvent.click(screen.getByTestId(`${TID}-toggle`))
  const marks = screen.queryAllByTestId(`${TID}-mark`)
  // ⚠ A zero-mark strip proves nothing — every assertion below would pass
  // against an empty tree.
  expect(marks.length).toBeGreaterThan(0)
  fireEvent.click(marks[0])
}

afterEach(() => {
  cleanup()
  setHighlightedNodesSpy.mockClear()
})

describe('the strip renders what the panel says instead of denying it', () => {
  it('⛔ THE WITNESSED CASE: with a mention, the denial is GONE and the pointer is shown', () => {
    show(index([HINGE]))
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
    const line = screen.getByTestId(`${TID}-detail-mention`)
    expect(line).toHaveAttribute('data-mention-id', 'insight:hinge')
    expect(line.textContent).toContain('Platform Capability Fit is the hinge')
    // The section is NAMED, so the pointer is actionable rather than a stray
    // sentence the reader has to go and find.
    expect(line.textContent).toContain('Also in Key insights:')
  })

  /*
   * ⭐ THE OPPOSITE-DIRECTION TWIN, and it is the one that matters most here.
   * Removing the denial altogether would be its own defect: silence is
   * indistinguishable from a broken control, which is why the sentence exists.
   */
  it('⛔ with NO mention the denial is still made, exactly as before', () => {
    show(index([]))
    expect(screen.getByTestId(`${TID}-detail-empty`).textContent).toBe(COPY.modelStrip.noInsight)
    expect(screen.queryByTestId(`${TID}-detail-mention`)).toBeNull()
  })

  it('every mention is listed, in order, bound by id', () => {
    show(
      index([
        HINGE,
        { id: 'sensitivity:1', section: 'sensitivity', headline: 'If this changes, Status Quo could become the better choice' },
      ]),
    )
    expect(
      screen.getAllByTestId(`${TID}-detail-mention`).map(e => e.getAttribute('data-mention-id')),
    ).toEqual(['insight:hinge', 'sensitivity:1'])
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
  })
})

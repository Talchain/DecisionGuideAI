/**
 * ⚠⚠ RE-PINNED 26 Sep 2026 (design audit B12). This file pinned the mark
 * detail's "Also in …" pointers and its "Nothing else on this panel refers to
 * this node." denial. The V2 prototype's detail carries NEITHER — a heading,
 * one bullet and three icon acts — so both are gone, and what this file now
 * pins is the stronger form of the rule it was written for: the detail makes
 * NO claim about the rest of the panel, in either direction, whatever the
 * index holds. The witnessed defect (a denial while the panel named the node)
 * cannot recur, because there is no denial left to render; each case keeps a
 * contrast proving the index DID hold the pointer the detail declines to draw.
 *
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
import type { NodeInsightIndex, NodeMention } from '../nodeInsights'

const TID = 'analysis-new-model-strip'
const PCF = 'f_pcf'

/**
 * ⚠ THE SECTION TYPE IS IMPORTED, NEVER RESPELLED. This helper declared
 * `'keyInsights' | 'sensitivity'` inline, which is a copy of the union that
 * shipped SHORT — so the spec would have kept compiling, and passing, against
 * exactly the two sections the defect was about (CLAUDE.md trap 12).
 */
const index = (mentions: NodeMention[], driverLabel: string | null = null): NodeInsightIndex =>
  new Map([[PCF, { driverLabel, findings: [], withheldFindings: 0, mentions }]])

/**
 * The mark's own name, which the detail renders as its title. Held once so the
 * restatement case below is a claim about ONE string appearing in two places,
 * rather than two literals that happen to match today.
 */
const PCF_LABEL = 'Platform Capability Fit'

const HINGE = {
  id: 'insight:hinge',
  section: 'keyInsights' as const,
  headline: 'Platform Capability Fit is the hinge',
}

function show(insights: NodeInsightIndex) {
  nodes.length = 0
  nodes.push({ id: PCF, type: 'factor', data: { label: PCF_LABEL } })
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

describe('the detail makes no claim about the rest of the panel (design audit B12)', () => {
  it('⛔ THE WITNESSED CASE: with a mention in the index, there is no denial — and no pointer either', () => {
    const idx = index([HINGE])
    // CONTRAST: the index really does name the node.
    expect(idx.get(PCF)?.mentions.map((m) => m.id)).toEqual(['insight:hinge'])
    show(idx)
    expect(screen.getByTestId(`${TID}-detail`)).toHaveAttribute('data-node-id', PCF)
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-detail-mention`)).toBeNull()
    expect(screen.getByTestId(`${TID}-detail`)).not.toHaveTextContent(COPY.modelStrip.noInsight)
    expect(screen.getByTestId(`${TID}-detail`)).not.toHaveTextContent('Also in')
  })

  it('⛔ with NO mention the detail still denies nothing', () => {
    show(index([]))
    expect(screen.getByTestId(`${TID}-detail`)).toHaveAttribute('data-node-id', PCF)
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
    expect(screen.getByTestId(`${TID}-detail`)).not.toHaveTextContent(COPY.modelStrip.noInsight)
  })

  /**
   * ⛔ THE "NAME SAID TWICE" DEFECT THIS FILE ONCE CAUGHT (title, driver chip
   * and a Drivers pointer all naming the node) — pinned in its final form: the
   * node's name is on the detail exactly once, even with a driver label and a
   * Drivers mention both in the index.
   */
  it('⛔ a node the glance named AND the Drivers section names says its name once', () => {
    const idx = index(
      [{ id: 'driver:f_pcf', section: 'drivers', headline: PCF_LABEL }],
      PCF_LABEL,
    )
    expect(idx.get(PCF)?.driverLabel).toBe(PCF_LABEL)
    show(idx)
    const text = screen.getByTestId(`${TID}-detail`).textContent ?? ''
    expect(text.split(PCF_LABEL).length - 1).toBe(1)
    expect(screen.getByTestId(`${TID}-detail-title`).textContent).toBe(PCF_LABEL)
    expect(screen.queryByTestId(`${TID}-detail-driver`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-detail-mention`)).toBeNull()
  })
})

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
import type { NodeInsightIndex, NodeMention } from '../nodeInsights'

const TID = 'analysis-new-model-strip'
const PCF = 'f_pcf'

/**
 * ⚠ THE SECTION TYPE IS IMPORTED, NEVER RESPELLED. This helper declared
 * `'keyInsights' | 'sensitivity'` inline, which is a copy of the union that
 * shipped SHORT — so the spec would have kept compiling, and passing, against
 * exactly the two sections the defect was about (CLAUDE.md trap 12).
 */
const index = (mentions: NodeMention[]): NodeInsightIndex =>
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
    //
    // ⚠ DERIVED FROM THE SECTION'S OWN HEADING, never retyped here. The
    // literal 'Also in Key insights:' stood in this assertion while the copy
    // module held a second hand-written copy of the same heading; a heading
    // edit would have moved the section on screen and left both this test and
    // the pointer naming a heading that no longer existed.
    expect(line.textContent).toBe(
      COPY.modelStrip.mention(COPY.sections.keyInsights, HINGE.headline),
    )
  })

  /**
   * ⛔ THE TWO SECTIONS THE FIRST FIX OMITTED. The renderer never branched on
   * the section, so these were always going to render — but nothing pinned
   * that, and "the renderer is generic" is exactly the kind of claim that stops
   * being true quietly. Each names its own heading, so a pointer that fell back
   * to one label for everything REDs here.
   */
  it('⛔ a Drivers row and an Uncertainty row each name THEIR OWN section', () => {
    show(
      index([
        { id: 'driver:f_reporting', section: 'drivers', headline: 'Regulatory reporting load' },
        { id: 'uncertainty:EVIDENCE_GAP', section: 'uncertainty', headline: 'Churn assumption is unevidenced' },
      ]),
    )
    const lines = screen.getAllByTestId(`${TID}-detail-mention`)
    expect(lines.map((e) => e.getAttribute('data-mention-section'))).toEqual([
      'drivers',
      'uncertainty',
    ])
    expect(lines[0].textContent).toBe(
      COPY.modelStrip.mention(COPY.sections.drivers, 'Regulatory reporting load'),
    )
    expect(lines[1].textContent).toBe(
      COPY.modelStrip.mention(COPY.sections.uncertainty, 'Churn assumption is unevidenced'),
    )
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
  })

  /**
   * ⚠⚠ AN EMPTY HEADLINE IS A REAL PRODUCER STATE, NOT A DEFENSIVE BRANCH.
   * `buildAnalysisNewViewModel` sets `headline: ''` on a LONG non-threshold
   * uncertainty or sensitivity row and carries the sentence in `implication`
   * instead, so the row does not say itself twice. Those rows carry
   * `affectedNodes`, so they DO become mentions — and the line then read as a
   * heading with a dangling colon and nothing after it.
   *
   * ⛔ AND THE FIX IS NOT TO FALL BACK TO `implication`: reprinting the whole
   * sentence here would make the pointer a SECOND RENDERING of a card already
   * on screen. The section name alone is true, useful, and the most this line
   * is entitled to say.
   */
  it('⛔ a finding with an EMPTY headline still points, with no dangling colon', () => {
    show(index([{ id: 'uncertainty:SENSITIVE_ASSUMPTION', section: 'sensitivity', headline: '' }]))
    const line = screen.getByTestId(`${TID}-detail-mention`)
    expect(line.textContent).toBe(`Also in ${COPY.sections.sensitivity}`)
    expect(line.textContent).not.toContain(':')
    // Still a mention, so the denial must stay gone — the whole point is that
    // the panel IS talking about this node.
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
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

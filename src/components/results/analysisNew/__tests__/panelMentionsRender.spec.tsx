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
    // ⚠ THE SECTION'S OWN HEADING IS INDEXED, never retyped — the literal
    // 'Also in Key insights:' stood here while the copy module held a second
    // hand-written copy of the same heading, and a heading edit would have left
    // both this test and the pointer naming a heading that no longer existed.
    //
    // ⚠⚠ BUT THE FRAME IS SPELLED OUT, AND THAT IS A CORRECTION. This read
    // `toBe(COPY.modelStrip.mention(COPY.sections.keyInsights, HINGE.headline))`
    // — the same call, on the same inputs, as the component makes. Both sides
    // moved together, so it could not fail for ANY implementation of
    // `mention()`, including one that dropped the headline entirely: a guard
    // agreeing with itself (CLAUDE.md trap 13b). Two questions were riding one
    // expression. The heading still comes from `COPY.sections`; the frame
    // around it is now asserted, which is the same shape the empty-headline
    // case below already used.
    expect(line.textContent).toBe(`Also in ${COPY.sections.keyInsights}: ${HINGE.headline}`)
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
    // ⛔ THE DRIVERS ROW CARRIES NO PAYLOAD, and it is not an omission here.
    // A Drivers headline is the node's own label by construction, so the
    // payload could only ever restate the title above it. The suppression is
    // scoped to that one section, which is what the Uncertainty line beside it
    // proves: a producer SENTENCE is information the title cannot restate, and
    // it survives. Without this pair the fix could decay into "pointers carry
    // no payload" with nothing red.
    expect(lines[0].textContent).toBe(`Also in ${COPY.sections.drivers}`)
    expect(lines[1].textContent).toBe(
      `Also in ${COPY.sections.uncertainty}: Churn assumption is unevidenced`,
    )
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
  })

  /**
   * ⛔⛔ THE PAIRING NOTHING IN THIS DIFF OBSERVED: a NON-NULL `driverLabel` AND
   * A DRIVERS MENTION, ON ONE NODE.
   *
   * This is the commonest node on an ordinary run and it had no case anywhere.
   * `vm.drivers.findings` is every live driver while the glance caps at three,
   * so every rank-1-to-3 node receives BOTH the glance chip and a drivers
   * mention — and `driverFinding` sets that mention's headline to
   * `d.factorLabel`, the node's own label. The detail therefore rendered:
   *
   *     detail-title         Platform Capability Fit
   *     detail-driver chip   What matters most
   *     detail-mention       Also in Drivers and dynamics: Platform Capability Fit
   *
   * The pointer's payload was the title directly above it. Paul measured the
   * same restatement class on deployed `19fe87` and `ModelStrip.tsx`'s header
   * records it; this line would have added a fourth rendering of one name.
   *
   * ⚠ THE PRECONDITION IS ASSERTED IN-TEST rather than assumed: the chip must
   * be present and the title must carry the label, or the mention assertion
   * below is satisfied by a detail that simply is not the defective class
   * (CLAUDE.md trap 13b).
   */
  it('⛔ a node the glance named AND the Drivers section names does not say its name twice', () => {
    show(
      index(
        [{ id: `driver:${PCF}`, section: 'drivers', headline: PCF_LABEL }],
        // ⚠ THE DRIVER'S OWN LABEL, which is what `buildNodeInsights` stores —
        // the chip's wording is the copy module's and is asserted separately.
        PCF_LABEL,
      ),
    )

    // PRECONDITION — this really is the rank-1-to-3 class, not a bare mention.
    expect(screen.getByTestId(`${TID}-detail-driver`)).toHaveTextContent(
      COPY.glance.whatMattersMost,
    )
    expect(screen.getByTestId(`${TID}-detail-title`).textContent).toContain(PCF_LABEL)

    // THE POINTER. It still points — the section is named, so the reader knows
    // where to go — and it no longer hands back the name they are looking at.
    const line = screen.getByTestId(`${TID}-detail-mention`)
    expect(line).toHaveAttribute('data-mention-section', 'drivers')
    expect(line.textContent).toBe(`Also in ${COPY.sections.drivers}`)
    expect(line.textContent).not.toContain(PCF_LABEL)
    expect(line.textContent).not.toContain(':')

    // And the denial stays gone: the panel IS talking about this node.
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
  })

  /*
   * ⭐ THE OPPOSITE-DIRECTION TWIN FOR THAT FIX. Suppressing every pointer's
   * payload, or deleting the mention line, would satisfy the case above and be
   * a worse defect — the reader would lose the one sentence the title cannot
   * restate. Same node, same chip, a KEY INSIGHTS mention this time, and its
   * payload must survive intact.
   */
  it('⛔ the same node keeps a Key insights payload — the drop is scoped, not general', () => {
    show(index([HINGE], PCF_LABEL))

    expect(screen.getByTestId(`${TID}-detail-driver`)).toHaveTextContent(
      COPY.glance.whatMattersMost,
    )
    const line = screen.getByTestId(`${TID}-detail-mention`)
    expect(line).toHaveAttribute('data-mention-section', 'keyInsights')
    expect(line.textContent).toBe(`Also in ${COPY.sections.keyInsights}: ${HINGE.headline}`)
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

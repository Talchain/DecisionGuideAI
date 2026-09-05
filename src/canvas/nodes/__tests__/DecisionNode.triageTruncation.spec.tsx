/**
 * The "Top gap:" triage line's truncation rule — pinned, because this PR
 * CHANGED it and nothing could see the change in either direction.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `truncateAtWord` (`DecisionNode.tsx`) was rewritten in this PR so it never
 * cuts inside a word. Its two PRE-EXISTING callers are the triage line at
 * `DecisionNode.tsx:274` and `:313` (`Top gap: estimate …` / `Top gap: validate
 * …`, measure 40) — a user-visible sentence that has nothing to do with the
 * anchor brief the rewrite was written for. The two specs that already touch
 * this line (`DecisionNode.restingState.spec.tsx`, `.triageProvenance.spec.tsx`)
 * both use "Brand perception", 16 characters, which never reaches the measure.
 * So the behaviour moved under a green suite. Measured on the real change:
 *
 *   input   "Use a supercalifragilisticexpialidociousmetricvalue here"
 *   OLD(40) "Use a supercalifragilisticexpialidocious…"   ← cut MID-WORD
 *   NEW(40) "Use a…"                                      ← cut at the word
 *
 * The new rule is the better rule. It is also a material shortening of a live
 * sentence, and an undisclosed, unpinned user-visible change is the finding —
 * not the change.
 *
 * CLAIM TYPE: rendered TEXT, exact string. Not visibility, not layout
 * (platform trap 3 — jsdom does no layout, so nothing here is evidence about
 * pixels or about whether the line overflows its card).
 *
 * BINDING BY IDENTITY, NOT BY PREDICATE (trap 19). Every assertion names the
 * WHOLE triage sentence, so it cannot be satisfied by some other node's copy
 * that happens to contain the same fragment. Proven with a discriminating
 * mutant pair: reverting the truncator's rule REDs these tests; renaming an
 * unrelated factor leaves them GREEN.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  edges: [],
  nodes: [],
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'decision-1',
  type: 'decision',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  data: { label: 'Should we hire?', type: 'decision' },
}

/** The measure the two triage call sites pass. Not a magic number here. */
const TRIAGE_MEASURE = 40

/**
 * A graph that reaches triage rule 2 and prints "Top gap: validate <label>".
 *
 * ⚠ THE PRECONDITION IS PINNED IN-TEST, not assumed (trap 13b): every case
 * asserts its own label is LONGER than the measure before asserting what the
 * line says, so a test can never pass because the fixture quietly stopped
 * reaching the truncator. `otherLabel` exists only so the mutant pair has an
 * unrelated string to move.
 */
function graph(inferredLabel: string, otherLabel = 'Headcount') {
  const strength = { weightSource: 'cee' as const }
  return makeStoreState({
    nodes: [
      {
        id: 'fac-inferred',
        type: 'factor',
        data: {
          type: 'factor',
          label: inferredLabel,
          observedState: { value: 5, extractionType: 'inferred' },
        },
      },
      {
        id: 'fac-known',
        type: 'factor',
        data: {
          type: 'factor',
          label: otherLabel,
          observedState: { value: 12, extractionType: 'stated' },
        },
      },
      { id: 'out-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
      { id: 'out-2', type: 'outcome', data: { type: 'outcome', label: 'Margin' } },
      { id: 'opt-1', type: 'option', data: { type: 'option' } },
      { id: 'opt-2', type: 'option', data: { type: 'option' } },
      { id: 'opt-3', type: 'option', data: { type: 'option' } },
    ],
    edges: [
      { id: 'e1', source: 'fac-inferred', target: 'out-1', data: { weight: 0.3, direction: 'positive', ...strength } },
      { id: 'e2', source: 'fac-inferred', target: 'out-2', data: { weight: 0.3, direction: 'positive', ...strength } },
      { id: 'e3', source: 'fac-known', target: 'out-1', data: { weight: 0.3, direction: 'positive', ...strength } },
      { id: 'e4', source: 'decision-1', target: 'opt-1' },
      { id: 'e5', source: 'decision-1', target: 'opt-2' },
      { id: 'e6', source: 'decision-1', target: 'opt-3' },
    ],
    goalThreshold: { value: 100, direction: 'above' },
  })
}

const renderWith = (inferredLabel: string, otherLabel?: string) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(graph(inferredLabel, otherLabel) as never),
  )
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as unknown as React.ComponentProps<typeof DecisionNode>)} />
    </ReactFlowProvider>,
  )
}

describe('DecisionNode triage line — truncation never cuts inside a word', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * THE DISCRIMINATING CASE. The second word runs past the measure, so the old
   * 0.6-heuristic rule kept a mid-word fragment of it and the new rule drops it
   * whole. Both halves are asserted: the sentence the user now sees, and the
   * absence of the fragment they used to see.
   */
  it('drops a word that runs past the measure rather than cutting it open', () => {
    const label = 'Use a supercalifragilisticexpialidociousmetricvalue here'
    expect(label.length).toBeGreaterThan(TRIAGE_MEASURE)

    renderWith(label)

    expect(screen.getByText('Top gap: validate Use a…')).toBeTruthy()
    // The mid-word fragment the OLD rule shipped. Asserted absent by its own
    // text, so this REDs if the old behaviour ever returns.
    expect(screen.queryByText(/supercalifragilisticexpialidocious…/)).toBeNull()
    expect(screen.queryByText(/supercalifragilisticexpialidocious[^m]/)).toBeNull()
  })

  /**
   * The ordinary long label — several words, a boundary at or before the
   * measure. The cut lands on that boundary, and the word after it is gone
   * entirely rather than clipped.
   */
  it('cuts at the last word boundary at or before the measure', () => {
    const label = 'Snowflake-Native Build Capacity In The Data Platform Team'
    expect(label.length).toBeGreaterThan(TRIAGE_MEASURE)

    renderWith(label)

    expect(screen.getByText('Top gap: validate Snowflake-Native Build Capacity In The…')).toBeTruthy()
    expect(screen.queryByText(/In The Dat/)).toBeNull()
  })

  /**
   * ⚠ THE DELIBERATE OVERRUN, AND IT IS THE ONE WITH A CONSEQUENCE. A single
   * unbroken token has no boundary to cut at, so the rule returns it WHOLE and
   * the string exceeds the measure. On the anchor brief that is bounded by
   * `line-clamp-3`; the triage line has NO clamp, so this is the case where
   * the new rule can make the line longer than the old one did (60 characters
   * here against the old rule's 41). Pinned so the trade is visible, and rowed
   * in the PR body rather than silently absorbed.
   */
  it('returns a single unbroken token whole, exceeding the measure by design', () => {
    const token = 'Snowflakenativebuildcapacityinthedataplatformteamnow'
    expect(token.length).toBeGreaterThan(TRIAGE_MEASURE)
    expect(token).not.toContain(' ')

    renderWith(token)

    expect(screen.getByText(`Top gap: validate ${token}`)).toBeTruthy()
    // No ellipsis anywhere on this line: nothing was cut, so nothing may claim
    // to have been.
    expect(screen.queryByText(/Top gap: validate .*…/)).toBeNull()
  })

  /**
   * The control that lets this file PASS as well as fail: a label under the
   * measure is returned untouched, with no ellipsis invented.
   */
  it('leaves a label shorter than the measure exactly as it is', () => {
    const label = 'Brand perception'
    expect(label.length).toBeLessThan(TRIAGE_MEASURE)

    renderWith(label)

    expect(screen.getByText('Top gap: validate Brand perception')).toBeTruthy()
  })
})

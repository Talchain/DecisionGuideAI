/**
 * ⭐⭐ "UNWRITTEN" IS TWO STATES AND THE CARD READ ONLY ONE.
 *
 * ## Witnessed, not inferred
 *
 * Deployed build `079d080b`, CEE `0c0c503`, guest, fresh browser context, a
 * FRESH draft from a typed brief, read at the product's own terminal beat (the
 * *"values and coaching are still arriving"* notice cleared and the card count
 * stable across three samples — 63 s). The anchor card of the whole model
 * rendered with the single word **"Question"** as its title and nothing else:
 * no unwritten line, no CTA.
 *
 * Meanwhile the Model tab, reading the SAME node, correctly reported the
 * question as `unwritten` — `projectModelQuestion` → `labelIsTypeDefault`,
 * which compares against `DECISION_NODE_LABEL` by VALUE.
 *
 * ⛔ **Two internally-consistent authorities disagreeing about one fact**, with
 * nothing to tell the reader which to believe. CLAUDE.md trap 21, on the most
 * prominent card on the canvas.
 *
 * ## The cause was one predicate, and it is not a copy change
 *
 * `DecisionNode` asked `restingLabel.length === 0`. An empty label is
 * unwritten; so is the type's own default name — and only the first has zero
 * length. The arm it gates was already built and already correct:
 * `DECISION_RESTING_COPY.unnamedLine` / `.unnamedCta`, reaching `requestAsk`,
 * which prefills an editable draft the user presses Send on and never
 * auto-sends. **Nothing here is new copy; the existing arm simply was not being
 * reached.**
 *
 * ⚠ AND THAT IS WHY WIDENING IT IS SAFE RATHER THAN A MARKER WITH NO MOVE. The
 * estate has shipped the opposite defect — a sentence telling the reader to set
 * a value while the only control that could was greyed out. Here the move
 * exists, is gated on `canReceiveAsk`, and is exercised below.
 *
 * ## What these tests bind to
 *
 * The valuable mutant is **not** "does the unwritten line render" — a card
 * hardcoded to always show it would pass that. It is **does a question a person
 * actually wrote still read as written**. So every binding test has its
 * opposite-direction twin, and the twin is the one that would catch the
 * failure mode that makes this worse than the defect.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode, DECISION_RESTING_COPY } from '../DecisionNode'
import { DECISION_NODE_LABEL, decisionLabelIsUnwritten } from '../../domain/vocabulary'
import { labelIsTypeDefault } from '../../model-tab-v2/rowPresentation'
import { useGuidanceStore } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const hoisted = vi.hoisted(() => ({ state: null as any }))
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => unknown) => selector(hoisted.state)),
    { getState: () => hoisted.state },
  ),
}))

const DECISION_ID = 'decision-1'
const setStore = () => {
  hoisted.state = {
    edges: [], nodes: [{ id: DECISION_ID, type: 'decision', data: { type: 'decision' } }],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(), dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null, goalConstraints: [], viewMode: 'standard',
    selectNodeWithoutHistory: vi.fn(),
  }
}

function renderCard(label: string) {
  setStore()
  render(
    <ReactFlowProvider>
      {/* ⚠ `as never` on a SPREAD is a TS2698 (`Spread types may only be
          created from object types`) and the typecheck gate caught it — the
          cast has to land on the props TYPE, not on the object being spread. */}
      <DecisionNode
        {...({
          id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 }, selected: false,
          isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false,
          zIndex: 0, data: { label, type: 'decision' },
        } as unknown as React.ComponentProps<typeof DecisionNode>)}
      />
    </ReactFlowProvider>,
  )
}

describe('the Question card knows when its question is unwritten', () => {
  /**
   * ⚠ A COMPOSER IS REGISTERED DELIBERATELY. The CTA is gated on
   * `canReceiveAsk` — with no conversation surface at all the affordance must
   * not render rather than pretend, which is that module's own rule. Without
   * this the CTA assertions would fail for a reason unrelated to the predicate
   * under test, and the failure would look like the fix not working.
   */
  beforeEach(() => {
    useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn() } as never)
  })
  afterEach(() => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
  })

  it('⭐ a card still carrying the TYPE DEFAULT says so, and offers the move', () => {
    renderCard(DECISION_NODE_LABEL)
    expect(screen.getByText(DECISION_RESTING_COPY.unnamedLine)).toBeTruthy()
    expect(screen.getByText(DECISION_RESTING_COPY.unnamedCta)).toBeTruthy()
  })

  /**
   * ⭐⭐ THE MOVE IS REAL, BOUND AT ITS DESTINATION. The estate has shipped a
   * state marker whose only prescribed action was unreachable; asserting the
   * CTA exists would repeat that. This asserts the COMPOSER RECEIVES THE TEXT
   * — and that nothing is sent for the user.
   */
  it('⭐ the CTA prefills the composer with the ask, and sends nothing', () => {
    const prefill = vi.fn(); const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: vi.fn() } as never)
    renderCard(DECISION_NODE_LABEL)
    fireEvent.click(screen.getByText(DECISION_RESTING_COPY.unnamedCta))
    expect(prefill).toHaveBeenCalledWith(DECISION_RESTING_COPY.unnamedAsk)
    expect(send).not.toHaveBeenCalled()
  })

  /**
   * ⛔ THE TWIN THAT MATTERS MOST. Treating every decision node as unwritten
   * would erase every question a user HAS written — worse than the defect this
   * closes. A card hardcoded to show the unwritten arm passes the test above
   * and fails this one.
   */
  it('⛔ CONTRAST: a question a person WROTE still reads as written', () => {
    renderCard('Should we move upmarket or double down on self-serve?')
    expect(screen.queryByText(DECISION_RESTING_COPY.unnamedLine)).toBeNull()
    expect(screen.queryByText(DECISION_RESTING_COPY.unnamedCta)).toBeNull()
  })

  /**
   * ⚠ THE PRE-EXISTING CASE MUST NOT REGRESS. The empty label was the one state
   * the old predicate DID see; a widening that swapped one arm for the other
   * rather than covering both would pass the first test and lose this one.
   */
  it('an EMPTY label is still unwritten — the case the old predicate did see', () => {
    renderCard('')
    expect(screen.getByText(DECISION_RESTING_COPY.unnamedLine)).toBeTruthy()
  })

  it('whitespace around the default name does not smuggle it past the check', () => {
    renderCard(`  ${DECISION_NODE_LABEL}  `)
    expect(screen.getByText(DECISION_RESTING_COPY.unnamedLine)).toBeTruthy()
  })

  /**
   * ⚠ A label that merely CONTAINS the word is a written question. "is a
   * substring of" is not "is this thing" — the estate has shipped that
   * confusion twice, most recently inside a guard written to prevent it.
   */
  it('⛔ CONTRAST: a written question that CONTAINS the word is not the default', () => {
    renderCard('Which Question should we answer first?')
    expect(screen.queryByText(DECISION_RESTING_COPY.unnamedLine)).toBeNull()
  })
})

/**
 * ⭐⭐ ONE DEFINITION, TWO CONSUMERS — the half that stops this recurring.
 *
 * Fixing the canvas alone would leave two comparisons that happen to agree
 * today, which is the hand-maintained mirror `domain/vocabulary.ts` exists to
 * abolish and exactly how the two surfaces drifted apart in the first place.
 * `labelIsTypeDefault` now DELEGATES to `decisionLabelIsUnwritten`, so these
 * cannot disagree — and this pins that they cannot, rather than that they
 * currently do not.
 */
describe('the Model tab and the canvas cannot disagree about one node', () => {
  const CASES: ReadonlyArray<readonly [string, boolean]> = [
    [DECISION_NODE_LABEL, true],
    [`  ${DECISION_NODE_LABEL} `, true],
    ['Should we move upmarket?', false],
    ['Which Question should we answer first?', false],
    ['', false],
  ]

  it.each(CASES)('agrees on %j', (label, expected) => {
    expect(decisionLabelIsUnwritten(label)).toBe(expected)
    expect(labelIsTypeDefault({ kind: 'decision', label })).toBe(expected)
  })

  /**
   * ⛔ THE KIND CHECK STAYS WHERE THE MIXED-KIND ROWS ARE. Only the Model tab is
   * handed rows of every kind, so only it asks the kind question — and a goal
   * row that happened to be named "Question" must not be muted as an unwritten
   * decision. Without this, moving the comparison could quietly move the kind
   * check with it.
   */
  it('⛔ a GOAL row named "Question" is not an unwritten decision', () => {
    expect(labelIsTypeDefault({ kind: 'goal', label: DECISION_NODE_LABEL })).toBe(false)
  })
})

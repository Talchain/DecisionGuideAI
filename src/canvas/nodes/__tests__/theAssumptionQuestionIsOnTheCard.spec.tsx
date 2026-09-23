/**
 * ⭐⭐⭐ THE FACTOR WAS THE ONE KIND WITH NO QUESTION ON ITS FACE.
 *
 * `DecisionNode` broke the "AI chips live in popovers" rule on purpose and said
 * why — **the invitations belong on the card, not behind a hover** — and a later
 * change put one question on the face of the Risk, Outcome, Action and Goal
 * cards for the same reason, measured on deployed `9748b336` where every
 * coaching chip on the canvas read ZERO in the resting state because a closed
 * `NodePopover` returns null.
 *
 * FACTOR was not done. Its chips stayed hover-only — and hover has no touch
 * equivalent — on the kind that carries the model's assumptions.
 *
 * ⛔ AND THEY WERE DELETED AFTER A RUN, which is backwards. The moment the model
 * says a factor drives the result is the moment "what evidence supports this?"
 * is worth asking. Risk and Outcome render theirs in both phases; this matches.
 *
 * ## What these tests are for
 *
 * Not "does a chip exist". The valuable claims are that the question is bound to
 * WHAT THE PRODUCER SAYS THE VALUE IS, that it survives the run, and that it
 * stays absent where there is no assumption to interrogate — because a chip on
 * every card is wallpaper, not coaching.
 *
 * ## Locked Canvas design (23 Sep 2026) — the question MOVED, it did not go
 *
 * Spec §2 / ED 11:52Z point 3 / ED 02:31Z D4: "Coaching is one consistent
 * icon". The face's chip row (`factor-card-question`) is removed and the card's
 * ONE question is asked by the rail's coaching icon (`node-coaching-icon-<id>`),
 * which sits in the resting band BaseNode already reserves — still on the card,
 * still no hover. Every claim below is re-pointed to that icon at the same
 * identity: its accessible name IS the chip's label, from the same resolver.
 * The chip row's absence from the face is asserted beside each presence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const ID = 'fac_churn'
const state = (resultsStatus: string) => ({
  selectedNodeId: null, hoveredOptionId: null, nodes: [], edges: [],
  ceeAnalysisReady: null, results: { status: resultsStatus, report: null },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { active: null, _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), _evidenceNodeClass: new Map() },
  goalThreshold: null, goalConstraints: [], viewMode: 'standard', lodRung: 'full',
  guidanceItems: [],
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn((s) => s(state('idle'))) }))

const props = {
  type: 'factor', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  deletable: true, selectable: true, draggable: true, width: 240, height: 100,
  sourcePosition: undefined, targetPosition: undefined,
}

/** `data` decides which question, so each arm supplies its own producer fields. */
function renderFactor(data: Record<string, unknown>, resultsStatus = 'idle') {
  cleanup()
  vi.mocked(useCanvasStore).mockImplementation((sel) => (sel as (s: unknown) => unknown)(state(resultsStatus) as never))
  render(
    <ReactFlowProvider>
      <FactorNode {...props} id={ID} data={{ label: 'Monthly churn', kind: 'factor', ...data }} />
    </ReactFlowProvider>,
  )
  // Positive control: the card mounted before any absence is asserted (trap 13).
  expect(screen.getByTestId('node-title'), 'the card did not mount').toBeTruthy()
}

const INFERRED = { observedState: { value: 0.4, extractionType: 'inferred' }, category: 'controllable' }

/** The rail's coaching icon for this card — the question's home since 23 Sep 2026. */
const ICON = `node-coaching-icon-${ID}`

/**
 * The icon asks only where an ask surface is registered (`canReceiveAsk`) — it
 * renders nothing in a harness with no chat. Registered here so absence below
 * means "no question", never "no chat".
 */
beforeEach(() => {
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as never)
})

describe('the factor card carries its own question, like every other kind', () => {
  it('⭐ an INFERRED value asks what evidence supports it — on the card, no hover', () => {
    renderFactor(INFERRED)
    // Locked Canvas design (23 Sep 2026), spec §2: no chip row on the face…
    expect(screen.queryByTestId('factor-card-question')).toBeNull()
    // …the rail's one coaching icon asks it, at rest (no hover needed).
    expect(screen.getByTestId(ICON)).toHaveAccessibleName('What’s the evidence?')
    // …and no duplicate generic "Ask Olumi" beside it (ED 02:31Z D4).
    expect(screen.queryByTestId(`node-action-ask-${ID}`)).toBeNull()
  })

  /**
   * ⭐⭐ THE CLAIM THAT MATTERS MOST. `factorChips` returned null when
   * `isPostAnalysis`, so the question vanished exactly when the model had just
   * finished telling the reader this factor drives the result.
   */
  it('⭐ and it SURVIVES the run — the assumption does not stop being one', () => {
    renderFactor(INFERRED, 'complete')
    expect(screen.queryByTestId('factor-card-question')).toBeNull()
    expect(screen.getByTestId(ICON)).toHaveAccessibleName('What’s the evidence?')
  })

  /**
   * ⛔ DISCRIMINATING TWIN #1 — bound to the producer's field, not hardcoded.
   * Without it, a card emitting one constant question would pass everything above.
   */
  it('⛔ CONTRAST: an EXTERNAL factor asks a different question', () => {
    renderFactor({ observedState: { value: 0.4, extractionType: 'inferred' }, category: 'external' })
    expect(screen.queryByTestId('factor-card-question')).toBeNull()
    const q = screen.getByTestId(ICON)
    expect(q).toHaveAccessibleName('What if this changes?')
    expect(q).not.toHaveAccessibleName('What’s the evidence?')
  })

  /**
   * ⛔ DISCRIMINATING TWIN #2 — silence is part of the design. A question on
   * every card is wallpaper; where the reader owns the value there is no
   * assumption to interrogate.
   */
  it('⛔ CONTRAST: an OWNED, observed value gets no question at all', () => {
    renderFactor({ observedState: { value: 0.4, extractionType: 'observed', source: 'user' }, category: 'controllable' })
    expect(screen.queryByTestId('factor-card-question')).toBeNull()
    expect(screen.queryByTestId(ICON)).toBeNull()
    // ⚠ NON-VACUITY for the icon's absence: the ask surface IS registered and the
    // rail IS mounted — the generic "Ask Olumi" quick action renders in the
    // coaching icon's place exactly when the card has no question to ask.
    expect(screen.getByTestId(`node-action-ask-${ID}`)).toBeTruthy()
  })
})

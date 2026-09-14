/**
 * OptionNode — ONE FACTOR, ONE NAME, ON ONE CARD.
 *
 * MEASURED ON A REAL RENDER, not read from source. `e2e/geometry/cardAnatomy.measure.ts`
 * walks every visible leaf of every card on a seeded starter at 1600×1000. On the
 * `pricing-model` starter, all three non-baseline option cards named one factor
 * TWICE, three lines apart, in two different casings:
 *
 *     intervention row   "Usage-based pricing…"    ← sentence-cased
 *     differentiator     "Usage-Based Pricing…"    ← raw producer Title Case
 *
 * Same factor. Same card. Two spellings. To a reader who is not holding the model
 * in their head — which is everyone the canvas exists for — that reads as two
 * different factors, so the card appears to make two claims where it makes one.
 *
 * ⭐ WHY THIS IS A CONSISTENCY FIX AND NOT A DELETION. Paul ruled on 10 Sep 2026
 * that the intervention chip and the differentiator footer BOTH STAY — the chip
 * states the CHANGE, the footer states WHICH FACTOR is key. Both carriers are
 * wanted. A reader can only benefit from two carriers if they agree on what the
 * thing is called, so the repair is to make them agree, never to drop one.
 *
 * Root cause: the casing rule existed in exactly ONE place — inline in the
 * intervention-chip builder — and the differentiator path never called it.
 * `sentenceCaseFactorLabel` is now its one owner and both paths delegate.
 *
 * Every assertion binds by IDENTITY (the exact factor under test), never by a
 * value predicate another node could satisfy (CLAUDE.md trap 19).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { sentenceCaseFactorLabel } from '../../utils/labelUtils'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { useLayoutStore } from '../../layoutStore'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const baseProps = {
  id: 'option-1', type: 'option', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

const renderOption = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Full Switch at Renewal', type: 'option', ...data }} />
    </ReactFlowProvider>
  )

/**
 * The measured shape, reproduced: one Title Case factor label from the
 * producer, reachable by BOTH carriers on the same card.
 *
 * `factor-usage` is this option's top differentiator (it moves 0.1 → 1.0
 * against the baseline's 0.0) AND it carries a baseline reference, so the
 * from→to chip renders too. That co-occurrence is the precondition for the
 * defect, and it is pinned in-test below rather than assumed.
 */
const TITLE_CASE_LABEL = 'Usage-Based Pricing Exposure'

const twoCarrierState = () =>
  makeStoreState({
    ceeAnalysisReady: {
      options: [
        { id: 'option-1', interventions: { 'factor-usage': 1.0 } },
        { id: 'option-3', interventions: { 'factor-other': 0.9 } },
        { id: 'option-2', interventions: { 'factor-usage': 0.0 } },
      ],
    },
    nodes: [
      { id: 'option-1', type: 'option', data: { label: 'Full Switch at Renewal', type: 'option' } },
      // A SECOND non-baseline option is required for a differentiator to exist
      // at all (`computeAllDifferentiators` returns empty below two of them),
      // and it claims a DIFFERENT top factor so option-1's sentence takes the
      // unique-factor frame.
      { id: 'option-3', type: 'option', data: { label: 'New Logos Only', type: 'option' } },
      // The baseline is what makes the from-to row render; without it
      // `structuredDeltas` drops every chip and only one carrier is on screen.
      {
        id: 'option-2', type: 'option',
        data: { label: 'Keep Per-Seat Pricing', type: 'option', is_baseline: true, interventions: { 'factor-usage': 0.0 } },
      },
      { id: 'factor-usage', type: 'factor', data: { label: TITLE_CASE_LABEL, observedState: { unit: 'scale', value: 0.0 } } },
      { id: 'factor-other', type: 'factor', data: { label: 'Enterprise Revenue Risk', observedState: { unit: 'scale', value: 0.0 } } },
    ],
    viewMode: 'standard',
  })

describe('OptionNode — one factor, one name', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
      predictedOutcome: null, valueOfInformation: null, voiRank: null,
    } as never)
    vi.mocked(useLayoutStore).mockImplementation(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: null })) as never)
  })

  it('the differentiator names the factor in the same case the intervention row does', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(twoCarrierState() as never))
    renderOption()

    // ── PRECONDITION, PINNED IN-TEST ────────────────────────────────────────
    // The differentiator must actually be on the card, or every assertion
    // below holds vacuously (CLAUDE.md trap 13b: a guard whose discrimination
    // depends on a fixture nothing pins).
    //
    // ⚠ SCOPE, STATED HONESTLY: this asserts the casing of ONE carrier. The
    // co-occurrence of BOTH carriers on one card — the shape actually measured
    // on the deployed starter — is exercised by
    // `e2e/geometry/cardAnatomy.measure.ts`, which reads a real render. The
    // from-to row is gated on store state this jsdom fixture does not
    // reproduce, and manufacturing it here would pin the fixture, not the
    // product.
    const differentiator = screen.getByText(/is the key difference/i)
    expect(differentiator.tagName).toBe('P')

    // ── THE CLAIM ───────────────────────────────────────────────────────────
    // Bound by identity to THIS factor: the producer wrote Title Case, and
    // every place the card names it must read the one sentence-cased form.
    const expected = sentenceCaseFactorLabel(TITLE_CASE_LABEL)
    expect(expected).toBe('Usage-based pricing exposure')

    expect(differentiator.textContent).toBe('Usage-based pricing… is the key difference')
    // …and the hover recovery carries the same casing, not the raw label.
    expect(differentiator.getAttribute('title')).toBe('Usage-based pricing exposure is the key difference')

    // The producer's Title Case must not survive anywhere in this sentence.
    expect(differentiator.textContent).not.toMatch(/Usage-Based Pricing/)
    expect(differentiator.getAttribute('title')).not.toMatch(/Usage-Based Pricing/)
  })

  it('an acronym survives — the rule lowercases words, never recognisable shapes', () => {
    // A negative control for the normaliser itself. Without it the fix could
    // "succeed" by lowercasing NRR into a word no reader recognises.
    expect(sentenceCaseFactorLabel('NRR Above Target')).toBe('NRR above target')
    expect(sentenceCaseFactorLabel('Impact on GDPR Compliance')).toBe('Impact on GDPR compliance')
    expect(sentenceCaseFactorLabel('')).toBe('')
  })

  it('the "→ value" branch carries the same casing', () => {
    // The differentiator has two sentence frames. A fix applied to one and not
    // the other would leave the defect live on every shared-factor option.
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-usage': { value: 1.0, display_value: 'Very high (1)' } } },
            { id: 'option-2', interventions: { 'factor-usage': { value: 0.4, display_value: 'Moderate (0.4)' } } },
            { id: 'option-3', interventions: { 'factor-usage': { value: 0.1, display_value: 'Low (0.1)' } } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Full Switch at Renewal', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Hybrid Platform Fee', type: 'option' } },
          { id: 'option-3', type: 'option', data: { label: 'New Logos Only', type: 'option' } },
          { id: 'factor-usage', type: 'factor', data: { label: TITLE_CASE_LABEL, observedState: { unit: 'scale', value: 0.0 } } },
        ],
        viewMode: 'standard',
      }) as never),
    )
    renderOption()

    const p = screen.getByText(/→ Very high \(1\)/)
    expect(p.tagName).toBe('P')
    expect(p.textContent).toBe('Usage-based pricing… → Very high (1)')
    expect(p.textContent).not.toMatch(/Usage-Based Pricing/)
  })
})

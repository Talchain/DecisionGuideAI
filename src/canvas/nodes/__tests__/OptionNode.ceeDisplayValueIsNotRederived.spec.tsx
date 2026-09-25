/**
 * ⭐⭐ THE CARD MUST PRINT THE NUMBER CEE AUTHORED, NOT RE-DERIVE ONE.
 *
 * WITNESSED ON PAUL'S MODEL TWICE IN ONE DAY, on two different boards:
 *
 *   1. bundle `a039817e` (20 Sep) — CEE sent
 *      `intervention_details["8b2b48ae"] = { display_value: "£18k",
 *      normalised_value: 0.9, raw_value: 18000, unit: "£" }`.
 *      The card rendered **"No ad spend in place → £0.9"**.
 *   2. bundle `d41770fd` (20 Sep) — the "Warm Intro via Network" card captioned
 *      itself *"Investor relationship… is the key difference"* and **did not
 *      show that difference**, while CEE had authored `"0.8 scale"` for it.
 *
 * ⭐ THE CAUSE IS ONE LINE, AND IT IS A SHAPE MISMATCH, NOT A FORMATTER BUG.
 * `formatInterventionTargetText` has always opened with the F.6 passthrough
 * (`if (chip.displayValue) return chip.displayValue`), and
 * `unwrapInterventionValue` has always read `display_value` off a NESTED
 * intervention.
 *
 * ⚠⚠ THIS BLOCK ONCE SAID *"But CEE does not send a nested intervention"*, FLATLY,
 * AND THAT SENTENCE IS WITHDRAWN. **Both shapes are real.** The served bundles
 * above carry the FLAT one; all five committed starter drafts carry the NESTED
 * one (70 interventions; `src/types/options.ts:79` declares exactly that shape).
 * The defect was never that one shape is fictional — it is that the code handled
 * ONE and the served payload used the OTHER, so the fix is a compatibility
 * adapter over both rather than a switch from one to the other.
 *
 * Correcting it here because the implementation, the utility corpus and
 * `joinInterventionDetails`' own docblock all withdrew the premise while this
 * header kept asserting it — and a false premise in a spec header is exactly
 * what made the original defect invisible. What the SERVED bundles send is:
 *
 *     options[i].interventions         = { "<factorId>": 0.9 }          ← flat number
 *     options[i].intervention_details  = { "<factorId>": { display_value: "£18k", … } }
 *
 * — a SIBLING map the chip builder never read. So `displayValue` was always
 * `undefined` on the served path, the passthrough could never fire, and the UI
 * fell through to `inferInterventionScaleBase`, which needs the FACTOR's
 * `observed_state` anchor. Advertising Spend's baseline is `0`, so no anchor
 * existed and the normalised `0.9` was printed with the unit: **"£0.9"**.
 *
 * ⚠⚠ AND THIS IS WHY NO EXISTING TEST COULD SEE IT (CLAUDE.md trap 16-inverse:
 * *a fixture you wrote yourself is not evidence about the wire*). Every prior
 * OptionNode spec builds `interventions: { 'f-head': { value: 3, display_value:
 * '3 engineers' } }` — the nested shape, which the code already handled.
 *
 * ⚠ AND THE ORIGINAL SENTENCE HERE — *"the shape the producer never emits"* — IS
 * ALSO WITHDRAWN, for the same reason as above. That shape IS emitted, by the
 * starter drafts. The honest statement is narrower and is the whole point: those
 * fixtures exercised **only** the shape the code already handled, so the suites
 * could be green while the shape the SERVED bundles use fell straight through.
 * A corpus that covers one member of a union certifies nothing about the other
 * (CLAUDE.md trap 13d: check what your corpus EXCLUDES, not what it covers).
 * These fixtures use the SERVED shape, copied from the two bundles above; the
 * nested shape is covered at the boundary in `labelUtils.spec.ts`.
 *
 * Paul's ruling, 20 Sep: *"the graph … should display the data model accurately,
 * operating as a thin layer, not performing excessive data manipulation."*
 * CEE authored the string; the card prints it.
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): jsdom text assertions. They prove PRESENCE
 * and ABSENCE of text in the DOM, never layout or visibility.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { optionCardRows } from './__helpers__/optionPreview'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/**
 * Advertising Spend, exactly as bundle `a039817e` carries it: a real currency
 * unit and a baseline of ZERO — the state that defeats every scale-recovery
 * path, because `inferInterventionScaleBase` requires `observedValue > 0`.
 */
const FACTOR_SPEND = {
  id: 'f-spend',
  type: 'factor',
  data: {
    label: 'Advertising Spend',
    type: 'factor',
    observedState: { value: 0, unit: '£', raw_value: 0 },
    unit: '£',
  },
}

/**
 * Investor Relationship Strength, exactly as bundle `d41770fd` carries it:
 * `unit: "scale"` and NO `raw_value` on the factor at all, so the UI has no
 * native anchor and suppresses the whole value — which is how a card came to
 * name a key difference it did not show.
 */
const FACTOR_SCALE = {
  id: 'f-rel',
  type: 'factor',
  data: {
    label: 'Investor Relationship Strength',
    type: 'factor',
    observedState: { value: 0.2, unit: 'scale' },
    unit: 'scale',
  },
}

const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Warm Intro via Network', type: 'option' } }
const OPTION_B = { id: 'option-b', type: 'option', data: { label: 'Status Quo', type: 'option', is_baseline: true } }

/**
 * ⭐ THE WIRE SHAPE. Flat `interventions` + sibling `intervention_details`,
 * copied from `analysis_ready.options[*]` in both bundles. Every one of the
 * four options in `d41770fd` carries details for every intervention, so this
 * is the ordinary case and not an edge one.
 */
const CEE_WIRE = {
  options: [
    {
      id: 'option-b',
      interventions: { 'f-spend': 0, 'f-rel': 0.2 },
      intervention_details: {
        'f-spend': { display_value: '£0', normalised_value: 0, raw_value: 0, unit: '£' },
        'f-rel': { display_value: '0.2 scale', normalised_value: 0.2, raw_value: 0.2, unit: 'scale' },
      },
    },
    {
      id: 'option-1',
      interventions: { 'f-spend': 0.9, 'f-rel': 0.8 },
      intervention_details: {
        'f-spend': { display_value: '£18k', normalised_value: 0.9, raw_value: 18000, unit: '£' },
        'f-rel': { display_value: '0.8 scale', normalised_value: 0.8, raw_value: 0.8, unit: 'scale' },
      },
    },
  ],
}

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [FACTOR_SPEND, FACTOR_SCALE, OPTION_1, OPTION_B],
  edges: [],
  ceeAnalysisReady: CEE_WIRE,
  results: { status: 'idle' },
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

const baseProps = {
  id: 'option-1', type: 'option', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

const renderCard = () => {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Warm Intro via Network', type: 'option' }} />
    </ReactFlowProvider>
  )
}

describe('OptionNode — CEE display_value is printed, never re-derived', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('prints the authored currency string, not the normalised number with a unit stuck on it', () => {
    const { container } = renderCard()
    const text = container.textContent ?? ''

    // The defect, stated as the user saw it on `a039817e`.
    expect(text).not.toMatch(/£0\.9(?!\d)/)
    // The authored string CEE sent for this very intervention.
    expect(text).toContain('£18k')
  })

  it('shows the baseline side from the authored string too, so the pair is one frame', () => {
    const { container } = renderCard()
    expect(container.textContent ?? '').toContain('£0')
  })

  it('does not silently drop an intervention whose unit the UI cannot anchor', async () => {
    // `d41770fd`: this is the change the card called "the key difference" and
    // then did not show. CEE authored both sides; the card states them.
    // Contract v3.1 pt 7 (gap U12): the placeholder WORD `scale` is dropped and
    // the authored figures kept — the factor card's rule — so the claim is now
    // bound to this option's row for this factor: CEE's own 0.2 → 0.8, no "scale".
    // The rows are ON THE CARD at rest (Paul 25 Sep, the prototype; the bounded
    // anatomy had moved them into the popover) — read there, by identity.
    renderCard()
    const row = optionCardRows('option-1').querySelector('[data-testid="option-change-row-option-1-f-rel"]')
    expect(row, 'the f-rel change row must render').not.toBeNull()
    expect(row!.textContent ?? '').toContain('0.2 → 0.8')
    expect(row!.textContent ?? '').not.toMatch(/scale/i)
  })

  /**
   * PRECONDITION GUARD (CLAUDE.md trap 13b — a guard whose discrimination
   * depends on a fixture nothing pins). If the fixture ever stops producing a
   * chip at all, the three assertions above would pass vacuously on an empty
   * card. This fails loudly instead.
   */
  it('PRECONDITION: the fixture renders an intervention chip for this option', () => {
    expect(renderCard().container.textContent ?? '').toMatch(/ad spend|Advertising|Investor Relationship|relationship/i)
  })
})

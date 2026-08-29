/**
 * THE TWO ACCORDIONS HOLDING THE DECISION SCIENCE OPEN ON ARRIVAL.
 *
 * ## The defect this pins
 *
 * A deployed-bundle census (29 Aug 2026) found the product's strongest
 * decision science shipped and collapsed shut: `accordion-tornado` ("What
 * could change the result" — rank-flip rates and fragile edges with their
 * alternative winner) and `accordion-stress-test` ("Stress-test your
 * decision" — the disconfirmation and outside-view challenges) both rendered
 * with `defaultExpanded={false}`. The census's words: *"the single biggest
 * loss: a tester sees a recommendation and never opens the two accordions
 * holding the actual decision science."*
 *
 * Nothing here is a new capability. Both sections were already built, already
 * mounted and already correct — they were simply unfindable.
 *
 * ## Why cases (c) and (d) are not padding (standing brief §3)
 *
 * The two assertions above are satisfied by TWO different implementations:
 * the intended one (flip these two call sites), and the wrong one (flip
 * `defaultExpanded`'s default in the shared `Accordion` primitive, which
 * would silently expand accordions all over the product).
 *
 * ⚠ CASE (c) ALONE DOES NOT CATCH THAT, AND AN EARLIER VERSION OF THIS
 * COMMENT CLAIMED IT DID. Measured, not assumed: mutating the primitive's
 * `defaultExpanded = false` to `true` left all three of (a)/(b)/(c) GREEN.
 * The reason is that `accordion-drivers` passes `defaultExpanded={false}`
 * EXPLICITLY (`ResultsBody.tsx:722`), so the parameter default never governs
 * it — a default is only reachable where the prop is OMITTED. The claim was
 * exactly the kind a green suite never contradicts, and only the mutant found
 * it.
 *
 * So the two cases divide the work:
 *   (c) proves the change is SCOPED — a sibling section on the same tab is
 *       still collapsed, i.e. the panel was not blanket-expanded;
 *   (d) proves the PRIMITIVE's default is untouched, by rendering an
 *       Accordion that omits the prop, which is the only construction the
 *       default actually reaches.
 *
 * Binding is by testid — the accordion's own identity — never by position or
 * by "the first expanded region", either of which another section could
 * satisfy (trap 19).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { Accordion } from '../Accordion'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { TornadoRow } from '../TornadoChart'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isFocusNowPanelEnabled: vi.fn(() => true),
    isStrengthenPanelEnabled: vi.fn(() => false),
    isAiPanelV2Enabled: vi.fn(() => true),
  }
})

import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'

function makeData(): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: 'Option A',
    expected: 0.8,
    outcome: { mean: 0.8, p10: 0.6, p50: 0.78, p90: 0.95 },
    p10: 0.6,
    p50: 0.78,
    p90: 0.95,
    isRecommended: true,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: 'Option B',
    expected: 0.4,
    outcome: { mean: 0.4, p10: 0.2, p50: 0.38, p90: 0.6 },
    p10: 0.2,
    p50: 0.38,
    p90: 0.6,
    isRecommended: false,
    winProbability: 0.3,
    goalProbability: 0.3,
  } as unknown as OptionResult
  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    goalThreshold: 0.6,
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    isNormalised: false,
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData
  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }
  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
  } as unknown as ConfidenceSectionData
  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  } as ImprovementsSectionData
  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

/** A populated tornado — the section renders only with rows AND an outcome. */
const TORNADO_ROWS: TornadoRow[] = [
  {
    factorKey: 'fac_price',
    label: 'Unit price',
    lowOutcome: 0.6,
    highOutcome: 0.95,
    canFocus: true,
    matchedNodeId: 'node_price',
    direction: 'positive',
  },
]

function renderBody() {
  return render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: TORNADO_ROWS, expectedOutcome: 0.8 }}
      onSendMessage={() => {}}
    />,
  )
}

/** The Accordion primitive publishes its state on its header button. */
function headerOf(testId: string): HTMLElement {
  return within(screen.getByTestId(testId)).getAllByRole('button')[0]
}

describe('the decision science is open on arrival', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('(a) "What could change the result" is expanded without a click', () => {
    renderBody()
    expect(headerOf('accordion-tornado')).toHaveAttribute('aria-expanded', 'true')
  })

  it('(b) "Stress-test your decision" is expanded without a click', () => {
    renderBody()
    expect(headerOf('accordion-stress-test')).toHaveAttribute('aria-expanded', 'true')
  })

  it('(c) SCOPE — a sibling section on the same tab is still collapsed', () => {
    renderBody()
    // Positive control: the sibling mounted at all, so its collapsed reading
    // is a fact about the accordion and not about a section that never rendered.
    expect(screen.getByTestId('accordion-drivers')).toBeInTheDocument()
    expect(headerOf('accordion-drivers')).toHaveAttribute('aria-expanded', 'false')
  })

  it('(d) PRIMITIVE — an Accordion that omits the prop still defaults to collapsed', () => {
    // The ONLY construction the parameter default governs. Everything else on
    // this tab passes `defaultExpanded` explicitly, which is precisely why the
    // other three cases cannot see a change to the primitive.
    render(
      <Accordion title="Untouched default" testId="accordion-default-probe">
        <p>body</p>
      </Accordion>,
    )
    expect(screen.getByTestId('accordion-default-probe')).toBeInTheDocument()
    expect(headerOf('accordion-default-probe')).toHaveAttribute('aria-expanded', 'false')
  })
})

/**
 * ⛔ THE ANALYSIS TAB, TOO: AN OPTION ADDED AFTER THE RUN IS NOT "AN OPTION THE
 * ANALYSIS RETURNED NOTHING FOR".
 *
 * The same defect #1940 fixed on the Reasoning tab, on the surface it did not
 * reach. Run over A and B, then add and link C: the retained report never saw
 * C, `deriveNotAnalysedReason` calls it `not_returned` (it HAS values and an
 * edge), and `NotAnalysedOptionCard` — `OptionCards`' fork, mounted by
 * `ResultsBody` — printed *"The analysis returned no result for this option"*
 * with no currency check at all. That asserts the run was ASKED about C. It was
 * not. The canvas card beside it withheld the sentence at the same moment
 * (`useOptionLeftOutOfRun.ts`), so one option read two opposite ways on one
 * screen (trap 21).
 *
 * ⭐ THE RULE IS THE CANVAS'S, AND SO IS THE AUTHORITY:
 * `if (reason === 'not_returned' && !resultsAreCurrent) return null`, with
 * `resultsAreCurrent` from `useAnalysisResultsAreCurrent`. Currency is set here
 * the way the product sets it — a `fresh` verdict, then the dirty overlay an
 * analytical edit (adding C) raises — never handed to the card as a prop.
 *
 * ⚠ WHAT IS WITHHELD IS THE SENTENCE, NOT THE FACT. C is genuinely absent from
 * the displayed result, so the card and its "Not analysed" badge stay.
 *
 * ⚠ `no_interventions` IS NOT GATED — it reports the graph as it is NOW and is
 * the one arm carrying an action. Its survival on a not-current run is the
 * contrast control: a fix that withheld every reason would pass the first pair.
 *
 * ⭐ THE MUTANT PAIR: twins differing ONLY in currency. The CURRENT twin carries
 * the sentence (positive control); the NOT-CURRENT twin does not. Deleting the
 * gate REDs the second.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { useCanvasStore } from '../../../canvas/store'
import { NOT_ANALYSED_BADGE, notAnalysedReasonCopy } from '../utils/notAnalysedCopy'
import type { NotAnalysedReason } from '../utils/notAnalysedOptions'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

const ANALYSED_A = 'opt_hire'
const ANALYSED_B = 'opt_partner'
const ADDED = 'opt_vendor'
const ADDED_LABEL = 'License a vendor tool'
const ENGINE_BLAME = 'returned no result'

function analysed(id: string, label: string, win: number, isRecommended = false): OptionResult {
  return {
    id,
    label,
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended,
    winProbability: win,
    goalProbability: 0.5,
    nValidSamples: 10000,
  } as unknown as OptionResult
}

/** C, beside the run over A and B, with the reason the derivation gives it. */
function added(reason: NotAnalysedReason): OptionResult {
  return {
    id: ADDED,
    label: ADDED_LABEL,
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    notAnalysed: true,
    notAnalysedReason: reason,
  } as unknown as OptionResult
}

/** The shape `ResultsBody.notAnalysedMountPath.spec.tsx` mounts: a run that ranks. */
function runOverAAndBWithC(reason: NotAnalysedReason): ResultsSectionDataReturn {
  const options = [
    analysed(ANALYSED_A, 'Hire two developers', 0.6, true),
    analysed(ANALYSED_B, 'Partner with a consultancy', 0.25),
    added(reason),
  ]
  const recommendation = {
    recommendedOption: options[0],
    allOptions: options,
    goalLabel: 'Cut support cost per ticket',
    goalThreshold: 0.4,
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.9,
    robustnessLevel: 'medium',
    isNormalised: true,
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.6, robustness: 0.6, clarity: 0.6 },
    verdict: { hasLeadingOption: true },
    leaderDesignationPermitted: true,
  } as unknown as DecisionResultData
  const drivers: DriversSectionData = {
    drivers: [], topDrivers: [], driversStatus: 'computed', totalCount: 0, hasMagnitudeData: false,
  }
  const confidence = {
    tier: { tier: 'fair', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 60,
    uncertainties: [], topUncertainties: [], improvements: [], topImprovements: [],
    evidenceGaps: [], topEvidenceGaps: [], nextActions: [], topNextActions: [],
  } as unknown as ConfidenceSectionData
  const improvements: ImprovementsSectionData = { improvements: [], count: 0, hasHighPriority: false }
  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Cut support cost per ticket',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

function mountWithCurrency(current: boolean, reason: NotAnalysedReason) {
  useCanvasStore.setState({
    analysisFreshness: { freshness: 'fresh' },
    // An analytical edit after the run — here, adding and linking C.
    analysisFreshnessDirty: !current,
    importPendingServerRegistration: false,
  } as never)
  return render(
    <ResultsBody
      resultsSectionData={runOverAAndBWithC(reason)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      expertMode={false}
    />,
  )
}

/** The card, BY ITS ID, asserted present — so no absence below is the absence of the card. */
const addedCard = () => screen.getByTestId(`option-card-not-analysed-${ADDED}`)

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
    optionNumbering: {},
  } as never)
})

describe('ResultsBody: the not-analysed card needs a current result to blame the engine', () => {
  it('⭐ CURRENT: the card states the run’s own ground', () => {
    mountWithCurrency(true, 'not_returned')
    expect(addedCard()).toBeInTheDocument()
    expect(screen.getByTestId(`not-analysed-reason-${ADDED}`)).toHaveTextContent(
      notAnalysedReasonCopy('not_returned'),
    )
  })

  it('⛔ NOT CURRENT: no "returned no result" anywhere on the tab; the card and its badge stay', () => {
    const { container } = mountWithCurrency(false, 'not_returned')
    // The state is still named.
    expect(addedCard()).toBeInTheDocument()
    expect(screen.getByTestId(`not-analysed-badge-${ADDED}`)).toHaveTextContent(NOT_ANALYSED_BADGE)
    // The ground is not.
    expect(screen.queryByTestId(`not-analysed-reason-${ADDED}`)).toBeNull()
    expect(container.textContent ?? '').not.toContain(ENGINE_BLAME)
    const titled = Array.from(container.querySelectorAll('[title]')).map((el) => el.getAttribute('title') ?? '')
    expect(titled.filter((t) => t.includes(ENGINE_BLAME))).toEqual([])
  })

  it('⭐ CONTRAST: `no_interventions` describes the graph as it is and is never withheld', () => {
    mountWithCurrency(false, 'no_interventions')
    expect(screen.getByTestId(`not-analysed-reason-${ADDED}`)).toHaveTextContent(
      notAnalysedReasonCopy('no_interventions'),
    )
    expect(screen.getByTestId(`not-analysed-resolve-${ADDED}`)).toBeInTheDocument()
  })
})

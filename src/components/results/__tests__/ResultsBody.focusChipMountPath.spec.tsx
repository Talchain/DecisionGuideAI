/**
 * THE FOCUS CHIP'S MOUNT PATH — the assertion `OptionCards.focusChipHonesty`
 * could not make, and the one whose absence let a DARK instance be fixed while
 * a reachable one went untouched.
 *
 * ## Why this file exists
 *
 * `OptionCards.focusChipHonesty.spec.tsx` renders `<OptionCards>` in isolation
 * with `onFocusNode` injected, and proves the chip's label is honest. That is a
 * claim about the COMPONENT. It is silent on whether a user ever sees the chip.
 *
 * This estate has shipped a feature dark past exactly that kind of suite three
 * times (CLAUDE.md trap 3b — rows 2.466 and 2.491, then the PR this file lands
 * on). The rule the traps state is: bind to the surface the deployed flags
 * MOUNT, and assert the mount path itself so the binding fails loud.
 *
 * ## The derived truth this pins — the chip is currently UNREACHABLE
 *
 * - `ResultsBody.tsx:587` is `OptionCards`' ONLY production parent (every other
 *   `<OptionCards` in the tree is a spec).
 * - The options block around it is gated only on
 *   `!recommendation.isSingleOption && allOptions.length > 1`. No feature flag
 *   gates it; `netlify.toml` retired `VITE_FEATURE_ANALYSIS_HERO_PANEL`, and no
 *   surviving flag can unmount this block. So the BLOCK is reachable.
 * - But the CHIP inside it is gated on `!option.isBaseline && onFocusNode`, and
 *   `ResultsBody` never passes `onFocusNode` to `<OptionCards>`. `OutputsDock
 *   .tsx:3182` supplies the handler to `ResultsBody`, which forwards it to five
 *   OTHER children (`AnalysisHeroContainer` :386, `TriageActionCardsBody` :410,
 *   `DriversSection` :666, `TornadoChart` :729, `StressTestSection` :779).
 *
 * Contrast control for that absence claim: `onFocusNode` appears 7× in
 * `ResultsBody.tsx`, so the symbol is visible to the sweep — the omission at
 * :587 is a real absence rather than a blind probe.
 *
 * ## What makes the pin discriminating rather than vacuous
 *
 * An "the chip is absent" assertion passes for free if the chip can never
 * render, if the block never mounts, or if the testid is wrong. So the cases
 * below are a PAIR, and the discrimination is the DIFFERENCE between them:
 *
 *   - in ISOLATION with a handler  → the chip RENDERS   (positive control)
 *   - through `ResultsBody` with the SAME handler → the chip is ABSENT
 *
 * Only a missing forward at `ResultsBody.tsx:587` can produce that difference.
 *
 * ## One mutant DEMONSTRATED equivalent, not assumed
 *
 * Renaming the testid inside `focusOnCanvasTestId` leaves all 12 cases GREEN
 * (measured). That is genuine equivalence rather than a hole: the component
 * STAMPS the id from that helper and every query READS it from the same helper,
 * so a consistent rename cannot be observed — and should not be, since the
 * string is an internal identifier with no user-facing contract. The mutant that
 * must bite is the one that removes the ATTRIBUTE while the queries keep asking
 * for it; it does (see the positive control).
 * Wire the prop through and the isolation case is unchanged while the mount
 * case REDs — which is the point: this is a KNOWN-DARK pin, not a veto. If a
 * later lane deliberately makes the chip reachable, this file must be updated
 * in the same change, and its RED is the prompt to re-read the label first.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { OptionCards } from '../OptionCards'
import { FOCUS_ON_CANVAS_LABEL, focusOnCanvasTestId } from '../utils/focusOnCanvasCopy'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

const OPT_A = 'opt_hire'
const OPT_B = 'opt_partner'

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

const OPTIONS = [
  analysed(OPT_A, 'Hire two developers', 0.6, true),
  analysed(OPT_B, 'Partner with a consultancy', 0.25),
]

function makeData(options: OptionResult[]): ResultsSectionDataReturn {
  const recommendation = {
    recommendedOption: options.find(o => o.isRecommended) ?? null,
    allOptions: options,
    goalLabel: 'Cut support cost per ticket',
    goalThreshold: 0.4,
    isSingleOption: options.length <= 1,
    analysisStatus: 'computed',
    recommendationStability: 0.9,
    robustnessLevel: 'medium',
    isNormalised: true,
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.6, robustness: 0.6, clarity: 0.6 },
    verdict: { hasLeadingOption: true },
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

/** Mounts the real parent, supplying the handler exactly as `OutputsDock:3182` does. */
function renderBody(onFocusNode?: (nodeId: string) => void) {
  return render(
    <ResultsBody
      resultsSectionData={makeData(OPTIONS)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      expertMode={false}
      onFocusNode={onFocusNode}
    />,
  )
}

afterEach(() => cleanup())

describe('ResultsBody — the OptionCards focus chip is DARK on the mount path', () => {
  it('POSITIVE CONTROL: the chip renders when the component itself is given a handler', () => {
    // Proves the probe can see a PRESENCE. Without this the absence cases below
    // would pass just as happily against a renamed testid or a deleted chip
    // (trap 13).
    render(<OptionCards options={OPTIONS} winnerId={OPT_A} hasLeadingOption onFocusNode={vi.fn()} />)
    expect(screen.getByTestId(focusOnCanvasTestId(OPT_A))).toBeTruthy()
    expect(screen.getByTestId(focusOnCanvasTestId(OPT_B))).toBeTruthy()
  })

  it('PRECONDITION: the options block really does mount through ResultsBody', () => {
    // The block is what would have to be missing for the absence below to be
    // uninteresting. Pinned by identity, on the same render the next case uses.
    renderBody(vi.fn())
    expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    expect(screen.getByTestId(`option-card-${OPT_A}`)).toBeInTheDocument()
  })

  it('THE PIN: ResultsBody does NOT forward onFocusNode to OptionCards, so no chip renders', () => {
    // The discriminating half of the pair. Same handler, same options, same
    // testids as the positive control — the ONLY difference is that the chip is
    // reached through its real parent. `ResultsBody.tsx:587` omits the prop.
    renderBody(vi.fn())
    expect(screen.queryByTestId(focusOnCanvasTestId(OPT_A))).toBeNull()
    expect(screen.queryByTestId(focusOnCanvasTestId(OPT_B))).toBeNull()
  })

  it('and no control on the body carries the chip LABEL either', () => {
    // A second probe of the same fact through a DIFFERENT channel (accessible
    // name, not testid), so a chip rendered under some other id is still caught.
    //
    // ⚠ This replaced a spy assertion (`expect(onFocusNode).not.toHaveBeenCalled()`)
    // that MEASURED AS NON-DISCRIMINATING: nothing in the test clicks anything,
    // so the spy is uncalled whether or not the chip is on screen. It stayed
    // GREEN under the wire-the-prop mutant that REDs the pin above — a test that
    // cannot fail for the reason it names (trap 13), caught only by running the
    // mutant rather than by reading it.
    renderBody(vi.fn())
    expect(screen.queryAllByRole('button', { name: FOCUS_ON_CANVAS_LABEL })).toHaveLength(0)
  })

  it('CONTRAST: withholding the handler changes nothing — the gate is not what hides it', () => {
    // States the finding as an EQUALITY: supplying the handler and withholding
    // it produce the same surface, because the prop never reaches the component
    // either way. This case discriminates a different mutation from the one THE
    // PIN catches — drop the `onFocusNode &&` guard on the chip and this REDs
    // while the pin does not (measured).
    renderBody(undefined)
    expect(screen.queryByTestId(focusOnCanvasTestId(OPT_A))).toBeNull()
    expect(screen.getByTestId('option-cards')).toBeInTheDocument()
  })
})

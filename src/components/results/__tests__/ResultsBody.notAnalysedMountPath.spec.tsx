/**
 * NO-RANK RULING — ON THE MOUNT PATH, AT THE DEPLOYED FLAG POSTURE.
 *
 * ## Why this file exists at all
 *
 * `OptionCards.notAnalysed.spec.tsx` renders `<OptionCards>` in isolation. This
 * estate has shipped the same feature dark TWICE past exactly that kind of
 * suite (CLAUDE.md trap 3b: rows 2.466 and 2.491 — a full mutant kit, RED-first
 * and positive controls all passed while every instrument pointed at a
 * component the deployed flags do not mount). A green component suite is not
 * evidence about a surface a user loads.
 *
 * So this file asserts the MOUNT PATH itself: `<ResultsBody>` — `OptionCards`'
 * only production parent — renders the not-analysed card.
 *
 * ## The deployed posture, derived
 *
 * `ResultsBody.tsx` mounts `<OptionCards>` inside a block gated ONLY on
 * `!recommendation.isSingleOption && allOptions.length > 1`. There is NO
 * feature flag on that path — the surrounding comment states it deliberately.
 * The flags `netlify.toml` sets for staging (e.g.
 * `VITE_FEATURE_PRE_ANALYSIS_V3 = "1"`) switch OTHER surfaces around it and
 * cannot unmount this one. `ResultsBody` itself is the Analysis tab body,
 * mounted unconditionally from `OutputsDock` on the `results` tab.
 *
 * That is why this file makes no flag assertion: there is no flag to assert.
 * The gate it DOES pin is the real one — `allOptions.length > 1` — because a
 * never-analysed option is still an option node, and if it were filtered out
 * upstream a two-option scenario would fall below the gate and the whole
 * comparison block would vanish. That failure mode is silent and is pinned
 * below.
 *
 * ## THE SECOND RANKED SURFACE (added with the analysis-cockpit consolidation)
 *
 * `ResultsBody` now also mounts `AnalysisHeroContainer`, which builds one row
 * per option from the SAME `recommendation.allOptions`. So there are TWO
 * surfaces on this screen that can rank, and this file originally queried only
 * one of them — an unscoped `getByText(EXCLUDED_LABEL)` that started matching
 * two nodes the moment the cockpit landed.
 *
 * The duplicate LABEL is legitimate: both surfaces list every option, and the
 * ruling keeps an unanalysed option VISIBLE. The duplicate RANK was not — the
 * hero drew an ordinal beside the excluded option while the card below it drew
 * none. The label queries are therefore scoped by identity, and a new case
 * pins the hero's half of the no-rank contract so this file covers both
 * surfaces rather than one.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

const ANALYSED_A = 'opt_hire'
const ANALYSED_B = 'opt_partner'
const EXCLUDED = 'opt_migrate'
const EXCLUDED_LABEL = 'Migrate to Salesforce'

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

/** The hook's own output shape for an option CEE excluded from the submission. */
const EXCLUDED_OPTION = {
  id: EXCLUDED,
  label: EXCLUDED_LABEL,
  expected: null,
  outcome: { mean: null, p10: null, p50: null, p90: null },
  p10: null,
  p50: null,
  p90: null,
  isRecommended: false,
  notAnalysed: true,
  notAnalysedReason: 'no_interventions',
} as unknown as OptionResult

function makeData(options: OptionResult[]): ResultsSectionDataReturn {
  const recommendation = {
    recommendedOption: options.find((o) => o.isRecommended) ?? null,
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
    // A run that DOES rank: on a withheld run the ranked chrome is suppressed
    // for every card and the absence assertions would pass for free.
    //
    // ⚠ BOTH QUESTIONS, because ranking is gated on the COMPOSED answer and not
    // on the verdict. `verdict.hasLeadingOption` answers Q2 alone, and a Q2-only
    // recommendation is one `leaderDesignationPermitted()` may only WITHHOLD on
    // — which would suppress the ordinal on EVERY row and make the positive
    // control below ("an analysed option still carries its ordinal") impossible
    // to satisfy, i.e. the whole file's absence assertions vacuous.
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

function renderBody(options: OptionResult[]) {
  return render(
    <ResultsBody
      resultsSectionData={makeData(options)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      expertMode={false}
    />,
  )
}

const MIXED = [
  analysed(ANALYSED_A, 'Hire two developers', 0.6, true),
  analysed(ANALYSED_B, 'Partner with a consultancy', 0.25),
  EXCLUDED_OPTION,
]

afterEach(() => {
  cleanup()
  // `registerOptionNumbering` is append-only and the store is a module
  // singleton, so a seeded test can leak its numbering into every sibling,
  // and such a leak is SILENT (siblings assert absence of ordinals, which a
  // stale numbering map would quietly start contradicting).
  //
  // ⚠ PROPHYLACTIC, NOT A LIVE FIX — measured: with this reset removed, NO
  // sibling in this file currently REDs. An earlier revision of this comment
  // read as though the leak were live. It is not; it is one seeded test away
  // from being live, which is why the reset stays.
  useCanvasStore.setState({ optionNumbering: {} })
})

describe('ResultsBody — the not-analysed card on the mount path', () => {
  it('PRECONDITION: the options block is mounted and the ranked chrome is on screen', () => {
    renderBody(MIXED)
    // If the block itself stopped mounting, every absence assertion below
    // would pass against an empty tree (trap 13 — an absence claim needs a
    // demonstrated presence).
    expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    expect(screen.getByTestId(`option-card-${ANALYSED_A}`)).toBeInTheDocument()
    expect(screen.getByTestId(`rank-marker-${ANALYSED_A}`)).toBeInTheDocument()
  })

  it('renders the not-analysed card through ResultsBody, with no ranked chrome on it', () => {
    renderBody(MIXED)
    const card = screen.getByTestId(`option-card-not-analysed-${EXCLUDED}`)
    expect(card).toBeInTheDocument()
    // SCOPED, not loosened. The analysis cockpit lists the same option above
    // the cards, so the label is legitimately on screen TWICE and an unscoped
    // getByText resolves neither surface's claim. The assertion still says
    // "the not-analysed card names this option" — it now says it about the
    // card, by identity, instead of about whichever node matched first.
    expect(within(card).getByText(EXCLUDED_LABEL)).toBeInTheDocument()
    expect(screen.queryByTestId(`option-card-${EXCLUDED}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`rank-marker-${EXCLUDED}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`stable-number-${EXCLUDED}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`win-pct-${EXCLUDED}`)).not.toBeInTheDocument()
  })

  it('NO-RANK on the OTHER surface too: the hero lists it with no ordinal', () => {
    // The cards were never the only ranked surface. `AnalysisHeroContainer`
    // renders one row per option from the SAME `allOptions`, and it used to
    // draw an ordinal beside every one of them — so the excluded option was
    // simultaneously rank-less on the card and "3" in the cockpit, on one
    // screen. That is the contradiction `utils/optionDisplayOrder.ts` names
    // ("last is not a rank ... no ordinal at all") and the one this file's
    // sibling assertions would never have seen, because they only query the
    // cards.
    renderBody(MIXED)
    const excludedRow = document.querySelector(`[data-option-id="${EXCLUDED}"]`)
    expect(excludedRow).not.toBeNull()
    expect(within(excludedRow as HTMLElement).queryByTestId('hero-row-number')).toBeNull()

    // POSITIVE CONTROL — without it the absence above passes just as happily
    // when the hero stops drawing ordinals altogether, or stops mounting.
    // An analysed option in the SAME list must still carry its ordinal.
    const analysedRow = document.querySelector(`[data-option-id="${ANALYSED_A}"]`)
    expect(analysedRow).not.toBeNull()
    expect(within(analysedRow as HTMLElement).getByTestId('hero-row-number')).toHaveTextContent('1')
  })

  it('NO-RANK covers the hero IDENTITY CHIP, not just the badge', () => {
    // ⭐ THE BADGE HALF ABOVE IS NOT THE WHOLE SURFACE. `hero-row-number` is
    // gated on `showOrdinal` (= `!designationsWithheld && row.isRanked`); the
    // `hero-row-identity` chip beside it is a SECOND place an ordinal can
    // appear in the same row, and it was gated on `stableNumber != null`
    // alone. Registration covers `allOptions` — not-analysed options included
    // — so `stableNumber` is non-null for every row and the chip rendered
    // `Option 3` next to a card that deliberately renders no ordinal at all.
    //
    // This is the seventh-guard failure `NotAnalysedOptionCard`'s header
    // predicted in prose ("every future stat row added to that card would have
    // to remember the eighth guard") arriving on the OTHER surface, where the
    // fork does not protect it. Pinning the chip by its own testid so a future
    // ordinal-bearing element in this row cannot inherit the badge's pin.
    // ⚠ THE SEED IS LOAD-BEARING AND ITS ABSENCE IS SILENT. `stableNumberFor`
    // is all-or-nothing: with no `optionNumbering` in the store EVERY row's
    // `stableNumber` is null, no chip renders anywhere, and an absence
    // assertion here would pass while testing nothing. Registration in
    // production covers `allOptions` — the excluded option included — so this
    // seeds all three, which is what makes `Option 3` reachable on the
    // excluded row at all. The positive control below is what proves the seed
    // took; the first draft of this test failed on that control, not on the
    // claim, which is how the vacuity was caught.
    useCanvasStore.getState().registerOptionNumbering([ANALYSED_A, ANALYSED_B, EXCLUDED])

    renderBody(MIXED)
    const excludedRow = document.querySelector(`[data-option-id="${EXCLUDED}"]`)
    expect(excludedRow).not.toBeNull()
    expect(within(excludedRow as HTMLElement).queryByTestId('hero-row-identity')).toBeNull()

    // POSITIVE CONTROL — the chip must still render for an option that WAS
    // scored. Without this the absence above passes when the chip is deleted
    // outright, which would silently undo the identity this PR exists to add.
    const analysedRow = document.querySelector(`[data-option-id="${ANALYSED_A}"]`)
    expect(analysedRow).not.toBeNull()
    expect(
      within(analysedRow as HTMLElement).getByTestId('hero-row-identity'),
    ).toHaveTextContent(/^Option \d+$/)
  })

  it('the WinGauge draws no segment for it', () => {
    // The gauge already filters to numeric win probabilities, so this is a
    // REGRESSION pin rather than a fix — it is exactly the surface a future
    // "treat missing as zero" convenience would break, and it would break
    // silently.
    renderBody(MIXED)
    expect(screen.queryByText(new RegExp(EXCLUDED_LABEL + '\\s*\\d'))).not.toBeInTheDocument()
  })

  it('the excluded option still COUNTS toward the comparison gate', () => {
    // `allOptions.length > 1` is what mounts the whole block. A future change
    // that filtered marked options out of `allOptions` upstream would take a
    // two-option scenario below the gate and delete the comparison entirely —
    // a silent whole-section regression. One analysed option plus one excluded
    // must still mount.
    renderBody([analysed(ANALYSED_A, 'Hire two developers', 0.6, true), EXCLUDED_OPTION])
    expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    expect(screen.getByTestId(`option-card-not-analysed-${EXCLUDED}`)).toBeInTheDocument()
  })

  it('UNCHANGED BEHAVIOUR — a run with no excluded option mounts exactly as before', () => {
    renderBody([
      analysed(ANALYSED_A, 'Hire two developers', 0.6, true),
      analysed(ANALYSED_B, 'Partner with a consultancy', 0.25),
    ])
    expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    expect(screen.queryByTestId(/option-card-not-analysed-/)).not.toBeInTheDocument()
  })
})

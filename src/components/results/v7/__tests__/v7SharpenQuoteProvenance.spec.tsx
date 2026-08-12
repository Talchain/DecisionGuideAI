/**
 * The V7 sharpen line's "You wrote: …" quote must be the USER's
 * words, never ours (ROADMAP 2.993).
 *
 * THE DEFECT (measured at `e15c6b81`, the commit staging deploys):
 * `V7TopMatter` computed `briefWording = recommendation.goalText ?? goalLabel`
 * and `V7SharpenLine` rendered it under `You wrote: "…"`. `goalText` is the
 * user's own framing goal; `goalLabel` is OUR derivation
 * (`useResultsSectionData`: sanitised, sourced from the drafted goal NODE's
 * label, sometimes re-phrased as `the best outcome for X`, and defaulting to
 * the literal `your goal`). The fallback therefore put the product's own
 * generated text inside quotation marks and attributed it to the user — a lie
 * about authorship, on the one surface designed to reflect their words back.
 *
 * WHY THE ASSERTIONS BIND TO PROVENANCE, NOT TO A VALUE (trap 19):
 * a test that merely asserted "the quote equals X" would pass whenever the
 * derived label and the brief happen to coincide. So every case here is built
 * from a fixture where the two DIFFER, and the honest-path oracle is the
 * PRODUCER of the submitted brief — `composeBriefText`, the function
 * `useAsk` uses to build the `brief` this app sends to CEE. The displayed
 * characters must occur inside those bytes; the derived label must not.
 * Each test pins that precondition in-test, so if `composeBriefText` ever
 * stops carrying the framing goal, these tests go RED instead of quietly
 * becoming tautologies.
 *
 * MOUNT PATH (trap 3b), RE-BOUND 12 Aug 2026: the V7 group MOVED, unchanged,
 * from ResultsBody's unflagged `v7-top-group` slot to the temporary "Alt view"
 * dock tab (`V7ComparisonTabBody`, also unflagged) — Paul: "move, NOT delete".
 * This file was `ResultsBody.v7SharpenQuoteProvenance.spec.tsx`; the harness
 * now renders the new (and only) production parent. Each test still asserts
 * the surface actually mounted, so an absence assertion can never pass
 * because the whole component vanished.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { V7ComparisonTabBody } from '../V7ComparisonTabBody'
import type { V7SharpenLineProps } from '../V7SharpenLine'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  DriverItem,
  ImprovementsSectionData,
  OptionResult,
} from '../../types'
import { composeBriefText } from '@/hooks/useAsk'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

/**
 * ── OBSERVING THE PASS-THROUGH HALF OF THE MECHANISM ───────────────────────
 *
 * The refusal is only half of ROADMAP 2.993. The other half is that
 * `V7TopMatter` STILL HANDS THE DERIVED LABEL OVER, correctly labelled, so that
 * the decision not to attribute it lives in `V7SharpenLine` on the live path
 * and any future re-attribution has to be a visible diff in that file.
 *
 * That half was UNPINNED. Every assertion in this file is an absence, so
 * simplifying `V7TopMatter` to pass `null` when there is no `goalText` would
 * delete the mechanism and leave the whole suite GREEN — a guard whose evidence
 * comes from itself (CLAUDE.md trap 13b). A discarded value leaves no DOM
 * trace, so the ONLY way to observe it is at the prop boundary.
 *
 * The mock spreads `importOriginal` and DELEGATES to the real component rather
 * than replacing it: a `vi.mock` factory replaces the whole module, and a
 * hand-listed stub is the mirror that silently drops whatever the module gains
 * next (trap 12). Because it delegates, the three rendering tests below are
 * unaffected and still exercise the real refusal.
 */
const { sharpenProps } = vi.hoisted(() => ({ sharpenProps: [] as V7SharpenLineProps[] }))

vi.mock('../V7SharpenLine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../V7SharpenLine')>()
  const { createElement } = await import('react')
  return {
    ...actual,
    V7SharpenLine: (props: V7SharpenLineProps) => {
      sharpenProps.push(props)
      return createElement(actual.V7SharpenLine, props)
    },
  }
})

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isAnalysisHeroV17Enabled: vi.fn(() => false),
    isAnalysisHeroCompareEnabled: vi.fn(() => false),
    isFocusNowPanelEnabled: vi.fn(() => true),
    isStrengthenPanelEnabled: vi.fn(() => false),
    isAiPanelV2Enabled: vi.fn(() => true),
    isAnalysisHeroPanelEnabled: vi.fn(() => false),
  }
})

import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import type { AnalysisFreshnessState } from '@/canvas/store/analysisFreshness'

/**
 * The user's own words. Deliberately unlike anything a label deriver would
 * produce, and carrying a token (`kestrel`) that appears nowhere else.
 */
const USER_BRIEF_GOAL =
  'Keep the kestrel migration under budget without slipping the December date'

/**
 * OUR text. Shaped like a real `goalLabel` output — this is exactly the form
 * `useResultsSectionData` emits for a short/colliding label — and sharing NO
 * distinctive token with the brief above.
 */
const DERIVED_GOAL_LABEL = 'the best outcome for Cat'

/** The framing this app would submit, with the user's goal in it. */
const FRAMING_WITH_USER_GOAL = {
  title: 'Platform migration',
  goal: USER_BRIEF_GOAL,
  timeline: 'By December',
}

/**
 * The framing a fresh session actually has. The only in-app writer that ever
 * set `framing.goal` (`InputsDock`) now lives in `archive/`, so `goalText` is
 * absent and the old code fell through to the derived label EVERY time.
 */
const FRAMING_WITHOUT_USER_GOAL = {
  title: 'Platform migration',
  timeline: 'By December',
}

function driver(): DriverItem {
  return {
    factorKey: 'n_lead',
    factorLabel: 'Tech lead hired',
    rawElasticity: 1,
    normalisedInfluence: 1,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'n_lead',
  } as DriverItem
}

/**
 * @param goalText the user's framing goal as `useResultsSectionData` exposes
 *   it (`currentScenarioFraming?.goal || undefined`) — `undefined` reproduces
 *   a session with no user-written goal.
 */
function makeData(goalText: string | undefined): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: 'Bring In 6-Month Contractor',
    expected: 0.8,
    outcome: { mean: 0.8, p10: 0.6, p50: 0.78, p90: 0.95 },
    p10: 0.6,
    p50: 0.78,
    p90: 0.95,
    isRecommended: true,
    winProbability: 0.71,
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: 'Hire Permanent Senior Tech Lead',
    isRecommended: false,
    winProbability: 0.31,
  } as unknown as OptionResult

  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: DERIVED_GOAL_LABEL,
    ...(goalText === undefined ? {} : { goalText }),
    goalThreshold: 0.6,
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    isNormalised: false,
  } as unknown as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [driver()],
    topDrivers: [driver()],
    driversStatus: 'computed',
    totalCount: 1,
    hasMagnitudeData: true,
  }

  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    // The sharpen line only renders when there ARE inputs to sharpen.
    topEvidenceGaps: [
      {
        factorId: 'n_pipeline',
        factorLabel: 'Hiring Pipeline Duration',
        confidence: 40,
        voi: 0.6,
        suggestion: 'Confirm the pipeline estimate',
        targetNodeId: 'n_pipeline',
      },
    ],
    nextActions: [],
    topNextActions: [],
    challengeFragileEdges: [],
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
    goalLabel: DERIVED_GOAL_LABEL,
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

function renderBody(goalText: string | undefined) {
  return render(
    <V7ComparisonTabBody
      resultsSectionData={makeData(goalText)}
      onSendMessage={() => {}}
      onFocusNode={() => {}}
    />,
  )
}

/** The surface must actually be on screen — otherwise an absence proves nothing. */
function assertSharpenSurfaceMounted(): HTMLElement {
  expect(
    screen.getByTestId('v7-top-matter'),
    'V7 top matter must mount — the Alt view tab hosts it with no flag',
  ).toBeInTheDocument()
  return screen.getByTestId('v7-sharpen-line')
}

const FRESH: AnalysisFreshnessState = { freshness: 'fresh', computedAt: '2026-07-23T00:00:00Z' }

describe('V7 sharpen line quote provenance (ROADMAP 2.993) — in the Alt view tab', () => {
  beforeEach(() => {
    sharpenProps.length = 0
    useCanvasStore.setState({ analysisFreshness: FRESH, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'altview', activeOutputTabVersion: 0 })
    useGuidanceStore.setState({ guidanceItems: [] })
  })

  it('HANDS THE DERIVED LABEL OVER — the refusal happens in the component, not upstream', () => {
    renderBody(undefined)
    assertSharpenSurfaceMounted()

    // The instrument must have observed the live render at all — otherwise
    // every assertion below would pass vacuously on an empty array (trap 13).
    expect(
      sharpenProps.length,
      'the recording wrapper must have seen V7SharpenLine render',
    ).toBeGreaterThan(0)

    // IDENTITY BINDING (trap 19): not "some quote was passed", but THIS quote —
    // our derived label, carrying the one provenance that makes it refusable.
    // A value predicate like "a non-null briefQuote" would be satisfied by the
    // user_brief case too, which is the opposite of what is under test.
    expect(sharpenProps.at(-1)?.briefQuote).toEqual({
      text: DERIVED_GOAL_LABEL,
      source: 'derived_label',
    })

    // …and receiving it changes nothing on screen. Both halves in one test, so
    // a change that deletes the pass-through cannot pass by also deleting the
    // assertion that the screen stays clean.
    expect(screen.queryByTestId('v7-sharpen-quote')).not.toBeInTheDocument()
  })

  it('CONTROL — the pass-through discriminates: the user_brief case carries a DIFFERENT quote', () => {
    // Without this, the test above could not tell "the derived label was passed"
    // from "whatever was passed happened to match". Keeping one probe whose
    // expected answer DIFFERS is what exposes an instrument that has stopped
    // discriminating (CLAUDE.md trap 20).
    renderBody(USER_BRIEF_GOAL)
    assertSharpenSurfaceMounted()

    expect(sharpenProps.at(-1)?.briefQuote).toEqual({
      text: USER_BRIEF_GOAL,
      source: 'user_brief',
    })
    expect(USER_BRIEF_GOAL).not.toBe(DERIVED_GOAL_LABEL)
  })

  it('never attributes OUR derived goal label to the user when the brief carries no goal', () => {
    // Precondition, pinned in-test: the derived label is NOT in the bytes this
    // app submits as the brief, so quoting it under "You wrote" cannot be true.
    const submittedBrief = composeBriefText(FRAMING_WITHOUT_USER_GOAL)
    expect(submittedBrief).not.toContain(DERIVED_GOAL_LABEL)

    renderBody(undefined)
    const line = assertSharpenSurfaceMounted()

    expect(
      screen.queryByTestId('v7-sharpen-quote'),
      'no authorship claim is made when nothing the user wrote is available',
    ).not.toBeInTheDocument()
    expect(line).not.toHaveTextContent('You wrote')
    expect(line).not.toHaveTextContent(DERIVED_GOAL_LABEL)
  })

  it('quotes text traceable to the SUBMITTED BRIEF bytes, not to the derived label', () => {
    // Preconditions, pinned in-test (trap 13b — a discriminator must pin its
    // own precondition or it decays into a tautology):
    //   1. the two candidate strings genuinely differ;
    //   2. the user's goal IS in the submitted brief bytes;
    //   3. the derived label is NOT.
    const submittedBrief = composeBriefText(FRAMING_WITH_USER_GOAL)
    expect(USER_BRIEF_GOAL).not.toBe(DERIVED_GOAL_LABEL)
    expect(submittedBrief).toContain(USER_BRIEF_GOAL)
    expect(submittedBrief).not.toContain(DERIVED_GOAL_LABEL)

    renderBody(USER_BRIEF_GOAL)
    assertSharpenSurfaceMounted()

    const quoted = screen.getByTestId('v7-sharpen-quote').textContent ?? ''
    const match = quoted.match(/^You wrote:\s*[“"](.+)[”"]$/)
    expect(match, `quote did not render in the expected frame: ${JSON.stringify(quoted)}`).not.toBeNull()

    // PROVENANCE: the displayed characters must occur inside the brief this
    // app submits — not merely equal some string that happens to match.
    expect(submittedBrief).toContain(match![1])
    // …and the derived label must not have leaked into the attributed quote.
    expect(match![1]).not.toContain(DERIVED_GOAL_LABEL)
  })

  it('shows the inputs to sharpen either way — only the authorship claim is withheld', () => {
    // Positive control against a vacuous absence: the first test asserts the
    // quote is gone; this proves the rest of the line still renders, so the
    // absence is of the CLAIM, not of the component.
    renderBody(undefined)
    const line = assertSharpenSurfaceMounted()
    expect(line).toHaveTextContent('A few inputs would sharpen these results')
    expect(within(line).getByText('Hiring Pipeline Duration')).toBeInTheDocument()
  })
})

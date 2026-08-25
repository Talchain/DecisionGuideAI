/**
 * Resolve next ON THE DEFAULT ANALYSIS TAB, plus the decision-level EVPI line.
 * V7-C slice 2a — Paul's ruling of 14 Aug 2026; design of record
 * `olumi-docs/docs-designs/RESOLVE-NEXT-DECISION-EVPI-DESIGN-2026-08-13.md`.
 *
 * ⭐ WHAT THIS LANE IS FIXING, AND WHY THE LOCATION IS HALF THE FIX.
 *
 * The value-of-information ranking has been live and honest since V7-C slice 1 —
 * on the wrong page. Since the 12-Aug "move, NOT delete" ruling it has sat FOUR
 * non-obvious steps past where a post-run user lands: the dock auto-selects the
 * **Analysis** tab, and Resolve next lives on the secondary **Alt view** tab
 * (whose own source comment calls it temporary), behind a COLLAPSED disclosure,
 * behind a NON-DEFAULT sub-chip. Telemetry is dark behind all four layers, so no
 * witness says anyone ever opened it. The design doc's own reachability gate
 * called this "reachable-but-obscure, bordering effectively-dark for a fresh
 * user" and named the precondition: put it on the DEFAULT Analysis tab, or the
 * new science lands on a page real users do not reach — the estate's #1 failure
 * mode. Paul ruled. This spec is that ruling, pinned.
 *
 * ⭐ AND WHAT THE NEW LINE IS FOR, precisely.
 *
 * On 5 of 5 live payloads captured in this repo, `decision_evpi` came back
 * NON-ZERO while not one `factor_evppi` row cleared its own noise floor. In
 * every one of those runs the surface said only "Nothing stands out to resolve
 * yet…" — which a reasonable reader takes as "the analysis looked, there is
 * nothing more to learn, go decide". The run's own WHOLE-DECISION measurement
 * was in the browser saying it did NOT come back at zero, and no pixel depended
 * on it. Today a run with genuinely nothing to learn and a run whose unknowns
 * merely could not be told apart ONE AT A TIME are indistinguishable on screen.
 * After this slice they are not. That is the entire deliverable.
 *
 * ⚠ WHY THE ASSERTIONS BIND WHERE THEY DO (CLAUDE.md trap 3b). A UI test can be
 * bound to a component the deployed flags switch off — this estate shipped that
 * defect twice in one feature. §0 therefore renders **ResultsBody** on the
 * DEFAULT dock tab and asserts the MOUNT PATH ITSELF: the view is a DESCENDANT
 * of `analysis-hero-panel`, the one analysis surface, which now mounts
 * unconditionally. A green assertion about a component the deployment does not
 * render is not evidence.
 *
 * ⚠ AND WHY THE MODEL IS BUILT, NOT HAND-WRITTEN. Every render below goes
 * through `buildHeroModel(data)` from a `ResultsSectionDataReturn`, so the test
 * exercises the PLUMBING (hook field → mapper passthrough → model → component)
 * rather than a hand-built evidence object that silently encodes my own model of
 * the producer (trap 16: a fixture you wrote yourself is not evidence about the
 * wire — and here the passthrough is exactly what could break).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import { HERO_COPY } from '../heroCopy'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import { RESOLVE_NEXT_COPY as R } from '../../voi/resolveNextCopy'
import type { DecisionVoiVerdict } from '../../voi/decisionVoi'
import type { VoiRanking } from '../../voi/voiRanking'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  refutedClaimsForScope,
  NO_EFFECT_CLAIM_PHRASES,
  HISTORICAL_NO_EFFECT_OVERCLAIM,
} from '../../__tests__/helpers/refutedEvpiClaimMatchers'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

vi.mock('@/flags', async () => {
  // `importOriginal`-spread, never a hand-listed allowlist: a `vi.mock` factory
  // REPLACES the module, so every flag not listed would be silently absent
  // (CLAUDE.md trap 12 — this exact pattern once killed 51 tests at collection).
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isFocusNowPanelEnabled: vi.fn(() => true),
    isStrengthenPanelEnabled: vi.fn(() => false),
    isAiPanelV2Enabled: vi.fn(() => true),
  }
})

import { ResultsBody } from '../../ResultsBody'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CHURN = { factorId: 'fac_churn', label: 'Customer churn rate', canFocus: true, canReviewValue: false }
const DEMAND = { factorId: 'fac_demand', label: 'Enterprise market demand', canFocus: true, canReviewValue: false }
const MARKET = { factorId: 'fac_market', label: 'Market receptivity', canFocus: true, canReviewValue: false }
const COMPETITOR = { factorId: 'fac_comp', label: 'Competitor response', canFocus: true, canReviewValue: false }

/**
 * THE STATE THIS SLICE EXISTS FOR — rows arrived, were validated and
 * label-resolved, and NOT ONE cleared its noise floor. This is the shape all
 * five captured live payloads had, and the one where today's copy is most
 * likely to be misread.
 */
const ALL_BELOW_RESOLUTION: VoiRanking = {
  resolved: [],
  belowResolution: [CHURN, DEMAND],
  someFactorsUnassessed: false,
}

/** A run the ranking CAN rank — the slice-2a boundary case (§2). */
const RANKED: VoiRanking = {
  resolved: [MARKET, COMPETITOR],
  belowResolution: [],
  someFactorsUnassessed: false,
}

/**
 * Build the hero model THROUGH the real mapper, from a hook-shaped object.
 * `makeHeroData()` casts, so it carries neither VOI field — supplying them here
 * is what exercises the passthrough under test.
 */
function heroModel(
  voiRanking: VoiRanking | null,
  decisionVoi: DecisionVoiVerdict,
): HeroChartModel {
  const data = { ...makeHeroData(), voiRanking, decisionVoi } as ResultsSectionDataReturn
  const model = buildHeroModel(data)
  expect(model.kind, 'fixture must produce a chart model, else every assertion below is vacuous').toBe('chart')
  return model as HeroChartModel
}

/**
 * Render the panel, open the disclosure, switch to Resolve next, and return the
 * VIEW's own text.
 *
 * ⚠ THE HAYSTACK IS THE VIEW SUBTREE, NOT `document.body` — and getting this
 * wrong is a real hazard rather than a detail. The Alt-view suites sweep
 * `document.body.textContent` because they render the disclosure ALONE; here the
 * disclosure sits inside a panel that legitimately renders numbers everywhere
 * (option readouts, row ordinals, the headline's own percentage). A body-wide
 * no-digit sweep on this host is not a stricter guard — it is a FALSE one, which
 * fails on the panel's honest numbers and would push the next lane to weaken it.
 * The claim that is both true and worth pinning is "no digit inside the Resolve
 * next view", so that is the claim, scoped to the element it is about
 * (CLAUDE.md trap 16: a sweep proves what it was pointed at).
 */
function openResolveNext(
  voiRanking: VoiRanking | null,
  decisionVoi: DecisionVoiVerdict,
): string {
  render(<AnalysisHeroPanel model={heroModel(voiRanking, decisionVoi)} rerunDisabled={false} />)
  // `fireEvent`, NOT `node.click()`: the raw DOM call escapes React's `act()`, so
  // the disclosure never re-renders and every later assertion reads a COLLAPSED
  // section — a false green that looks exactly like a real one.
  fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
  fireEvent.click(screen.getByTestId('hero-evidence-tab-resolveNext'))
  return screen.getByTestId('hero-evidence-resolve-next').textContent ?? ''
}

/** Open the disclosure only — for the runs where no Resolve next chip exists. */
function openDisclosure(voiRanking: VoiRanking | null, decisionVoi: DecisionVoiVerdict) {
  render(<AnalysisHeroPanel model={heroModel(voiRanking, decisionVoi)} rerunDisabled={false} />)
  fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
}

/** The hook-shaped object ResultsBody needs, with the VOI fields attached. */
function resultsBodyData(
  voiRanking: VoiRanking | null,
  decisionVoi: DecisionVoiVerdict,
): ResultsSectionDataReturn {
  return { ...makeHeroData(), voiRanking, decisionVoi } as ResultsSectionDataReturn
}

function renderAnalysisTab(
  voiRanking: VoiRanking | null,
  decisionVoi: DecisionVoiVerdict,
) {
  return render(
    <ResultsBody
      resultsSectionData={resultsBodyData(voiRanking, decisionVoi)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
    />,
  )
}

beforeEach(() => {
  useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
  // The DEFAULT post-run dock tab — Analysis (`OutputsDock.tsx:345`, `:265`).
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
})

// ─── §0 — THE MOUNT PATH (trap 3b: bind to what the deployment mounts) ───────

describe('§0 Resolve next is on the DEFAULT Analysis tab', () => {
  it('0.1 reaches the Resolve next view INSIDE the analysis hero panel on the Analysis tab', () => {
    renderAnalysisTab(ALL_BELOW_RESOLUTION, 'measured_non_zero')

    // POSITIVE CONTROL FIRST. Without it every assertion below could be passing
    // against a panel that never painted (trap 13).
    const panel = screen.getByTestId('analysis-hero-panel')
    expect(screen.getByTestId('outputs-results-redesign'), 'the Analysis tab body rendered').toBeInTheDocument()

    // The user's two clicks, on the DEFAULT tab — no tab switch anywhere.
    fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
    fireEvent.click(screen.getByTestId('hero-evidence-tab-resolveNext'))

    // THE MOUNT PATH ITSELF, asserted — not merely "the testid exists
    // somewhere". If a future change relocates the view off the hero host, this
    // fails loud instead of passing on a different rendering of the same data.
    const view = within(panel).getByTestId('hero-evidence-resolve-next')
    expect(view).toBeInTheDocument()
    expect(within(view).getByTestId('hero-resolve-next-decision-level')).toBeInTheDocument()

    // And the Alt-view host is NOT what we reached: no V7 testid is involved.
    expect(screen.queryByTestId('v7-evidence-resolve-next')).not.toBeInTheDocument()
  })

  // ⚠ RETIRED WITH ITS MECHANISM: case 0.2 flipped the analysis-hero flag off
  // to prove 0.1's binding was real. That flag is deleted and the surface
  // mounts unconditionally, so the case could only have asserted a fork that
  // no longer exists. 0.1's binding is
  // still discriminating on its own — it asserts DESCENDANCY (`within(panel)`),
  // which a relocation off the host would RED.

  it('0.3 the collapsed disclosure ADVERTISES the view (its subtitle names it)', () => {
    // The residual reachability cost after this slice is one collapsed
    // disclosure. The subtitle is the only advert for what is inside it, and an
    // enumeration that omits a live view is a small dishonesty on the one line
    // every post-run user reads.
    renderAnalysisTab(ALL_BELOW_RESOLUTION, 'measured_non_zero')
    const toggle = screen.getByRole('button', { name: /why and what could change it/i })
    expect(toggle).toHaveTextContent(HERO_COPY.evidence.subtitle)
    expect(HERO_COPY.evidence.subtitle.toLowerCase()).toMatch(/resolve next/)
  })
})

// ─── §1 — THE DECISION-LEVEL LINE (the new acceptance) ───────────────────────

describe('§1 the decision-level line', () => {
  it('1.1 renders EXACTLY ONE line with the not-zero sentence when the run measured non-zero', () => {
    openResolveNext(ALL_BELOW_RESOLUTION, 'measured_non_zero')
    const nodes = screen.getAllByTestId('hero-resolve-next-decision-level')
    expect(nodes).toHaveLength(1)
    // Bound to the RATIFIED CONSTANT by identity, never to a paraphrase.
    expect(nodes[0]).toHaveTextContent(R.decisionNotZero)
    // It sits BENEATH the empty state, which must still render: the new line
    // adds the other measurement, it never replaces or softens the L51 sentence.
    expect(screen.getByTestId('hero-resolve-next-none-above-resolution')).toHaveTextContent(
      R.noneAboveResolution,
    )
  })

  it('1.2 NEGATIVE CONTROL — absent/not-computed renders NOTHING, not a placeholder', () => {
    // The contract's own absence rule: "Absence means NOT COMPUTED — never 0."
    // Saying anything here would convert "we did not compute this" into a
    // measurement. The honest render is silence.
    const text = openResolveNext(ALL_BELOW_RESOLUTION, 'not_computed')
    expect(screen.queryByTestId('hero-resolve-next-decision-level')).not.toBeInTheDocument()
    // …and the view DID render (else the absence above is vacuous).
    expect(screen.getByTestId('hero-resolve-next-none-above-resolution')).toBeInTheDocument()
    // No placeholder, no zero, no "unknown" stand-in leaked in its place.
    // (Scoped to the view — the panel's lens strip legitimately says "not
    // available for this run" about an unrelated lens.)
    expect(text).not.toMatch(/\bunknown\b|\bnot available\b|\bn\/a\b|\bpending\b/i)
    expect(text).not.toMatch(/\d/)
  })

  it('1.3 a MEASURED ZERO gets its own sentence — the one licensed no-effect state', () => {
    openResolveNext(ALL_BELOW_RESOLUTION, 'measured_zero')
    expect(screen.getByTestId('hero-resolve-next-decision-level')).toHaveTextContent(R.decisionZero)
    // And never the non-zero sentence: the two states must be distinguishable,
    // which is the whole point of the slice.
    expect(document.body.textContent ?? '').not.toContain(R.decisionNotZero)
  })

  it.each(['measured_non_zero', 'measured_zero', 'not_computed'] as const)(
    '1.4 renders NO DIGIT anywhere, in state %s',
    (verdict) => {
      // `decision_evpi` is in OUTCOME units with no licensed display and the
      // UI's unit story is a heuristic, so a magnitude on screen would inherit
      // the guess. The surface buys its signal from WORDS, never from a number.
      const text = openResolveNext(ALL_BELOW_RESOLUTION, verdict)
      expect(text, `a digit reached the DOM in state ${verdict}`).not.toMatch(/\d/)
    },
  )
})

// ─── §2 — THE GATING BOUNDARY (slice 2a is one state, deliberately) ──────────

describe('§2 the gate: the line belongs to the all-below-resolution state only', () => {
  it('2.1 a RANKED run does not get the decision line (the ranking is the answer there)', () => {
    openResolveNext(RANKED, 'measured_non_zero')
    // Positive control: the ranked rows really did render.
    expect(screen.getAllByTestId('hero-resolve-next-row').length).toBeGreaterThan(0)
    expect(screen.getByTestId('hero-resolve-next-lead')).toHaveTextContent(R.lead)
    expect(screen.queryByTestId('hero-resolve-next-decision-level')).not.toBeInTheDocument()
  })

  it('2.2 an ABSENT ranking offers NO chip and makes NO claim — honest silence', () => {
    // ⚠ THE HONESTY BOUNDARY, and it is the whole reason the decision line is
    // gated on the ranking rather than on `decision_evpi` alone.
    //
    // `voiRanking === null` means the estimator delivered no usable rows, so
    // "nothing stands out to resolve yet" would fabricate an assessment that
    // never happened. And stating the whole-decision fact on its own — even
    // though `decision_evpi` genuinely ARRIVED here, as `measured_non_zero`
    // proves — would imply a per-factor assessment beside it that also never
    // happened. So the surface says nothing at all.
    //
    // On THIS host that is expressed by removing the chip, following the
    // convention already pinned for Trade-offs ("never shows a Trade-offs tab
    // when the producer narrative is absent"): a chip whose only destination is
    // "not produced for this run" is a dead end. The Alt-view host renders its
    // chips unconditionally and shows a gate sentence instead; both are honest,
    // and this one is the one this host's users already understand.
    openDisclosure(null, 'measured_non_zero')
    // POSITIVE CONTROL: the disclosure genuinely opened and painted sibling
    // views, so the absences below are absences from a real render.
    expect(screen.getByTestId('hero-evidence-drivers')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-evidence-tab-resolveNext')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-evidence-resolve-next')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-resolve-next-decision-level')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-resolve-next-none-above-resolution')).not.toBeInTheDocument()
    // No claim about value of information reached the user by ANY route.
    const body = document.body.textContent ?? ''
    expect(body).not.toContain(R.decisionNotZero)
    expect(body).not.toContain(R.noneAboveResolution)
    expect(body).not.toContain(R.gate)
  })

  it('2.3 a run whose ONLY evidence is the ranking still discloses it', () => {
    // ⭐ THE SILENT-CAPABILITY CASE, and the reason `hasResolveNext` had to join
    // the disclosure's nothing-to-disclose guard rather than only the chip list.
    //
    // Before this slice the guard was `!drivers && !flipRisks && !tradeOffs →
    // render nothing`. Promoting Resolve next WITHOUT widening that guard would
    // have produced the estate's signature defect in miniature: on a run where
    // the ranking is the only evidence, the whole disclosure would return null
    // and the newly-promoted capability would be invisible — with every other
    // test in this file still green, because they all use a fixture that happens
    // to carry drivers.
    const data = {
      ...makeHeroData({ topDriverLabel: null, recommendation: { flipThresholds: [] } }),
      voiRanking: ALL_BELOW_RESOLUTION,
      decisionVoi: 'measured_non_zero' as DecisionVoiVerdict,
    } as ResultsSectionDataReturn
    const model = buildHeroModel(data) as HeroChartModel
    expect(model.kind).toBe('chart')
    // Precondition PINNED IN-TEST: this really is a no-other-evidence run, so
    // the assertion below is provably about the guard and not about a fixture
    // that quietly still had drivers (CLAUDE.md trap 13b).
    expect(model.evidence.drivers, 'precondition: no drivers').toHaveLength(0)
    expect(model.evidence.flipRisks, 'precondition: no flip risks').toHaveLength(0)
    expect(model.evidence.tradeOffs, 'precondition: no trade-offs').toBeNull()
    expect(model.evidence.resolveNext, 'precondition: the ranking IS present').not.toBeNull()

    render(<AnalysisHeroPanel model={model} rerunDisabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
    // The single remaining view is auto-selected, so no chip click is needed.
    const view = screen.getByTestId('hero-evidence-resolve-next')
    expect(within(view).getByTestId('hero-resolve-next-decision-level')).toHaveTextContent(
      R.decisionNotZero,
    )
  })
})

// ─── §3 — HONESTY SWEEPS OVER THE NEW HOST'S DOM ─────────────────────────────

describe('§3 the new host is swept by the same honesty doctrines as the old one', () => {
  it.each(refutedClaimsForScope('dom').map((r) => [r.what, r.pattern, r.control] as const))(
    '3.1 renders none of the refuted value-of-information vocabulary: %s',
    (_what, pattern, control) => {
      // The control proves the pattern can fire at all; the sweep proves the
      // rendered DOM does not trip it. A sweep whose pattern matches nothing
      // anywhere is a sweep that cannot fail (trap 13).
      expect(control, 'the pattern must match its own control').toMatch(pattern)
      const text = openResolveNext(ALL_BELOW_RESOLUTION, 'measured_non_zero')
      expect(text).not.toMatch(pattern)
    },
  )

  it.each(NO_EFFECT_CLAIM_PHRASES)(
    '3.2 the RENDERED surface makes no no-effect claim (L61): %s',
    (phrase) => {
      const text = openResolveNext(ALL_BELOW_RESOLUTION, 'measured_non_zero')
      expect(text.toLowerCase()).not.toContain(phrase)
    },
  )

  it('3.3 …including in the measured-ZERO state, where the claim IS licensed', () => {
    // ⭐ The subtle one. A measured zero is the one state where "learning
    // everything would change nothing" is TRUE, so the temptation is to spell it
    // with the banned words. The sentence must make the licensed claim WITHOUT
    // matching the literals — a sweep with a carve-out is a sweep that widens.
    const text = openResolveNext(ALL_BELOW_RESOLUTION, 'measured_zero')
    for (const phrase of NO_EFFECT_CLAIM_PHRASES) {
      expect(text.toLowerCase(), `the zero sentence must not need the banned literal "${phrase}"`).not.toContain(phrase)
    }
    // …and it did render, so the sweep above was not vacuous.
    expect(screen.getByTestId('hero-resolve-next-decision-level')).toHaveTextContent(R.decisionZero)
  })

  it('3.4 POSITIVE CONTROL — the L61 sweep can SEE this host and would fail the historical overclaim', () => {
    const text = openResolveNext(ALL_BELOW_RESOLUTION, 'measured_non_zero')
    // (a) the haystack really contains the surface's sentences
    expect(text).toContain(R.noneAboveResolution)
    expect(text).toContain(R.decisionNotZero)
    // (b) the phrase list is capable of failing the sentence it was written to
    // remove — pinned to that literal permanently, not to whatever ships now.
    expect(
      NO_EFFECT_CLAIM_PHRASES.some((p) => HISTORICAL_NO_EFFECT_OVERCLAIM.toLowerCase().includes(p)),
      'the sweep must be capable of failing the sentence it exists to keep out',
    ).toBe(true)
  })
})

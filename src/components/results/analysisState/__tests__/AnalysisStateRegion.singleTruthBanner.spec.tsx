/**
 * THE ACCEPTANCE TEST FOR L-36 / screenshot S06 — the P0-trust defect where
 * "This analysis did not run — it stopped before it ran" and "Cannot confirm
 * whether this analysis is current." rendered ONE ABOVE THE OTHER, directly
 * above a fully rendered result.
 *
 * ⭐ WHAT IS BEING CLAIMED, PRECISELY
 * ----------------------------------
 * NOT "those two sentences no longer co-occur in the one state we looked at".
 * The claim is STRUCTURAL: the surface has exactly one truth-state slot, and
 * which banner fills it is a total function of the run state. So the assertions
 * below are (a) exhaustive over the state enum, not sampled, and (b) written
 * against the MOUNTED ELEMENTS by testid, never against copy — copy changes and
 * the property must survive it (trap 19: bind by identity).
 *
 * ⭐ THE MUTANT PAIR (brief acceptance (a): "the pair, not one mutant")
 * -------------------------------------------------------------------
 * A count-≤-1 assertion is satisfiable by a region that renders NOTHING, so it
 * is not evidence on its own. Every exclusivity case below is therefore paired
 * with a POSITIVE case in the opposite state, and the two must disagree:
 *   · force `refused` with a prior result → the refusal banner mounts and the
 *     freshness banner does NOT;
 *   · force `complete_current`            → the freshness banner mounts and the
 *     refusal banner does NOT.
 * A mutant that always returns 'refusal' passes the first and REDs the second;
 * a mutant that always returns 'freshness' does the reverse; a mutant that
 * renders both REDs both. No single mutant survives the pair.
 *
 * ⚠ WHY THE NOTICES ARE STUBBED
 * -----------------------------
 * The real notices render null unless their own store slices hold a verdict, so
 * a test using them would be asserting the STORE's state, not the region's
 * rule — and a slice that failed to populate would look exactly like correct
 * exclusivity (an absence probe with no positive control, trap 13). The stubs
 * ALWAYS render, which means every "did not mount" assertion below is a claim
 * about the REGION and nothing else. `analysisStateRegion.mountSites.spec.ts`
 * separately pins that the production surface mounts the real ones, and only
 * from here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../AnalysisRefusalNotice', () => ({
  AnalysisRefusalNotice: () => <div data-testid="analysis-refusal-notice">refusal</div>,
}))
vi.mock('../../AnalysisFreshnessNotice', () => ({
  AnalysisFreshnessNotice: () => <div data-testid="analysis-freshness-notice">freshness</div>,
}))

import { AnalysisStateRegion } from '../AnalysisStateRegion'
import {
  TRUTH_BANNER_BY_RUN_STATE,
  selectBodyPresentation,
  selectTruthBanner,
  type AnalysisRunStateKind,
} from '../analysisStateContract'

const ALL_STATES = Object.keys(TRUTH_BANNER_BY_RUN_STATE) as AnalysisRunStateKind[]

/** Every truth-state banner the surface can mount, counted as DOM elements. */
function mountedTruthBanners(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll(
      '[data-testid="analysis-refusal-notice"],[data-testid="analysis-freshness-notice"]',
    ),
  ).map((el) => el.getAttribute('data-testid') ?? '')
}

describe('AnalysisStateRegion — AT MOST ONE truth-state banner, in every state', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('control: the probe can SEE a banner (it is not blind)', () => {
    // Trap 13. Every assertion in this file is an absence claim about one
    // banner or the other; none of them is worth anything unless the query can
    // observe a presence. It can: here it observes two, which is also the
    // pre-fix shape this region exists to make unreachable.
    const { container } = render(
      <div>
        <div data-testid="analysis-refusal-notice" />
        <div data-testid="analysis-freshness-notice" />
      </div>,
    )
    expect(mountedTruthBanners(container)).toHaveLength(2)
  })

  it.each(ALL_STATES)('mounts at most one truth-state banner in %s', (kind) => {
    // Exhaustive over the enum, with a prior result present in EVERY state —
    // i.e. the hardest case, the one where a body is on screen for a banner to
    // contradict. Sampling states here is how S06 shipped.
    const { container } = render(
      <AnalysisStateRegion runState={kind} hasReport>
        <div data-testid="results-body" />
      </AnalysisStateRegion>,
    )
    expect(mountedTruthBanners(container).length).toBeLessThanOrEqual(1)
  })

  it('S06 EXACTLY: refused, with a prior result on screen → ONE banner, and it is the refusal', () => {
    // The witnessed defect, reproduced as a state and pinned. Before the
    // region, this cell mounted the refusal notice AND the freshness notice
    // (CEE clamps a refusal's freshness to `unknown`, so "cannot confirm" was
    // live in exactly the state that had just said the analysis never ran)
    // AND the previous run's body.
    const { container } = render(
      <AnalysisStateRegion
        runState="refused"
        hasReport
        bodyAttribution={<div data-testid="stale-results-banner" />}
      >
        <div data-testid="results-body" />
      </AnalysisStateRegion>,
    )
    expect(mountedTruthBanners(container)).toEqual(['analysis-refusal-notice'])
    expect(screen.queryByTestId('analysis-freshness-notice')).toBeNull()
    // The body is NOT withheld: the user's best available context stays on
    // screen, attributed. Withholding it would be a second defect, not a fix.
    expect(screen.getByTestId('results-body')).toBeTruthy()
    expect(screen.getByTestId('stale-results-banner')).toBeTruthy()
  })

  it('THE PAIR: complete_current → ONE banner, and it is the FRESHNESS one', () => {
    // The other half. Without this case, "exactly one refusal banner" is also
    // satisfied by a region hard-wired to the refusal notice.
    const { container } = render(
      <AnalysisStateRegion runState="complete_current" hasReport>
        <div data-testid="results-body" />
      </AnalysisStateRegion>,
    )
    expect(mountedTruthBanners(container)).toEqual(['analysis-freshness-notice'])
    expect(screen.queryByTestId('analysis-refusal-notice')).toBeNull()
  })

  it('never_run mounts NO truth-state banner and NO body', () => {
    const { container } = render(
      <AnalysisStateRegion runState="never_run" hasReport>
        <div data-testid="results-body" />
      </AnalysisStateRegion>,
    )
    expect(mountedTruthBanners(container)).toEqual([])
    expect(screen.queryByTestId('results-body')).toBeNull()
  })

  it('a refused FIRST analysis still reaches the user, with no body to decorate', () => {
    // ROADMAP 2.1163's harm, preserved through the refactor. The refusal notice
    // was deliberately UNGATED at its old mount site precisely because a refused
    // analysis is the case with no results; the region reproduces that by
    // ordering `refused` above `never_run`, not by copying the gate.
    render(<AnalysisStateRegion runState="refused" hasReport={false} />)
    expect(screen.getByTestId('analysis-refusal-notice')).toBeTruthy()
    expect(screen.queryByTestId('analysis-freshness-notice')).toBeNull()
  })

  it('the attribution renders ONLY for a prior body, never beside a current one', () => {
    // DISCRIMINATING PAIR for the body slot: same attribution node, two states,
    // opposite outcomes. Rendering "showing results from previous analysis"
    // over THIS run's numbers is the 2.1127 false claim.
    const prior = render(
      <AnalysisStateRegion
        runState="complete_stale"
        hasReport
        bodyAttribution={<div data-testid="stale-results-banner" />}
      />,
    )
    expect(prior.queryByTestId('stale-results-banner')).toBeTruthy()
    document.body.innerHTML = ''

    const current = render(
      <AnalysisStateRegion
        runState="complete_current"
        hasReport
        bodyAttribution={<div data-testid="stale-results-banner" />}
      />,
    )
    expect(current.queryByTestId('stale-results-banner')).toBeNull()
  })
})

describe('the composition table itself', () => {
  it('is total over the run states — no state falls through to a default', () => {
    // A default arm is how a newly-minted state silently inherits somebody
    // else's banner. There is no default; this asserts the consequence.
    for (const kind of ALL_STATES) {
      expect(selectTruthBanner(kind), kind).toMatch(/^(none|refusal|freshness)$/)
    }
    expect(ALL_STATES).toHaveLength(7)
  })

  it('gives blocked and refused the SAME row (they differ on the wire, not on screen)', () => {
    expect(selectTruthBanner('blocked')).toBe(selectTruthBanner('refused'))
    expect(selectTruthBanner('refused')).toBe('refusal')
  })

  it('a run in flight keeps a retained body — MARKED, never blanked', () => {
    // The brief's table writes ✗ for the running row. That is right for a FIRST
    // run and wrong for a rerun: blanking the previous numbers mid-run
    // contradicts the ratified "run-in-flight is MARKED, not blanked" doctrine
    // and takes content away at the moment the user is comparing. `hasReport`
    // separates the two cases, and both are pinned here.
    expect(selectBodyPresentation('running', false)).toBe('hidden')
    expect(selectBodyPresentation('running', true)).toBe('prior')
  })

  it('only complete_current presents the body as current', () => {
    for (const kind of ALL_STATES) {
      const presentation = selectBodyPresentation(kind, true)
      if (kind === 'complete_current') expect(presentation).toBe('current')
      else if (kind === 'never_run') expect(presentation).toBe('hidden')
      else expect(presentation, kind).toBe('prior')
    }
  })
})

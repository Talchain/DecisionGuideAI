/**
 * "What your model implies" is on the panel.
 *
 * ── THE DEFECT: A FINISHED CAPABILITY NOBODY PLUGGED IN ────────────────────
 * `sections/ModelImplication.tsx` is written, typed, gated, built onto the view
 * model (`buildAnalysisNewViewModel.ts:2307`) and covered by two spec files —
 * and had ZERO production importers. The estate already knew:
 * `analysis-hero/__tests__/heroWithholdsOnTheSameCells.spec.ts:30` says so in
 * as many words. So every sentence in `analysisNewCopy.ts:108-178` —
 * `divergedLead`, `divergedResolve`, `alignedLead`, `alignedResolve`,
 * `needsTargetLead`, `needsTargetUnlock` — reached no screen.
 *
 * It is the design pack's CENTREPIECE. `10-REASONING-PANEL-revised.html` gives
 * "What your model implies" its own block between the coaching cards and the
 * collapsed rows; the shipped tab had the option ROWS and not the sentence that
 * says what they mean.
 *
 * ── WHY IT MOUNTS ABOVE THE OPTION ROWS ────────────────────────────────────
 * The component's own header argues it must NOT be a collapsed row: when the
 * two readings disagree, that is the most decision-relevant sentence the run
 * produced, and "a finding that changes the decision cannot rest behind a
 * chevron." The prototype agrees — the implication leads, the rows support it.
 *
 * ── WHAT THIS DOES NOT DO ──────────────────────────────────────────────────
 * It adds no claim. Every sentence arrives pre-composed and already gated:
 * `{kind:'none'}` for pre-run, for a single option, and on any run whose
 * verdict withholds the leader claim. This spec pins that the DARK STATES STAY
 * DARK, because "mount the thing" is exactly the change that would make a
 * withheld claim visible if the mount ignored the gate.
 *
 * ── ⭐ V2 (24 Sep 2026): THE CARD IS GONE, THE SENTENCE IS NOT ─────────────
 * Reasoning V2 no longer mounts `ModelImplication`. Its LEAD reaches the screen
 * as bullet 1 ("What seems well-founded") of "Move towards commitment"
 * (`buildCommitmentSynthesis` → `CommitmentSummary`), which wraps the option
 * rows. So the wiring cases below are re-pointed to THAT bullet, bound by its
 * `data-source` identity and the exact copy constant, on a rendered tab — no
 * longer a source scan, which on the V2 body matched only comments that still
 * name `<ModelImplication>`. The component cases stay: the component exists and
 * its contract is unchanged; it simply has no mount on this tab.
 *
 * ⛔ AND THE DARK STATE STAYS DARK, BY A NEW GATE. Bullet 1 is silenced whenever
 * `vm.checks.leaderWithheld` (see `commitmentSynthesis.ts`, `foundedBullet`):
 * a run with NO verdict still yields an `aligned` implication, while the checks
 * read the same run as `leader_not_assessed`. The withheld arm below pins it.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { ModelImplication } from '../sections/ModelImplication'
import type { ModelImplication as Model } from '../analysisNewTypes'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentSynthesis } from '../commitmentSynthesis'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { DecisionResultData } from '../../types'
import { makeData, makeOption } from './analysisNewFixtures'

/** The commitment zone's own testid and bullet 1's (`CommitmentSummary`). */
const COMMIT = 'analysis-new-commitment'
const FOUNDED = `${COMMIT}-founded`

/**
 * A run ENTITLED to name a leader: the verdict AND its sibling conjunct, as
 * `useResultsSectionData` publishes them (see `modelImplication.spec.ts`,
 * `ENTITLED_RUN`, for why the verdict alone is a shape the producer never emits).
 */
const ENTITLED = {
  verdict: { leaderId: 'opt_a', hasLeadingOption: true } as DecisionResultData['verdict'],
  leaderDesignationPermitted: true,
}
const ranged = (id: string, label: string, centre: number, goalProbability: number | null) =>
  makeOption({
    id,
    label,
    expected: centre,
    p10: centre - 10,
    p50: centre,
    p90: centre + 10,
    outcome: { mean: centre, p10: centre - 10, p50: centre, p90: centre + 10 },
    ...(goalProbability === null ? {} : { goalProbability }),
    nValidSamples: 2000,
  })
/** Two readings, two different options: A leads the outcome, B the goal. */
const divergingRun = (): ResultsSectionDataReturn => {
  const a = ranged('opt_a', 'Segment', 120, 0.3)
  const b = ranged('opt_b', 'RudderStack', 60, 0.8)
  return makeData({ recommendation: { allOptions: [a, b], recommendedOption: a, goalThreshold: 100, ...ENTITLED } })
}
/** Same options, no user target: one reading only (`needs_target`). */
const oneReadingRun = (): ResultsSectionDataReturn => {
  const a = ranged('opt_a', 'Segment', 120, null)
  const b = ranged('opt_b', 'RudderStack', 60, null)
  return makeData({ recommendation: { allOptions: [a, b], recommendedOption: a, ...ENTITLED } })
}
/** The diverging run with the leader claim WITHHELD — one conjunct flipped. */
const withheldRun = (): ResultsSectionDataReturn => {
  const d = divergingRun()
  return {
    ...d,
    recommendation: {
      ...d.recommendation,
      verdict: { leaderId: 'opt_a', hasLeadingOption: false } as DecisionResultData['verdict'],
      leaderDesignationPermitted: false,
    },
  }
}

const vmOf = (data: ResultsSectionDataReturn, isStale = false) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale })

const renderTab = (data: ResultsSectionDataReturn, stale = false) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={stale}
      {...(stale ? { staleReason: 'changed' as const } : {})}
      responseHash="implication_reaches_screen"
    />,
  )

/** `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const CLAIM = (sentence: string) => ({ sentence }) as never

const DIVERGED: Model = {
  kind: 'diverged',
  outcome: CLAIM('Adopt Segment has the highest expected outcome.'),
  goal: CLAIM('Accelerator or Bridge Funding is likeliest to hit the goal.'),
}

describe('the implication block reaches a screen', () => {
  it('CONTROL: the component renders its title and both readings', () => {
    // Establishes the probe can see the block at all, so the mount assertion
    // below is about the WIRING and not about a broken renderer.
    cleanup()
    render(<ModelImplication implication={DIVERGED} />)
    expect(screen.getByTestId('analysis-new-implication')).toBeVisible()
    expect(screen.getByTestId('analysis-new-implication-outcome')).toHaveTextContent(
      'highest expected outcome',
    )
    expect(screen.getByTestId('analysis-new-implication-goal')).toHaveTextContent(
      'likeliest to hit the goal',
    )
  })

  /**
   * ⭐ V2 RE-POINT (was a source scan for `<ModelImplication implication={vm…}>`).
   * The property is unchanged — the implication is WIRED to the screen, fed the
   * view model, not a literal — and it is now asserted on a rendered tab: bullet
   * 1 carries the lead, bound by `data-source` and the exact copy constant, and
   * the retired card has no second mount beside it.
   */
  it('THE WIRING: the implication lead reaches the screen as bullet 1 of the commitment zone', () => {
    const data = divergingRun()
    const vm = vmOf(data)
    // PRECONDITIONS, PINNED IN-TEST: a reading that speaks, on a run whose
    // leader is NOT withheld — otherwise bullet 1 is silent by design.
    expect(vm.modelImplication.kind, 'PRECONDITION: the run yields two readings').toBe('diverged')
    expect(vm.checks.leaderWithheld, 'PRECONDITION: the leader is not withheld').toBe(false)
    expect(buildCommitmentSynthesis(vm).founded?.source).toBe('implication_diverged_lead')

    cleanup()
    renderTab(data)
    const founded = screen.getByTestId(FOUNDED)
    expect(founded).toHaveAttribute('data-source', 'implication_diverged_lead')
    expect(screen.getByTestId(`${FOUNDED}-text`).textContent).toBe(COPY.implications.divergedLead)
    expect(screen.getByTestId(COMMIT)).toContainElement(founded)
    // The card itself is not mounted: bullet 1 is the ONE place this lead lives.
    expect(screen.queryByTestId('analysis-new-implication')).toBeNull()
    const body = screen.getByTestId('analysis-new-tab-body').textContent ?? ''
    expect(body.split(COPY.implications.divergedLead).length - 1, 'the lead is said once').toBe(1)
  })

  it('THE WIRING: an aligned run states the aligned lead, naming the option the view model named', () => {
    // The other speaking arm, so the bullet is shown to follow the VIEW MODEL's
    // kind rather than always printing one sentence. Both readings pick A.
    const a = ranged('opt_a', 'Segment', 120, 0.8)
    const b = ranged('opt_b', 'RudderStack', 60, 0.3)
    const data = makeData({ recommendation: { allOptions: [a, b], recommendedOption: a, goalThreshold: 100, ...ENTITLED } })
    const mi = vmOf(data).modelImplication
    expect(mi.kind, 'PRECONDITION: both readings agree').toBe('aligned')
    if (mi.kind !== 'aligned') throw new Error('unreachable')

    cleanup()
    renderTab(data)
    expect(screen.getByTestId(FOUNDED)).toHaveAttribute('data-source', 'implication_aligned_lead')
    expect(screen.getByTestId(`${FOUNDED}-text`).textContent).toBe(COPY.implications.alignedLead(mi.label))
  })

  /**
   * ⭐ V2 RE-POINT. This asserted by SOURCE POSITION, and on the V2 body it was
   * passing on two COMMENTS that still name `<ModelImplication>` and
   * `<OptionsComparison>` — vacuous. The prototype's order is unchanged (the
   * sentence that says what the rows mean comes first), so it is now asserted
   * in the rendered DOM: bullet 1 precedes the option rows, which sit in the
   * commitment zone's slot below the bullets.
   */
  it('it leads the option rows rather than following them', () => {
    cleanup()
    renderTab(divergingRun())
    const founded = screen.getByTestId(FOUNDED)
    const options = screen.getByTestId('analysis-new-options')
    expect(screen.getByTestId(`${COMMIT}-slot`)).toContainElement(options)
    expect(precedes(founded, options), 'the implication must precede the option rows').toBe(true)
  })

  /**
   * ⛔ THE LOAD-BEARING DARK STATE, AT THE WIRING. A withheld leader silences
   * any READING bullet 1 would otherwise state — and the contrast twin above
   * (`divergingRun`, one conjunct apart) proves the probe can see the bullet.
   *
   * ⭐⭐ WAVE 2 (commitment structure, 25 Sep 2026): RE-POINTED, NOT DELETED.
   * "NO implication on screen" used to mean the bullet did not render at all;
   * it now means no READING renders — bullet 1 states the option count
   * instead (`commitmentSynthesis.ts`'s `withheldFoundedBullet`), which is
   * not an implication about which option is ahead.
   */
  it('DISCRIMINATOR: a withheld leader puts NO implication on screen (states the count instead)', () => {
    const vm = vmOf(withheldRun())
    expect(vm.checks.leaderWithheld, 'PRECONDITION: the leader is withheld').toBe(true)

    cleanup()
    renderTab(withheldRun())
    // The zone rendered — so the absence is the gate's doing, not an empty tab.
    expect(screen.getByTestId(COMMIT)).toBeInTheDocument()
    expect(screen.getByTestId(FOUNDED)).toHaveAttribute('data-source', 'withheld_count')
    const body = screen.getByTestId('analysis-new-tab-body').textContent ?? ''
    expect(body).not.toContain(COPY.implications.divergedLead)
    expect(body).not.toContain(COPY.implications.alignedLead('Segment'))
    expect(body).not.toContain(COPY.implications.alignedLead('RudderStack'))
  })

  it('a STALE run says so on the block itself, not only in the ribbon far above', () => {
    // ⚠ RAISED BY REVIEW, AND IT IS EXPOSURE THIS MOUNT CREATED. Before the
    // mount the component had no importers, so it could not mislead anyone.
    // It is now the ONLY block on the panel that does not rest behind a
    // chevron, and it makes the strongest claim on the surface — so it carries
    // its own qualifier rather than relying on a ribbon several sections up.
    cleanup()
    render(<ModelImplication implication={DIVERGED} isStale />)
    expect(screen.getByTestId('analysis-new-implication-stale')).toBeVisible()
  })

  it('DISCRIMINATOR: a fresh run carries NO stale marker', () => {
    // The cheapest wrong implementation stamps every render. That would make
    // the marker meaningless, which is worse than not having one.
    cleanup()
    render(<ModelImplication implication={DIVERGED} />)
    expect(screen.queryByTestId('analysis-new-implication-stale')).toBeNull()
  })

  it('does not become a THIRD request for the success target', () => {
    // ⚠ RAISED BY REVIEW. The `needs_target` reading closes with an ASK, and the
    // model strip asks for the same thing. `successTargetAskedOnce.spec.tsx`
    // exists because this panel once put one fact on screen four times — and it
    // mentions neither `implication` nor `needs_target`, so the new claimant
    // this mount created was invisible to the guard written to prevent exactly
    // it. The finding survives; the duplicate ask does not.
    const NEEDS: Model = {
      kind: 'needs_target',
      outcome: CLAIM('Adopt Segment has the highest expected outcome.'),
    }
    cleanup()
    render(<ModelImplication implication={NEEDS} targetAskedElsewhere />)
    expect(screen.getByTestId('analysis-new-implication-outcome')).toBeVisible()
    expect(
      screen.queryByTestId('analysis-new-implication-resolve'),
      'a third request for one target',
    ).toBeNull()
    // ⚠ AND THE LEAD GOES WITH IT. Suppressing the ask alone left "Only one
    // reading of this run is available." standing with its remedy deleted — a
    // limitation announced as a dead end, which is a worse sentence than the
    // duplicate ask it replaced. Raised by review.
    expect(
      screen.queryByTestId('analysis-new-implication-lead'),
      'a limitation stated with its remedy removed',
    ).toBeNull()
  })

  it('DISCRIMINATOR: when NOTHING else asks, this block still does', () => {
    // The cheapest wrong fix deletes the ask outright. Then a user with no
    // target and no strip affordance is never told the run could answer more.
    const NEEDS: Model = {
      kind: 'needs_target',
      outcome: CLAIM('Adopt Segment has the highest expected outcome.'),
    }
    cleanup()
    render(<ModelImplication implication={NEEDS} />)
    expect(screen.getByTestId('analysis-new-implication-resolve')).toBeVisible()
    expect(screen.getByTestId('analysis-new-implication-lead')).toBeVisible()
  })

  it('DISCRIMINATOR: a DIVERGED reading keeps its close either way', () => {
    // The suppression is scoped to the arm that asks. Diverged closes with what
    // to do about the disagreement, which is not a target request.
    cleanup()
    render(<ModelImplication implication={DIVERGED} targetAskedElsewhere />)
    expect(screen.getByTestId('analysis-new-implication-resolve')).toBeVisible()
    expect(screen.getByTestId('analysis-new-implication-lead')).toBeVisible()
  })

  /**
   * ⭐ V2 RE-POINT (was a source scan for `isStale={vm.status.isStale}` and
   * `targetAskedElsewhere={stripOffersTarget}` on the card's mount).
   *
   * ⭐ RE-POINTED AGAIN (40692c55 / 716b8e67, V2 census B3): the commitment
   * block no longer carries its own stale marker (`analysis-new-commitment-stale`
   * is gone). The glance's freshness ribbon is the ONE freshness statement on a
   * stale post-run tab, and it states which staleness it is; the block's
   * "From an earlier run" said it a second time and asserted a changed model on
   * runs we only cannot confirm. So: a stale run shows the ribbon ONCE, above
   * the claim, and the commitment block adds no marker; the fresh twin shows no
   * ribbon — a marker that stamps every render means nothing.
   */
  it('THE WIRING: a stale run shows the glance ribbon once and the commitment block adds no marker', () => {
    cleanup()
    renderTab(divergingRun(), true)
    const ribbons = screen.getAllByTestId('analysis-new-status-stale')
    expect(ribbons, 'the freshness statement is made exactly once').toHaveLength(1)
    expect(ribbons[0].textContent).toBe(COPY.status.stale)
    const body = screen.getByTestId('analysis-new-tab-body').textContent ?? ''
    expect(body.split(COPY.status.stale).length - 1, 'the ribbon sentence is on screen once').toBe(1)
    expect(precedes(ribbons[0], screen.getByTestId(FOUNDED)), 'the qualifier comes before the claim').toBe(true)
    const commitment = screen.getByTestId(COMMIT)
    expect(commitment, 'PRECONDITION: the block holds the claim').toContainElement(screen.getByTestId(FOUNDED))
    expect(screen.queryByTestId(`${COMMIT}-stale`), 'the retired marker stays retired').toBeNull()
    expect(commitment.textContent ?? '', 'the block adds no freshness marker of its own').not.toContain(COPY.markers.stale)
    expect(commitment.textContent ?? '').not.toContain(COPY.status.stale)

    cleanup()
    renderTab(divergingRun(), false)
    expect(screen.getByTestId(FOUNDED), 'PRECONDITION: the bullet renders').toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-status-stale')).toBeNull()
    expect(screen.queryByTestId('analysis-new-status-freshness-unknown')).toBeNull()
  })

  /**
   * The ask-once rule, V2. Bullet 1 takes the `needs_target` state's FIRST
   * STATEMENT (the outcome reading), never its lead ("Only one reading…") or its
   * unlock (the request for a target) — so the synthesis cannot become a third
   * request for the success target beside the model strip. Pinned on the
   * rendered tab, with the outcome sentence present as the positive control.
   */
  it('THE WIRING: a one-reading run states the outcome reading and does NOT ask for a target', () => {
    const mi = vmOf(oneReadingRun()).modelImplication
    expect(mi.kind, 'PRECONDITION: no user target, one reading').toBe('needs_target')
    if (mi.kind !== 'needs_target') throw new Error('unreachable')

    cleanup()
    renderTab(oneReadingRun())
    expect(screen.getByTestId(FOUNDED)).toHaveAttribute('data-source', 'implication_outcome_claim')
    expect(screen.getByTestId(`${FOUNDED}-text`).textContent).toBe(mi.outcome.sentence)
    const body = screen.getByTestId('analysis-new-tab-body').textContent ?? ''
    expect(body, 'a limitation announced with its remedy elsewhere').not.toContain(COPY.implications.needsTargetLead)
    expect(body, 'a third request for one target').not.toContain(COPY.implications.needsTargetUnlock)
  })

  it('DISCRIMINATOR: a withheld or pre-run implication still renders nothing', () => {
    // The load-bearing one. `{kind:'none'}` is what a withheld-leader run and a
    // pre-run both produce, and mounting a component is precisely the change
    // that could put a withheld claim on screen. If this ever renders chrome,
    // the mount has outrun its gate.
    cleanup()
    const { container } = render(<ModelImplication implication={{ kind: 'none' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

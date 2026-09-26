/**
 * ⭐⭐ THE INFLUENCE ROW READS AS A RANKING — ON BOTH VIEWS, OR THE FIX IS A
 * PER-VIEW ACCIDENT.
 *
 * ⛔⛔ THIS SPEC HAS NEVER BEEN EXECUTED. Written under a hard no-install /
 * no-test-run constraint: no vitest, no tsc, no node_modules, nothing driven on
 * staging. Every expectation is derived by reading `FactorNode.tsx`,
 * `NodeMetricRow.tsx` and `influenceScaleCopy.ts` at this branch's tip. CI is
 * the authority. There is no green claim from this lane.
 *
 * ## THE ABSENCE THIS CLOSES, AND WHY THE UNIT SPEC BESIDE IT IS NOT ENOUGH
 *
 * At `2a433f99` the branch changed four files and added no test file. Swept
 * with `rg -a`: `influenceRankReadout` → 3 files, all source, 0 test;
 * `influenceSetSize` → 2 files, all source, 0 test; contrast
 * `influenceBasisNoun` → 10 files including 5 dedicated specs. The contrast
 * fires hard in the same sweep, so the zero is real absence, not a blind probe.
 *
 * `influenceRankReadout.spec.ts` guards the FUNCTION. It cannot see a DELETED
 * CALL SITE — a pure-function spec stays green while the card renders whatever
 * it likes. THIS file is the one that REDs on that, and it is pointed at BOTH
 * call sites deliberately: the same figure is rendered by the Standard-view
 * `NodeMetricRow` and by the Detailed-view `DataBar`, so covering one would
 * leave `Relative influence … 100%` reachable one view away.
 *
 * ## ⚠ THE FIXTURES SUPPLY `influenceSetSize`, AND THAT IS THE POINT
 *
 * The field arrived OPTIONAL, so every pre-existing mock of
 * `useNodeDisplayMetadata` omits it, `influenceRankReadout(rank, undefined)`
 * returns null, and the whole existing suite sits on the fallback branch. That
 * is CLAUDE.md trap 3b — a test bound to a surface the deployed product does
 * not render — arriving through the FIXTURE rather than through a flag. Every
 * mock below states its denominator explicitly, on both arms.
 *
 * ## ⚠ WHAT THIS CANNOT PROVE (jsdom, CLAUDE.md trap 3)
 *
 * Nothing here is a claim about LAYOUT. The `w-7` → `min-w-7` change on the
 * detailed row and the caption-column floor are pixel claims; jsdom cannot see
 * them, this lane ran no visual harness, and no such claim is made.
 *
 * ## ⭐ LOCKED CANVAS DESIGN (23 Sep 2026) — ONE DRIVER LINE, BOTH VIEWS
 *
 * Spec §3 "Tiny driver visual"; ED 02:31Z D1a; ED 11:52Z point 3 ("no
 * pseudo-precise `% influence` on the face"). The Standard `NodeMetricRow`
 * (`factor-influence-row`, "Most influential … of 5") and the Detailed DataBar
 * row are BOTH replaced by one `FactorDriverLine`: `factor-driver-line` on the
 * face, `factor-driver-line-detail` in Detailed/popover layer 2. Its caption is
 * "Driver N of M analysed" for a determined rank, else the quantity's own
 * noun; the percentage lives ONLY in its accessible name / tooltip, beside
 * "…N% of the strongest factor…" — demoted, never deleted.
 *
 * ⭐ AND THE STANDARD LINE MOVED OFF THE FACE (ED #63 5809278282, 24 Sep —
 * bounded anatomy): "The fuller S3 reasoning detail — change rows, driver
 * wording, turning-point explanation/findings — can move to the existing
 * hover/focus popover and inspector rather than expanding layout geometry."
 * `factor-driver-line` is now rendered INSIDE the factor's Standard popover
 * (mocked transparent here as `factor-node-popover`), and `popoverLine()` binds
 * it THERE and asserts it is NOT on the card face. The face keeps a neutral,
 * wordless driver cue (pinned in `FactorNode.boundedAnatomy.spec.tsx`).
 *
 * Every claim below is re-pointed to that line at the same identity:
 *   · ranked → the new caption, no bare "%", the % in the accessible name;
 *   · both call sites (face + Detailed) — the two views cannot disagree;
 *   · the bar still carries the FRACTION (its fill width), so it discriminates;
 *   · no denominator / no rank / a set of one → the quantity noun, never a rank;
 *   · ⛔ NOT CURRENT → the line is HIDDEN (spec §8: "stale analysis hides …
 *     driver … cues"), a deliberate change from the old fall-back-to-percentage
 *     arm. The withheld rank is still asserted absent, now with the whole line.
 *
 * ## ⛔ CONTRACT v3.1 pt 5 SUPERSEDED ONE OF THOSE CLAIMS (24 Sep 2026), AND
 * ## ED #63 5806207128 RESTORED ITS CAPTION THE SAME DAY
 *
 *   · the caption is "Driver N of M analysed" and `M` is the ELIGIBLE ANALYSED
 *     set (`influenceSetSize`), not the ranked count (`influenceRankedCount`,
 *     now the publication guard only) — ED: "Denominator = eligible analysed
 *     factors, not 'number of ranks we happen to render'". Every fixture below
 *     supplies both, and they differ (5 vs 3), so a caption that printed the
 *     ranked count goes red;
 *   · no denominator / no rank / a set of one → NO line and NO bar on either
 *     view ("A factor the run did not rank shows no rank"); the card says
 *     "Not ranked in this run" to AT only. The quantity-noun arm is retired.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))
// Spread the real flags module so a newly-added flag never goes silently
// absent and throws at render (CLAUDE.md trap 12 — a `vi.mock` factory
// REPLACES the module). Only the flags this suite pins are overridden.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const baseProps = {
  id: 'factor-1',
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: false,
  selectable: true,
  draggable: true,
}

/**
 * ⭐⭐ THE CURRENCY SLICE IS SEEDED EXPLICITLY, AND AN AFFIRMATIVE VERDICT IS A
 * PRECONDITION OF EVERY RANKED ASSERTION IN THIS FILE.
 *
 * `FactorNode` withholds the whole ranked readout unless
 * `useAnalysisResultsAreCurrent()` is true, and that hook is NOT mocked here —
 * it is imported for real, reads these three fields, and calls the real
 * `classifyFreshnessForDisplay`. Mocking it would leave this file asserting its
 * own idea of freshness (CLAUDE.md trap 13c: a perfect score against a wrong
 * oracle).
 *
 * ⚠ AND IT FAILS CLOSED ON OMISSION, which is exactly why it is stated. An
 * absent slice classifies as `'none'`, the readout withholds, and every ranked
 * expectation below would fail — loudly, rather than by quietly sitting on the
 * fallback branch, which is the defect this whole file exists to close one level
 * up. Stating it keeps the failure loud AND makes the precondition visible.
 */
const FRESH = { analysisFreshness: { freshness: 'fresh' }, analysisFreshnessDirty: false }

const setStore = (
  viewMode: 'standard' | 'expert',
  currency: Record<string, unknown> = FRESH,
) => {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'complete', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      goalThreshold: null,
      goalConstraints: [],
      importPendingServerRegistration: false,
      viewMode,
      ...currency,
    })
  )
}

/**
 * ⚠ THE DENOMINATOR IS A REQUIRED ARGUMENT OF THIS HELPER, not an optional
 * override with a default. A helper that defaulted it would rebuild the exact
 * silent-fallback defect this file exists to close, one level down in the test
 * kit — every future case would sit on whichever branch the default chose and
 * nobody would have to notice.
 */
const setMetadata = (
  rank: number | null,
  setSize: number | null,
  influence: number,
  // The ranked count — the publication guard (ED 5806207128), distinct from the
  // analysed set so a caption that printed it would go red.
  rankedCount: number | null = 3,
) => {
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({
    sensitivityRank: rank,
    influence,
    influenceProvenance: 'normalised_elasticity',
    influenceImportanceBasis: null,
    influenceSetSize: setSize,
    influenceRankedCount: rankedCount,
    confidence: null,
    confidenceIsDefaulted: false,
    confidenceIsProvisional: false,
    inSensitivityAnalysis: true,
    achievementProbability: null,
    achievementProbabilityIsModelledBasis: false,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: true,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })
}

const renderFactor = () =>
  render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} data={{ label: 'Tech lead presence', type: 'factor', observedState: { value: 0.5 } }} />
    </ReactFlowProvider>
  )

/**
 * The exact announced sentence the ranked leader publishes, at 100% — the
 * driver line's whole accessible name (and tooltip). Literal on purpose: it is
 * the corpus that notices a wrong sentence (CLAUDE.md trap 12d).
 */
const RANKED_NAME_LEADER =
  'Driver 1 of 3 ranked in this run. Ranked by how strongly the comparison responds to each factor in this model. ' +
  'Bar: outcome sensitivity, 100% of the strongest factor. ' +
  'Relative to the strongest factor in this model, not an absolute causal percentage. ' +
  'How much the outcome shifts when this factor changes. How sure are you of its value?'

/** Contract v3.1 pt 5: the unranked factor's one statement (AT only). */
const NOT_RANKED = 'Not ranked in this run'
const notRanked = () => screen.getByTestId('factor-driver-not-ranked')

/**
 * The Standard driver line — ON the card face, never repeated in the popover
 * (prototype, Paul 25 Sep 2026, superseding ED 5809278282's move to the
 * popover; the helper keeps its name) — and the Detailed one, bound by test id.
 */
const popoverLine = () => {
  const face = screen.getByTestId('node-title').closest('[role="group"]') as HTMLElement
  const pop = screen.queryByTestId('factor-node-popover')
  if (pop) expect(within(pop).queryByTestId('factor-driver-line'), 'the driver line is repeated in the popover').toBeNull()
  return within(face).getByTestId('factor-driver-line')
}
const detailLine = () => screen.getByTestId('factor-driver-line-detail')
const captionOf = (line: HTMLElement) => within(line).getByTestId(/-caption$/).textContent
/** The bar's FILL — the measurement, independent of the words. */
const fillOf = (line: HTMLElement) =>
  (within(line).getByTestId(/-bar$/).firstElementChild as HTMLElement).style.width

beforeEach(() => { vi.clearAllMocks() })

describe('Standard view — the driver line states the ranking', () => {
  it('renders the ranked caption and the set size, and NOT a bare percentage', () => {
    setStore('standard')
    setMetadata(1, 5, 1)
    renderFactor()
    /* ⚠ BOUND BY TEST ID, NOT BY TEXT. In Standard view a top-three factor
       mounts `layer2Content` a SECOND time inside the hover popover (mocked
       transparent here), so the Detailed driver line is also in the document.
       A `getByText` would be ambiguous (CLAUDE.md trap 19). */
    const line = popoverLine()
    expect(captionOf(line)).toBe('Driver 1 of 3 ranked in this run')
    /* ⛔ THE DELETE-MUTANT ASSERTION. Remove the rank from this call site and
       the line disappears (contract v3.1 pt 5), which the line above REJECTS.
       And the retired `% influence` row is gone from the face. */
    expect(line.textContent).not.toContain('%')
    expect(line.textContent).not.toContain('Relative influence')
    expect(line.textContent).not.toContain('Most influential')
    expect(screen.queryByTestId('factor-influence-row')).toBeNull()
  })

  it('the line owns its whole accessible name — the rank, its basis, the figure and its scale, in one sentence', () => {
    setStore('standard')
    setMetadata(1, 5, 1)
    renderFactor()
    const line = popoverLine()
    expect(line).toHaveAccessibleName(RANKED_NAME_LEADER)
    /* ⚠ THE NEGATIVE CONTROL for the old mangling ("Most influential: of 5.")
       — the caption and the set size are one phrase, never split by a colon. */
    expect(line.getAttribute('aria-label')).not.toContain('Driver 1: of 3')
    expect(line.getAttribute('aria-label')!.startsWith(captionOf(line)!)).toBe(true)
  })

  it('the percentage is DEMOTED, not deleted — it survives in the disclosure', () => {
    setStore('standard')
    setMetadata(1, 5, 1)
    renderFactor()
    // The NO-HIDING half of the claim. Taking the figure off the face of the
    // card is the change; taking it away from a reader who wants it would be
    // hiding a finding, which this estate forbids.
    expect(popoverLine()).toHaveAccessibleName(/100% of the strongest factor/)
  })

  it('rank 2 takes its own number — the leader is not the only case that renders', () => {
    setStore('standard')
    setMetadata(2, 5, 0.62)
    renderFactor()
    const line = popoverLine()
    expect(captionOf(line)).toBe('Driver 2 of 3 ranked in this run')
    expect(line.textContent).not.toContain('62%')
    expect(line).toHaveAccessibleName(/62% of the strongest factor/)
  })
})

/**
 * ⭐ THE SECOND CALL SITE. The Detailed view renders the SAME display-model
 * number, so it carried the same misread. Locked Canvas design (23 Sep 2026):
 * it is the SAME `FactorDriverLine` now, under its own test id — pinned here so
 * `Relative influence … 100%` cannot survive one view switch away.
 */
describe('Detailed view — the Detailed driver line states the same ranking', () => {
  it('renders the ranked caption, the set size, and the ranked accessible name', () => {
    setStore('expert')
    setMetadata(1, 5, 1)
    renderFactor()
    const line = detailLine()
    expect(captionOf(line)).toBe('Driver 1 of 3 ranked in this run')
    expect(line.textContent).not.toContain('100%')
    expect(line.textContent).not.toContain('Relative influence')
    expect(line).toHaveAccessibleName(RANKED_NAME_LEADER)
  })

  it('the bar geometry is UNCHANGED — the words replace the printed figure, not the measurement', () => {
    setStore('expert')
    setMetadata(1, 5, 1)
    renderFactor()
    /* ⭐ THIS IS THE ASSERTION THAT STOPS THE FIX BECOMING A LOSS. Removing the
       fraction along with the printed percentage would flatten every bar to the
       same length and throw away the one channel that still shows HOW FAR ahead
       the leader is. The fill width is the fraction the line was given. */
    expect(fillOf(detailLine())).toBe('max(4px, 100%)')
  })

  it('a mid-set rank keeps its own fraction, so the bar still discriminates', () => {
    setStore('expert')
    setMetadata(2, 5, 0.62)
    renderFactor()
    // NON-VACUITY for the test above: if the bar were flattened, every ranked
    // factor would report the same value and the pair of tests would agree for
    // the wrong reason (CLAUDE.md trap 20 — sameness across inputs that ought
    // to differ is evidence about the probe).
    expect(fillOf(detailLine())).toBe('max(4px, 62%)')
  })
})

/**
 * ⭐⭐ THE FAIL-CLOSED ARM, ON BOTH VIEWS. What the deployed card renders for
 * every factor ranked below the determined depth, every factor on a tied set,
 * and every single-factor model: the driver line with the QUANTITY'S OWN NOUN
 * ("Outcome sensitivity" on this basis) and never a rank. Locked Canvas design
 * (23 Sep 2026): the old fallback printed "Relative influence 100%"; the % now
 * stays in the disclosure on this arm too.
 */
describe('no denominator — contract v3.1 pt 5: no rank, no line, no bar, on either view', () => {
  // ⛔ SUPERSEDED (contract v3.1 pt 5): these used to pin the quantity-noun
  // fallback ("Outcome sensitivity" + bar). An unranked factor now shows no
  // rank and no line; its figure stays in the inspector's ImportanceBar.
  it('Standard view: no line and no bar; the card says "Not ranked in this run" to AT', () => {
    setStore('standard')
    setMetadata(1, null, 1)
    renderFactor()
    expect(screen.getByTestId('node-title')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line-bar')).toBeNull()
    expect(notRanked().textContent).toBe(NOT_RANKED)
    expect(document.body.textContent).not.toContain('Outcome sensitivity')
  })

  it('Detailed view: no Detailed line either — the two views cannot disagree', () => {
    setStore('expert')
    setMetadata(1, null, 1)
    renderFactor()
    expect(screen.getByTestId('node-title')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-line-detail')).toBeNull()
    expect(screen.getAllByTestId('factor-driver-not-ranked')).toHaveLength(1)
  })

  it('no rank withholds the claim even when a denominator is present', () => {
    // The tie gate withholding a rank is the commonest live cause.
    setStore('standard')
    setMetadata(null, 5, 1)
    renderFactor()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(document.body.textContent).not.toContain('of 5')
    expect(notRanked().textContent).toBe(NOT_RANKED)
  })

  it('a set of one is a maximum, not a ranking', () => {
    setStore('standard')
    setMetadata(1, 1, 1, 1)
    renderFactor()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(document.body.textContent).not.toContain('Driver')
    expect(notRanked().textContent).toBe(NOT_RANKED)
  })

  it('CONTRAST — a ranked factor carries no "Not ranked" statement', () => {
    setStore('standard')
    setMetadata(1, 5, 1)
    renderFactor()
    expect(popoverLine()).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-not-ranked')).toBeNull()
  })
})

/**
 * ⭐⭐ A RESULT THE PRODUCT CANNOT VOUCH FOR PUBLISHES NO DENOMINATOR.
 *
 * ⛔ THIS DESCRIBE REPLACES A GATE ON `graphEditedSinceLastRun`, AND THE
 * REPLACEMENT IS THE FINDING OF THIS ROUND.
 *
 * `of 5` is a COUNTABLE claim: run over five factors, add three, and the canvas
 * shows eight cards beside a row still claiming `of 5` — the reader refutes the
 * product by counting. The previous gate was the legacy store flag, and it
 * cannot answer the question: `resultsLoadHistorical` (`canvas/store.ts:6026`)
 * and `resultsHydrateFromSupabase` (`:6097`) reset it to `false` in the same
 * `set()` that writes `results.status: 'complete'`, so restoring a historical
 * run re-published the denominator against a graph it was never computed on.
 * It also over-fired the other way — `historyHash` (`:2025`) includes
 * `position`, so a node DRAG dropped the caption.
 *
 * ⚠ AND THE GATE MOVED FROM THE PRODUCER TO HERE, which is the other half. In
 * `useNodeDisplayMetadata` it made the `influenceSetSize` assignment
 * CONDITIONAL and so falsified the invariant that field's optionality rests on.
 * At the render site the producer's implication holds and the licence is asked
 * separately — see `useNodeDisplayMetadata.influenceSetSize.spec.ts`, which
 * pins the restored implication.
 *
 * ⭐ Locked Canvas design (23 Sep 2026), spec §8 / §3 "Hide when analysis is
 * absent or stale": a run the product cannot vouch for (restored /
 * cannot-confirm) HIDES the whole driver line on both views, rather than
 * falling back to the unranked percentage. The rank is still withheld
 * (asserted), and the CONTROL still proves the gate discriminates.
 *
 * ⭐ DESIGN INTEGRATION (23 Sep 2026): a model KNOWN to have changed since the
 * run is a different state — its line is shown LABELLED `Last run · ` (#1891's
 * rule, Paul's Ruling 3; ED 02:31Z Q2 keys the label on `changed` only).
 */
describe('the ranked claim is withheld when the result is not confirmably current', () => {
  it('THE DEFECT THIS ROUND CLOSES: a RESTORED run publishes no denominator', () => {
    // The exact slice both restore actions write: an 'unknown' verdict whose
    // reason is `hydrated_without_capture`, with the dirty overlay CLEARED.
    // Under the old gate this state read "the graph has not moved" and the
    // countable claim went out against a graph never seen.
    setStore('standard', {
      analysisFreshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' },
      analysisFreshnessDirty: false,
    })
    setMetadata(1, 5, 1)
    renderFactor()

    // Positive control: the card itself mounted (trap 13).
    expect(screen.getByTestId('node-title')).toBeTruthy()
    // ⚠ Locked Canvas design (23 Sep 2026): the driver line is HIDDEN, on the
    // face AND in the popover's layer 2 — not re-labelled, not a third
    // ranked-but-uncountable variant.
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line-detail')).toBeNull()
    expect(document.body.textContent).not.toContain('of 5')
    expect(document.body.textContent).not.toContain('Driver 1')
  })

  it('a local analysis-affecting edit LABELS it as the last run’s — it does not publish it as current', () => {
    // The dirty overlay over a retained CEE 'fresh' — what an ordinary
    // in-canvas add produces via `invalidateAnalysisReady` (`store.ts:2890`).
    // ⭐ Design integration (23 Sep 2026): the model is KNOWN to have changed,
    // so the rank is kept and labelled (#1891's rule, Paul's Ruling 3) — the
    // countable `of 5` is now a claim about the LAST run, which is true.
    setStore('standard', {
      analysisFreshness: { freshness: 'fresh' },
      analysisFreshnessDirty: true,
    })
    setMetadata(1, 5, 1)
    renderFactor()

    expect(screen.getByTestId('node-title')).toBeTruthy()
    // ED 5806207128 stale form: "Last run · Driver N of M analysed".
    expect(captionOf(popoverLine())).toBe('Last run · Driver 1 of 3 ranked')
    // Never the unlabelled current-run caption.
    expect(captionOf(popoverLine())!.startsWith('Driver')).toBe(false)
  })

  it('CONTROL: the same rank and the same set size on a current result DO publish', () => {
    // Both arms asserted explicitly, so the gate is shown to DISCRIMINATE
    // rather than merely to return null on everything (CLAUDE.md trap 13b — a
    // guard agreeing with itself). Same metadata, one store field different.
    setStore('standard', FRESH)
    setMetadata(1, 5, 1)
    renderFactor()

    expect(captionOf(popoverLine())).toBe('Driver 1 of 3 ranked in this run')
  })

  it('the Detailed view withholds on the same signal — the two views cannot disagree', () => {
    // One gate, one local, both renders. Without this the fix could be a
    // per-view accident, which is the defect this whole file was written for.
    setStore('expert', {
      analysisFreshness: { freshness: 'stale' },
      analysisFreshnessDirty: false,
    })
    setMetadata(1, 5, 1)
    renderFactor()

    // ⭐ Design integration (23 Sep 2026): a CEE-stated 'stale' composes to
    // 'changed' — the model is KNOWN to have moved — so the Detailed line is
    // SHOWN and LABELLED as the last run's, rank included (#1891's rule, Paul's
    // Ruling 3, ROADMAP 2.651: "labelled, not withheld"; visual contract v3).
    // The two views still cannot disagree: both carry the same label.
    const line = detailLine()
    expect(captionOf(line)).toBe('Last run · Driver 1 of 3 ranked')
    expect(line.getAttribute('aria-label')!.startsWith(captionOf(line)!)).toBe(true)
    expect(line.textContent).not.toContain('100%')
  })
})

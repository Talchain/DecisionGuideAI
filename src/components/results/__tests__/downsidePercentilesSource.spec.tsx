/**
 * ROADMAP 2.646 — THE ENGINE'S REASON, CARRIED ALL THE WAY TO THE SENTENCE.
 *
 * ## What this row actually closes
 *
 * 2.581 gave a reader whose tail is missing a STATED absence instead of
 * silence, and 2.605 then had to make that sentence blame nobody: at the render
 * site, `option.downside === undefined` had three causes the UI could not tell
 * apart (a producer omitted it silently, our own mapper dropped a partial
 * block, or schema-pin skew ate it). Attributing the gap to "the engine" would
 * have been our own unearned claim, on the very surface built to stop unearned
 * claims.
 *
 * That was a TRANSIT gap, not a knowledge gap. ISL has always known which of
 * its gates fired and has always said so in `outcome.percentiles_source`; the
 * field simply died on the way. 0.38.0 declares it, PLoT's 7-Aug egress carries
 * it, CEE transports it untouched — and this repo dropped it TWICE, at two
 * hops that each rebuild the option object field-by-field
 * (`mapV5AnalysisToReport`, then `useResultsSectionData`). This suite is about
 * the whole chain, because a field that survives one rebuild and not the other
 * reaches nobody, and each hop passing its own unit test would have proved
 * nothing about that.
 *
 * ## Why `'unavailable'` earns a sentence that `undefined` does not
 *
 * Read at the PRODUCER's bytes rather than from this repo's commentary —
 * ISL `src/models/response_v2.py` @ `c25836f7`:
 *
 *   * `:234-238` declares the field: "'unavailable' when no valid samples
 *     exist (p10/p50/p90 will be null)".
 *   * `:412-432` `OptionResultV2._downside_requires_samples` ENFORCES
 *     `downside present ⟹ percentiles_source == 'samples'`.
 *
 * The contrapositive is the whole prize: on `'unavailable'`, ISL never emitted
 * a downside AT ALL. So our mapper cannot have dropped one, and pin skew cannot
 * have eaten one — and skew cannot have eaten the discriminator either, since
 * we are holding it. Causes 2 and 3 are RETIRED for this case, which is why the
 * copy may name the engine here and may not anywhere else.
 *
 * ⚠ And the same read bounds what the sentence must NOT say. ISL's
 * `_summary_stats_absent_only_without_samples` (`:245-281`) states in terms
 * that an option "can legitimately have no raw `samples` array (percentiles
 * 'unavailable') while the analyzer still computed an honest mean and std for
 * it" — the biconditional is deliberately NOT enforced. So `'unavailable'`
 * licenses a claim about the PERCENTILE POPULATION and the tail drawn from it,
 * and nothing wider. `noNumeralAndNoWiderClaim` below pins that boundary.
 *
 * ## The three payload states, and why all three are here
 *
 * A guard that only ever drove `'unavailable'` would agree with a render site
 * that had simply hard-swapped the copy (trap 13b — a guard agreeing with
 * itself). The discrimination is the behaviour, so all three states the wire
 * can present are driven through the SAME chain:
 *
 *   | `percentiles_source` | downside | sentence          | why                                     |
 *   |----------------------|----------|-------------------|-----------------------------------------|
 *   | `'unavailable'`      | absent   | ENGINE            | producer invariant retires causes 2 + 3 |
 *   | absent               | absent   | VAGUE             | pre-0.38.0 hop — we still cannot tell   |
 *   | `'samples'`          | absent   | VAGUE             | engine HAD a population; cause unknown  |
 *
 * The third row is the one worth defending in review: it is deliberately NOT
 * an improvement. The engine had samples and the tail is still missing, so the
 * cause really is undiscriminated and naming the engine would be false. A
 * change that "improved" that row would be this row's defect wearing this
 * row's fix.
 *
 * ## Provenance of the fixtures — what is captured and what is derived
 *
 * The BASE payload is the real 5 Aug capture
 * (`live-analysis-turn-downside-2026-08-05.json`, the session 2.581 was
 * reported from). It carries no `percentiles_source` on any of its five
 * options, because it PREDATES the 7-Aug PLoT carry — which makes it a real-
 * wire witness for the absent-discriminator row above, not a stand-in for one.
 *
 * ⚠ The DEGENERATE option is DERIVED, not captured, and the distinction is
 * stated because it matters: no capture of an `'unavailable'` option exists
 * anywhere in this repo (the carry landed after the last capture). A fixture
 * you write yourself encodes your model of the producer rather than the
 * producer (CLAUDE.md trap 16's inverse form), so `degenerateOutcome()` is not
 * invented — every member is derived from the emitting code read at its bytes,
 * cited inline, and `producerShapeIsWhatTheProducerEmits` asserts the derived
 * shape against those rules rather than letting it drift into whatever the
 * tests below happen to need.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { useResultsSectionData } from '../useResultsSectionData'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'
import {
  DOWNSIDE_UNAVAILABLE_COPY,
  DOWNSIDE_UNAVAILABLE_ENGINE_COPY,
} from '../utils/downsideCopy'
import { useCanvasStore } from '../../../canvas/store'
import liveDownsideTurn from '../../../v5/__tests__/fixtures/live-analysis-turn-downside-2026-08-05.json'

/** The five option ids the capture carries, in its own order. */
const FIXTURE_OPTION_IDS = [
  'opt_oven',
  'opt_packing',
  'opt_retrofit',
  'opt_status_quo',
  'opt_vans',
] as const

/** The option every "degenerate" arm below degrades. Named once. */
const DEGENERATE_ID = 'opt_retrofit'

/** The capture's `analysis_result` block, deep-copied per call. */
function liveAnalysisBlock(): AnalysisResultBlock {
  const blocks = (liveDownsideTurn as { blocks: Array<Record<string, unknown>> }).blocks
  const analysis = blocks.find((b) => b.type === 'analysis_result')
  if (!analysis) throw new Error('fixture no longer carries an analysis_result block')
  return JSON.parse(JSON.stringify(analysis)) as unknown as AnalysisResultBlock
}

type WireEntry = {
  option_id: string
  option_label: string
  outcome?: Record<string, unknown>
  downside?: Record<string, unknown>
}

function wireEntries(block: AnalysisResultBlock): WireEntry[] {
  return (block as unknown as { enrichment: { option_comparison: WireEntry[] } })
    .enrichment.option_comparison
}

/** `option_id → option_label`, read from the capture. */
function fixtureLabels(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of wireEntries(liveAnalysisBlock())) out[row.option_id] = row.option_label
  return out
}

/**
 * ISL's degenerate `OutcomeDistributionV2`, as PLoT's egress emits it.
 *
 * EVERY MEMBER IS DERIVED FROM CODE READ AT ITS BYTES — nothing here is chosen
 * to make a test below pass:
 *
 *   * `mean` / `std` ABSENT — ISL `response_v2.py:245-281`
 *     (`_summary_stats_absent_only_without_samples`: they travel together, and
 *     may be absent only when `percentiles_source == 'unavailable'`).
 *   * `p10` / `p50` / `p90` ABSENT — ISL sends them as `null` on this shape
 *     (`:229`, "null when unavailable"); PLoT's `finiteNum` guard drops a
 *     non-finite stat rather than forwarding a fabricated `null`
 *     (`routes/v2/run.ts`, the `built.p10 = …` chain).
 *   * `n_samples` / `n_valid_samples` / `validity_ratio` PRESENT — REQUIRED at
 *     ISL (`:230-232`) and carried by PLoT. `n_valid_samples: 0` with
 *     `validity_ratio: 0` is a MEASUREMENT ("we sampled and got nothing
 *     usable"), which is exactly why PLoT stopped deleting the whole block.
 *   * `percentiles_source: 'unavailable'` — the discriminator.
 *
 * `n_samples` is taken from the capture's own runs (10000) so the degenerate
 * option is the SAME size of run as its siblings, and the only thing that
 * differs between it and them is the thing under test.
 */
function degenerateOutcome(): Record<string, unknown> {
  return {
    n_samples: 10000,
    n_valid_samples: 0,
    validity_ratio: 0,
    percentiles_source: 'unavailable',
  }
}

/**
 * Return the capture with ONE option degraded to the producer's degenerate
 * shape: the outcome block replaced, and `downside` DELETED.
 *
 * Deleting `downside` is not tidying — it is the producer's enforced invariant
 * (`_downside_requires_samples`). A fixture carrying both would be a payload
 * ISL raises a `ValueError` on, i.e. a state the wire cannot present, and a
 * branch tested against an impossible input is worth nothing (trap 16's inverse
 * form: the code path is live, the DATA cannot reach it).
 */
function blockWithDegenerateOption(
  optionId: string = DEGENERATE_ID,
  outcome: Record<string, unknown> = degenerateOutcome(),
): AnalysisResultBlock {
  const block = liveAnalysisBlock()
  const entry = wireEntries(block).find((e) => e.option_id === optionId)
  if (!entry) throw new Error(`fixture no longer carries ${optionId}`)
  entry.outcome = outcome
  delete entry.downside
  return block
}

/** The capture with one option's tail removed but its outcome left INTACT. */
function blockWithTailOnlyRemoved(optionId: string = DEGENERATE_ID): AnalysisResultBlock {
  const block = liveAnalysisBlock()
  const entry = wireEntries(block).find((e) => e.option_id === optionId)
  if (!entry) throw new Error(`fixture no longer carries ${optionId}`)
  delete entry.downside
  return block
}

/** The second tail-less option in the two-degraded payload below. */
const UNDISCRIMINATED_ID = 'opt_vans'

/**
 * TWO tail-less options in ONE payload, differing ONLY in the discriminator:
 * `opt_retrofit` degenerate (`'unavailable'`), `opt_vans` tail removed with its
 * outcome intact and no discriminator.
 *
 * This is the payload that makes the render layer able to see a MIS-JOIN. With
 * a single degraded option, a hop that answered "does ANY option in this run
 * carry 'unavailable'?" instead of "does THIS one?" is invisible at the pixel
 * layer, because every sibling still has a tail and so never renders an absence
 * line at all — the defect hides behind the very options that prove the harness
 * works. Two tail-less cards side by side, expected to say DIFFERENT things,
 * cannot hide it (CLAUDE.md trap 19).
 */
function blockWithTwoDegraded(): AnalysisResultBlock {
  const block = blockWithDegenerateOption()
  const other = wireEntries(block).find((e) => e.option_id === UNDISCRIMINATED_ID)
  if (!other) throw new Error(`fixture no longer carries ${UNDISCRIMINATED_ID}`)
  delete other.downside
  return block
}

type MappedReport = ReturnType<typeof mapV5AnalysisToReport> & {
  option_probabilities?: Record<
    string,
    { downside?: unknown; percentiles_source?: unknown }
  >
}

function mapped(block: AnalysisResultBlock): MappedReport {
  return mapV5AnalysisToReport(block) as MappedReport
}

function mappedEntry(block: AnalysisResultBlock, optionId: string) {
  const report = mapped(block)
  const entry = report.option_probabilities?.[optionId]
  // HARNESS PRECONDITION. A mapper that produced no entry for this id would
  // make every assertion below fail for a reason unrelated to the code under
  // test — and, worse, `expect(undefined?.percentiles_source).toBeUndefined()`
  // would PASS. An absence assertion must first prove it can see a presence.
  expect(entry, `harness precondition: the mapper must emit ${optionId}`).toBeDefined()
  return entry!
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 0 — the derived fixture is what the producer actually emits
// ─────────────────────────────────────────────────────────────────────────────

describe('2.646 — the degenerate fixture is derived from the producer, not invented', () => {
  it('producerShapeIsWhatTheProducerEmits: absent summary + absent percentiles + present accounting + the discriminator', () => {
    const o = degenerateOutcome()

    // The summary pair travels together and is absent (ISL :245-281).
    expect(o.mean, 'mean must be ABSENT on a degenerate run').toBeUndefined()
    expect(o.std, 'std must be ABSENT with mean').toBeUndefined()

    // Percentiles absent — never a fabricated null (PLoT finiteNum).
    for (const k of ['p10', 'p50', 'p90'] as const) {
      expect(o[k], `${k} must be ABSENT, never null`).toBeUndefined()
      expect(Object.prototype.hasOwnProperty.call(o, k), `${k} key must not exist`).toBe(false)
    }

    // The accounting triple is REQUIRED at the producer and is a measurement.
    expect(o.n_samples, 'n_samples is required at ISL').toBe(10000)
    expect(o.n_valid_samples, 'n_valid_samples: 0 is a measurement, not an absence').toBe(0)
    expect(o.validity_ratio, 'validity_ratio: 0 is a measurement').toBe(0)

    expect(o.percentiles_source).toBe('unavailable')
  })

  it('the degenerate wire entry carries NO downside — the producer invariant, not tidying', () => {
    const entry = wireEntries(blockWithDegenerateOption()).find(
      (e) => e.option_id === DEGENERATE_ID,
    )!
    expect(
      Object.prototype.hasOwnProperty.call(entry, 'downside'),
      'downside ⟹ percentiles_source === "samples" (ISL :412-432): a payload with both is one ISL refuses to construct',
    ).toBe(false)

    // POSITIVE CONTROL: the siblings in the same payload still carry theirs, so
    // the absence above is a fact about this entry and not about the helper.
    for (const id of FIXTURE_OPTION_IDS) {
      if (id === DEGENERATE_ID) continue
      const sibling = wireEntries(blockWithDegenerateOption()).find((e) => e.option_id === id)!
      expect(sibling.downside, `sibling ${id} must keep its tail`).toBeDefined()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — WIRE → REPORT (the real mapper)
// ─────────────────────────────────────────────────────────────────────────────

describe('2.646 layer 1 — mapV5AnalysisToReport carries percentile provenance', () => {
  it("carries 'unavailable' verbatim onto the option it belongs to, and to no other", () => {
    const report = mapped(blockWithDegenerateOption())

    expect(mappedEntry(blockWithDegenerateOption(), DEGENERATE_ID).percentiles_source).toBe(
      'unavailable',
    )

    // BOUND BY IDENTITY, not by "some option carries it": every sibling is
    // named and asserted NOT to have acquired the value. A carry that stamped
    // the whole record would satisfy a single-option assertion (trap 19).
    for (const id of FIXTURE_OPTION_IDS) {
      if (id === DEGENERATE_ID) continue
      expect(
        report.option_probabilities?.[id]?.percentiles_source,
        `${id} must not inherit ${DEGENERATE_ID}'s provenance`,
      ).toBeUndefined()
    }
  })

  it("carries 'samples' verbatim — the value is passed through, not a boolean in disguise", () => {
    const block = blockWithTailOnlyRemoved()
    const entry = wireEntries(block).find((e) => e.option_id === DEGENERATE_ID)!
    entry.outcome = { ...(entry.outcome ?? {}), percentiles_source: 'samples' }

    expect(mappedEntry(block, DEGENERATE_ID).percentiles_source).toBe('samples')
  })

  it('leaves it ABSENT on the real 5 Aug capture — and specifically does NOT default to "samples"', () => {
    // The live witness for the fallback row: this payload predates the carry,
    // so every option genuinely arrives without the discriminator.
    const block = liveAnalysisBlock()
    for (const row of wireEntries(block)) {
      expect(
        row.outcome && Object.prototype.hasOwnProperty.call(row.outcome, 'percentiles_source'),
        `capture precondition: ${row.option_id} must predate the carry`,
      ).toBe(false)
    }

    const report = mapped(block)
    for (const id of FIXTURE_OPTION_IDS) {
      const entry = mappedEntry(block, id)
      expect(
        entry.percentiles_source,
        `${id}: absent in ⇒ absent out. ISL declares a Python-side default of "samples"; re-applying it here would manufacture a provenance claim`,
      ).toBeUndefined()
      expect(
        Object.prototype.hasOwnProperty.call(entry, 'percentiles_source'),
        `${id}: the KEY must not exist — an explicit undefined still serialises into snapshots`,
      ).toBe(false)
      // The tails themselves must be untouched by this row.
      expect(report.option_probabilities?.[id]?.downside, `${id} keeps its tail`).toBeDefined()
    }
  })

  it('refuses a value outside the producer vocabulary rather than passing it through', () => {
    for (const rogue of ['SAMPLES', 'estimated', '', 0, null, true, {}]) {
      const block = blockWithTailOnlyRemoved()
      const entry = wireEntries(block).find((e) => e.option_id === DEGENERATE_ID)!
      entry.outcome = { ...(entry.outcome ?? {}), percentiles_source: rogue }
      expect(
        mappedEntry(block, DEGENERATE_ID).percentiles_source,
        `${JSON.stringify(rogue)} is not in the producer's vocabulary and must not reach a reader`,
      ).toBeUndefined()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — REPORT → VIEW MODEL (the real hook, fed by the real mapper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drive the hook from a report the REAL mapper produced. This is the join that
 * a per-hop unit test cannot make: `mapV5AnalysisToReport`'s function-local
 * `ResultsOptionProbability` and `types.ts`'s exported one are same-named twins
 * that nothing but a human keeps in agreement, and the seam between them is
 * where this field died. Executing both halves is the only check that binds.
 */
function driveHook(block: AnalysisResultBlock, cap: number | null) {
  const labels = fixtureLabels()
  const optionNodes = FIXTURE_OPTION_IDS.map((id) => ({
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', label: labels[id] },
  }))
  const goal = {
    id: 'goal',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: {
      kind: 'goal',
      label: 'Raise Operating Profit',
      ...(cap !== null ? { goal_threshold_cap: cap } : {}),
    },
  }

  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report: mapped(block) },
    runMeta: {} as never,
    nodes: [...optionNodes, goal] as never,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as never)

  const hook = renderHook(() => useResultsSectionData())
  const options = hook.result.current.recommendation?.allOptions ?? []
  // HARNESS PRECONDITION — a store shape the hook cannot read would produce an
  // empty list, and every "must be undefined" below would pass vacuously.
  expect(options.length, 'harness precondition: the hook must build all five options').toBe(
    FIXTURE_OPTION_IDS.length,
  )
  return options
}

function optionByIdentity(options: OptionResult[], id: string): OptionResult {
  const found = options.find((o) => o.id === id)
  expect(found, `option ${id} must be in the view model`).toBeDefined()
  expect(found!.label, `identity: ${id} must carry the capture's own label`).toBe(
    fixtureLabels()[id],
  )
  return found!
}

describe('2.646 layer 2 — useResultsSectionData carries provenance to the view model', () => {
  beforeEach(() => {
    useCanvasStore.setState({ results: null, nodes: [], edges: [] } as never)
  })

  it("surfaces 'unavailable' as percentilesSource on the degraded option only", () => {
    const options = driveHook(blockWithDegenerateOption(), null)

    const degraded = optionByIdentity(options, DEGENERATE_ID)
    expect(degraded.percentilesSource).toBe('unavailable')
    expect(degraded.downside, 'the producer sent no tail for this option').toBeUndefined()

    for (const id of FIXTURE_OPTION_IDS) {
      if (id === DEGENERATE_ID) continue
      const sibling = optionByIdentity(options, id)
      expect(sibling.percentilesSource, `${id} must not inherit it`).toBeUndefined()
      expect(sibling.downside, `${id} keeps its tail — positive control`).toBeDefined()
    }
  })

  /**
   * DISCRIMINATING PAIR ON THE SCALE DECISION. This hook denormalises the whole
   * percentile family (and the tail with it) by a per-option scale. Provenance
   * is a CLAIM, not a magnitude: it must be byte-identical either side of that
   * decision. A carry written inside the scaling block would pass the arm above
   * and silently vanish (or worse, be coerced) on a run with a goal threshold.
   */
  it('provenance is identical with and without denormalisation — a claim is not a magnitude', () => {
    const unscaled = optionByIdentity(driveHook(blockWithDegenerateOption(), null), DEGENERATE_ID)
    const scaled = optionByIdentity(driveHook(blockWithDegenerateOption(), 1_000_000), DEGENERATE_ID)

    expect(unscaled.percentilesSource).toBe('unavailable')
    expect(scaled.percentilesSource).toBe('unavailable')
    expect(scaled.percentilesSource).toBe(unscaled.percentilesSource)

    // CONTROL that the two arms are genuinely different runs: a sibling's tail
    // MUST move with the scale. Without this the "identical" assertion above
    // would be satisfied by two copies of the same unscaled run.
    const siblingUnscaled = optionByIdentity(driveHook(blockWithDegenerateOption(), null), 'opt_oven')
    const siblingScaled = optionByIdentity(
      driveHook(blockWithDegenerateOption(), 1_000_000),
      'opt_oven',
    )
    expect(siblingUnscaled.downside!.cvar10).not.toBe(siblingScaled.downside!.cvar10)
  })

  it('leaves percentilesSource ABSENT on the real capture — no default invented at this hop either', () => {
    const options = driveHook(liveAnalysisBlock(), null)
    for (const id of FIXTURE_OPTION_IDS) {
      const option = optionByIdentity(options, id)
      expect(option.percentilesSource, `${id}: absent in ⇒ absent out`).toBeUndefined()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — VIEW MODEL → PIXELS, on the MOUNT PATH
// ─────────────────────────────────────────────────────────────────────────────

function makeData(options: OptionResult[]): ResultsSectionDataReturn {
  const recommendation = {
    recommendedOption: options[0],
    allOptions: options,
    goalLabel: 'Raise Operating Profit by 8% Within 18 Months',
    goalThreshold: null,
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.9,
    robustnessLevel: 'medium',
    isNormalised: true,
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.6, robustness: 0.6, clarity: 0.6 },
    verdict: { hasLeadingOption: true },
  } as unknown as DecisionResultData
  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }
  const confidence = {
    tier: { tier: 'fair', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 60,
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
    goalLabel: 'Raise Operating Profit by 8% Within 18 Months',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

/**
 * THE MOUNT PATH — `ResultsBody` is `OptionCards`' only production parent, and
 * the options handed to it come from the REAL hook fed by the REAL mapper.
 * Rendering `<OptionCards>` directly here would test a component the deployed
 * flags may not mount, which is how 2.466 and 2.491 both shipped dark past
 * full mutant kits (CLAUDE.md trap 3b).
 */
function renderChain(block: AnalysisResultBlock) {
  const options = driveHook(block, null)
  render(
    <ResultsBody
      resultsSectionData={makeData(options)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      expertMode
    />,
  )
  const toggle = screen.queryByTestId('option-cards-toggle')
  if (toggle && /show all/i.test(toggle.textContent ?? '')) fireEvent.click(toggle)
  return options
}

/** Address a card by IDENTITY and re-assert the capture's own label on it. */
function cardByIdentity(optionId: string): HTMLElement {
  const card = screen.getByTestId(`option-card-${optionId}`)
  const label = fixtureLabels()[optionId]
  expect(card.textContent, `identity: card ${optionId} must show "${label}"`).toContain(label)
  return card
}

function absenceLine(optionId: string): string {
  return (
    within(cardByIdentity(optionId)).getByTestId(`option-downside-unavailable-${optionId}`)
      .textContent ?? ''
  )
}

describe('2.646 layer 3 — the sentence a reader gets, on the mount path', () => {
  beforeEach(() => {
    useCanvasStore.setState({ results: null, nodes: [], edges: [] } as never)
  })
  afterEach(cleanup)

  it("'unavailable' ⇒ the copy NAMES THE ENGINE, while every sibling still shows its real tail", () => {
    renderChain(blockWithDegenerateOption())

    expect(absenceLine(DEGENERATE_ID)).toBe(DOWNSIDE_UNAVAILABLE_ENGINE_COPY)

    // POSITIVE CONTROL in the same tree, both directions: the siblings render
    // the tail surface, so the sentence above is a fact about this card rather
    // than about a harness that renders nothing.
    for (const id of FIXTURE_OPTION_IDS) {
      if (id === DEGENERATE_ID) continue
      const card = cardByIdentity(id)
      expect(
        within(card).queryByTestId(`option-downside-unavailable-${id}`),
        `${id} must show no absence line`,
      ).toBeNull()
      expect(within(card).getByTestId(`option-downside-${id}`)).toBeTruthy()
    }
  })

  it('discriminator ABSENT ⇒ the vague-honest copy survives, on the real capture', () => {
    // Same option, same missing tail, ONLY the discriminator differs from the
    // arm above. This pair IS the behaviour: without it, a render site that had
    // simply hard-swapped the sentence would pass.
    renderChain(blockWithTailOnlyRemoved())
    expect(absenceLine(DEGENERATE_ID)).toBe(DOWNSIDE_UNAVAILABLE_COPY)
  })

  it("'samples' ⇒ the vague-honest copy, deliberately: the engine had a population and the cause is still unknown", () => {
    const block = blockWithTailOnlyRemoved()
    const entry = wireEntries(block).find((e) => e.option_id === DEGENERATE_ID)!
    entry.outcome = { ...(entry.outcome ?? {}), percentiles_source: 'samples' }

    renderChain(block)
    expect(
      absenceLine(DEGENERATE_ID),
      "naming the engine here would be false — ISL had samples, so the omission is a non-finite component or our own mapper",
    ).toBe(DOWNSIDE_UNAVAILABLE_COPY)
  })

  it('TWO tail-less cards in ONE tree say DIFFERENT things — the mis-join test', () => {
    renderChain(blockWithTwoDegraded())

    // Same run, same missing tail, same card component, adjacent on screen.
    // The ONLY difference is which discriminator the producer sent.
    expect(absenceLine(DEGENERATE_ID)).toBe(DOWNSIDE_UNAVAILABLE_ENGINE_COPY)
    expect(
      absenceLine(UNDISCRIMINATED_ID),
      'a hop that asked "does ANY option carry unavailable?" would give this card the engine sentence too',
    ).toBe(DOWNSIDE_UNAVAILABLE_COPY)

    // And the remaining three still carry real tails, so the pair above is a
    // fact about two cards rather than about a tree that renders nothing.
    for (const id of FIXTURE_OPTION_IDS) {
      if (id === DEGENERATE_ID || id === UNDISCRIMINATED_ID) continue
      expect(within(cardByIdentity(id)).getByTestId(`option-downside-${id}`)).toBeTruthy()
    }
  })

  it('noNumeralAndNoWiderClaim: the engine sentence carries no digit and claims nothing about the mean', () => {
    renderChain(blockWithDegenerateOption())
    const line = absenceLine(DEGENERATE_ID)

    // Rule 3: a numeral in a tail statistic reads as "there is no downside".
    expect(line, 'no digit may appear in a stated absence').not.toMatch(/[0-9]/)

    // ISL does NOT enforce the biconditional: an option can be percentiles-
    // 'unavailable' and still have an honest mean/std. A sentence claiming the
    // engine computed nothing at all would therefore be false on a payload the
    // producer permits.
    expect(line, 'must not claim the engine produced no average').not.toMatch(
      /\b(mean|average|expected value)\b/i,
    )
    expect(line, 'must not claim nothing was simulated at all').not.toMatch(
      /\bnothing (was|were) (simulated|computed|run)\b/i,
    )

    // And it must not promise anything about a rerun, in either direction —
    // whether re-running helps is not on the wire.
    expect(line, 'no rerun promise').not.toMatch(/\b(try again|run(ning)? it again|rerun|retry)\b/i)
  })

  it('the two sentences are genuinely different strings — the discrimination cannot be vacuous', () => {
    // If these ever collapse to the same text, every arm above passes while the
    // product discriminates nothing. A guard whose subject can become identical
    // to its control is a guard agreeing with itself (trap 13b).
    expect(DOWNSIDE_UNAVAILABLE_ENGINE_COPY).not.toBe(DOWNSIDE_UNAVAILABLE_COPY)
    expect(DOWNSIDE_UNAVAILABLE_ENGINE_COPY.length).toBeGreaterThan(0)
  })
})

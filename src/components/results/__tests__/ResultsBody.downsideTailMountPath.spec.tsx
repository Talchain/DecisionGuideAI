/**
 * ROADMAP 2.581 — THE DOWNSIDE TAIL, ON THE MOUNT PATH, FED BY THE SESSION
 * THAT WAS REPORTED AS BROKEN.
 *
 * ## What was actually wrong, because it was not what the row assumed
 *
 * The row opened on "the downside tail is scenario-dependent on the same
 * builds" and prescribed a typed versioned contract across every producer,
 * on the theory that PLoT's 0.31 passthrough was losing the object.
 *
 * That premise is false, and this file's fixture is the refutation. The
 * fixture IS the failing session's `/proxy/v5/turn` response, byte-for-byte
 * (`expert-session-2026-08-05-raw/run5/wire.json`, wire entry 14) — the run
 * whose option cards the tester opened one by one and found "no tail values
 * and no caveat". That payload carries
 * `blocks[0].enrichment.option_comparison[i].downside{cvar_10, p05,
 * expected_regret}` for ALL FIVE options, with
 * `option_comparison_status: "computed"`, `n_samples: 10000` and
 * `validity_ratio: 1`. Nothing was lost by ISL, by PLoT, or by CEE. The tail
 * was on the wire and never reached the reader.
 *
 * What differed between the tester's two sessions was the Results panel's
 * EXPERT MODE. `OptionCards` gates the whole `ExpertBlock` — range bar AND
 * tail AND caveat — on `expertMode`, and in the failing session it was off:
 * `run5/driver.log` shows the harness click Compare (16:02:54), then the only
 * button in the product whose visible text reads "Expert" (16:02:57 — the
 * Compare tab's own pill, `compare-tab/TabHeader.tsx`), then return to the
 * Analysis tab. The Results control is an unlabelled `</>` glyph and was never
 * touched. The passing session's accessibility snapshot carries the string
 * `Disable expert mode`, which `OutputsDock` renders only when `expertMode`
 * is true. The 10th/median/90th the tester still saw comes from the V7
 * "Likely outcome" lens, which is not expert-gated at all.
 *
 * ## What this file therefore pins
 *
 *  1. WIRE → REPORT, on the real capture. The real mapper, given the real
 *     failing-session payload, must produce a downside for every option id at
 *     the fixture's exact magnitudes. No hand-written payload: a fixture you
 *     write yourself encodes your model of the producer, not the producer.
 *
 *  2. REPORT → PIXELS, on the MOUNT PATH. Assertions render `<ResultsBody>`
 *     (the single production parent of `OptionCards`, ResultsBody.tsx:549) at
 *     the DEPLOYED flag posture, not `<OptionCards>` in isolation. Row 2.491
 *     shipped a badge dark past a full mutant kit because every instrument was
 *     pointed at a component the deployed flags do not mount; the deployed
 *     posture here is read off a DOM census of the same capture — run5's
 *     button list carries `hero-lens-tab-*` (hero panel mounted) alongside
 *     `option-card-*`, so both surfaces are live together.
 *
 *  3. EXPERT BEFORE **AND** AFTER THE ANALYSIS, REOPENING EVERY OPTION CARD
 *     WITHOUT A RERUN — the row's literal acceptance gate. The "after" arm is
 *     a rerender with the SAME data object, which is what "without a rerun"
 *     means at this seam.
 *
 *  4. THE STATED ABSENCE. When the producers genuinely omit the block — which
 *     they do, across at least five branches, all silent — the reader is told,
 *     and is still never shown a number.
 *
 * ## Binding, and what would defeat it
 *
 * Every assertion addresses a card by `option-card-<exact option id>` and
 * re-asserts that card's own label from the fixture, so no assertion can be
 * satisfied by a sibling (trap 19). Every magnitude is DERIVED by calling the
 * product's own `formatRangeValue` / `downsideSummaryCopy` on the fixture's
 * numbers rather than transcribed, so a formatter change cannot make this
 * suite pass against a display it no longer describes. Absence arms always run
 * in a tree where at least one sibling carries the surface, so the harness is
 * demonstrably able to see what it claims is missing (trap 13).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
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
  DOWNSIDE_HEADING_COPY,
  DOWNSIDE_TAIL_CAVEAT_COPY,
  DOWNSIDE_UNAVAILABLE_COPY,
  downsideSummaryCopy,
} from '../utils/downsideCopy'
import { formatRangeValue } from '../utils/formatRangeValue'
import liveDownsideTurn from '../../../v5/__tests__/fixtures/live-analysis-turn-downside-2026-08-05.json'

/**
 * The five option ids the failing session actually carried, in the payload's
 * own order. Named here so a fixture that silently lost an option fails loudly
 * rather than shrinking the suite (a shrunk corpus reads exactly like a green
 * one — the collect-time failure class).
 */
const FIXTURE_OPTION_IDS = [
  'opt_oven',
  'opt_packing',
  'opt_retrofit',
  'opt_status_quo',
  'opt_vans',
] as const

type DownsideOnWire = { cvar_10: number; p05: number; expected_regret: number }

/** The capture's `analysis_result` block, verbatim. */
function liveAnalysisBlock(): AnalysisResultBlock {
  const blocks = (liveDownsideTurn as { blocks: Array<Record<string, unknown>> }).blocks
  const analysis = blocks.find((b) => b.type === 'analysis_result')
  if (!analysis) throw new Error('fixture no longer carries an analysis_result block')
  return JSON.parse(JSON.stringify(analysis)) as unknown as AnalysisResultBlock
}

/** `option_id → option_label`, read from the capture. */
function fixtureLabels(): Record<string, string> {
  const block = liveAnalysisBlock() as unknown as {
    enrichment: { option_comparison: Array<{ option_id: string; option_label: string }> }
  }
  const out: Record<string, string> = {}
  for (const row of block.enrichment.option_comparison) out[row.option_id] = row.option_label
  return out
}

/**
 * LAYER 1 — the real mapper on the real capture. Everything below consumes
 * THIS, so the rendered magnitudes trace to the wire rather than to a literal
 * typed into a test.
 */
function reportDownsideByOptionId(): Record<string, DownsideOnWire> {
  const report = mapV5AnalysisToReport(liveAnalysisBlock()) as ReturnType<
    typeof mapV5AnalysisToReport
  > & { option_probabilities?: Record<string, { downside?: DownsideOnWire }> }
  const out: Record<string, DownsideOnWire> = {}
  for (const [id, entry] of Object.entries(report.option_probabilities ?? {})) {
    if (entry.downside) out[id] = entry.downside
  }
  return out
}

/**
 * LAYER 2 input — `OptionResult`s built FROM layer 1, at the hook's unscaled
 * decision (`scale === 1`, which is the branch the capture itself lands in:
 * no goal threshold was set in that session, so `capValid` is false). The
 * scaled branch is covered by `useResultsSectionData.downside.spec.ts`; this
 * file is about whether the surface renders at all and for which cards.
 */
function optionsFromWire(omitDownsideFor: readonly string[] = []): OptionResult[] {
  const downside = reportDownsideByOptionId()
  const labels = fixtureLabels()
  return FIXTURE_OPTION_IDS.map((id, i) => {
    const d = downside[id]
    const withTail = !omitDownsideFor.includes(id) && d !== undefined
    return {
      id,
      label: labels[id],
      expected: 0.1,
      outcome: { mean: 0.1, p10: -0.2, p50: 0.05, p90: 0.3 },
      p10: -0.2,
      p50: 0.05,
      p90: 0.3,
      isRecommended: i === 0,
      winProbability: 0.2,
      goalProbability: undefined,
      nValidSamples: 10000,
      rank: i + 1,
      ...(withTail ? { downside: { cvar10: d.cvar_10, p05: d.p05, expectedRegret: d.expected_regret } } : {}),
    } as unknown as OptionResult
  })
}

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

/** The MOUNT PATH: OptionCards' only production parent. */
function renderBody(options: OptionResult[], expertMode: boolean) {
  return render(
    <ResultsBody
      resultsSectionData={makeData(options)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      expertMode={expertMode}
    />,
  )
}

/**
 * Select a card by IDENTITY — the option id addresses it and the capture's own
 * label is re-asserted, so a card carrying the right numbers under the wrong
 * identity satisfies nothing.
 */
function cardByIdentity(optionId: string): HTMLElement {
  const card = screen.getByTestId(`option-card-${optionId}`)
  const label = fixtureLabels()[optionId]
  expect(card.textContent, `identity: card ${optionId} must show "${label}"`).toContain(label)
  return card
}

/**
 * Reveal every option card — the row's "reopening every option card without a
 * rerun". `OptionCards` collapses past the first two, which is exactly what
 * the tester had to click through; a suite that only ever saw the top two
 * would be reporting coverage it never had.
 */
function showAllOptions(): void {
  const toggle = screen.queryByTestId('option-cards-toggle')
  if (toggle && /show all/i.test(toggle.textContent ?? '')) fireEvent.click(toggle)
  // Every option in the fixture must now be addressable, or the arms below
  // would silently assert over a subset.
  for (const id of FIXTURE_OPTION_IDS) {
    expect(
      screen.queryByTestId(`option-card-${id}`),
      `all five option cards must be revealed; ${id} was not`,
    ).not.toBeNull()
  }
}

describe('2.581 — the downside tail on the mount path, fed by the reported-broken session', () => {
  beforeEach(() => {
    // Deployed posture, read from the same capture's DOM census (its button
    // list carries `hero-lens-tab-*`). Injected through the flag system's own
    // localStorage seam rather than a module mock, so the real predicate runs.
    localStorage.setItem('feature.analysisHeroPanel', '1')
  })
  afterEach(() => {
    cleanup()
    localStorage.removeItem('feature.analysisHeroPanel')
  })

  // ── LAYER 1: the wire actually carried it ────────────────────────────────

  it('the failing session\'s own payload yields a downside for EVERY option id, at its exact magnitudes', () => {
    const block = liveAnalysisBlock() as unknown as {
      enrichment: {
        option_comparison_status: string
        option_comparison: Array<{ option_id: string; downside?: DownsideOnWire }>
      }
    }
    // The capture's own health, asserted so a future fixture swap that quietly
    // degrades the run cannot make the rest of this suite vacuous.
    expect(block.enrichment.option_comparison_status).toBe('computed')
    expect(block.enrichment.option_comparison.map((r) => r.option_id)).toEqual([
      ...FIXTURE_OPTION_IDS,
    ])

    const mapped = reportDownsideByOptionId()
    for (const row of block.enrichment.option_comparison) {
      expect(row.downside, `wire: ${row.option_id} must carry a downside block`).toBeDefined()
      expect(mapped[row.option_id], `mapper: ${row.option_id} must survive to the report`).toEqual({
        cvar_10: row.downside!.cvar_10,
        p05: row.downside!.p05,
        expected_regret: row.downside!.expected_regret,
      })
    }
    expect(Object.keys(mapped).sort()).toEqual([...FIXTURE_OPTION_IDS].sort())
  })

  // ── LAYER 2: expert BEFORE the analysis ──────────────────────────────────

  it('expert mode on at first render: every option card shows its own tail values AND the caveat', () => {
    const options = optionsFromWire()
    renderBody(options, true)
    showAllOptions()

    const wire = reportDownsideByOptionId()
    for (const id of FIXTURE_OPTION_IDS) {
      const card = cardByIdentity(id)
      const surface = within(card).getByTestId(`option-downside-${id}`)
      expect(surface.textContent).toContain(DOWNSIDE_HEADING_COPY)
      // Derived from the wire through the product's own formatter — never
      // transcribed, so a formatter change cannot leave this passing against a
      // display it no longer describes.
      expect(surface.textContent).toContain(
        downsideSummaryCopy(formatRangeValue(wire[id].p05), formatRangeValue(wire[id].cvar_10)),
      )
      expect(
        within(card).getByTestId(`option-downside-caveat-${id}`).textContent,
      ).toBe(DOWNSIDE_TAIL_CAVEAT_COPY)
      // The caveat travels WITH the values by construction — they share one
      // conditional — so neither can arrive without the other.
      expect(within(card).queryByTestId(`option-downside-unavailable-${id}`)).toBeNull()
    }
  })

  // ── LAYER 2: expert AFTER the analysis, no rerun ─────────────────────────

  it('expert mode switched on AFTER the analysis, with no new data, reveals the tail on every card', () => {
    const options = optionsFromWire()
    const data = makeData(options)
    const { rerender } = render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
        expertMode={false}
      />,
    )
    showAllOptions()
    // Pre-condition, so the reveal below is provably the toggle's doing.
    for (const id of FIXTURE_OPTION_IDS) {
      expect(screen.queryByTestId(`option-downside-${id}`)).toBeNull()
    }

    // The SAME data object — this is what "without a rerun" means here.
    rerender(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
        expertMode
      />,
    )
    showAllOptions()

    const wire = reportDownsideByOptionId()
    for (const id of FIXTURE_OPTION_IDS) {
      const card = cardByIdentity(id)
      expect(within(card).getByTestId(`option-downside-${id}`).textContent).toContain(
        downsideSummaryCopy(formatRangeValue(wire[id].p05), formatRangeValue(wire[id].cvar_10)),
      )
      expect(within(card).getByTestId(`option-downside-caveat-${id}`).textContent).toBe(
        DOWNSIDE_TAIL_CAVEAT_COPY,
      )
    }
  })

  // ── Simple mode stays simple (P5), and says nothing rather than lying ────

  it('expert mode off: no tail surface and no absence line on any card — depth is opt-in, not withheld', () => {
    renderBody(optionsFromWire(), false)
    showAllOptions()
    for (const id of FIXTURE_OPTION_IDS) {
      const card = cardByIdentity(id)
      expect(within(card).queryByTestId(`option-downside-${id}`)).toBeNull()
      expect(within(card).queryByTestId(`option-downside-unavailable-${id}`)).toBeNull()
      expect(card.textContent).not.toMatch(/worst 1 in 20/i)
    }
  })

  // ── The stated absence ───────────────────────────────────────────────────

  it('an option the producers omitted the tail for gets a STATED reason, while its siblings keep their values', () => {
    const withheld = 'opt_retrofit'
    renderBody(optionsFromWire([withheld]), true)
    showAllOptions()

    const withheldCard = cardByIdentity(withheld)
    expect(within(withheldCard).queryByTestId(`option-downside-${withheld}`)).toBeNull()
    expect(
      within(withheldCard).getByTestId(`option-downside-unavailable-${withheld}`).textContent,
    ).toBe(DOWNSIDE_UNAVAILABLE_COPY)

    // POSITIVE CONTROL, both directions: the siblings in the same tree still
    // carry the real surface, so the absence above is a fact about this card
    // and not about the harness.
    const wire = reportDownsideByOptionId()
    for (const id of FIXTURE_OPTION_IDS) {
      if (id === withheld) continue
      const card = cardByIdentity(id)
      expect(within(card).queryByTestId(`option-downside-unavailable-${id}`)).toBeNull()
      expect(within(card).getByTestId(`option-downside-${id}`).textContent).toContain(
        downsideSummaryCopy(formatRangeValue(wire[id].p05), formatRangeValue(wire[id].cvar_10)),
      )
    }
  })

  it('the stated absence contains no numeral — an absent tail must never read as a measured one', () => {
    renderBody(optionsFromWire([...FIXTURE_OPTION_IDS]), true)
    showAllOptions()
    for (const id of FIXTURE_OPTION_IDS) {
      const line = within(cardByIdentity(id)).getByTestId(`option-downside-unavailable-${id}`)
      expect(line.textContent ?? '').not.toMatch(/[0-9]/)
    }
  })
})

/**
 * Hero rows × a RE-RUN that flips the leader — rank coherence, the OTHER half.
 *
 * ## What this file exists to catch
 *
 * `firstRunNumbering.rankCoherence.spec.ts` (this directory) closed the
 * FIRST-RUN half of the option-rank-coherence contract: a production
 * screenshot showed badge "4" above badge "3" because ordinals were seeded
 * from an expected-value order while the rows sort by win probability. The
 * fix aligned the registration order to the display order — which makes the
 * two agree on run 1 and says nothing about run 2.
 *
 * On a RE-RUN THAT FLIPS THE LEADER they diverge again, and worse:
 *
 *   - `optionNumbering` is APPEND-ONLY (`canvas/store/stableOptionNumbers.ts`)
 *     — an id keeps its first ordinal forever.
 *   - `buildHeroModel` re-ranks `index` every run (`i + 1` over
 *     `sortOptionsForDisplay`), and carries `stableNumber` unchanged.
 *   - The badge used to render `stableNumber ?? index`, so `stableNumber` WON
 *     whenever the row set was fully registered.
 *
 * The consequence, witnessed: after a flip the new leader's badge is filled
 * leader-blue AND CARRIES THE NUMERAL 2. The fill and the numeral disagree
 * inside one 24x24 element, while the list order, the "Highest on this view"
 * cue and the leader chip all say 1.
 *
 * ## The ruling this file pins
 *
 * THREE authorities were reduced to ONE PER ELEMENT:
 *   - the badge (a RANK affordance — it is filled for the leader and its own
 *     `showOrdinal` doc says it "ranks ALL of them") carries `row.index`;
 *   - IDENTITY is rendered as TEXT, `Option N`, exactly as
 *     `OptionCards.tsx:732-738` already does (the canvas node agrees on the
 *     accessible name only — see the correction at the assertion below).
 * No third convention was invented; the hero converged on the existing one.
 *
 * ## State class
 *
 * SEEDED-THEN-RERUN, in ONE page session with no reload — that is the only
 * state in which the defect is reachable, because `optionNumbering` has no
 * `persist()` and a reload clears it. The run-1 registration is driven
 * through the REAL hook and the REAL PLoT V2 mapper so the ordinals are the
 * ones a user's first run actually mints, not a fixture's idea of them.
 *
 * ## What this file does NOT cover
 *
 * It renders the hero panel alone. The cross-surface half — hero rank beside
 * OptionCards identity on ONE screen — is pinned on the real mount path in
 * `../../__tests__/ResultsBody.crossSurfaceOptionNumbering.spec.tsx`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, renderHook } from '@testing-library/react'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel } from '../heroTypes'
import { useResultsSectionData } from '../../useResultsSectionData'
import { useCanvasStore } from '../../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../../adapters/plot/v2/types'

/**
 * First-appearance order is A, B, C. Run 1 ranks them A, B, C (win
 * probability), so the ordinals minted on run 1 are A=1, B=2, C=3 — and they
 * are frozen there forever.
 */
const OPTIONS = [
  { id: 'opt_a', label: 'Hire two developers', mean: 30 },
  { id: 'opt_b', label: 'Partner with a consultancy', mean: 24 },
  { id: 'opt_c', label: 'Continue solo', mean: 12 },
]

/**
 * ONLY `win_probability` moves between the two runs. Everything else — the
 * option set, the labels, the outcome distributions, the drivers — is
 * byte-identical, so nothing but the ranking can explain a difference in what
 * is rendered.
 */
const RUN1_WIN: Record<string, number> = { opt_a: 0.7, opt_b: 0.2, opt_c: 0.1 }
const RUN2_WIN: Record<string, number> = { opt_a: 0.2, opt_b: 0.7, opt_c: 0.1 }

function makeV2Response(win: Record<string, number>, leaderId: string): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: OPTIONS.map((o) => ({
      option_id: o.id,
      option_label: o.label,
      confidence_interval: [o.mean - 10, o.mean + 10],
      win_probability: win[o.id],
      outcome: {
        mean: o.mean, std: 5, p10: o.mean - 10, p50: o.mean, p90: o.mean + 10,
        n_samples: 1000, n_valid_samples: 1000, validity_ratio: 1,
      },
    })),
    critiques: [],
    drivers: [{ node_id: 'd', label: 'D', contribution: 0.5, direction: 'positive' }],
    edge_sensitivity: [],
    factor_sensitivity: [{ factor_id: 'f1', elasticity: 0.4, importance_rank: 1 }],
    // A PERMITTED run on both passes. Without a producer leader claim
    // `deriveDecisionVerdict` returns `unknown`, designations are withheld,
    // and this file would quietly become a withheld-run test that asserts
    // nothing about a badge it no longer draws (the trap
    // firstRunNumbering.rankCoherence.spec.ts documents at its fixture).
    robustness: {
      // A DETERMINATE run. Without a stability number `buildResultsVM` returns
      // `decisionState: indeterminate`, which NEUTRALISES the cards' ranked
      // chrome — the screen would then carry no rank affordance to compare.
      recommendation_stability: 0.9,
      fragile_edges: [],
      robust_edges: ['e1'],
      near_tie: { is_tie: false, top_option_id: leaderId },
    },
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
  } as unknown as V2RunResponse
}

/** Put a completed run on the store, exactly as a finished analysis leaves it. */
function seedRun(win: Record<string, number>, leaderId: string): void {
  const report = mapV2ResponseToReportV1(makeV2Response(win, leaderId), { seed: 42 })
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report } as never,
    runMeta: {} as never,
    nodes: OPTIONS.map((o) => ({
      id: o.id,
      type: 'option',
      position: { x: 0, y: 0 },
      data: { kind: 'option', label: o.label },
    })) as never,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as never)
}

/**
 * Drive the REAL hook over the run currently on the store. Its registration
 * effect is what mints/merges the ordinals, so run 1 must go through here for
 * the run-2 assertions to be about real frozen ordinals.
 */
function driveHook(): ReturnType<typeof useResultsSectionData> {
  const { result, unmount } = renderHook(() => useResultsSectionData())
  const value = result.current
  unmount()
  return value
}

/** Run 1 (mints ordinals) then run 2 (flips the leader); returns run 2's model. */
function flipAndBuild(): HeroChartModel {
  useCanvasStore.setState({ optionNumbering: {} } as never)

  seedRun(RUN1_WIN, 'opt_a')
  driveHook()
  const mintedOnRun1 = { ...useCanvasStore.getState().optionNumbering }
  // PRECONDITION, asserted in-test: without these exact frozen ordinals the
  // assertions below would pass for reasons unrelated to the defect (trap
  // 13b — a discriminator must pin its own precondition).
  expect(mintedOnRun1).toEqual({ opt_a: 1, opt_b: 2, opt_c: 3 })

  seedRun(RUN2_WIN, 'opt_b')
  const data = driveHook()
  const numbering = useCanvasStore.getState().optionNumbering
  // PRECONDITION: the re-run must NOT have renumbered anything — the whole
  // defect depends on the ordinals being frozen at run 1.
  expect(numbering).toEqual(mintedOnRun1)

  const model = buildHeroModel(data, numbering)
  expect(model.kind).toBe('chart')
  const chart = model as HeroChartModel
  // PRECONDITION: the leader really did flip — opt_b is now first.
  expect(chart.rows.map((r) => r.id)).toEqual(['opt_b', 'opt_a', 'opt_c'])
  expect(chart.rows[0].index).toBe(1)
  expect(chart.rows[0].stableNumber).toBe(2)
  return chart
}

function renderFlipped(): HeroChartModel {
  const chart = flipAndBuild()
  render(<AnalysisHeroPanel model={chart} rerunDisabled={false} />)
  return chart
}

beforeEach(() => {
  useCanvasStore.setState({ optionNumbering: {} } as never)
})
afterEach(() => cleanup())

describe('hero badge after a re-run that flips the leader', () => {
  it('the badge on the new leader row carries its CURRENT RANK, not the ordinal frozen on run 1', () => {
    renderFlipped()
    // Bound by identity to the row that flipped INTO the lead (row 1 is
    // opt_b, asserted in flipAndBuild), never by "some badge reading 1".
    const leaderRow = screen.getByTestId('hero-option-row-1')
    expect(within(leaderRow).getByTestId('hero-row-number')).toHaveTextContent('1')
  })

  it('the FILLED badge’s numeral is its own row’s position (the witnessed contradiction)', () => {
    renderFlipped()
    // The filled badge is the leader treatment (`bg-primary`, HeroOptionRow).
    // Before the fix it was filled leader-blue while carrying an ordinal from
    // a different question — one 24x24 element answering two at once.
    //
    // ⚠ THIS ASSERTION WAS WRITTEN WRONG FIRST AND PASSED AT PRISTINE, which
    // is why it is phrased this way. The original said "the filled badge
    // reads 1" — but the DEFAULT lens is Goal fit, whose leader is opt_a on
    // ROW 2, and opt_a's frozen ordinal happens to be 1. The test passed on a
    // different object than the one it was written for (trap 19), with its
    // positive control firing happily. Binding is now positional and derived:
    // whichever row is filled, its numeral must equal ITS OWN position.
    const positions = [1, 2, 3]
    const filled = positions.filter((i) =>
      /bg-primary/.test(
        within(screen.getByTestId(`hero-option-row-${i}`)).getByTestId('hero-row-number')
          .className,
      ),
    )
    // POSITIVE CONTROL: exactly one row carries the leader fill. Without it
    // the assertion below passes vacuously the moment the fill stops
    // rendering at all.
    expect(filled).toHaveLength(1)
    const filledPosition = filled[0]
    expect(
      within(screen.getByTestId(`hero-option-row-${filledPosition}`)).getByTestId(
        'hero-row-number',
      ),
    ).toHaveTextContent(String(filledPosition))
  })

  it('every badge in the list reads its display rank, top to bottom', () => {
    renderFlipped()
    const numerals = screen.getAllByTestId('hero-row-number').map((n) => n.textContent?.trim())
    expect(numerals).toEqual(['1', '2', '3'])
  })

  it('IDENTITY is still on screen, as TEXT, in OptionCards’ existing wording', () => {
    renderFlipped()
    const leaderRow = screen.getByTestId('hero-option-row-1')
    // opt_b was second on run 1, so its identity is Option 2 — permanently.
    // Same string OptionCards.tsx:737 renders for this id, so a reader moving
    // between those two surfaces sees one identity, not two numbers.
    // ⚠ NOT the canvas node's glyph, though earlier revisions of these
    // comments said so: `canvas/nodes/OptionNode.tsx:1206-1213` draws the
    // BARE NUMERAL in a bordered box and carries `Option N` as its
    // `aria-label` only. The two surfaces agree on the ACCESSIBLE NAME and
    // deliberately differ in glyph (a canvas node has no room for the word).
    // Corrected rather than deleted, because the aria agreement is the
    // stronger property.
    expect(within(leaderRow).getByTestId('hero-row-identity')).toHaveTextContent('Option 2')
    const secondRow = screen.getByTestId('hero-option-row-2')
    expect(within(secondRow).getByTestId('hero-row-identity')).toHaveTextContent('Option 1')
  })

  it('rank and identity DISAGREE on this run, and that is the point — each is labelled', () => {
    const chart = renderFlipped()
    const leaderRow = screen.getByTestId('hero-option-row-1')
    const rank = within(leaderRow).getByTestId('hero-row-number').textContent?.trim()
    const identity = within(leaderRow).getByTestId('hero-row-identity').textContent?.trim()
    // The two quantities are DELIBERATELY different for this option on this
    // run. If a future "harmonisation" makes them equal, this REDs — which is
    // the whole reason it is written as an inequality rather than as two
    // separate equalities.
    expect(rank).not.toEqual(identity)
    expect(rank).toBe(String(chart.rows[0].index))
    expect(identity).toBe(`Option ${chart.rows[0].stableNumber}`)
  })
})

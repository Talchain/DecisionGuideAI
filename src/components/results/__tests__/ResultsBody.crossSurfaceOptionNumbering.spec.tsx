/**
 * CROSS-SURFACE OPTION NUMBERING — hero RANK beside card IDENTITY, on ONE
 * screen, after a re-run that flips the leader.
 *
 * ## THIS IS THE LOAD-BEARING HALF OF THE BADGE FIX, NOT A SIDE-ASSERTION
 *
 * The hero badge used to render `stableNumber ?? index` — the frozen IDENTITY
 * ordinal — while the list order, the leader fill and the "Highest on this
 * view" cue all stated the CURRENT rank. (That identity ordinal was the first
 * run's RANK until 31 Aug 2026 and is now the card's POSITION in canvas
 * reading order; this file is about the two quantities being distinct, which
 * is unaffected by where identity comes from.) Pointing the badge at
 * `row.index` closes that. But it opens the opposite-direction harm
 * immediately, and this estate's signature defect is exactly that trade: the
 * same option would then read "1" in the cockpit and "Option 2" on the card
 * below it and on its canvas node — a cross-surface disagreement bought with
 * a fixed badge.
 *
 * Two harms cannot share one window, so they were given two elements:
 *
 *   | element                          | question it answers        | source        |
 *   |----------------------------------|----------------------------|---------------|
 *   | hero badge (filled for leader)   | who leads NOW?             | `row.index`   |
 *   | hero `Option N` text             | which option IS this?      | `stableNumber`|
 *   | card `Option N` text             | which option IS this?      | `stableNumber`|
 *   | card colour swatch (no numeral)  | who leads NOW?             | `rank`        |
 *
 * The hero did not invent a convention: `OptionCards.tsx:722-738` has drawn
 * rank as a NUMERAL-FREE colour swatch and identity as the TEXT
 * `Option {stableNumber}` since D17, and `canvas/nodes/OptionNode.tsx` mirrors
 * the same chip. The hero converged on it.
 *
 * ## WHY THIS FILE, RATHER THAN MORE CASES IN THE HERO SUITE
 *
 * A hero-only suite cannot see a cross-surface disagreement — both halves of
 * the contradiction have to be mounted at once. `ResultsBody` is the only
 * production parent of `OptionCards` and it also mounts
 * `AnalysisHeroContainer` from the SAME `recommendation.allOptions`, so this
 * is the surface a user loads with both numbers on it. (Same reasoning as
 * `ResultsBody.notAnalysedMountPath.spec.tsx`, and the same trap it cites:
 * CLAUDE.md 3b — a green component suite is not evidence about a screen.)
 *
 * ## WHAT IT IS WRITTEN TO CATCH
 *
 * A future "harmonisation" that makes the two numbers agree — from EITHER
 * side. Pointing the badge back at `stableNumber` REDs it, and so does
 * relabelling the card's identity chip with the rank. That is why the central
 * assertion is an INEQUALITY between two NAMED quantities rather than two
 * separate equalities that a single well-meaning edit could satisfy at once.
 *
 * ## STATE CLASS
 *
 * SEEDED-THEN-RERUN, one page session, no reload. `optionNumbering` has no
 * `persist()`, so a reload clears it and the divergence disappears — which is
 * why runs without a flip, and every reload, agreed.
 *
 * ## WHAT THIS FILE EXCLUDES
 *
 * jsdom: presence and text, never layout or visibility (CLAUDE.md trap 3). It
 * says nothing about the canvas `OptionNode`, which reads the same
 * `optionNumbering` map from the store but mounts on a different surface.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within, renderHook } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

/** First-appearance order A, B, C — the order run 1 freezes ordinals in. */
const OPTIONS = [
  { id: 'opt_a', label: 'Hire two developers', mean: 30 },
  { id: 'opt_b', label: 'Partner with a consultancy', mean: 24 },
  { id: 'opt_c', label: 'Continue solo', mean: 12 },
]

/** ONLY `win_probability` moves between the runs. */
/** Canvas geometry: a single row, left to right — reading order a, b, c. */
const CANVAS_POSITION: Record<string, { x: number; y: number }> = {
  opt_a: { x: 40, y: 100 },
  opt_b: { x: 340, y: 100 },
  opt_c: { x: 640, y: 100 },
}

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
    // A PERMITTED run: without a producer leader claim the verdict is
    // `unknown`, designations are withheld, and BOTH surfaces suppress their
    // ranked chrome — every assertion here would pass against a screen with
    // no numbers on it at all.
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

function seedRun(win: Record<string, number>, leaderId: string): void {
  const report = mapV2ResponseToReportV1(makeV2Response(win, leaderId), { seed: 42 })
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report } as never,
    runMeta: {} as never,
    nodes: OPTIONS.map((o) => ({
      id: o.id,
      type: 'option',
      // Real canvas geometry: one row, left to right in OPTIONS order. `Option
      // N` is POSITIONAL IDENTITY (the Nth card in canvas reading order, ruled
      // 31 Aug 2026), so the frozen ordinals this file asserts are earned by
      // position — not by the array order they happen to match.
      position: CANVAS_POSITION[o.id],
      data: { kind: 'option', label: o.label },
    })) as never,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as never)
}

function driveHook(): ReturnType<typeof useResultsSectionData> {
  const { result, unmount } = renderHook(() => useResultsSectionData())
  const value = result.current
  unmount()
  return value
}

/**
 * Run 1 (mints the ordinals through the REAL hook and the REAL PLoT V2
 * mapper), then run 2 (flips the leader), then render the real mount path on
 * run 2's data.
 */
function renderFlippedBody(): void {
  useCanvasStore.setState({ optionNumbering: {} } as never)

  seedRun(RUN1_WIN, 'opt_a')
  driveHook()
  const frozen = { ...useCanvasStore.getState().optionNumbering }
  // PRECONDITION pinned in-test: these are the ordinals a real first run
  // mints. Fabricating them as a fixture would make every assertion below a
  // statement about my own arithmetic (CLAUDE.md trap 16-inverse). Since
  // 31 Aug 2026 they are CANVAS READING ORDER (the cards sit in one row, a/b/c
  // left to right) rather than the first run's ranking — the numbers are the
  // same here on purpose, so this file keeps testing the cross-surface
  // question it was written for and not the seeding rule.
  expect(frozen).toEqual({ opt_a: 1, opt_b: 2, opt_c: 3 })

  seedRun(RUN2_WIN, 'opt_b')
  const data = driveHook()
  // PRECONDITION: the re-run renumbered nothing. Append-only is the mechanism
  // the whole defect rests on.
  expect(useCanvasStore.getState().optionNumbering).toEqual(frozen)
  // PRECONDITION: the leader actually flipped.
  expect(data.recommendation.allOptions.map((o) => o.id)).toContain('opt_b')

  render(
    <ResultsBody
      resultsSectionData={data}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      expertMode={false}
    />,
  )
}

beforeEach(() => {
  useCanvasStore.setState({ optionNumbering: {} } as never)
})
afterEach(() => cleanup())

describe('ResultsBody — hero rank and card identity, on one screen, after a flip', () => {
  it('PRECONDITION: both ranked surfaces are mounted with their chrome on screen', () => {
    renderFlippedBody()
    // Without this every assertion below could pass against a screen that
    // stopped rendering one of the two surfaces (CLAUDE.md trap 13).
    expect(screen.getByTestId('analysis-hero-panel')).toBeInTheDocument()
    expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    expect(screen.getByTestId('hero-option-row-1')).toBeInTheDocument()
    expect(screen.getByTestId('option-card-opt_b')).toBeInTheDocument()
    expect(screen.getByTestId('rank-marker-opt_b')).toBeInTheDocument()
  })

  it('the hero badge states RANK: opt_b flipped into the lead, so its badge reads 1', () => {
    renderFlippedBody()
    // Bound to opt_b by identity — the card carries `data-option-id`, and the
    // hero row is the one containing that option's label. Never "the badge
    // that reads 1".
    const heroRow = screen.getByTestId('hero-option-row-1')
    expect(within(heroRow).getByTestId('hero-row-label')).toHaveTextContent(
      'Partner with a consultancy',
    )
    expect(within(heroRow).getByTestId('hero-row-number')).toHaveTextContent('1')
  })

  it('BOTH surfaces state the same IDENTITY for opt_b — Option 2 — in the same words', () => {
    renderFlippedBody()
    const heroRow = screen.getByTestId('hero-option-row-1')
    expect(within(heroRow).getByTestId('hero-row-identity')).toHaveTextContent('Option 2')
    // The card's identity chip is `OptionCards.tsx:732-738`, unchanged by this
    // slice — the hero adopted ITS wording, not the other way round.
    expect(screen.getByTestId('stable-number-opt_b')).toHaveTextContent('Option 2')
  })

  it('⭐ THE PIN: rank and identity are DIFFERENT QUANTITIES for opt_b, and stay different', () => {
    renderFlippedBody()
    const heroRow = screen.getByTestId('hero-option-row-1')
    const heroRank = within(heroRow).getByTestId('hero-row-number').textContent?.trim()
    const heroIdentity = within(heroRow).getByTestId('hero-row-identity').textContent?.trim()
    const cardIdentity = screen.getByTestId('stable-number-opt_b').textContent?.trim()

    // Identity agrees ACROSS surfaces...
    expect(heroIdentity).toBe(cardIdentity)
    // ...and differs from rank WITHIN the hero, deliberately, on this run.
    expect(heroRank).toBe('1')
    expect(heroIdentity).toBe('Option 2')
    expect(heroIdentity).not.toBe(`Option ${heroRank}`)
  })

  it('the card states rank WITHOUT a numeral, so no numeral on the card can contradict the hero', () => {
    renderFlippedBody()
    // D17: `#N of M` was removed from the card; rank is a colour swatch. The
    // ONLY numeral in the card header is the identity chip. If a rank numeral
    // ever comes back to the card, this REDs — because it would immediately
    // be a second number about a different question sitting next to identity.
    const marker = screen.getByTestId('rank-marker-opt_b')
    expect(marker.textContent?.trim()).toBe('')
  })

  it('CONTROL: the option that LOST the lead shows the mirror image (rank 2, identity Option 1)', () => {
    renderFlippedBody()
    // A single row could satisfy every assertion above by coincidence. opt_a
    // moves the OTHER way — rank 1 -> 2 while identity stays Option 1 — so
    // the two quantities are shown to move independently, not merely to
    // differ once.
    const secondRow = screen.getByTestId('hero-option-row-2')
    expect(within(secondRow).getByTestId('hero-row-label')).toHaveTextContent(
      'Hire two developers',
    )
    expect(within(secondRow).getByTestId('hero-row-number')).toHaveTextContent('2')
    expect(within(secondRow).getByTestId('hero-row-identity')).toHaveTextContent('Option 1')
    expect(screen.getByTestId('stable-number-opt_a')).toHaveTextContent('Option 1')
  })
})

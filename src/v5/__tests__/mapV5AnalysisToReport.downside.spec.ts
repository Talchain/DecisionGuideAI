/**
 * ROADMAP 2.449 — the V5 wire→report boundary for the DOWNSIDE / tail-risk block.
 *
 * WHY A SEPARATE SUITE. `mapV5AnalysisToReport` reads `option_comparison[]` by
 * EXPLICIT FIELD SELECTION — there is no spread anywhere in it. That is the
 * same shape of drop that killed this statistic at PLoT, and it is a live one
 * in this very file today: `EnrichmentOutcomeStatsSchema` carries
 * `n_valid_samples`, the V2 mapper forwards it, and the V5 mapper drops it.
 * A field that is not asserted at THIS boundary is a field that vanishes
 * silently the next time someone tidies the object literal.
 *
 * THE FIXTURE IS A LIVE CAPTURE, NOT ONE THIS LANE INVENTED. The base block is
 * `live-analysis-turn-walkA-2026-08-04.json` — a real UI-facing CEE turn from
 * 4 Aug 2026, which is exactly the payload that PROVES the gap: it carries
 * `decision_evpi` (so ISL computed the regret population on that run) and no
 * option carries a downside block (so it died in transit). The downside blocks
 * are then grafted onto that real payload in the shape ISL's `DownsideV2`
 * declares, rather than a whole payload written from this lane's model of the
 * producer.
 *
 * ALL-OR-NOTHING IS THE PRODUCER'S RULE. ISL declares `cvar_10`, `p05` and
 * `expected_regret` as REQUIRED floats and omits the block — "Omitted, never
 * null" — rather than ship a partial one. So a partial block arriving here is
 * a broken contract, not a half-answer, and absence is its only honest
 * reading. Never a zero: a fabricated 0 in a tail statistic reads as "there is
 * no downside".
 */

import { describe, expect, it } from 'vitest'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'
import liveWalkATurn from './fixtures/live-analysis-turn-walkA-2026-08-04.json'

type DownsideOnWire = { cvar_10?: unknown; p05?: unknown; expected_regret?: unknown }

type ReportWithDownside = ReturnType<typeof mapV5AnalysisToReport> & {
  option_probabilities?: Record<
    string,
    { downside?: { cvar_10: number; p05: number; expected_regret: number } }
  >
}

/**
 * The live 4-Aug turn's `analysis_result` block, with per-option downside
 * blocks grafted on by option id. Passing `undefined` for an option leaves it
 * exactly as the live capture had it — i.e. with NO downside key, which is the
 * producer's documented absence shape and the state the live wire is in today.
 */
function liveBlockWithDownside(
  byOptionId: Record<string, DownsideOnWire | undefined>,
): AnalysisResultBlock {
  const blocks = (liveWalkATurn as { blocks: Array<Record<string, unknown>> }).blocks
  const analysis = blocks.find((b) => b.type === 'analysis_result')
  if (!analysis) throw new Error('live fixture no longer carries an analysis_result block')
  const cloned = JSON.parse(JSON.stringify(analysis)) as Record<string, unknown>
  const enrichment = cloned.enrichment as { option_comparison?: Array<Record<string, unknown>> }
  const rows = enrichment?.option_comparison
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error('live fixture no longer carries >= 2 option_comparison rows')
  }
  for (const row of rows) {
    const id = (row.option_id ?? row.id) as string
    const d = byOptionId[id]
    if (d !== undefined) row.downside = d
  }
  return cloned as unknown as AnalysisResultBlock
}

/** The live capture's own option ids, derived rather than hardcoded. */
function liveOptionIds(): string[] {
  const blocks = (liveWalkATurn as { blocks: Array<Record<string, unknown>> }).blocks
  const analysis = blocks.find((b) => b.type === 'analysis_result') as
    | { enrichment?: { option_comparison?: Array<Record<string, unknown>> } }
    | undefined
  return (analysis?.enrichment?.option_comparison ?? []).map(
    (r) => (r.option_id ?? r.id) as string,
  )
}

describe('2.449 — downside/tail-risk at the V5 wire→report boundary', () => {
  // =========================================================================
  // 0 — the gap itself, pinned against the live capture
  // =========================================================================

  it('THE GAP: the live 4-Aug turn carries decision_evpi and NO option downside', () => {
    // This is the measurement the whole lane rests on, kept executable so it
    // cannot quietly stop being true. `decision_evpi` present means ISL
    // computed the regret population on that run (its own model validator
    // raises otherwise), so the absent per-option blocks are a DROP in
    // transit, never a "the engine had nothing to say".
    const raw = JSON.stringify(liveWalkATurn)
    expect(raw).toContain('decision_evpi')
    expect(raw).not.toContain('cvar_10')
    expect(raw).not.toContain('"downside"')
    expect(liveOptionIds().length).toBeGreaterThanOrEqual(2)
  })

  // =========================================================================
  // 1 — present-in ⇒ present-out, bound to the option by id
  // =========================================================================

  it('carries EACH option its OWN downside block through to option_probabilities', () => {
    const [firstId, secondId] = liveOptionIds()
    const first = { cvar_10: 0.21, p05: 0.29, expected_regret: 0.04 }
    const second = { cvar_10: -0.37, p05: -0.18, expected_regret: 0.19 }

    const report = mapV5AnalysisToReport(
      liveBlockWithDownside({ [firstId]: first, [secondId]: second }),
    ) as ReportWithDownside

    // Bound BY ID, and the two fixtures are deliberately different so neither
    // assertion could be satisfied by the other option's block.
    expect(report.option_probabilities?.[firstId]?.downside).toEqual(first)
    expect(report.option_probabilities?.[secondId]?.downside).toEqual(second)
    expect(report.option_probabilities?.[secondId]?.downside?.cvar_10).not.toBe(
      report.option_probabilities?.[firstId]?.downside?.cvar_10,
    )
  })

  it('POSITIVE CONTROL — present on one option and absent on its sibling, in ONE report', () => {
    const [firstId, secondId] = liveOptionIds()
    const first = { cvar_10: 0.21, p05: 0.29, expected_regret: 0.04 }

    const report = mapV5AnalysisToReport(
      liveBlockWithDownside({ [firstId]: first }),
    ) as ReportWithDownside

    // PRESENT arm — the harness can see a block arrive.
    expect(report.option_probabilities?.[firstId]?.downside).toEqual(first)
    // ABSENT arm — and can see one NOT arrive, on an option that is otherwise
    // fully mapped in the same report.
    expect(report.option_probabilities?.[secondId]).toBeDefined()
    expect(report.option_probabilities?.[secondId]).not.toHaveProperty('downside')
  })

  // =========================================================================
  // 2 — honest absence: never a zero, never a partial block
  // =========================================================================

  it.each<[string, DownsideOnWire]>([
    ['a missing p05', { cvar_10: 0.21, expected_regret: 0.04 }],
    ['a null cvar_10', { cvar_10: null, p05: 0.29, expected_regret: 0.04 }],
    ['a NaN expected_regret', { cvar_10: 0.21, p05: 0.29, expected_regret: Number.NaN }],
    ['a string cvar_10', { cvar_10: '0.21', p05: 0.29, expected_regret: 0.04 }],
    ['an Infinity p05', { cvar_10: 0.21, p05: Number.POSITIVE_INFINITY, expected_regret: 0.04 }],
    ['an empty object', {}],
  ])('drops the WHOLE block on %s — never a partial, never a zero', (_name, bad) => {
    const [firstId, secondId] = liveOptionIds()
    const good = { cvar_10: -0.37, p05: -0.18, expected_regret: 0.19 }

    const report = mapV5AnalysisToReport(
      liveBlockWithDownside({ [firstId]: bad, [secondId]: good }),
    ) as ReportWithDownside

    // PRECONDITION PIN: the good sibling proves this run carried downside
    // blocks at all, so the assertion below is about the GUARD and not about a
    // fixture somebody emptied.
    expect(report.option_probabilities?.[secondId]?.downside).toEqual(good)

    expect(report.option_probabilities?.[firstId]).not.toHaveProperty('downside')
    expect(report.option_probabilities?.[firstId]?.downside).toBeUndefined()
  })

  it('carries a GENUINE zero expected_regret — a measured 0 is not an absence', () => {
    // The option that wins every simulated draw has expected_regret === 0 by
    // construction at the producer. A truthiness guard would swallow it and
    // silently delete the whole tail view of the leading option.
    const [firstId] = liveOptionIds()
    const winner = { cvar_10: 0.55, p05: 0.58, expected_regret: 0 }

    const report = mapV5AnalysisToReport(
      liveBlockWithDownside({ [firstId]: winner }),
    ) as ReportWithDownside

    expect(report.option_probabilities?.[firstId]?.downside).toEqual(winner)
    expect(report.option_probabilities?.[firstId]?.downside?.expected_regret).toBe(0)
  })

  it('a genuine zero in EVERY component still survives', () => {
    const [firstId] = liveOptionIds()
    const allZero = { cvar_10: 0, p05: 0, expected_regret: 0 }
    const report = mapV5AnalysisToReport(
      liveBlockWithDownside({ [firstId]: allZero }),
    ) as ReportWithDownside
    expect(report.option_probabilities?.[firstId]?.downside).toEqual(allZero)
  })
})

/**
 * ROADMAP 2.234 — `mixed`, `unknown` and null driver directions must not be
 * rendered as "up".
 *
 * THE DEFECT (Codex audit B, B-03, at `900dbd6c`). The 0.30 boundary contract
 * deliberately leaves `direction` open and documents the observed domain
 * `positive | negative | mixed | unknown` (+ null); PLoT emits exactly that
 * (`plot-lite-service/src/routes/v2/run.ts:879-892`). This mapper accepted only
 * `positive` and `negative` and fell back to THE SIGN OF THE MAGNITUDE:
 *
 *     direction = explicitDirection ?? (rawMagnitude >= 0 ? 'positive' : 'negative')
 *
 * The magnitude is picked from `sensitivity_score ?? sensitivity ?? elasticity
 * ?? importance_score` and those are ordinarily NON-NEGATIVE, so every
 * `mixed`, every `unknown` and every absent direction became `positive`, then
 * `polarity: 'up'`. The UI ended up asserting that raising a factor raises the
 * outcome on runs where the producer had explicitly said the direction is
 * mixed or unknown. That is a false scientific claim, not a missing
 * disclosure — which is why the fix is "never infer", not "infer better".
 *
 * ONE NORMALIZER. The same two-value collapse was written a second time in
 * `useResultsSectionData.normalizeFactorSensitivity`. Both now call
 * `src/lib/factorDirection.ts`, so a future domain member cannot be honoured
 * in one place and dropped in the other.
 *
 * CLAIM TYPE: pure-mapper behaviour over a synthesised block conforming to the
 * producer contract. It proves what the mapper does with a conforming wire; it
 * is NOT a live-wire incidence claim (the audit did not measure incidence on
 * staging traffic either).
 */
import { describe, expect, it } from 'vitest'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'

type WidenedReport = ReturnType<typeof mapV5AnalysisToReport> & Record<string, unknown>
type ReportFactor = { factor_id: string; direction?: unknown }

function block(enrichment: Record<string, unknown>): AnalysisResultBlock {
  return {
    type: 'analysis_result',
    summary: 'A summary',
    leading_option_id: 'opt_a',
    win_probabilities: { opt_a: 0.6, opt_b: 0.4 },
    enrichment,
  } as unknown as AnalysisResultBlock
}

/** One factor row carrying `direction` exactly as the producer sent it. */
function mappedWithDirection(direction: unknown): WidenedReport {
  const row: Record<string, unknown> = {
    factor_id: 'n_market',
    factor_label: 'Market size',
    // Deliberately a NON-NEGATIVE magnitude — the field shape that made the
    // sign fallback silently mean "positive" for every non-directional value.
    sensitivity_score: 0.42,
  }
  if (direction !== undefined) row.direction = direction
  return mapV5AnalysisToReport(block({ factor_sensitivity: [row] })) as WidenedReport
}

function factorsOf(report: WidenedReport): ReportFactor[] {
  return (report.factor_sensitivity ?? []) as ReportFactor[]
}

describe('mapV5AnalysisToReport — the direction domain is carried, never inferred (ROADMAP 2.234)', () => {
  // ONE FIXTURE PER DOMAIN MEMBER, plus null and absent.
  it('positive → positive / up', () => {
    const report = mappedWithDirection('positive')
    expect(factorsOf(report)[0].direction).toBe('positive')
    expect(report.drivers[0].polarity).toBe('up')
  })

  it('negative → negative / down', () => {
    const report = mappedWithDirection('negative')
    expect(factorsOf(report)[0].direction).toBe('negative')
    expect(report.drivers[0].polarity).toBe('down')
  })

  it('mixed → mixed, and NEVER "up"', () => {
    const report = mappedWithDirection('mixed')
    expect(factorsOf(report)[0].direction).toBe('mixed')
    expect(report.drivers[0].polarity).not.toBe('up')
    expect(report.drivers[0].polarity).toBe('neutral')
  })

  it('unknown → unknown, and NEVER "up"', () => {
    const report = mappedWithDirection('unknown')
    expect(factorsOf(report)[0].direction).toBe('unknown')
    expect(report.drivers[0].polarity).not.toBe('up')
    expect(report.drivers[0].polarity).toBe('neutral')
  })

  it('null → no direction at all (absence stays absence — never defaulted to positive)', () => {
    const report = mappedWithDirection(null)
    expect(factorsOf(report)[0].direction ?? null).toBeNull()
    expect(report.drivers[0].polarity).toBe('neutral')
  })

  it('field ABSENT → no direction at all', () => {
    const report = mappedWithDirection(undefined)
    expect(factorsOf(report)[0].direction ?? null).toBeNull()
    expect(report.drivers[0].polarity).toBe('neutral')
  })

  it('an UNRECOGNISED value fails closed to `unknown`, never to a directional claim', () => {
    const report = mappedWithDirection('sideways')
    expect(factorsOf(report)[0].direction).toBe('unknown')
    expect(report.drivers[0].polarity).toBe('neutral')
  })

  it('POSITIVE CONTROL — the magnitude is still carried untouched, so this is not an "everything went dark" pass', () => {
    const report = mappedWithDirection('mixed')
    const factor = factorsOf(report)[0] as ReportFactor & { sensitivity: number }
    expect(factor.factor_id).toBe('n_market')
    expect(factor.sensitivity).toBe(0.42)
    expect(report.drivers[0].contribution).toBe(0.42)
  })

  it('a NEGATIVE magnitude with no producer direction is still not a direction claim', () => {
    // The old fallback would have called this 'negative' from the sign alone.
    // The producer said nothing, so neither does the UI.
    const report = mapV5AnalysisToReport(
      block({
        factor_sensitivity: [
          { factor_id: 'n_cost', factor_label: 'Cost', elasticity: -0.3 },
        ],
      }),
    ) as WidenedReport
    expect(factorsOf(report)[0].direction ?? null).toBeNull()
    expect(report.drivers[0].polarity).toBe('neutral')
    // Magnitude is still the absolute value — unchanged behaviour.
    expect(report.drivers[0].contribution).toBe(0.3)
  })
})

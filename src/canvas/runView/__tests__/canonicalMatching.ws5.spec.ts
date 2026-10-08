import { describe, expect, it } from 'vitest'
import { buildRunView } from '../runView'
import { readFileSync } from 'node:fs'
import type { CanonicalAnalysisView } from '../canonicalAnalysisView'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
// JSON evidence only; no imports across the hero's mount boundary.
const served: { j: { canonical_analysis_view: CanonicalAnalysisView; analysis_result: { enrichment: { inference_warnings: Record<string, unknown>[] } } } } = JSON.parse(readFileSync('src/components/results/analysis-hero/__tests__/fixtures/cee-94b2554d-served-read-b38d1c80.json', 'utf8'))
const p02: { j: { analysis_result: unknown } } = JSON.parse(readFileSync('src/components/results/analysis-hero/__tests__/fixtures/p02-B2-464abd0a-read-reloaded.json', 'utf8'))

const canonical = served.j.canonical_analysis_view
const run = canonical.run!
const X = 'launch_starter_tier'
const ctx = { goalChanceHeroSays: true, labelOf: (id: string) => id, rangeLabelOf: (id: string) => id }
const report = () => ({ run_id: run.run_id, computed_against_hash: run.graph_hash_at_run,
  meta: { computed_at: run.computed_at }, inference_warnings: served.j.analysis_result.enrichment.inference_warnings })
describe('R6 canonical matching and figure authority', () => {
  it('R6-3a canonical 20–60% wins over the P02 legacy 5–37% range', () => {
    const legacy = mapV5AnalysisToReport(p02.j.analysis_result as never)
    const body = { ...canonical, options: [{ option_id: X, cell: { kind: 'range', display: '20–60%', detail: {} }, main_driver: { kind: 'not_recorded' } }] }
    const view = buildRunView({ ...legacy, run_id: run.run_id }, body as never)
    expect(buildRunView(legacy).chanceCellOf(X, ctx).text).toContain('5% and 37%')
    expect(view.chanceCellOf(X, ctx)).toEqual({ kind: 'range', text: '20–60%' })
  })
  it.each(['less than 1%', '<1%'])('R6-3b served b38d1c80 bound %s cannot become about 1%%', display => {
    const id = 'keep_pricing_as_is'
    const body = { ...canonical, options: [{ ...canonical.options.find(o => o.option_id === id)!, cell: { kind: 'figure', display } }] }
    const warnings = report().inference_warnings.map(w => w.code === 'GOAL_CHANCE_LICENSED'
      ? { ...w, pct_by_option: { ...(w.pct_by_option as Record<string, number>), [id]: 1 } } : w)
    const cell = buildRunView({ ...report(), inference_warnings: warnings }, body as never).chanceCellOf(id, ctx)
    expect(cell.text).toBe(display)
    expect(cell.text).not.toContain('about 1%')
  })
  it('R6-3c same hash but different computed_at ignores the canonical view without a run id', () => {
    const r = { ...report(), run_id: undefined, meta: { computed_at: '2026-10-08T17:00:00.000Z' } }
    const body = { ...canonical, options: [{ option_id: X, cell: { kind: 'figure', display: 'about 71%' }, main_driver: { kind: 'not_recorded' } }] }
    expect(buildRunView(r, body as never).chanceCellOf(X, ctx)).toEqual(buildRunView(r).chanceCellOf(X, ctx))
  })
  it('R6-3c hash AND recorded timestamp are required; run ids win when both exist', () => {
    const body = { ...canonical, options: [{ option_id: X, cell: { kind: 'figure', display: 'about 71%' }, main_driver: { kind: 'not_recorded' } }] }
    expect(buildRunView({ ...report(), run_id: undefined }, body as never).chanceCellOf(X, ctx).text).toBe('about 71%')
    for (const r of [{ ...report(), run_id: undefined, meta: {} }, { ...report(), run_id: undefined, computed_against_hash: 'different' }, { ...report(), run_id: 'different' }]) {
      expect(buildRunView(r, body as never).chanceCellOf(X, ctx)).toEqual(buildRunView(r).chanceCellOf(X, ctx))
    }
    expect(buildRunView({ ...report(), meta: {}, computed_against_hash: 'different' }, body as never).chanceCellOf(X, ctx).text).toBe('about 71%')
    // Either absent id takes the hash+time fallback, never hash alone.
    const withoutCanonicalId = { ...body, run: { ...run, run_id: null } }
    expect(buildRunView(report(), withoutCanonicalId as never).chanceCellOf(X, ctx).text).toBe('about 71%')
    expect(buildRunView({ ...report(), meta: {} }, withoutCanonicalId as never).chanceCellOf(X, ctx)).toEqual(buildRunView({ ...report(), meta: {} }).chanceCellOf(X, ctx))
  })
})

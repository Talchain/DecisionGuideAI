/**
 * Unit tests for `findAnalysisProducingPlotTurn` (PR #156 round-3,
 * reviewer BLOCKING #2).
 *
 * Pre-fix the bundle used generic `findBestPayload(tracedPayloads, 'PLoT')`
 * which picked the most recent completed PLoT entry of any kind. A
 * late validate / probe / limits PLoT entry could displace the
 * actual `/v1/run` analysis response. The new selector ranks
 * analysis-class endpoints first (V1 engine > V1 stream > V2 run)
 * and requires completed-2xx with body for `usable live evidence`.
 */

import { describe, it, expect } from 'vitest'
import {
  findAnalysisProducingPlotTurn,
  type PlotSelectorTracedPayload,
} from '../analysisProducingPlotTurn'

function plotEntry(
  overrides: Partial<PlotSelectorTracedPayload> = {},
): PlotSelectorTracedPayload {
  return {
    id: 'tp-1',
    service: 'PLoT',
    endpoint: '/bff/engine/v1/run',
    status: 200,
    completed: true,
    timestamp: Date.now(),
    response: { headers: {}, body: { run_id: 'run-1', factor_sensitivity: [] } },
    ...overrides,
  }
}

describe('findAnalysisProducingPlotTurn — happy path', () => {
  it('returns the single V1 engine entry as tier=v1_engine + usable live evidence', () => {
    const out = findAnalysisProducingPlotTurn([plotEntry({ id: 'tp-v1' })])
    expect(out.selected?.id).toBe('tp-v1')
    expect(out.tier).toBe('v1_engine')
    expect(out.selected_is_usable_live_evidence).toBe(true)
  })

  it('V1 engine beats V2 even when V2 is more recent', () => {
    const out = findAnalysisProducingPlotTurn([
      // most-recent-first ordering, per trace-store convention
      plotEntry({ id: 'tp-v2', endpoint: '/v2/run' }),
      plotEntry({ id: 'tp-v1', endpoint: '/bff/engine/v1/run' }),
    ])
    expect(out.selected?.id).toBe('tp-v1')
    expect(out.tier).toBe('v1_engine')
  })

  it('V1 stream beats V2 when V1 engine is absent', () => {
    const out = findAnalysisProducingPlotTurn([
      plotEntry({ id: 'tp-v2', endpoint: '/v2/run' }),
      plotEntry({
        id: 'tp-v1-stream',
        endpoint: '/bff/engine/v1/stream',
        response: { headers: {}, body: { run_id: 'r', factor_sensitivity: [] } },
      }),
    ])
    expect(out.selected?.id).toBe('tp-v1-stream')
    expect(out.tier).toBe('v1_stream')
  })

  it('V2 selected when no V1 entries exist', () => {
    const out = findAnalysisProducingPlotTurn([
      plotEntry({ id: 'tp-v2', endpoint: '/v2/run' }),
    ])
    expect(out.tier).toBe('v2_run')
    expect(out.selected_is_usable_live_evidence).toBe(true)
  })
})

describe('findAnalysisProducingPlotTurn — usable-live-evidence gates', () => {
  it('request-only V1 entry (no response) → selected but NOT usable live evidence', () => {
    const out = findAnalysisProducingPlotTurn([
      plotEntry({
        id: 'tp-request-only',
        completed: false,
        response: undefined,
      }),
    ])
    expect(out.selected?.id).toBe('tp-request-only')
    expect(out.tier).toBe('v1_engine')
    // Critical: the selector still surfaces the attempt, but flags
    // it as non-usable so the bundle won't label as `live_*`.
    expect(out.selected_is_usable_live_evidence).toBe(false)
  })

  it('failed 500 V1 entry → selected but NOT usable live evidence', () => {
    const out = findAnalysisProducingPlotTurn([
      plotEntry({
        id: 'tp-500',
        status: 500,
        response: { headers: {}, body: { error: 'failed' } },
      }),
    ])
    expect(out.selected?.id).toBe('tp-500')
    expect(out.selected_is_usable_live_evidence).toBe(false)
  })

  it('failed 4xx V1 entry → selected but NOT usable live evidence', () => {
    const out = findAnalysisProducingPlotTurn([
      plotEntry({
        id: 'tp-400',
        status: 400,
        response: { headers: {}, body: { error: 'bad request' } },
      }),
    ])
    expect(out.selected_is_usable_live_evidence).toBe(false)
  })

  it('empty-stream V1 entry (body:null) → selected but NOT usable live evidence', () => {
    const out = findAnalysisProducingPlotTurn([
      plotEntry({
        id: 'tp-empty-stream',
        endpoint: '/bff/engine/v1/stream',
        response: { headers: {}, body: null },
      }),
    ])
    expect(out.selected?.id).toBe('tp-empty-stream')
    expect(out.tier).toBe('v1_stream')
    expect(out.selected_is_usable_live_evidence).toBe(false)
  })

  it('empty-object body → NOT usable live evidence', () => {
    const out = findAnalysisProducingPlotTurn([
      plotEntry({
        id: 'tp-empty-body',
        response: { headers: {}, body: {} },
      }),
    ])
    expect(out.selected_is_usable_live_evidence).toBe(false)
  })

  it('completed-2xx V1 entry with usable body → usable live evidence', () => {
    const out = findAnalysisProducingPlotTurn([plotEntry()])
    expect(out.selected_is_usable_live_evidence).toBe(true)
  })

  it('reviewer BLOCKING #2: a later non-analysis PLoT entry does NOT displace an earlier completed /v1/run', () => {
    // Trace store has (most-recent-first):
    //   - tp-validate: PLoT /v1/validate, completed-2xx, but
    //     non-analysis (selector should SKIP)
    //   - tp-limits:   PLoT /v1/limits, completed-2xx, non-analysis
    //   - tp-run:      PLoT /v1/run, completed-2xx, body present
    // Pre-fix `findBestPayload(_, 'PLoT')` would pick `tp-validate`
    // (most recent). Round-3 selector picks `tp-run`.
    const out = findAnalysisProducingPlotTurn([
      plotEntry({ id: 'tp-validate', endpoint: '/v1/validate' }),
      plotEntry({ id: 'tp-limits', endpoint: '/v1/limits' }),
      plotEntry({ id: 'tp-run', endpoint: '/bff/engine/v1/run' }),
    ])
    expect(out.selected?.id).toBe('tp-run')
    expect(out.tier).toBe('v1_engine')
  })

  it('fallback: ONLY non-analysis PLoT entries → no analysis-class match → selected is null', () => {
    const out = findAnalysisProducingPlotTurn([
      plotEntry({ id: 'tp-validate', endpoint: '/v1/validate' }),
      plotEntry({ id: 'tp-limits', endpoint: '/v1/limits' }),
    ])
    expect(out.selected).toBeNull()
    expect(out.tier).toBeNull()
    expect(out.selected_is_usable_live_evidence).toBe(false)
  })

  it('empty trace store → null selection', () => {
    const out = findAnalysisProducingPlotTurn([])
    expect(out.selected).toBeNull()
    expect(out.tier).toBeNull()
    expect(out.selected_is_usable_live_evidence).toBe(false)
  })
})

describe('findAnalysisProducingPlotTurn — tier-fallback when no usable entry exists', () => {
  it('V1 engine entries present but ALL non-2xx → tier=v1_engine, NOT usable, selected = newest V1 engine', () => {
    // Trace store has only failed V1 engine entries; the selector
    // returns the most recent (index 0) so reviewers see the
    // attempt, but flags it non-usable.
    const out = findAnalysisProducingPlotTurn([
      plotEntry({ id: 'tp-500-newer', status: 500 }),
      plotEntry({ id: 'tp-500-older', status: 500 }),
    ])
    expect(out.selected?.id).toBe('tp-500-newer')
    expect(out.tier).toBe('v1_engine')
    expect(out.selected_is_usable_live_evidence).toBe(false)
  })

  it('V1 engine has only failed; V1 stream has a usable entry → V1 stream picked over V1 engine fallback', () => {
    // Tier ranking: V1 engine WITH usable wins over V1 stream
    // with usable. But V1 engine WITHOUT usable does NOT block V1
    // stream's usable from winning — the helper looks at each tier
    // for usable first.
    const out = findAnalysisProducingPlotTurn([
      plotEntry({ id: 'tp-eng-500', endpoint: '/bff/engine/v1/run', status: 500 }),
      plotEntry({
        id: 'tp-stream-ok',
        endpoint: '/bff/engine/v1/stream',
        status: 200,
        response: { headers: {}, body: { run_id: 'r', factor_sensitivity: [] } },
      }),
    ])
    expect(out.selected?.id).toBe('tp-stream-ok')
    expect(out.tier).toBe('v1_stream')
    expect(out.selected_is_usable_live_evidence).toBe(true)
  })
})

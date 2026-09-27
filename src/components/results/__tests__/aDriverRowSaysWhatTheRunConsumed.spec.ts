/**
 * R7 / X4 — a driver row's provenance is what the RUN consumed, not what the
 * canvas holds now (R7 inventory rows `glance-input-provenance-from-canvas` /
 * `atglance-input-provenance`, DL #70 5859773247 item 3).
 *
 * The producer sends `factor_sensitivity[].value_source` / `value_defaulted` /
 * `value_extraction_type` (0.60.0 `EnrichmentFactorSensitivityEntrySchema`;
 * present on served turns). `useResultsSectionData` already reads all three,
 * but the V5 mapper dropped them, so the glance's "This reading rests on inputs
 * Olumi estimated" and the hero's `est.` tag were classified from the LIVE
 * node: a value the user overrode after the run rewrote what the run consumed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'

import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { driverValueProvenance } from '../driverValueProvenance'
import realStagingFixture from '../../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'

type State = ReturnType<typeof useCanvasStore.getState>
type Block = Record<string, unknown> & { enrichment: Record<string, unknown> }

/** The run said: engineering capacity was Olumi's estimate; offshore was the user's. */
const RUN_SOURCES: Record<string, { value_source: string; value_defaulted: boolean; value_extraction_type: string }> = {
  fac_eng_capacity: { value_source: 'cee_inference', value_defaulted: false, value_extraction_type: 'inferred' },
  fac_offshore: { value_source: 'user_override', value_defaulted: false, value_extraction_type: 'explicit' },
}

function blockWithRunSources(): Block {
  const block = structuredClone(realStagingFixture.blocks[0]) as unknown as Block
  const fs = block.enrichment.factor_sensitivity as Array<Record<string, unknown>>
  block.enrichment.factor_sensitivity = fs.map((f) => ({ ...f, ...(RUN_SOURCES[f.factor_id as string] ?? {}) }))
  return block
}

function captureReport(block: Block): Record<string, unknown> {
  const envelope = {
    response_version: 2,
    assistant_text: 'Analysis complete.',
    blocks: [block],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as unknown as OlumiResponse
  const captured: Array<{ report: unknown; hash: string }> = []
  const store: V5ApplicatorStore = {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    nodes: [],
    edges: [],
    resultsComplete: (params) => {
      captured.push({ report: params.report, hash: params.hash })
    },
    currentResultsHash: null,
  }
  applyV5State(envelope, store)
  expect(captured).toHaveLength(1)
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, ...captured[0] } as unknown as State['results'],
    hasCompletedFirstRun: true,
  } as Partial<State>)
  return captured[0].report as Record<string, unknown>
}

beforeEach(() => {
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as unknown as State['results'],
    runMeta: {} as State['runMeta'],
    nodes: [] as unknown as State['nodes'],
    edges: [],
    hasCompletedFirstRun: false,
    currentScenarioFraming: null,
    ceeAnalysisReady: undefined,
  })
})

describe('the V5 mapper carries the run’s own value provenance', () => {
  it('value_source / value_defaulted / value_extraction_type reach the report, verbatim', () => {
    const report = captureReport(blockWithRunSources())
    const rows = report.factor_sensitivity as Array<Record<string, unknown>>
    const byId = new Map(rows.map((r) => [r.factor_id, r]))
    expect(byId.get('fac_eng_capacity')).toMatchObject(RUN_SOURCES.fac_eng_capacity)
    expect(byId.get('fac_offshore')).toMatchObject(RUN_SOURCES.fac_offshore)
    // Absence stays absence: the third factor had none on the wire.
    expect(byId.get('fac_talent_market')).not.toHaveProperty('value_source')
  })

  it('and reach the driver rows the surfaces classify (the real hook)', () => {
    captureReport(blockWithRunSources())
    const drivers = renderHook(() => useResultsSectionData()).result.current.drivers.drivers ?? []
    const byKey = new Map(drivers.map((d) => [d.factorKey, d]))
    expect(byKey.get('fac_eng_capacity')?.valueSource).toBe('cee_inference')
    expect(byKey.get('fac_offshore')?.valueSource).toBe('user_override')
  })
})

describe('⛔ the run’s source wins over the live node', () => {
  // The canvas NOW says the reverse of what the run consumed.
  const liveNodes = new Map([
    ['fac_eng_capacity', 'user_override'],
    ['fac_offshore', 'cee_inference'],
  ])

  it('a value the user overrode AFTER the run is still what the run estimated', () => {
    expect(driverValueProvenance({ factorKey: 'fac_eng_capacity', valueSource: 'cee_inference' }, liveNodes)).toBe('estimated')
    expect(driverValueProvenance({ factorKey: 'fac_offshore', valueSource: 'user_override' }, liveNodes)).toBe('not_estimated')
  })

  it('CONTROL: a run that carried no value_source (legacy) still reads the node', () => {
    expect(driverValueProvenance({ factorKey: 'fac_eng_capacity' }, liveNodes)).toBe('not_estimated')
    expect(driverValueProvenance({ factorKey: 'fac_offshore', valueSource: '  ' }, liveNodes)).toBe('estimated')
  })

  it('an unknown run literal fails closed; it never falls back to the node', () => {
    expect(driverValueProvenance({ factorKey: 'fac_eng_capacity', valueSource: 'some_future_literal' }, liveNodes)).toBe(
      'undetermined',
    )
  })
})

/**
 * exportBundle.analysisChanged — pins captureDisplayState's composed-trust
 * derivation `analysisChanged = trust.semantic === 'changed' || trust.orphaned`
 * (exportBundle.ts, F10+F11 fold).
 *
 * The `semantic === 'changed'` half is already pinned by
 * exportBundle.displayState.spec.ts ("results_stale: … retained-fresh +
 * dirtied"). THIS file pins the ORPHAN OR — the exact term the code comment
 * warns about ("an earlier version omitted the orphan OR and drifted from
 * the hook"). The orphan classification needs the canonical flag ON, which
 * would re-route every case in the sibling file, so it lives here with its
 * own flags mock (importOriginal-spread per house rule — never a hand-listed
 * factory).
 *
 * Mutation this makes RED: delete `|| trust.orphaned` in captureDisplayState
 * → the orphan case's effective state is the synthesised 'unknown'
 * (cannot-confirm), semantic ≠ 'changed', and the bundle would report a green
 * 'complete' for a report no live run fact backs — the RCA-D1 contradiction
 * the runtime hook (useAnalysisDisplayState) exists to prevent. The bundle
 * mirrors that hook EXACTLY; this pin is mirror-parity, not copy preference.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface MockCanvasState {
  nodes: Array<{ id: string; data: Record<string, unknown> }>
  edges: Array<{ id: string }>
  results: {
    status: string
    report?: unknown
    hash?: string | null
  } | null
  ceeAnalysisReady: { status?: string } | null
  graphEditedSinceLastRun: boolean
  currentScenarioId?: string | null
  v5AnalysisFact?: {
    scenarioId: string | null
    analysisHash: string | null
    hasRunAnalysisFact: boolean | null
    freshness: 'fresh' | 'stale' | 'unknown' | 'none' | null
  } | null
  analysisFreshness?: { freshness: 'fresh' | 'stale' | 'unknown' | 'none' } | null
  analysisFreshnessDirty?: boolean
}

let mockState: MockCanvasState

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: {
    getState: () => mockState,
  },
}))

// Canonical flag ON: orphan classification only exists on the canonical path
// (flag OFF classifies a bare report as direct_plot_legacy, never orphaned).
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isV5CanonicalAnalysisEnabled: () => true,
  }
})

async function importCapture() {
  const mod = await import('../utils/exportBundle')
  return mod.captureDisplayState
}

describe('captureDisplayState — composed-trust analysisChanged (orphan OR)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('orphaned result (report present, NO run fact) → results_stale, never a green complete', async () => {
    mockState = {
      nodes: [],
      edges: [],
      ceeAnalysisReady: { status: 'ready' },
      graphEditedSinceLastRun: false,
      results: { status: 'complete', report: { option_comparison: [] }, hash: 'h1' },
      currentScenarioId: 'scn_1',
      v5AnalysisFact: null, // hydrated/recovered report — nothing minted it
      analysisFreshness: null, // no verdict either: semantic alone cannot route this
      analysisFreshnessDirty: false,
    }
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('results_stale')
    expect(result.analysis_display_state).not.toBe('complete')
    expect(result.analysis_display_headline).not.toBe('Analysis complete')
  })

  it('positive control: minted fact for the scenario + fresh verdict → complete (the pin can tell the states apart)', async () => {
    mockState = {
      nodes: [],
      edges: [],
      ceeAnalysisReady: { status: 'ready' },
      graphEditedSinceLastRun: false,
      results: { status: 'complete', report: { option_comparison: [] }, hash: 'h1' },
      currentScenarioId: 'scn_1',
      v5AnalysisFact: {
        scenarioId: 'scn_1',
        analysisHash: 'h1',
        hasRunAnalysisFact: true,
        freshness: 'fresh',
      },
      analysisFreshness: { freshness: 'fresh' },
      analysisFreshnessDirty: false,
    }
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('complete')
    expect(result.analysis_display_headline).toBe('Analysis complete')
  })
})

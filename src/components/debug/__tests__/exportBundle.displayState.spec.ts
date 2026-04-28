/**
 * exportBundle.displayState — covers the canonical analysis display fields
 * that captureDisplayState writes into debug bundles. The legacy fields
 * (`analysis_status_displayed`, `hero_headline_displayed`) are retained
 * for backwards-compatibility; the canonical fields (`analysis_display_state`,
 * `analysis_display_headline`) are the ones bundle consumers should migrate
 * to. Tests below pin the four-state mapping plus the exact bug-shape from
 * bundle bef4470b (28 Apr 2026).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface MockCanvasState {
  nodes: Array<{ id: string; data: Record<string, unknown> }>
  edges: Array<{ id: string }>
  results: {
    status: string
    report?: unknown
  } | null
  ceeAnalysisReady: { status?: string } | null
  graphEditedSinceLastRun: boolean
  showResultsPanel?: boolean
  showInspectorPanel?: boolean
  showDraftChat?: boolean
}

let mockState: MockCanvasState

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: {
    getState: () => mockState,
  },
}))

async function importCapture() {
  const mod = await import('../utils/exportBundle')
  return mod.captureDisplayState
}

function makeState(overrides: Partial<MockCanvasState> = {}): MockCanvasState {
  return {
    nodes: [],
    edges: [],
    results: { status: 'idle', report: null },
    ceeAnalysisReady: null,
    graphEditedSinceLastRun: false,
    ...overrides,
  }
}

describe('captureDisplayState — canonical analysis display fields', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('not_ready: empty state with no CEE response', async () => {
    mockState = makeState()
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('not_ready')
    expect(result.analysis_display_headline).toBe('Set up your model')
  })

  it('ready_to_analyse: CEE ready, no report', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'idle', report: null },
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('ready_to_analyse')
    expect(result.analysis_display_headline).toBe('Ready to analyse')
  })

  it('complete: hasReport && !graphEditedSinceLastRun', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: { option_comparison: [] } },
      graphEditedSinceLastRun: false,
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('complete')
    expect(result.analysis_display_headline).toBe('Analysis complete')
  })

  it('results_stale: hasReport && graphEditedSinceLastRun', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: { option_comparison: [] } },
      graphEditedSinceLastRun: true,
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('results_stale')
    expect(result.analysis_display_headline).toBe('Results may be outdated')
  })

  // The exact pattern from bundle bef4470b: CEE says 'ready', the legacy
  // results.status enum value is still 'complete' from a previous run, but
  // the report has been cleared (hasReport=false). The canonical field MUST
  // report 'ready_to_analyse' and the canonical headline MUST NOT be
  // "Analysis complete". The legacy fields are allowed to keep their
  // existing (buggy) behaviour for backwards-compatibility.
  it('bug-shape: hasReport=false but resultsStatus=complete + CEE ready → ready_to_analyse, NOT complete', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: null },
      graphEditedSinceLastRun: false,
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    expect(result.analysis_display_state).toBe('ready_to_analyse')
    expect(result.analysis_display_headline).toBe('Ready to analyse')
    expect(result.analysis_display_headline).not.toBe('Analysis complete')
  })

  it('non-ready CEE statuses collapse to not_ready', async () => {
    for (const status of ['needs_encoding', 'needs_user_mapping', 'needs_user_input']) {
      mockState = makeState({ ceeAnalysisReady: { status } })
      const captureDisplayState = await importCapture()
      const result = await captureDisplayState()
      expect(result.analysis_display_state).toBe('not_ready')
      expect(result.analysis_display_headline).toBe('Set up your model')
    }
  })

  it('legacy fields stay populated for backwards compatibility', async () => {
    mockState = makeState({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: { option_comparison: [] } },
    })
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()
    // Legacy: mirrors results.status enum verbatim
    expect(result.analysis_status_displayed).toBe('complete')
    // New: canonical 4-state mapping
    expect(result.analysis_display_state).toBe('complete')
  })
})

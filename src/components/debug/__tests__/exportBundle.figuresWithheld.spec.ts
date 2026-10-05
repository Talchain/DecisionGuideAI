/**
 * ⛔ GATE 2 CONSUMER, the debug export (Codex #2494 P2): `captureDisplayState` records the headline the screen derives,
 * so it must forward the typed withhold too. Paired: the same report with and without the code. Pattern:
 * `exportBundle.displayState.spec.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface MockCanvasState {
  nodes: Array<{ id: string; data: Record<string, unknown> }>
  edges: Array<{ id: string }>
  results: { status: string; report?: unknown; settledWithoutNewReport?: boolean } | null
  ceeAnalysisReady: { status?: string } | null
  graphEditedSinceLastRun: boolean
}

let mockState: MockCanvasState

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: {
    getState: () => mockState,
  },
}))

const WITHHELD = {
  option_comparison: [{ id: 'opt-a', win_probability: null }],
  inference_warnings: [{ code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', node_ids: ['goal'], message: 'Not shown. Your target can’t be tested yet.' }],
}
const EMPTY = { option_comparison: [{ id: 'opt-a', win_probability: null }] }

async function headlineFor(report: unknown, settledWithoutNewReport?: boolean): Promise<{ state: unknown; headline: unknown }> {
  mockState = {
    nodes: [], edges: [], graphEditedSinceLastRun: false, ceeAnalysisReady: { status: 'ready' },
    results: { status: 'complete', report, ...(settledWithoutNewReport === undefined ? {} : { settledWithoutNewReport }) },
  }
  const { captureDisplayState } = await import('../utils/exportBundle')
  const result = await captureDisplayState()
  return { state: result.analysis_display_state, headline: result.analysis_display_headline }
}

describe('captureDisplayState — the typed withhold is exported as the screen shows it', () => {
  beforeEach(() => { vi.resetModules() })

  it('RED: a completed Run that withheld its figures exports the honest headline', async () => {
    expect(await headlineFor(WITHHELD)).toEqual({ state: 'ran_without_result', headline: 'Analysis finished: figures not shown yet' })
  })

  it('CONTROL: the same report without the code exports the failure headline', async () => {
    expect(await headlineFor(EMPTY)).toEqual({ state: 'ran_without_result', headline: 'Analysis finished without a result' })
  })

  it('CONTROL: a settle that restored the earlier withheld report exports the failure headline', async () => {
    expect(await headlineFor(WITHHELD, true)).toEqual({ state: 'ran_without_result', headline: 'Analysis finished without a result' })
  })
})

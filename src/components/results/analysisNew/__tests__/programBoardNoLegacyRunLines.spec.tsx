/**
 * ON A PROGRAM BOARD NO LEGACY RUN LINE STANDS IN FOR THE PROGRAM'S OWN (old-code census, 27 Oct, DGAI staging 2b8306bf).
 * A program's Run is the host's, on every change, and says itself in CEE's served view. Two legacy surfaces still spoke
 * on a program board, and again while its saved read reloaded after each turn:
 *   · the Reasoning tab's pre-run line, "No analysis has run yet for this model.", when no served view is held;
 *   · the inspector's inline "Re-run to see how this affects the results", decided by the legacy freshness.
 * On a program board, after a turn while the read reloads too, neither shows. CONTRAST: a board that is not a program
 * keeps both.
 * Real path: the real saved-graph read (only `fetch` stubbed), the real core-turn applier, the real `AnalysisNewTabBody`
 * and `useEditConfirmation`. Fixture: CEE's served capacity read (pass 35463f30), each row on its own scenario id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'

vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true), focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useEditConfirmation } from '../../../../canvas/ui/inspector-v2/useEditConfirmation'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { applyCoreTurnState } from '../../../../v5/applyCoreTurn'
import { useSavedModelProgramState } from '../../../../canvas/nodes/shared/savedModelProgram'
import { openStrategicChallenge } from './analysisNewFixtures'
import capacity from '../../../../canvas/runView/__tests__/fixtures/pass-capacity-35463f30-read.json'

type Json = Record<string, any>
const LEGACY_PRE_RUN = 'No analysis has run yet for this model.'
let read: Json = {}
let hang = false
let n = 0
const nextHash = () => { n += 1; return `${String(capacity.graph_hash).slice(0, 12)}${String(n).padStart(4, '0')}` }

/** The board on screen (pre-run: no report held, no served view), its saved read answering as given. */
function board(program: boolean) {
  const scenarioId = crypto.randomUUID()
  const living = program ? capacity.graph.living_model : { aims: [], links: [], factors: [], options: [] }
  read = { ...capacity, scenario_id: scenarioId, graph_hash: nextHash(), graph: { ...capacity.graph, living_model: living } }
  useCanvasStore.setState({
    currentScenarioId: scenarioId,
    lastServerGraphHash: read.graph_hash,
    nodes: capacity.graph.nodes.map((x: Json, i: number) => ({ id: x.id, type: x.kind, position: { x: 0, y: i * 100 }, data: { label: x.label } })),
    edges: [],
    goalThreshold: null,
    results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
    // The legacy freshness says the result is not current, so a legacy surface would ask for a Re-run.
    analysisFreshness: { freshness: 'stale', freshnessReason: 'graph_changed', computedAt: 1 },
    analysisFreshnessDirty: true,
  } as never)
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })
/** A core turn that saved a new revision, through the real applier; its re-read has not answered. */
async function turnWhileReloading() {
  hang = true
  const revision = nextHash()
  act(() => {
    applyCoreTurnState({ model: { revision, graph: { nodes: [] } }, notes: [], analysis_state: null } as never, useCanvasStore.getState() as never)
  })
  expect(useCanvasStore.getState().lastServerGraphHash).toBe(revision)
  await settle()
}
const graphReads = () => vi.mocked(fetch).mock.calls.filter(([u]) => String(u).endsWith(`/scenarios/${read.scenario_id}/graph`)).length

async function reasoning() {
  render(<AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
    blockedListing={null} canRunAnalysis onReanalyse={() => {}} />)
  await settle()
  expect(graphReads()).toBe(1)
}

beforeEach(() => {
  hang = false
  useStrengthenStore.setState({ records: {} })
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!/\/scenarios\/[^/]+\/graph$/.test(String(url))) return new Response('{}', { status: 404 })
    if (hang) return new Promise<Response>(() => {})
    return new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/')
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

describe('the Reasoning tab’s pre-run line', () => {
  it('a program board with no served view says no legacy line, and still none after a turn while the read reloads', async () => {
    board(true)
    await reasoning()
    expect(screen.queryByTestId('analysis-new-status-pre-run')).toBeNull()
    expect(screen.queryByText(LEGACY_PRE_RUN)).toBeNull()

    await turnWhileReloading()
    expect(graphReads()).toBe(2)
    expect(screen.queryByTestId('analysis-new-status-pre-run')).toBeNull()
    expect(screen.queryByText(LEGACY_PRE_RUN)).toBeNull()
  })

  it('CONTRAST: a board that is not a program keeps its pre-run line', async () => {
    board(false)
    await reasoning()
    expect(screen.getByTestId('analysis-new-status-pre-run')).toHaveTextContent(LEGACY_PRE_RUN)
  })
})

describe('the inspector’s inline Re-run prompt after an edit', () => {
  /** The panel's hook beside the board's program state, so the saved read is made and answered with or without the fix. */
  async function editConfirmed(state: 'program' | 'not_program') {
    const hook = renderHook(() => ({ ...useEditConfirmation(), state: useSavedModelProgramState() }))
    await settle()
    expect(graphReads()).toBe(1)
    expect(hook.result.current.state).toBe(state)
    act(() => hook.result.current.confirm('value'))
    return hook
  }

  it('a program board never asks to Re-run from the legacy freshness, after a turn while the read reloads too', async () => {
    board(true)
    const hook = await editConfirmed('program')
    expect(hook.result.current.isStaleAfterEdit).toBe(false)

    await turnWhileReloading()
    expect(graphReads()).toBe(2)
    expect(hook.result.current.isStaleAfterEdit).toBe(false)
  })

  it('CONTRAST: a board that is not a program asks to Re-run after an edit while the result is not current', async () => {
    board(false)
    const hook = await editConfirmed('not_program')
    expect(hook.result.current.isStaleAfterEdit).toBe(true)
  })
})

/**
 * ⭐ ON A PROGRAM BOARD THE LEGACY ANALYSIS COMPOSITION NEVER RUNS (U6, DL 26 Oct: cut at the source). The analysis-truth
 * hooks every surface reads (`useAnalysisState`, `useAnalysisRunState`, the per-edge `useModelChangedSinceRunLight`)
 * answer from CEE's verdict alone there (`composeProgramAnalysisState`); the legacy composition, which folds in the
 * client's own freshness slices, edit overlay, results slice and report, is not called once across load → a core turn
 * → a cold reopen. A legacy (non-program) board still composes the legacy way.
 *
 * Real path: the served program read (`served-program-orders-full-read-20261026.json`) through the real
 * `hydrateCanvasFromServer` and saved-read classifier (only `fetch` stubbed); the turn is CEE's served capacity edit
 * turn through the real `parseCoreTurn` → `applyCoreTurnState`. The contrast (SYNTHETIC, labelled) is the same read
 * with no living model.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { useSavedModelProgramState } from '../../nodes/shared/savedModelProgram'
import { analysisStateComposition, useAnalysisState } from '../analysisStateSelector'
import { useAnalysisRunState } from '../../../components/results/analysisState/useAnalysisRunState'
import { useModelChangedSinceRunLight } from '../../hooks/useModelChangedSinceRun'
import { parseCoreTurn } from '../../../v5/coreTurnContract'
import { applyCoreTurnState } from '../../../v5/applyCoreTurn'
import served from '../../nodes/__tests__/fixtures/served-program-orders-full-read-20261026.json'
import editTurn from '../../conversation/__tests__/fixtures/served-acceptance-capacity-edit-turn-20261026.json'

const NON_PROGRAM_ID = '0b4c2d7e-1111-4222-8333-94445555a012'
/** SYNTHETIC, labelled: the served read with no living model, under its own scenario id (a non-program board). */
const nonProgram = (() => {
  const graph = Object.fromEntries(Object.entries(served.graph).filter(([k]) => k !== 'living_model'))
  return { ...served, scenario_id: NON_PROGRAM_ID, graph_hash: `${served.graph_hash}-np`, graph }
})()

/** The board as it opens (or reopens cold): an empty canvas, then the served read hydrated through the real path. */
async function open(read: { scenario_id: string }, expected: 'program' | 'not_program') {
  useCanvasStore.setState({ currentScenarioId: read.scenario_id, serverGraphIdentity: null, nodes: [], edges: [], analysisStateV1: null } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(read.scenario_id))
  const state = renderHook(() => useSavedModelProgramState())
  await waitFor(() => expect(state.result.current).toBe(expected))
  state.unmount()
}

/** The three analysis-truth readers, as surfaces mount them. */
function Readers({ onRead }: { onRead: (r: { authority: string; runState: string; changed: boolean }) => void }) {
  const composed = useAnalysisState()
  const runState = useAnalysisRunState()
  const changed = useModelChangedSinceRunLight()
  onRead({ authority: composed.authority, runState, changed })
  return null
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })

/** CEE's served capacity edit turn, through the real contract reader and the core applier. */
function applyServedTurn() {
  const turn = parseCoreTurn(editTurn.body)
  expect(turn).not.toBeNull()
  const s = useCanvasStore.getState()
  applyCoreTurnState(turn!, { nodes: s.nodes, setLastServerGraphHash: s.setLastServerGraphHash, setAnalysisStateV1: s.setAnalysisStateV1 })
}

/** Load → a core turn → a cold reopen, with the readers mounted at each step; the last answer read is returned. */
async function journey(read: { scenario_id: string }, expected: 'program' | 'not_program') {
  let last = { authority: '', runState: '', changed: false }
  const onRead = (r: typeof last) => { last = r }
  await open(read, expected)
  render(<Readers onRead={onRead} />)
  await settle()
  act(() => applyServedTurn())
  await settle()
  cleanup()
  await open(read, expected)
  render(<Readers onRead={onRead} />)
  await settle()
  return last
}

let legacy: ReturnType<typeof vi.spyOn>
let program: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  window.history.replaceState(null, '', '/?ai=core-route')
  legacy = vi.spyOn(analysisStateComposition, 'legacy')
  program = vi.spyOn(analysisStateComposition, 'program')
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('the legacy analysis composition on a program board', () => {
  it('a program board: 0 legacy compositions across load → a core turn → a cold reopen; CEE’s verdict answers', async () => {
    await journey(served, 'program')
    expect(legacy).toHaveBeenCalledTimes(0)
    // Positive control: the readers did read, through the program composition.
    expect(program.mock.calls.length).toBeGreaterThan(0)
  })

  it('CONTRAST: a legacy board composes the legacy way once its read says it is not a program', async () => {
    await journey(nonProgram, 'not_program')
    expect(legacy.mock.calls.length).toBeGreaterThan(0)
  })
})

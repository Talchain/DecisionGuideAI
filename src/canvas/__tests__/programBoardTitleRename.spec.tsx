/**
 * ⭐ A PROGRAM BOARD'S CARD TITLE DOES NOT RENAME ON THE CARD (W4 follow-up; spec §3 C13). Confirmed on the real path:
 * a double-click opened the title editor (BaseNode), whose save goes `store.updateNodeLabel` → `structural_rename`, and
 * the core route answers 409 `CANVAS_EDIT_REFUSED` with nothing saved. #3008 gated the inspector's rename; this is the
 * card's. A non-program board keeps the on-card rename.
 *
 * Real path: the served program read (`served-program-orders-full-read-20261026.json`) through the real
 * `hydrateCanvasFromServer` and saved-read classifier (only `fetch` stubbed), then the real `BaseNode` for a board card.
 * `updateNodeLabel` is a spy, so the rows also pin that nothing is sent. The contrast (SYNTHETIC, labelled) is the same
 * read with no living model.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle } from 'lucide-react'

vi.mock('../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../store'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import { useSavedModelProgramState } from '../nodes/shared/savedModelProgram'
import { BaseNode } from '../nodes/BaseNode'
import served from '../nodes/__tests__/fixtures/served-program-orders-full-read-20261026.json'

const FACTOR = 'price_cut'
const NON_PROGRAM_ID = '0b4c2d7e-1111-4222-8333-94445555a007'
/** SYNTHETIC, labelled: the served read with no living model, under its own scenario id (a non-program board). */
const nonProgram = (() => {
  const graph = Object.fromEntries(Object.entries(served.graph).filter(([k]) => k !== 'living_model'))
  return { ...served, scenario_id: NON_PROGRAM_ID, graph_hash: `${served.graph_hash}-np`, graph }
})()

async function board(read: { scenario_id: string }, expected: 'program' | 'not_program') {
  useCanvasStore.setState({ currentScenarioId: read.scenario_id } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(read.scenario_id))
  const state = renderHook(() => useSavedModelProgramState())
  await waitFor(() => expect(state.result.current).toBe(expected))
  state.unmount()
}

let updateNodeLabel: ReturnType<typeof vi.fn>
async function doubleClickTitle() {
  updateNodeLabel = vi.fn()
  useCanvasStore.setState({ updateNodeLabel } as never)
  const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR)!
  render(<ReactFlowProvider>
    <BaseNode {...({ ...node, selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as any)}
      nodeType="factor" icon={Circle} />
  </ReactFlowProvider>)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  fireEvent.doubleClick(screen.getByTestId('node-title'))
  return { editor: screen.queryByTestId('inspector-rename-input'), pencil: screen.queryByTestId('node-title-pencil') }
}

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('a program board: the card title does not rename', () => {
  it('a double-click opens no editor, shows no rename pencil, and sends nothing', async () => {
    await board(served, 'program')
    const { editor, pencil } = await doubleClickTitle()
    expect(editor).toBeNull()
    expect(pencil).toBeNull()
    expect(updateNodeLabel).not.toHaveBeenCalled()
  })
})

describe('CONTRAST: a non-program board keeps the on-card rename', () => {
  it('a double-click opens the editor in place, and Enter commits through store.updateNodeLabel', async () => {
    await board(nonProgram, 'not_program')
    const { editor } = await doubleClickTitle()
    expect(editor).not.toBeNull()
    fireEvent.change(editor!, { target: { value: 'A deeper price cut' } })
    fireEvent.keyDown(editor!, { key: 'Enter' })
    expect(updateNodeLabel).toHaveBeenCalledWith(FACTOR, 'A deeper price cut')
  })
})

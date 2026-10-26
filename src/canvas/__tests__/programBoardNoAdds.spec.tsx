/**
 * ⭐ A PROGRAM BOARD OFFERS NO ADD AND NO LEGACY RUN (U5; ALPHA-CODE-INVENTORY §2.3 finding 5). CEE refuses every canvas
 * edit on a program except a figure or a goal's target, with nothing saved (core-turn.ts, `CANVAS_EDIT_REFUSED`), and a
 * program has no Run control (its host runs the analysis; `programGraphHasNoRunButton`). Delete, rename and connect were
 * already withheld there (#3008); the adds and the palette's Run were not:
 *   · the pane menu's add items, and the sidebar's add door, which opens that same menu (`canAddFromPaneMenu`);
 *   · the decision panel's "Add option";
 *   · the command palette's "Run Analysis" (the legacy validator and run pipeline).
 * A non-program board keeps all of them.
 *
 * Real path: the served program read (`served-program-orders-full-read-20261026.json`) through the real
 * `hydrateCanvasFromServer` and saved-read classifier (only `fetch` stubbed), then the real hook and components. The
 * contrast (SYNTHETIC, labelled) is the same read with no living model.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../store'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import { useSavedModelProgramState } from '../nodes/shared/savedModelProgram'
import { useMenuItems, canAddFromPaneMenu } from '../contextMenu/useMenuItems'
import { InspectorRouter } from '../ui/inspector-v2/InspectorRouter'
import { CommandPalette } from '../components/CommandPalette'
import { ToastProvider } from '../ToastContext'
import served from '../nodes/__tests__/fixtures/served-program-orders-full-read-20261026.json'

const DECISION = 'mp:decision'
const NON_PROGRAM_ID = '0b4c2d7e-1111-4222-8333-94445555a011'
/** SYNTHETIC, labelled: the served read with no living model, under its own scenario id (a non-program board). */
const nonProgram = (() => {
  const graph = Object.fromEntries(Object.entries(served.graph).filter(([k]) => k !== 'living_model'))
  return { ...served, scenario_id: NON_PROGRAM_ID, graph_hash: `${served.graph_hash}-np`, graph }
})()

async function board(read: { scenario_id: string }, expected: 'program' | 'not_program') {
  useCanvasStore.setState({ currentScenarioId: read.scenario_id, serverGraphIdentity: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(read.scenario_id))
  expect(useCanvasStore.getState().nodes.some((n) => n.id === DECISION)).toBe(true)
  const state = renderHook(() => useSavedModelProgramState())
  await waitFor(() => expect(state.result.current).toBe(expected))
  state.unmount()
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })

/** Every menu id, submenus included. */
const idsOf = (entries: unknown): string[] => Array.isArray(entries)
  ? entries.flatMap((e) => [...(typeof e?.id === 'string' ? [e.id] : []), ...idsOf(e?.items ?? e?.children ?? e?.submenu)])
  : []
/** The pane menu's add items, and the sidebar door's judgement, read as the board reads them. */
async function paneAdds() {
  const { result } = renderHook(() => ({
    menu: useMenuItems({ target: { kind: 'pane', screenPos: { x: 10, y: 10 } }, showToast: vi.fn(), screenToFlowPosition: (p: { x: number; y: number }) => p, onClose: vi.fn() } as never),
    door: canAddFromPaneMenu(useSavedModelProgramState() === 'not_program'),
  }))
  await settle()
  return { adds: idsOf(result.current.menu).filter((id) => id.startsWith('add-node')), door: result.current.door }
}
async function decisionAddOption() {
  render(<ReactFlowProvider><ToastProvider><InspectorRouter nodeId={DECISION} edgeId={null} onClose={vi.fn()} /></ToastProvider></ReactFlowProvider>)
  await settle()
  return screen.queryByTestId('decision-add-option') !== null
}
async function paletteRun() {
  render(<ReactFlowProvider><CommandPalette isOpen onClose={vi.fn()} /></ReactFlowProvider>)
  await settle()
  return document.getElementById('cmd-action-run-analysis') !== null
}

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('a program board offers no add and no legacy Run', () => {
  it('the pane menu has no add item, and the sidebar door that opens it is not offered', async () => {
    await board(served, 'program')
    expect(await paneAdds()).toEqual({ adds: [], door: false })
  })

  it('the decision panel has no "Add option"', async () => {
    await board(served, 'program')
    expect(await decisionAddOption()).toBe(false)
  })

  it('the command palette has no "Run Analysis"', async () => {
    await board(served, 'program')
    expect(await paletteRun()).toBe(false)
  })
})

describe('CONTRAST: a non-program board keeps them', () => {
  it('the pane menu offers its adds, and the sidebar door', async () => {
    await board(nonProgram, 'not_program')
    const { adds, door } = await paneAdds()
    expect(adds.length).toBeGreaterThan(0)
    expect(door).toBe(true)
  })

  it('the decision panel offers "Add option"', async () => {
    await board(nonProgram, 'not_program')
    expect(await decisionAddOption()).toBe(true)
  })

  it('the command palette offers "Run Analysis"', async () => {
    await board(nonProgram, 'not_program')
    expect(await paletteRun()).toBe(true)
  })
})

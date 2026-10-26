/**
 * ⭐ A PROGRAM BOARD OFFERS NO DELETE THE SAVED MODEL REFUSES (U-W5, 27 Oct). Served on staging (UI 8f2bdd65, board
 * 5651fd74): Delete from the menu or the key took a card off the canvas and sent `structural_delete`; CEE answered 409
 * `CANVAS_EDIT_REFUSED` with `nothing_saved: true`, and the card came back on reload, so the canvas and the saved model
 * disagreed until then. On a program board (or one whose read has not answered) Delete is withheld with the reason, the
 * same gate as the connected additions (#3004): the menu row is disabled ("ask Olumi"), the key says the reason, and
 * the inspector offers no Remove. A non-program board keeps Delete.
 *
 * Real path: the served read (`served-program-orders-full-read-20261026.json`, its `_source` names the run) through the
 * real `hydrateCanvasFromServer` and the real saved-read classifier (only `fetch` stubbed), then the real `useMenuItems`,
 * `useKeyboardShortcuts` and `InspectorRouter`. Nothing is written: `commitValidatedMutation` is a spy. The contrast
 * (SYNTHETIC, labelled) is the same read with no living model: a non-program board.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'

const { commit } = vi.hoisted(() => ({ commit: vi.fn() }))
vi.mock('../mutations/commitValidatedMutation', () => ({ commitValidatedMutation: commit }))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
vi.mock('../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../store'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import { useSavedModelProgramState } from '../nodes/shared/savedModelProgram'
import { useMenuItems } from '../contextMenu/useMenuItems'
import type { ContextTarget, MenuEntry, MenuItemDef } from '../contextMenu/types'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { InspectorRouter } from '../ui/inspector-v2/InspectorRouter'
import { ToastProvider } from '../ToastContext'
import { CANVAS_STRUCTURAL_EDIT_NOTICE } from '../mutations/mutationAuthority'
import served from '../nodes/__tests__/fixtures/served-program-orders-full-read-20261026.json'

const CARD = 'weak_customer_response'
/** The inspector rows use a factor: its inspector carries the header menu with Remove (a claim card's has none). */
const FACTOR = 'price_cut'
const LINK = 'weekly_orders__reach_order_target'
const NON_PROGRAM_ID = '0b4c2d7e-1111-4222-8333-94445555a002'
/** SYNTHETIC, labelled: the served read with no living model, under its own scenario id (a non-program board). */
const nonProgram = (() => {
  const graph = Object.fromEntries(Object.entries(served.graph).filter(([k]) => k !== 'living_model'))
  return { ...served, scenario_id: NON_PROGRAM_ID, graph_hash: `${served.graph_hash}-np`, graph }
})()

async function board(read: { scenario_id: string }, expected: 'program' | 'not_program') {
  useCanvasStore.setState({ currentScenarioId: read.scenario_id,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  // A repeat read of the same saved graph answers `unchanged`; the board's cards are on the store either way.
  expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(read.scenario_id))
  expect(useCanvasStore.getState().nodes.some((n) => n.id === CARD)).toBe(true)
  // The board's classification, from the same read, before any gesture.
  const state = renderHook(() => useSavedModelProgramState())
  await waitFor(() => expect(state.result.current).toBe(expected))
  state.unmount()
}

const flatten = (entries: MenuEntry[]): MenuItemDef[] => entries.flatMap((e) => ('type' in e ? [] : [e, ...flatten(e.submenuItems ?? [])]))
async function deleteRow(target: ContextTarget) {
  const { result } = renderHook(() => useMenuItems({ target, showToast: vi.fn(), screenToFlowPosition: (p) => p, onClose: vi.fn() }))
  // The menu's own read of the board answers before the row is judged.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  return flatten(result.current).find((e) => e.id === 'delete')
}
const nodeTarget = (): ContextTarget => {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === CARD)!
  return { kind: 'node', nodeId: CARD, nodeType: node.type as never, node, screenPos: { x: 0, y: 0 } } as ContextTarget
}
const edgeTarget = (): ContextTarget => {
  const edge = useCanvasStore.getState().edges.find((e) => e.id === LINK)!
  return { kind: 'edge', edgeId: LINK, edge, isStructural: false, screenPos: { x: 0, y: 0 } } as ContextTarget
}
const multiTarget = (): ContextTarget => ({ kind: 'multi', nodeIds: [CARD], edgeIds: [LINK], screenPos: { x: 0, y: 0 } })

function KeyHost() { useKeyboardShortcuts(); return null }
async function pressBackspaceOn(id: string) {
  render(<KeyHost />)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  useCanvasStore.setState({ selection: { nodeIds: new Set([id]), edgeIds: new Set(), anchorPosition: null } } as never)
  const toasts: string[] = []
  const onToast = (e: Event) => toasts.push((e as CustomEvent<{ message: string }>).detail.message)
  window.addEventListener('topbar:show-toast', onToast)
  await act(async () => {
    fireEvent.keyDown(window, { key: 'Backspace' })
    await new Promise((r) => setTimeout(r, 30))
  })
  window.removeEventListener('topbar:show-toast', onToast)
  return toasts
}
async function inspectorHasRemove() {
  render(<ToastProvider><InspectorRouter nodeId={FACTOR} edgeId={null} onClose={vi.fn()} /></ToastProvider>)
  // The inspector's own read of the board answers first (its header menu exists only where it offers something).
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  const menu = screen.queryByTestId('inspector-header-menu')
  if (menu) fireEvent.click(menu)
  return screen.queryByTestId('inspector-remove') !== null
}

beforeEach(() => {
  window.history.replaceState(null, '', '/?ai=core-route')
  // Records the one delete path being entered; never applies it, so no row leaves the board off its saved read.
  commit.mockReset().mockImplementation(async () => ({ success: true }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('a program board withholds Delete, with its reason', () => {
  it('the menu: a card, a link and a multi-selection each show Delete disabled, "ask Olumi"', async () => {
    await board(served, 'program')
    for (const target of [nodeTarget(), edgeTarget(), multiTarget()]) {
      expect(await deleteRow(target)).toMatchObject({ enabled: false, disabledReason: 'ask Olumi', tooltip: CANVAS_STRUCTURAL_EDIT_NOTICE })
    }
  })

  it('the key: Backspace on a selected card says the reason, and nothing is deleted or sent', async () => {
    await board(served, 'program')
    expect(await pressBackspaceOn(CARD)).toEqual([CANVAS_STRUCTURAL_EDIT_NOTICE])
    expect(commit).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().nodes.some((n) => n.id === CARD)).toBe(true)
  })

  it('the inspector offers no Remove', async () => {
    await board(served, 'program')
    expect(await inspectorHasRemove()).toBe(false)
  })
})

describe('CONTRAST: a non-program board keeps Delete', () => {
  it('the menu: Delete enabled on a card, a link and a multi-selection', async () => {
    await board(nonProgram, 'not_program')
    for (const target of [nodeTarget(), edgeTarget(), multiTarget()]) expect(await deleteRow(target)).toMatchObject({ enabled: true })
  })

  it('the key: Backspace deletes through the one delete path', async () => {
    await board(nonProgram, 'not_program')
    expect(await pressBackspaceOn(CARD)).not.toContain(CANVAS_STRUCTURAL_EDIT_NOTICE)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('the inspector offers Remove', async () => {
    await board(nonProgram, 'not_program')
    expect(await inspectorHasRemove()).toBe(true)
  })
})

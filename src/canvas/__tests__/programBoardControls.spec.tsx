/**
 * ⭐ A PROGRAM BOARD OFFERS ONLY CONTROLS A PROGRAM FILLS (spec §3, C13: "Every enabled control on a program scenario must
 * have a supported program contract; hide or explain controls that do not."). Hidden on a program board, each for its
 * own reason:
 * - the lenses "If it failed" and "What if" (`barLensesFor`): the pre-mortem worksheet comes only from the legacy agent
 *   turn, and CEE's what-if refuses a program as `not_a_core_scenario`. The bar and its L key both skip them;
 * - the inspector's rename, and an option's value editor on its card and in the inspector: the core route refuses any
 *   canvas edit on a program but a factor's figure or a goal's target;
 * - the action bar (`useScenarioActionBar`, which heads the Reasoning tab): CEE ranks it from the legacy analysis.
 * A non-program board keeps all of them.
 *
 * Real path: the served read (`served-program-orders-full-read-20261026.json`) through the real `hydrateCanvasFromServer`
 * and the real saved-read classifier (only `fetch` stubbed), then the real `LensBar`, `useCanvasKeyboardShortcuts`,
 * `InspectorRouter`, `OptionNode`, `OptionPanel` and `useScenarioActionBar`. Nothing is written. The contrast (SYNTHETIC, labelled) is the same read with no living model.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'

vi.mock('../../flags', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), isGraphLensEnabled: () => true }))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  Handle: () => null,
}))
vi.mock('../nodes/shared/NodePopover', () => ({ NodePopover: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../store'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import { useSavedModelProgramState } from '../nodes/shared/savedModelProgram'
import { LensBar } from '../artefacts/LensBar'
import { useCanvasKeyboardShortcuts } from '../hooks/useCanvasKeyboardShortcuts'
import { InspectorRouter } from '../ui/inspector-v2/InspectorRouter'
import { ToastProvider } from '../ToastContext'
import { OptionNode } from '../nodes/OptionNode'
import { OptionPanel } from '../ui/inspector-v2/panels/OptionPanel'
import { useScenarioActionBar } from '../conversation/actionBar/useScenarioActionBar'
import { useActionBarStore } from '../conversation/actionBar/actionBarStore'
import type { ActionBarV1 } from '../conversation/actionBar/actionBarContract'
import { PRE_MORTEM, REVISION } from '../conversation/actionBar/__tests__/actionBarContractExample'
import served from '../nodes/__tests__/fixtures/served-program-orders-full-read-20261026.json'

const FACTOR = 'price_cut'
/** The served option that sets `price_cut` (10 %). */
const OPTION = 'cut_prices'
const NON_PROGRAM_ID = '0b4c2d7e-1111-4222-8333-94445555a003'
/** SYNTHETIC, labelled: the served read with no living model, under its own scenario id (a non-program board). */
const nonProgram = (() => {
  const graph = Object.fromEntries(Object.entries(served.graph).filter(([k]) => k !== 'living_model'))
  return { ...served, scenario_id: NON_PROGRAM_ID, graph_hash: `${served.graph_hash}-np`, graph }
})()

async function board(read: { scenario_id: string }, expected: 'program' | 'not_program') {
  useCanvasStore.setState({ currentScenarioId: read.scenario_id,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } } as never)
  useCanvasStore.getState().setLens('full')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  // A repeat read of the same saved graph answers `unchanged`; the board's cards are on the store either way.
  expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(read.scenario_id))
  expect(useCanvasStore.getState().nodes.some((n) => n.id === FACTOR)).toBe(true)
  const state = renderHook(() => useSavedModelProgramState())
  await waitFor(() => expect(state.result.current).toBe(expected))
  state.unmount()
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })
async function barLenses() {
  render(<LensBar />)
  await settle()
  return screen.getAllByRole('radio').map((b) => b.getAttribute('data-testid'))
}
function KeyHost() { useCanvasKeyboardShortcuts(); return null }
async function lensAfterL(from: 'rests_on') {
  render(<KeyHost />)
  await settle()
  useCanvasStore.getState().setLens(from)
  fireEvent.keyDown(window, { key: 'l' })
  return useCanvasStore.getState().lens.active
}
async function inspectorTitleRenames() {
  render(<ToastProvider><InspectorRouter nodeId={FACTOR} edgeId={null} onClose={vi.fn()} /></ToastProvider>)
  await settle()
  return screen.queryByTestId('inspector-rename-trigger') !== null
}

async function optionValueEditors() {
  const option = useCanvasStore.getState().nodes.find((n) => n.id === OPTION)!
  render(<ReactFlowProvider>
    <OptionNode type="option" position={{ x: 0, y: 0 }} selected={false} isConnectable
      positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0}
      deletable selectable draggable id={OPTION} data={option.data} {...({} as any)} />
    <OptionPanel nodeId={OPTION} techMode onClose={() => {}} onNavigate={() => {}} />
  </ReactFlowProvider>)
  await settle()
  return {
    card: screen.queryByTestId(`option-value-editor-${OPTION}-${FACTOR}`) !== null,
    // Technical detail: where this row's field is drawn whenever the row may edit.
    inspector: screen.getByTestId(`inspector-intervention-${FACTOR}`).querySelector('input') !== null,
  }
}
async function actionBarShown() {
  const bar = { v: 1, state_key: 'state-1', revision: REVISION, priority: [PRE_MORTEM], standard: [], more: [] } as unknown as ActionBarV1
  useActionBarStore.setState({ bar, scenarioId: useCanvasStore.getState().currentScenarioId } as never)
  const { result } = renderHook(() => useScenarioActionBar())
  await settle()
  return result.current !== null
}

const ALL = ['full', 'tradeoffs', 'rests_on', 'premortem', 'what_changes', 'what_if'].map((l) => `lens-bar-${l}`)

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('a program board hides the controls a program has no contract for', () => {
  it('the lens bar: no "If it failed" and no "What if"', async () => {
    await board(served, 'program')
    expect(await barLenses()).toEqual(['lens-bar-full', 'lens-bar-tradeoffs', 'lens-bar-rests_on', 'lens-bar-what_changes'])
  })

  it('the L key: from Rests on it wraps to Model (no Run, so "What would change" waits), never to a hidden lens', async () => {
    await board(served, 'program')
    expect(await lensAfterL('rests_on')).toBe('full')
  })

  it('the inspector: the title is read-only, with no rename', async () => {
    await board(served, 'program')
    expect(await inspectorTitleRenames()).toBe(false)
    expect(screen.getAllByText(useCanvasStore.getState().nodes.find((n) => n.id === FACTOR)!.data.label as string).length).toBeGreaterThan(0)
  })

  it("an option's values: text on the card and in the inspector, with no editor", async () => {
    await board(served, 'program')
    expect(await optionValueEditors()).toEqual({ card: false, inspector: false })
  })

  it('the action bar that heads the Reasoning tab: none', async () => {
    await board(served, 'program')
    expect(await actionBarShown()).toBe(false)
  })
})

describe('CONTRAST: a non-program board is unchanged', () => {
  it('the lens bar: all six lenses', async () => {
    await board(nonProgram, 'not_program')
    expect(await barLenses()).toEqual(ALL)
  })

  it('the L key: from Rests on it goes to If it failed', async () => {
    await board(nonProgram, 'not_program')
    expect(await lensAfterL('rests_on')).toBe('premortem')
  })

  it('the inspector: the title renames', async () => {
    await board(nonProgram, 'not_program')
    expect(await inspectorTitleRenames()).toBe(true)
  })

  it("an option's values: editable on the card and in the inspector", async () => {
    await board(nonProgram, 'not_program')
    expect(await optionValueEditors()).toEqual({ card: true, inspector: true })
  })

  it('the action bar: shown', async () => {
    await board(nonProgram, 'not_program')
    expect(await actionBarShown()).toBe(true)
  })
})

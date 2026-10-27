/**
 * On a program board every option with a stated setting shows its figure, the same way (Paul's test, 27 Oct, hiring
 * brief, UI fd3da3fd). "Hire a tech lead" read "Tech leads hired … Increases" while "Hire two developers" read
 * "0 → 2 developer", though the saved model holds both settings as figures (1 tech lead, 2 developers). The card read
 * the 1 as a 0–1 model-scale number and withheld it; a program's values are figures in their own units.
 *
 * Real path: CEE's served hiring read (`accept3-hiring-r1-read.json`, its `_source` names the run) through the real
 * `hydrateCanvasFromServer` and the real saved-graph read (only `fetch` stubbed), then the real `OptionNode`. Rows are
 * found by option and factor id; the inspector (the deployed `InspectorModal` chain) reads the same target as the card.
 * CONTROLS: the two-developer option reads as before, and the same read with no `model_program` keeps today's
 * model-scale reading.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null, useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../conversation/ConversationContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()), useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }),
}))

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { OptionNode } from '../OptionNode'
import { InspectorModal } from '../../components/InspectorModal'
import hiring from '../../runView/__tests__/fixtures/accept3-hiring-r1-read.json'

type Json = Record<string, any>
// The saved-graph read is cached per scenario and hash, so each board reads its own hash.
let n = 0
async function openBoard(board: Json) {
  n += 1
  const read = { ...board, graph_hash: `${board.graph_hash}${n}` }
  useCanvasStore.setState({ currentScenarioId: board.scenario_id, nodes: [], edges: [], lastServerGraphHash: null, lastAuthoritativeGraph: null } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  await act(async () => { await hydrateCanvasFromServer(board.scenario_id) })
}

async function card(id: string) {
  const node = useCanvasStore.getState().nodes.find((x) => x.id === id)
  expect(node, `option ${id} hydrated`).toBeTruthy()
  // ReactFlow's NodeProps needs fields no assertion here reads; the sibling node specs cast the same way.
  const props = { id, type: node!.type, data: node!.data, position: { x: 0, y: 0 }, selected: false, isConnectable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as any
  render(<ReactFlowProvider><OptionNode {...props} /></ReactFlowProvider>)
  // The saved-graph read has answered before anything asserts.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const before = (option: string, factor: string) => screen.queryByTestId(`option-change-row-before-${option}-${factor}`)?.textContent ?? null
const target = (option: string, factor: string) => screen.getByTestId(`option-change-row-target-${option}-${factor}`).textContent

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('a program option states its setting as a figure', () => {
  it('"Hire a tech lead" (tech_leads_added: value 1, unit tech_lead) reads "0 → 1 tech lead", never "Increases"', async () => {
    await openBoard(hiring)
    await card('hire_tech_lead')
    expect(before('hire_tech_lead', 'tech_leads_added')).toBe('0')
    expect(target('hire_tech_lead', 'tech_leads_added')).toBe('1 tech lead')
    expect(screen.getByTestId('option-change-row-value-hire_tech_lead-tech_leads_added').textContent).not.toContain('Increases')
  })

  it('CONTROL: "Hire two developers" (developers_added: value 2) still reads "0 → 2 developer"', async () => {
    await openBoard(hiring)
    await card('hire_two_developers')
    expect(before('hire_two_developers', 'developers_added')).toBe('0')
    expect(target('hire_two_developers', 'developers_added')).toBe('2 developer')
  })
})

describe('the inspector says what the card says', () => {
  it('"Hire a tech lead" in the inspector: the tech-lead target reads "1 tech lead"', async () => {
    await openBoard(hiring)
    const { container } = render(<InspectorModal nodeId="hire_tech_lead" edgeId={null} onClose={vi.fn()} />)
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    const dialog = container.querySelector('div[role="dialog"][aria-label="Node inspector"]') as HTMLElement
    expect(dialog).not.toBeNull()
    const row = within(dialog).getByTestId('inspector-intervention-tech_leads_added')
    expect(within(row).getByTestId('intervention-readout-tech_leads_added').textContent).toBe('This option sets 1 tech lead')
  })
})

describe('CONTROL: a board that is not a program keeps the model-scale reading', () => {
  it('the same read with no model_program: the tech-lead setting still reads "Increases", with no figure', async () => {
    const graph = hiring.graph as Json
    await openBoard({ ...hiring, graph: { ...graph, living_model: { ...graph.living_model, model_program: undefined } } })
    await card('hire_tech_lead')
    expect(before('hire_tech_lead', 'tech_leads_added')).toBeNull()
    expect(target('hire_tech_lead', 'tech_leads_added')).toBe('Increases')
  })
})

// CEE #3859: an option change that starts later carries `from_period_display` on its intervention; the row says it
// after the target. SYNTHETIC, labelled: the served read with that one field added in #3859's shape.
describe('a program option says when its change starts', () => {
  const later = (() => {
    const graph = structuredClone(hiring.graph) as Json
    const node = graph.nodes.find((x: Json) => x.id === 'hire_tech_lead')
    node.interventions.tech_leads_added = { ...node.interventions.tech_leads_added, from_period: 1, from_period_display: 'after 1 month' }
    return { ...hiring, graph }
  })()
  const starts = () => screen.queryByTestId('option-change-row-starts-hire_tech_lead-tech_leads_added')

  it('"Hire a tech lead" starting a month in reads "1 tech lead after 1 month"', async () => {
    await openBoard(later)
    await card('hire_tech_lead')
    expect(target('hire_tech_lead', 'tech_leads_added')).toBe('1 tech lead')
    expect(starts()?.textContent).toBe(' after 1 month')
  })

  it('CONTROL: the served read (no start delay) says no start', async () => {
    await openBoard(hiring)
    await card('hire_tech_lead')
    expect(target('hire_tech_lead', 'tech_leads_added')).toBe('1 tech lead')
    expect(starts()).toBeNull()
  })
})

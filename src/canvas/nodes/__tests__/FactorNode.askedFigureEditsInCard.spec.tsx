/**
 * AN ASKED FIGURE IS TYPED WHERE IT IS SHOWN (DL, 23 Oct). On a program graph (`model_program` "v1"), CEE marks a figure
 * only the person can give with `value_basis` "Waiting for your answer". The card showed those words with no field, while
 * the structure-fixed switches beside it were editable. The asked figure now opens the same in-card field as a missing
 * value (`NodeValueEditor` → `useModelEditAuthority.proposeFactorValue` → `factor_value_edit`, the existing write), and
 * a board that is not a program graph is unchanged.
 *
 * DL ruling (23 Oct, later): the structure-fixed switches ("Fixed by how the model is built") have NO field on a program
 * graph. The card says the figure is fixed, and editing an option's switch count changes what the option means; a
 * known figure on the same board keeps its field.
 *
 * ⛔ ONLY IN ITS OWN UNIT. The served asked node carries no unit (the quantity's "GBP/developer" is in
 * `living_model.canonical` only), and a unitless field reads the 0–1 model scale: it refused "45000" and would have saved
 * "0.4" as the cost. So the field opens only where the node carries the unit; row 1 adds it to the served node, as the
 * read would once the quantity's unit is projected (S3), and row 2 is the served node as it is today.
 *
 * Driven through the real path (as `FactorNode.inCardEditRealPath.spec.tsx`): the real `hydrateCanvasFromServer` read,
 * the real saved-graph read for the program flag, the real `ConversationProvider` and buffered transport (stubbed
 * global `fetch`). Fixture: CEE's served hiring read (S3 smoke-alpha3, the real read route), trimmed to its nodes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import hiring from '../../runView/__tests__/fixtures/alpha3-hiring-r1-read.json'
import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import { OutcomeNode } from '../OutcomeNode'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { useValuePrefillStore } from '../../graphChanges/valuePrefill'

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
}))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))

type Json = Record<string, any>
const ASKED = 'developer_hiring_cost'
const SWITCH = 'developers_hired'
/** A figure the brief states (`current_developers`, 6, from the brief): the person's to change. */
const KNOWN = 'current_developers'

let read: Json = {}
let sent: Json[] = []
// The saved-graph read is cached per scenario and hash, so each board reads its own hash.
let n = 0
/** The board as it opens: CEE's read, with the given living model, through the real read path; later reads serve it too. */
async function openBoard(livingModel: Json, askedUnit: string | null = null, patch: (x: Json) => Json = x => x) {
  n += 1
  // The asked quantity's unit on its node (`living_model.canonical.quantities[developer_hiring_cost].unit` as served).
  const nodes = (hiring.graph.nodes as Json[]).map(x => x.id === ASKED && askedUnit ? { ...x, observed_state: { unit: askedUnit } } : x).map(patch)
  read = { ...hiring, graph_hash: `${hiring.graph_hash}${n}`, graph_present: true, graph: { ...hiring.graph, nodes, living_model: livingModel } }
  useCanvasStore.setState({
    nodes: [], edges: [], currentScenarioId: hiring.scenario_id, results: { status: 'idle' } as never,
    lastServerGraphHash: null, lastAuthoritativeGraph: null, analysisFreshness: null, analysisStateV1: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (/\/scenarios\/[^/]+\/graph/.test(String(input))) {
      return new Response(JSON.stringify(read), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (init?.method === 'POST' && init.body) sent.push(JSON.parse(String(init.body)))
    return new Response(JSON.stringify({ assistant_text: '', cards: [], notes: [], run: null, model: null }), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
  await act(async () => { await hydrateCanvasFromServer(hiring.scenario_id) })
}

async function card(id: string, Card: typeof FactorNode | typeof OutcomeNode = FactorNode) {
  const node = useCanvasStore.getState().nodes.find(n => n.id === id) as Node
  render(
    <ConversationProvider>
      <ReactFlowProvider>
        <Card
          id={id} type="factor" data={node.data as never} selected={false} isConnectable
          positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable
        />
      </ReactFlowProvider>
    </ConversationProvider>,
  )
  // The saved-graph read (the program flag) has answered before anything asserts.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
  sent = []
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

const PROGRAM = { model_program: 'v1' }
const NOT_PROGRAM = { aims: [], links: [], factors: [], options: [] }
const graphReads = () => vi.mocked(fetch).mock.calls.filter(([u]) => /\/scenarios\/[^/]+\/graph/.test(String(u))).length

describe('an asked figure on a program graph', () => {
  it('⭐ with its unit: the no-figure dash opens the card’s field, and the figure goes out as one factor_value_edit in that unit', async () => {
    await openBoard(PROGRAM, 'GBP/developer')
    await card(ASKED)
    const value = screen.getByTestId(`node-value-editor-${ASKED}`)
    // Decision 2 A (Paul, 26 Oct): the card shows the dash; CEE's words live on the hourglass beside it.
    expect(value).toHaveTextContent('—')
    expect(value).not.toHaveTextContent('Waiting for your answer')
    fireEvent.click(value)
    fireEvent.doubleClick(screen.queryByTestId(`node-value-editor-${ASKED}`) ?? value)
    const input = screen.getByTestId(`node-value-editor-${ASKED}-input`)
    fireEvent.change(input, { target: { value: '45000' } })
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]).toMatchObject({ kind: 'system_event', scenario_id: hiring.scenario_id })
    expect(sent[0].event).toEqual({ kind: 'factor_value_edit', target_id: ASKED, field: 'value', value: 45000, raw_value: 45000, unit: 'GBP/developer' })
  })

  it('⭐ the result’s "Waits on" answer opens this card’s field, empty, through the existing open request (valuePrefill)', async () => {
    await openBoard(PROGRAM, 'GBP/developer')
    await card(ASKED)
    expect(screen.queryByTestId(`node-value-editor-${ASKED}-input`)).toBeNull()
    await act(async () => { useValuePrefillStore.getState().requestPrefill({ nodeId: ASKED, text: '' }) })
    const input = screen.getByTestId(`node-value-editor-${ASKED}-input`) as HTMLInputElement
    expect(input.value).toBe('')
    // The request is retired once the field has opened, so a remount never re-opens it.
    expect(useValuePrefillStore.getState().request).toBeNull()
    fireEvent.change(input, { target: { value: '45000' } })
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].event).toEqual({ kind: 'factor_value_edit', target_id: ASKED, field: 'value', value: 45000, raw_value: 45000, unit: 'GBP/developer' })
  })

  it('⛔ the served node with no unit: no field (never the 0–1 model scale for a £ cost), the no-figure dash', async () => {
    await openBoard(PROGRAM)
    await card(ASKED)
    expect(graphReads()).toBeGreaterThan(1)
    expect(screen.getByTestId('factor-recorded-value')).toHaveTextContent('—')
    expect(screen.queryByTestId(`node-value-editor-${ASKED}`)).toBeNull()
  })

  it('⭐ the waiting card names its own mark: CEE’s words and the asked glyph, with no invented figure or author', async () => {
    // Codex on #2952: the mounted card, not a supplied mark. The served node as it is today.
    await openBoard(PROGRAM)
    await card(ASKED)
    const mark = screen.getByTestId(`factor-value-source-${ASKED}`)
    // Decision 2 A: the hourglass carries CEE's question, so the card never prints it.
    expect(mark).toHaveAttribute('aria-label', 'Budget cost per additional developer: What total cost per new developer would count against your £200,000 budget, including recruitment and employment costs for the period that budget covers?')
    expect(mark.querySelector('.lucide-hourglass')).not.toBeNull()
    expect(mark.querySelector('.lucide-help-circle, .lucide-file-text, .lucide-user-check')).toBeNull()
    const line = screen.getByTestId('factor-recorded-value')
    expect(line).toHaveTextContent('—')
    // The figure slot holds no number: the question's own "£200,000" is on the mark's hover, never on the card.
    expect(screen.getByTestId(`factor-value-whole-${ASKED}`).textContent).toBe('—')
    expect(line.textContent).not.toMatch(/From your brief|Set by you|Source not recorded|Olumi/)
  })

  it('⭐ decision 2 A: the missing figure is a dashed slot, and a program card draws no "working assumption" book', async () => {
    await openBoard(PROGRAM)
    await card(ASKED)
    const slot = screen.getByTestId(`factor-asked-slot-${ASKED}`)
    expect(slot.textContent).toBe('—')
    expect(slot.className).toContain('border-dashed')
    expect(screen.queryByTestId(`factor-working-assumption-mark-${ASKED}`)).toBeNull()
  })

  it('CONTRAST: a board that is not a program keeps the words, no slot, and its "working assumption" book', async () => {
    await openBoard(NOT_PROGRAM)
    await card(ASKED)
    expect(screen.queryByTestId(`factor-asked-slot-${ASKED}`)).toBeNull()
    expect(screen.getByTestId(`factor-working-assumption-mark-${ASKED}`)).toBeTruthy()
  })

  it('DL ruling: the structure-fixed switch has no field on a program graph, and names itself as fixed', async () => {
    await openBoard(PROGRAM, 'GBP/developer')
    await card(SWITCH)
    expect(graphReads()).toBeGreaterThan(1)
    expect(screen.getByTestId('factor-recorded-value')).toHaveTextContent('0 developer')
    expect(screen.queryByTestId(`node-value-editor-${SWITCH}`)).toBeNull()
    // Its own mark, mounted: CEE's words for a figure the model's structure fixes.
    const mark = screen.getByTestId(`factor-value-source-${SWITCH}`)
    expect(mark).toHaveAttribute('aria-label', 'Additional developers hired: Fixed by how the model is built')
    expect(mark.querySelector('.lucide-calculator')).not.toBeNull()
  })

  // Decision 8 A (Paul, 26 Oct): the "=" mark, never "Today:"; with no relation in the read, CEE's words stand in.
  it('an outcome CEE works out but has no figure for: "= —", and the LINE carries CEE’s words (hover, focus, name)', async () => {
    await openBoard(PROGRAM, 'GBP/developer')
    await card('developer_spend', OutcomeNode)
    const line = screen.getByTestId('outcome-recorded-readout')
    expect(line.textContent).toBe('= —')
    expect(line).toHaveAttribute('tabindex', '0')
    expect(line).toHaveAttribute('aria-label', 'No figure yet. Worked out from Additional developers hired and Budget cost per additional developer')
    expect(screen.getByTestId('outcome-recorded-value').textContent).not.toContain('Worked out from')
  })

  it('CONTRAST (Codex r1 on #3034): a board that is not a program keeps "Today: —" and CEE\'s words', async () => {
    await openBoard(NOT_PROGRAM, 'GBP/developer')
    await card('developer_spend', OutcomeNode)
    const line = screen.getByTestId('outcome-recorded-readout')
    expect(line.textContent).toBe('Today: —')
    expect(line).toHaveAttribute('aria-label', 'Today: no figure yet. Worked out from Additional developers hired and Budget cost per additional developer')
    expect(screen.queryByTestId('outcome-worked-out-mark')).toBeNull()
  })

  it('…even when another author mark would win the band (an inferred stamp): the words stay on the line', async () => {
    await openBoard(PROGRAM, 'GBP/developer', (x: Json) => x.id === 'developer_spend' ? { ...x, observed_state: { ...(x.observed_state ?? {}), extractionType: 'inferred' } } : x)
    await card('developer_spend', OutcomeNode)
    expect(screen.getByTestId('outcome-recorded-readout').getAttribute('aria-label'))
      .toContain('Worked out from Additional developers hired and Budget cost per additional developer')
  })

  it('CONTRAST: an outcome with a real figure keeps its figure and its plain readout', async () => {
    await openBoard(PROGRAM, 'GBP/developer', (x: Json) => x.id === 'developer_spend' ? { ...x, display_value: '£25', observed_state: { value: 25, unit: 'GBP' } } : x)
    await card('developer_spend', OutcomeNode)
    const line = screen.getByTestId('outcome-recorded-readout')
    expect(line.textContent).toContain('25')
    expect(line).not.toHaveAttribute('tabindex')
  })

  it('CONTRAST: a known figure on the same program graph keeps its field', async () => {
    await openBoard(PROGRAM, 'GBP/developer')
    await card(KNOWN)
    expect(screen.getByTestId(`node-value-editor-${KNOWN}`)).toHaveTextContent('6 developer')
  })

  it('CONTRAST: on a board that is not a program graph the switch keeps its field', async () => {
    await openBoard(NOT_PROGRAM, 'GBP/developer')
    await card(SWITCH)
    expect(graphReads()).toBeGreaterThan(1)
    expect(screen.getByTestId(`node-value-editor-${SWITCH}`)).toHaveTextContent('0 developer')
  })

  it('CONTRAST: a board that is not a program graph is unchanged: the words, and no field', async () => {
    await openBoard(NOT_PROGRAM, 'GBP/developer')
    await card(ASKED)
    expect(graphReads()).toBeGreaterThan(1)
    expect(screen.getByTestId('factor-recorded-value')).toHaveTextContent('Waiting for your answer')
    expect(screen.queryByTestId(`node-value-editor-${ASKED}`)).toBeNull()
  })
})

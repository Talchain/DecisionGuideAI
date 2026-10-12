/**
 * ⭐ E1b — an option's values are edited ON the option card, through the inspector's own frame and writer
 * (`optionTargetEntry` → `proposeOptionIntervention` → `option_intervention_edit`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'
import { OptionNode } from '../OptionNode'
import { OPTION_INTERVENTION_NEEDS_FRESH_BASE } from '../../ui/inspector-v2/shared/optionInterventionCopy'
import { settleSystemEventSend } from '../../conversation/settleSystemEventSend'
import { SystemEventSendError } from '../../conversation/useConversation'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null }))
vi.mock('../shared/NodePopover', () => ({ NodePopover: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn(() => true) }))
// The served 409 is built with the real `SystemEventSendError`; its module reads the session through this seam.
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

// £ unit with a cap of 100,000: the frame is the factor's own unit, so "£90k" means 0.9 on the model scale.
// The option sets £80k against today's £60k, so the row is a concrete change and shows.
const FACTOR = { id: 'f-cost', type: 'factor', data: { label: 'Annual platform cost', type: 'factor', observedState: { value: 0.6, raw_value: 60000, unit: '£', cap: 100000 } } }
const OPTION = { id: 'opt-a', type: 'option', data: { label: 'Switch vendor', type: 'option', interventions: { 'f-cost': 0.8 } } }
/** What a row replaces in the store (the served nodes, the write base); `storeListeners` hear each replacement. */
let storeOverlay: Record<string, unknown> = {}
const storeListeners = new Set<() => void>()
const makeStoreState = () => ({
  hoveredOptionId: null, nodes: [FACTOR, OPTION], edges: [], ceeAnalysisReady: null, results: { status: 'idle' },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() }, goalThreshold: null,
  goalConstraints: [], setHoveredOption: vi.fn(), viewMode: 'standard', lodRung: 'full', lastServerGraphHash: null,
  ...storeOverlay,
})
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn((selector: (s: unknown) => unknown) => selector(makeStoreState())), {
    getState: () => makeStoreState(),
    subscribe: (listener: () => void) => { storeListeners.add(listener); return () => { storeListeners.delete(listener) } },
  }),
}))
vi.mock('../../layoutStore', () => ({ useLayoutStore: vi.fn((selector: (s: unknown) => unknown) => selector({ layoutNodeWidth: null })) }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({ sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false, predictedOutcome: null,
    valueOfInformation: null, voiRank: null })),
}))
let outcome: 'dispatched' | 'needs_fresh_base' = 'dispatched'
const proposeOptionIntervention = vi.fn((..._args: unknown[]) => outcome)
vi.mock('../../hooks/useModelEditAuthority', async (orig) => ({
  ...(await orig<typeof import('../../hooks/useModelEditAuthority')>()),
  useModelEditAuthority: () => new Proxy({}, { get: (_t, k) => (k === 'proposeOptionIntervention' ? proposeOptionIntervention : () => undefined) }),
}))

const TESTID = 'option-value-editor-opt-a-f-cost'
function renderCard() {
  return render(
    <ReactFlowProvider>
      <OptionNode type="option" position={{ x: 0, y: 0 }} selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable id="opt-a" data={OPTION.data} {...({} as any)} />
    </ReactFlowProvider>,
  )
}
function typeInto(text: string) {
  fireEvent.click(screen.getByTestId(TESTID))
  const input = screen.getByTestId(`${TESTID}-input`) as HTMLInputElement
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
  return input
}
beforeEach(() => { proposeOptionIntervention.mockClear(); outcome = 'dispatched'; storeOverlay = {}; storeListeners.clear() })

describe('an option value is edited on the card', () => {
  it('E1d: the editable value carries its pencil cue (hover/focus of its own named group, never the card\'s)', () => {
    renderCard()
    const control = screen.getByTestId(TESTID)
    const pencil = screen.getByTestId(`${TESTID}-pencil`)
    expect(control.contains(pencil)).toBe(true)
    expect(control.className).toMatch(/(^|\s)group\/edit(\s|$)/)
    expect(pencil.getAttribute('aria-hidden')).toBe('true')
    expect(pencil.querySelector('svg')!.getAttribute('class')).toMatch(/opacity-0 .*group-hover\/edit:opacity-100/)
  })

  it('opens seeded in the factor\'s unit, and "£90k" proposes 0.9 for that factor', () => {
    renderCard()
    fireEvent.click(screen.getByTestId(TESTID))
    expect((screen.getByTestId(`${TESTID}-input`) as HTMLInputElement).value).toBe('80,000')
    expect(screen.getByTestId(`${TESTID}-prefix`).textContent).toBe('£')
    const input = screen.getByTestId(`${TESTID}-input`) as HTMLInputElement
    fireEvent.change(input, { target: { value: '£90k' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(proposeOptionIntervention).toHaveBeenCalledTimes(1)
    expect(proposeOptionIntervention.mock.calls[0][0]).toBe('f-cost')
    expect(proposeOptionIntervention.mock.calls[0][1]).toBeCloseTo(0.9, 9)
  })

  it('the same figure typed again sends nothing', () => {
    renderCard(); typeInto('80000')
    expect(proposeOptionIntervention).not.toHaveBeenCalled()
  })

  it('an unreadable entry is refused on the card with a sentence, and nothing is sent', () => {
    renderCard(); typeInto('lots')
    expect(proposeOptionIntervention).not.toHaveBeenCalled()
    expect(screen.getByTestId(`${TESTID}-input`)).toBeDefined() // stays open with the typed text
  })

  it('a refusal from the writer is said in the inspector\'s words, never shown as saved', () => {
    outcome = 'needs_fresh_base'
    renderCard(); typeInto('70000')
    expect(screen.getByText(OPTION_INTERVENTION_NEEDS_FRESH_BASE)).toBeDefined()
  })
})

/**
 * ⭐ RECOVERY BATCH B — A LOST REPLY, THEN THE SAME VALUE AGAIN (served `live/runs/2026-10-12T001307Z/capacity`, row 7a;
 * UI c5310483, CEE c87608e4). "Add one specialist" 1 → 2: the 200 (graph f246477dd0d5eabf → 909617df4d06d742) was
 * dropped after the server stored 2, so the card kept 1 and the stale base. The user typed 2 again; the retry carried
 * f246477dd0d5eabf and got 409 GRAPH_DIVERGED `stale_base_graph_hash`, and the card said "Not saved. The model kept its
 * previous value; Olumi's reply says why." over a model holding 2, with no reply at all. The nodes and the envelope
 * below are the served bytes.
 */
describe('a retry refused on a moved base reads the saved model before it speaks', () => {
  const OPTION_ID = 'add_one_specialist'
  const FACTOR_ID = 'additional_specialists'
  const SERVED_FACTOR = { id: FACTOR_ID, type: 'factor', data: { label: 'Additional specialists', type: 'factor',
    observedState: { cap: 10, unit: 'specialists', value: 0, source: 'cee_inference', raw_value: 0, declared_scale: 'unit_interval' } } }
  const MATCH = { node_id: FACTOR_ID, confidence: 'high', match_type: 'exact_id' }
  const servedOption = (intervention: Record<string, unknown>) => ({ id: OPTION_ID, type: 'option',
    data: { label: 'Add one specialist', type: 'option', interventions: { [FACTOR_ID]: intervention } } })
  /** reads/04-05-A.json: revision 2, graph f246477dd0d5eabf. */
  const BEFORE = servedOption({ unit: 'specialists', value: 0.1, source: 'brief_extraction', raw_value: 1, target_match: MATCH })
  /** reads/05-05-B.json: revision 3, graph 909617df4d06d742 — the dropped send's write. */
  const STORED_2 = servedOption({ unit: 'specialists', value: 0.2, source: 'user_specified', target_match: MATCH })
  /** turns/03.json `response_body.details`: the retry's 409. */
  const served409 = () => new SystemEventSendError('server', {
    code: 'GRAPH_DIVERGED', conflictCategory: 'stale_base_graph_hash', reason: 'graph_write_conflict', retryable: false,
  })
  const EDITOR = `option-value-editor-${OPTION_ID}-${FACTOR_ID}`
  const word = () => screen.queryByTestId(`${EDITOR}-settlement`)?.textContent ?? null

  function renderServed() {
    storeOverlay = { nodes: [SERVED_FACTOR, BEFORE], lastServerGraphHash: 'f246477dd0d5eabf' }
    render(
      <ReactFlowProvider>
        <OptionNode type="option" position={{ x: 0, y: 0 }} selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
          dragging={false} zIndex={0} deletable selectable draggable id={OPTION_ID} data={BEFORE.data} {...({} as any)} />
      </ReactFlowProvider>,
    )
  }
  /** The user re-enters 2; the writer dispatches, and the served 409 comes back through the real settlement. */
  async function retryRefusedOnTheMovedBase() {
    fireEvent.click(screen.getByTestId(EDITOR))
    const input = screen.getByTestId(`${EDITOR}-input`) as HTMLInputElement
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(proposeOptionIntervention).toHaveBeenCalledTimes(1)
    expect(proposeOptionIntervention.mock.calls[0][0]).toBe(FACTOR_ID)
    expect(proposeOptionIntervention.mock.calls[0][1]).toBeCloseTo(0.2, 12)
    const opts = proposeOptionIntervention.mock.calls[0][2] as { onSendSettled: Parameters<typeof settleSystemEventSend>[1] }
    await act(async () => { settleSystemEventSend(Promise.reject(served409()), opts.onSendSettled); await Promise.resolve() })
  }
  /** The canonical re-read after a proven-no-write 409 (`refusedGraphRefresh`) lands the stored graph and its base. */
  async function savedModelRead(option: unknown, base: string) {
    await act(async () => {
      storeOverlay = { ...storeOverlay, nodes: [SERVED_FACTOR, option], lastServerGraphHash: base }
      storeListeners.forEach(listener => listener())
      await new Promise(resolve => setTimeout(resolve, 5))
    })
  }

  it('RED on c1477a3: the model holds 2, so the card says saved, never "Not saved … kept its previous value"', async () => {
    renderServed()
    await retryRefusedOnTheMovedBase()
    await savedModelRead(STORED_2, '909617df4d06d742')
    expect(word()).toBe('Saved. The model holds this value.')
    expect(screen.queryByText(/kept its previous value/)).toBeNull()
    // A 409 on the retry is the earlier send already applied: nothing is written a second time.
    expect(proposeOptionIntervention).toHaveBeenCalledTimes(1)
  })

  it('says nothing about saving until the saved model has been read', async () => {
    renderServed()
    await retryRefusedOnTheMovedBase()
    expect(word()).toBe('Checking the saved model…')
    expect(screen.queryByText(/^Not saved\./)).toBeNull()
  })

  it('NEGATIVE: a genuine refusal (the saved model holds another value) still says "Not saved"', async () => {
    renderServed()
    await retryRefusedOnTheMovedBase()
    await savedModelRead(servedOption({ unit: 'specialists', value: 0.5, source: 'user_specified', target_match: MATCH }), '49b9f3a7cbaf5338')
    expect(word()).toMatch(/^Not saved\./)
  })
})

/**
 * ⭐ RECOVERY BATCH B — THE CARD READ A STALE ANALYSIS VIEW THROUGH A RELOAD (served `live/runs/2026-10-12T020148Z/capacity`,
 * row 7a; UI 52936df0, CEE c85817f2). After the lost reply the UI's `ceeAnalysisReady` was still the pre-edit view
 * (turns 01–03: `current_graph_hash` 94902edbc47c5776, 0.1, "1 specialists"); the saved graph re-read after the 409, and
 * again on reload, was 175a3ae98f06785f with 0.2. The card said "0 → 1 specialists" while the server held 2.
 */
describe('a stale analysis view never overrides the saved value on the option card', () => {
  const OPTION_ID = 'add_one_specialist'
  const FACTOR_ID = 'additional_specialists'
  const FACTOR = { id: FACTOR_ID, type: 'factor', data: { label: 'Additional specialists', type: 'factor',
    observedState: { cap: 10, unit: 'specialists', value: 0, source: 'cee_inference', raw_value: 0, declared_scale: 'unit_interval' } } }
  /** reads/05-05-B.json: the saved option after the dropped send. */
  const SAVED = { id: OPTION_ID, type: 'option', data: { label: 'Add one specialist', type: 'option', interventions: { [FACTOR_ID]: {
    unit: 'specialists', value: 0.2, source: 'user_specified', target_match: { node_id: FACTOR_ID, confidence: 'high', match_type: 'exact_id' } } } } }
  /** turns/03.json `analysis_ready`: the last view the UI ingested, before the edit. */
  const viewBeforeTheEdit = {
    current_graph_hash: '94902edbc47c5776',
    options: [{ id: OPTION_ID, option_id: OPTION_ID, label: 'Add one specialist', is_baseline: false,
      interventions: { [FACTOR_ID]: 0.1 },
      intervention_details: { [FACTOR_ID]: { display_value: '1 specialists', normalised_value: 0.1, raw_value: 1, unit: 'specialists' } } }],
  }
  const EDITOR = `option-value-editor-${OPTION_ID}-${FACTOR_ID}`
  function renderWith(savedBase: string) {
    storeOverlay = { nodes: [FACTOR, SAVED], ceeAnalysisReady: viewBeforeTheEdit, lastServerGraphHash: savedBase }
    render(
      <ReactFlowProvider>
        <OptionNode type="option" position={{ x: 0, y: 0 }} selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
          dragging={false} zIndex={0} deletable selectable draggable id={OPTION_ID} data={SAVED.data} {...({} as any)} />
      </ReactFlowProvider>,
    )
  }

  it('RED on 84c7d3a: the saved graph moved on (175a3ae…), so the card shows the saved 2, never the view\'s 1', () => {
    renderWith('175a3ae98f06785f')
    const resting = screen.getByTestId(EDITOR).textContent ?? ''
    expect(resting).toMatch(/\b2 specialists\b/)
    expect(resting).not.toMatch(/\b1 specialists\b/)
    fireEvent.click(screen.getByTestId(EDITOR))
    expect((screen.getByTestId(`${EDITOR}-input`) as HTMLInputElement).value).toBe('2')
  })

  it('NEGATIVE: a CURRENT view keeps the existing rule (a different value keeps the producer\'s entry)', () => {
    renderWith('94902edbc47c5776')
    expect(screen.getByTestId(EDITOR).textContent ?? '').toMatch(/\b1 specialists\b/)
  })
})

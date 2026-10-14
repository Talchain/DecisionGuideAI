/** EDIT-UX 3b-ii: inspector links use the canvas gesture, then finish the edit. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { pickerToast } = vi.hoisted(() => ({ pickerToast: vi.fn() }))
vi.mock('../../../ToastContext', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useShowToastSafe: () => pickerToast,
}))
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'

const { reportManualEdit, proposeForDrawnLink } = vi.hoisted(() => ({
  reportManualEdit: vi.fn(),
  proposeForDrawnLink: vi.fn(() => 'sent'),
}))
vi.mock('../../../editNotes/editNoteStore', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  reportManualEdit,
}))
vi.mock('../../../conversation/drawnLinkProposal', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  proposeForDrawnLink,
}))
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import { CONNECTION_REFUSAL_COPY, useConnectGesture } from '../../../hooks/useConnectGesture'
import { USER_EDGE_DEFAULTS } from '../../../domain/edges'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../../utils/openEdgeStrengthEditor'
import { __resetViewerModeForTests, setViewerScenario } from '../../../../lib/viewerMode'

const OPTION = 'opt_expand'
const NEW_FACTOR = 'fac_budget'
const ALREADY_SET = 'fac_staff'
const ALREADY_LINKED = 'fac_training'
const SOURCE = 'fac_source'
const TARGET = 'out_growth'
const QUESTION = 'dec_strategy'
const CREATED_EDGE = 'edge-same-fixture'
const initialState = useCanvasStore.getInitialState()
const addEdge = vi.fn(initialState.addEdge)
const createEdgeId = vi.fn(() => CREATED_EDGE)
const showToast = vi.fn()
const originalFetch = globalThis.fetch

function node(id: string, kind: string, label: string, extra: Record<string, unknown> = {}) {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...extra } }
}

function factor(id: string, label: string, category = 'controllable') {
  return node(id, 'factor', label, {
    category,
    observedState: { value: 0.2, raw_value: 200, unit: '£', cap: 1000 },
  })
}

function seed() {
  // Reset the complete state for the identity row: both paths see the same
  // graph, ID owner, history, capture queue and timestamp.
  useCanvasStore.setState({
    ...initialState,
    addEdge,
    createEdgeId,
    nodes: [
      node(OPTION, 'option', 'Expand the team', {
        interventions: { [ALREADY_SET]: { value: 0.2, source: 'user_specified' } },
      }),
      factor(NEW_FACTOR, 'Budget'),
      factor(ALREADY_SET, 'Existing staff'),
      factor(ALREADY_LINKED, 'Training'),
      factor(SOURCE, 'Capacity', 'external'),
      factor('fac_observable', 'Satisfaction', 'observable'),
      node(TARGET, 'outcome', 'Growth'),
      node('risk_delivery', 'risk', 'Delivery risk'),
      node('goal_delivery', 'goal', 'Delivery goal'),
      node(QUESTION, 'decision', 'Which strategy?'),
    ] as never[],
    edges: [
      { id: 'existing-value-link', source: OPTION, target: ALREADY_SET, data: {} },
      { id: 'existing-empty-link', source: OPTION, target: ALREADY_LINKED, data: {} },
    ] as never[],
    results: { status: 'idle', report: null },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
    lastServerGraphHash: null,
    lastAuthoritativeGraph: null,
    currentScenarioId: null,
    pendingStructuralAddEdges: [],
  } as never, true)
}

const mount = (id = OPTION) => render(<InspectorRouter nodeId={id} edgeId={null} onClose={vi.fn()} />)
const factorPicker = () => screen.getByRole('combobox', { name: 'Choose a factor it changes' })
const connectionPicker = () => screen.getByRole('combobox', { name: 'Connect to…' })
const offeredIds = (picker: HTMLElement) => within(picker).queryAllByRole('option')
  .map(option => (option as HTMLOptionElement).value).filter(Boolean)

async function choose(picker: HTMLElement, target: string) {
  await act(async () => { fireEvent.change(picker, { target: { value: target } }) })
}

beforeEach(() => {
  __resetViewerModeForTests()
  vi.spyOn(Date, 'now').mockReturnValue(1791417600000)
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00112233-4455-4677-8899-aabbccddeeff')
  addEdge.mockClear()
  createEdgeId.mockClear()
  reportManualEdit.mockReset()
  proposeForDrawnLink.mockClear()
  showToast.mockClear()
  seed()
})
afterEach(() => {
  cleanup()
  __resetViewerModeForTests()
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('Option — choose the factor it changes', () => {
  it('offers only controllable factors that this option does not already change', () => {
    mount()
    expect(offeredIds(factorPicker())).toEqual([NEW_FACTOR])
    expect(within(factorPicker()).queryByRole('option', { name: 'Existing staff' })).toBeNull()
    expect(within(factorPicker()).queryByRole('option', { name: 'Training' })).toBeNull()
    expect(within(factorPicker()).queryByRole('option', { name: 'Capacity' })).toBeNull()
    expect(within(factorPicker()).queryByRole('option', { name: 'Satisfaction' })).toBeNull()
    console.info('INSPECTOR_CONNECT_OPTION_CANDIDATES', JSON.stringify({
      optionId: OPTION, offeredFactorIds: offeredIds(factorPicker()),
      excludedFactorIds: [ALREADY_SET, ALREADY_LINKED, SOURCE, 'fac_observable'],
      pickerDOM: factorPicker().outerHTML,
    }))
  })

  it('choosing one reaches the shared add exactly once with option → factor and no value write', async () => {
    mount()
    await choose(factorPicker(), NEW_FACTOR)
    expect(addEdge).toHaveBeenCalledTimes(1)
    expect(addEdge).toHaveBeenCalledWith({
      source: OPTION, target: NEW_FACTOR, sourceHandle: null, targetHandle: null,
      data: USER_EDGE_DEFAULTS,
    })
    expect(reportManualEdit).toHaveBeenCalledTimes(1)
    expect(useCanvasStore.getState().nodes.find(n => n.id === OPTION)?.data.interventions)
      .toEqual({ [ALREADY_SET]: { value: 0.2, source: 'user_specified' } })
    expect(proposeForDrawnLink).toHaveBeenCalledTimes(1)
    expect(proposeForDrawnLink).toHaveBeenCalledWith(CREATED_EDGE)
  })

  it('identity: picker and drag report deep-equal structural_add_edge payloads on the same fixture', async () => {
    mount()
    await choose(factorPicker(), NEW_FACTOR)
    expect(reportManualEdit).toHaveBeenCalledTimes(1)
    const pickerPayload = reportManualEdit.mock.calls[0][0]
    expect(pickerPayload.edit).toEqual({ kind: 'structural_add_edge', elementId: CREATED_EDGE, accepted: true })
    cleanup()
    seed()
    reportManualEdit.mockClear()
    const { result } = renderHook(() => useConnectGesture({ enabled: true, showToast }))
    act(() => result.current.onConnect({
      source: OPTION, target: NEW_FACTOR, sourceHandle: null, targetHandle: null,
    }))
    expect(reportManualEdit).toHaveBeenCalledTimes(1)
    expect(reportManualEdit.mock.calls[0][0]).toEqual(pickerPayload)
    console.info('INSPECTOR_CONNECT_PAYLOAD_IDENTITY', JSON.stringify({
      pair: { source: OPTION, target: NEW_FACTOR }, edit: pickerPayload.edit,
      beforeEdges: pickerPayload.before.edges.map((e: { id: string }) => e.id),
      afterEdges: pickerPayload.after.edges.map((e: { id: string }) => e.id),
      deepEqual: true,
    }))
  })

  it('focuses the linked factor’s empty target box', async () => {
    mount()
    await choose(factorPicker(), NEW_FACTOR)
    const target = within(screen.getByTestId(`inspector-intervention-${NEW_FACTOR}`)).getByRole('textbox')
    await waitFor(() => expect(target).toHaveFocus())
    expect(target).toBeEnabled()
    expect(target).toHaveValue('')
    console.info('INSPECTOR_CONNECT_TARGET_FOCUS', JSON.stringify({
      optionId: OPTION, factorId: NEW_FACTOR,
      activeAriaLabel: document.activeElement?.getAttribute('aria-label'),
      value: (target as HTMLInputElement).value,
      disabled: target.matches(':disabled'),
      activeIsTarget: document.activeElement === target,
      targetDOM: target.outerHTML,
    }))
  })

  it('model-scale factor: keeps the route note visible and does not focus a hidden technical field', async () => {
    useCanvasStore.setState(state => ({ nodes: state.nodes.map(n => n.id === NEW_FACTOR
      ? { ...n, data: { ...n.data, observedState: { value: 0.2, raw_value: 20 } } } : n) }))
    mount()
    const picker = factorPicker()
    picker.focus()
    await choose(picker, NEW_FACTOR)
    expect(within(screen.getByTestId(`inspector-intervention-${NEW_FACTOR}`)).queryByRole('textbox')).toBeNull()
    expect(screen.getByTestId('option-target-edit-route')).toBeVisible()
    expect(document.activeElement).not.toHaveAttribute('data-testid', `inspector-intervention-${NEW_FACTOR}`)
    expect(document.activeElement?.tagName).not.toBe('INPUT')
    fireEvent.click(screen.getByTestId('inspector-more-toggle'))
    expect(screen.getByTestId('inspector-authority-notice'))
      .toHaveTextContent('Description and advanced editor fields here are read-only for now.')
    fireEvent.click(screen.getByRole('button', { name: 'Show technical detail' }))
    expect(within(screen.getByTestId(`inspector-intervention-${NEW_FACTOR}`)).getByRole('textbox'))
      .toBeEnabled()
  })
})

describe('Connections — the drag validator owns available pairs', () => {
  it.each([
    ['controllable factor', NEW_FACTOR], ['external factor', SOURCE],
    ['observable factor', 'fac_observable'], ['risk', 'risk_delivery'],
    ['outcome', TARGET], ['goal', 'goal_delivery'],
  ])('%s offers only valid outgoing pairs, and excludes Question links and itself', (_kind, id) => {
    mount(id)
    const offered = offeredIds(connectionPicker())
    const { result } = renderHook(() => useConnectGesture({ enabled: true, showToast }))
    expect(offered.length).toBeGreaterThan(0)
    for (const target of offered) expect(result.current.isValidConnection({ source: id, target })).toBe(true)
    expect(offered).not.toContain(id)
    expect(offered).not.toContain(QUESTION)
  })

  it('contrast: the same pair is omitted as a duplicate and offered when the duplicate is removed', () => {
    useCanvasStore.setState(state => ({ edges: [...state.edges,
      { id: 'duplicate', source: SOURCE, target: TARGET, data: USER_EDGE_DEFAULTS },
    ] }))
    const { result } = renderHook(() => useConnectGesture({ enabled: true, showToast }))
    expect(result.current.isValidConnection({ source: SOURCE, target: TARGET })).toBe(false)
    mount(SOURCE)
    expect(offeredIds(connectionPicker())).not.toContain(TARGET)
    act(() => useCanvasStore.setState(state => ({ edges: state.edges.filter(e => e.id !== 'duplicate') })))
    expect(result.current.isValidConnection({ source: SOURCE, target: TARGET })).toBe(true)
    expect(offeredIds(connectionPicker())).toContain(TARGET)
  })

  it('contrast: the same pair is omitted for a cycle and offered when the reverse link is removed', () => {
    useCanvasStore.setState(state => ({ edges: [...state.edges,
      { id: 'reverse', source: TARGET, target: SOURCE, data: USER_EDGE_DEFAULTS },
    ] }))
    const { result } = renderHook(() => useConnectGesture({ enabled: true, showToast }))
    expect(result.current.isValidConnection({ source: SOURCE, target: TARGET })).toBe(false)
    mount(SOURCE)
    expect(offeredIds(connectionPicker())).not.toContain(TARGET)
    act(() => useCanvasStore.setState(state => ({ edges: state.edges.filter(e => e.id !== 'reverse') })))
    expect(result.current.isValidConnection({ source: SOURCE, target: TARGET })).toBe(true)
    expect(offeredIds(connectionPicker())).toContain(TARGET)
  })

  it('contrast: the live edge limit refuses the same pair, then raising it offers the pair', () => {
    const existingCount = useCanvasStore.getState().edges.length
    useCanvasStore.setState({
      engineLimits: { nodes: { max: 50 }, edges: { max: existingCount } },
    } as never)
    const { result } = renderHook(() => useConnectGesture({ enabled: true, showToast }))
    expect(result.current.isValidConnection({ source: SOURCE, target: TARGET })).toBe(false)
    mount(SOURCE)
    expect(screen.queryByRole('combobox', { name: 'Connect to…' })).toBeNull()
    expect(screen.getByText('No other elements can link here.')).toBeVisible()
    act(() => useCanvasStore.setState({
      engineLimits: { nodes: { max: 50 }, edges: { max: existingCount + 1 } },
    } as never))
    expect(result.current.isValidConnection({ source: SOURCE, target: TARGET })).toBe(true)
    expect(offeredIds(connectionPicker())).toContain(TARGET)
  })

  it('revalidates a stale selection when a reverse link arrives before the picker rerenders', () => {
    mount(SOURCE)
    const picker = connectionPicker()
    expect(offeredIds(picker)).toContain(TARGET)
    const { result } = renderHook(() => useConnectGesture({ enabled: true, showToast }))
    expect(result.current.isValidConnection({ source: SOURCE, target: TARGET })).toBe(true)
    act(() => {
      useCanvasStore.setState(state => ({ edges: [...state.edges,
        { id: 'reverse-arrived', source: TARGET, target: SOURCE, data: USER_EDGE_DEFAULTS },
      ] }))
      fireEvent.change(picker, { target: { value: TARGET } })
    })
    expect(result.current.isValidConnection({ source: SOURCE, target: TARGET })).toBe(false)
    expect(offeredIds(connectionPicker())).not.toContain(TARGET)
    expect(addEdge).not.toHaveBeenCalled()
    expect(reportManualEdit).not.toHaveBeenCalled()
    expect(proposeForDrawnLink).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().edges.some(edge => edge.source === SOURCE && edge.target === TARGET)).toBe(false)
    // Never a silent refusal (Codex head review P1): the picker says why, in the canvas's refusal voice.
    expect(pickerToast).toHaveBeenCalledWith(CONNECTION_REFUSAL_COPY.no_longer_valid, 'warning')
  })

  it('choosing a causal link opens that new edge’s strength through the existing event and selection', async () => {
    const openInspector = vi.fn()
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, openInspector)
    try {
      mount(SOURCE)
      await choose(connectionPicker(), TARGET)
      expect(addEdge).toHaveBeenCalledTimes(1)
      expect(addEdge).toHaveBeenCalledWith({
        source: SOURCE, target: TARGET, sourceHandle: null, targetHandle: null,
        data: USER_EDGE_DEFAULTS,
      })
      expect([...useCanvasStore.getState().selection.edgeIds]).toEqual([CREATED_EDGE])
      expect(openInspector).toHaveBeenCalledTimes(1)
      expect(useCanvasStore.getState().edges.find(e => e.id === CREATED_EDGE)?.data?.structuralAddStandDown)
        .toBe('strength_not_stated')
      console.info('INSPECTOR_CONNECT_STRENGTH_OPEN', JSON.stringify({
        edgeId: CREATED_EDGE, selectedEdgeIds: [...useCanvasStore.getState().selection.edgeIds],
        openEvents: openInspector.mock.calls.length,
      }))
    } finally {
      window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, openInspector)
    }
  })

  it('shows the empty state when no other element can link here', () => {
    useCanvasStore.setState(state => ({ nodes: state.nodes.filter(n => n.id === SOURCE || n.id === QUESTION), edges: [] }))
    mount(SOURCE)
    expect(screen.getByText('No other elements can link here.')).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Connect to…' })).toBeNull()
  })

  it.each([
    [OPTION, 'Choose a factor it changes', NEW_FACTOR],
    [SOURCE, 'Connect to…', TARGET],
  ])('viewer state reacts and blocks a pending selection from %s', (id, label, target) => {
    mount(id)
    const picker = screen.getByRole('combobox', { name: label })
    expect(offeredIds(picker)).toContain(target)
    // Change access and fire the still-mounted control in one batch. A live
    // callback guard must refuse even before React replaces the old picker.
    act(() => {
      setViewerScenario('shared-read-only-scenario')
      fireEvent.change(picker, { target: { value: target } })
    })
    expect(screen.queryByRole('combobox', { name: label })).toBeNull()
    expect(addEdge).not.toHaveBeenCalled()
    expect(reportManualEdit).not.toHaveBeenCalled()
    act(() => setViewerScenario(null))
    expect(offeredIds(screen.getByRole('combobox', { name: label }))).toContain(target)
  })
})

describe('Connect to… offers causal targets only', () => {
  it('a factor is never offered an option or the decision as a target (the option picker owns option → factor)', () => {
    mount(SOURCE)
    const ids = offeredIds(connectionPicker())
    const kinds = useCanvasStore.getState().nodes.filter(n => ids.includes(n.id))
      .map(n => String((n.data as Record<string, unknown>)?.kind ?? n.type))
    expect(ids.length).toBeGreaterThan(0)
    expect(kinds).not.toContain('option')
    expect(kinds).not.toContain('decision')
  })
})

/** Linked factors without a target use the existing saving row and authority. */
import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen, within, fireEvent, act } from '@testing-library/react'

const { proposeOptionIntervention } = vi.hoisted(() => ({ proposeOptionIntervention: vi.fn() }))
vi.mock('../../../hooks/useModelEditAuthority', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useModelEditAuthority: () => ({ proposeOptionIntervention }),
}))
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import { USER_EDGE_DEFAULTS } from '../../../domain/edges'
import { OPTION_INTERVENTION_NEEDS_FRESH_BASE, OPTION_INTERVENTION_NOT_ENCODABLE } from '../shared/optionInterventionCopy'
import {
  OPTION_INTERVENTION_BLOCKED,
  OPTION_INTERVENTION_NOT_SAVED_DECLINED,
  OPTION_INTERVENTION_UNCONFIRMED,
} from '../shared/useOptionInterventionCommit'

const OPTION = 'opt_expand'
const EMPTY = 'fac_budget'
const SET = 'fac_existing_budget'
const CAP = 1000

function seed(linked = true, duplicate = false) {
  useCanvasStore.setState({
    nodes: [
      { id: OPTION, type: 'option', position: { x: 0, y: 0 }, data: {
        kind: 'option', label: 'Expand the team',
        interventions: { [SET]: { value: 0.2, source: 'user_specified' } },
      } },
      ...[EMPTY, SET].map(id => ({ id, type: 'factor', position: { x: 0, y: 0 }, data: {
        kind: 'factor', category: 'controllable', label: id === EMPTY ? 'Budget' : 'Existing budget',
        observedState: { value: 0.2, raw_value: 200, unit: '£', cap: CAP },
      } })),
    ] as never[],
    edges: [
      { id: 'set-link', source: OPTION, target: SET, data: {} },
      ...(linked ? [{ id: 'empty-link', source: OPTION, target: EMPTY, data: {} }] : []),
      ...(duplicate ? [{ id: 'duplicate-link', source: OPTION, target: EMPTY, data: {} }] : []),
    ] as never[],
    results: { status: 'idle', report: null },
    ceeAnalysisReady: null,
    lastServerGraphHash: 'gh-linked',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

const mount = () => render(<InspectorRouter nodeId={OPTION} edgeId={null} onClose={vi.fn()} />)
const rowFor = (factor: string) => screen.getByTestId(`inspector-intervention-${factor}`)
const inputFor = (factor: string) => within(rowFor(factor)).getByRole('textbox') as HTMLInputElement
async function enter(factor: string, text = '£500') {
  const input = inputFor(factor)
  await act(async () => {
    input.focus()
    fireEvent.change(input, { target: { value: text } })
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

beforeEach(() => {
  proposeOptionIntervention.mockReset().mockReturnValue('dispatched')
  seed()
})
afterEach(() => cleanup())

describe('OptionPanel — linked factor without a target', () => {
  it('control: the existing set row is enabled and an unlinked factor has no box', () => {
    seed(false)
    mount()
    expect(inputFor(SET)).toBeEnabled()
    expect(inputFor(SET)).toHaveValue('200')
    expect(screen.queryByTestId(`inspector-intervention-${EMPTY}`)).toBeNull()
  })

  it('recognises a linked factor whose imported kind is carried only by data.type', () => {
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n =>
      n.id === EMPTY ? { ...n, type: undefined, data: { ...n.data, kind: undefined, type: 'factor' } } : n,
    ) })
    mount()
    expect(inputFor(EMPTY)).toBeEnabled()
    expect(inputFor(EMPTY)).toHaveValue('')
  })

  it('supports an absent interventions map and adds provenance only when a recorded value arrives', () => {
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n =>
      n.id === OPTION ? { ...n, data: { ...n.data, interventions: undefined } } : n,
    ) })
    mount()
    expect(inputFor(EMPTY)).toHaveValue('')
    expect(screen.queryByTestId(`inspector-intervention-${EMPTY}-provenance`)).toBeNull()
    act(() => useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n =>
      n.id === OPTION ? { ...n, data: { ...n.data, interventions: {
        [EMPTY]: { value: 0.5, source: 'user_specified' },
      } } } : n,
    ) }))
    expect(inputFor(EMPTY)).toHaveValue('500')
    expect(screen.getByTestId(`inspector-intervention-${EMPTY}-provenance`)).toHaveTextContent('Set by you')
    expect(screen.queryByTestId('option-links-without-values')).toBeNull()
  })

  it('does not offer target boxes for incoming links or outbound links to other node kinds', () => {
    seed(false)
    act(() => useCanvasStore.setState({
      nodes: [...useCanvasStore.getState().nodes, {
        id: 'risk_cost', type: 'risk', position: { x: 0, y: 0 }, data: { kind: 'risk', label: 'Cost risk' },
      }],
      edges: [...useCanvasStore.getState().edges,
        { id: 'incoming', source: EMPTY, target: OPTION, data: USER_EDGE_DEFAULTS },
        { id: 'risk-link', source: OPTION, target: 'risk_cost', data: USER_EDGE_DEFAULTS },
      ],
    }))
    mount()
    expect(screen.queryByTestId(`inspector-intervention-${EMPTY}`)).toBeNull()
    expect(screen.queryByTestId('inspector-intervention-risk_cost')).toBeNull()
    expect(inputFor(SET)).toBeEnabled()
  })

  it('has an enabled empty box in the factor unit; an unlinked factor has no box', () => {
    mount()
    expect(inputFor(EMPTY)).toBeEnabled()
    expect(inputFor(EMPTY)).toHaveValue('')
    expect(inputFor(EMPTY)).toHaveAttribute('placeholder', 'Enter a value')
    expect(inputFor(EMPTY)).toHaveAccessibleName('Target for Budget under Expand the team')
    expect(rowFor(EMPTY)).toHaveTextContent('This option sets Budget to')
    expect(rowFor(EMPTY)).toHaveTextContent('£')
    expect(screen.queryByTestId(`inspector-intervention-${EMPTY}-provenance`)).toBeNull()
    console.info('LINKED_TARGET_BOX', JSON.stringify({
      factorId: EMPTY, value: inputFor(EMPTY).value, placeholder: inputFor(EMPTY).placeholder,
      accessibleName: inputFor(EMPTY).getAttribute('aria-label'),
      disabled: inputFor(EMPTY).matches(':disabled'),
      provenancePresent: screen.queryByTestId(`inspector-intervention-${EMPTY}-provenance`) !== null,
    }))
    cleanup()
    seed(false)
    mount()
    expect(screen.queryByTestId(`inspector-intervention-${EMPTY}`)).toBeNull()
    expect(inputFor(SET)).toBeEnabled()
  })

  it('Enter sends exactly once through the same authority call shape as an existing row', async () => {
    mount()
    await enter(EMPTY)
    expect(proposeOptionIntervention).toHaveBeenCalledTimes(1)
    const emptyCall = proposeOptionIntervention.mock.calls[0]
    expect(emptyCall.slice(0, 2)).toEqual([EMPTY, 500 / CAP])
    expect(emptyCall[2]).toEqual({ onSendSettled: expect.any(Function) })
    await enter(SET)
    expect(proposeOptionIntervention).toHaveBeenCalledTimes(2)
    const existingCall = proposeOptionIntervention.mock.calls[1]
    expect(existingCall.slice(0, 2)).toEqual([SET, 500 / CAP])
    expect(emptyCall.length).toBe(existingCall.length)
    expect(Object.keys(emptyCall[2])).toEqual(Object.keys(existingCall[2]))
    console.info('LINKED_TARGET_AUTHORITY_CALLS', JSON.stringify({
      empty: [...emptyCall.slice(0, 2), Object.keys(emptyCall[2])],
      existing: [...existingCall.slice(0, 2), Object.keys(existingCall[2])],
    }))
    expect(useCanvasStore.getState().nodes.find(n => n.id === OPTION)?.data.interventions)
      .toEqual({ [SET]: { value: 0.2, source: 'user_specified' } })
    expect(screen.queryByTestId(`inspector-intervention-${EMPTY}-provenance`)).toBeNull()
  })

  it.each([
    ['not_encodable', OPTION_INTERVENTION_NOT_ENCODABLE],
    ['needs_fresh_base', OPTION_INTERVENTION_NEEDS_FRESH_BASE],
  ])('discloses %s under the new field exactly as under an existing field', async (outcome, message) => {
    proposeOptionIntervention.mockReturnValue(outcome)
    mount()
    await enter(EMPTY)
    const emptyLine = screen.getByTestId(`intervention-unapplied-${EMPTY}`)
    expect(emptyLine).toHaveTextContent(message)
    expect(inputFor(EMPTY)).toHaveAttribute('aria-describedby', emptyLine.id)
    expect(inputFor(EMPTY)).toHaveAttribute('aria-invalid', 'true')
    expect(inputFor(EMPTY)).toHaveValue('500')
    expect(screen.queryByTestId('option-intervention-notice')).toBeNull()
    console.info('LINKED_TARGET_REFUSAL', JSON.stringify({ outcome, factorId: EMPTY, message: emptyLine.textContent }))
    await enter(SET)
    expect(screen.getByTestId(`intervention-unapplied-${SET}`).textContent).toBe(emptyLine.textContent)
  })

  it('keeps the no-values sentence true and gives each linked factor one box', () => {
    seed(true, true)
    const option = useCanvasStore.getState().nodes.find(n => n.id === OPTION)!
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n =>
      n.id === OPTION ? { ...option, data: { ...option.data, interventions: {} } } : n,
    ) })
    mount()
    expect(screen.getByTestId('option-links-without-values')).toHaveTextContent(
      'Linked to 2 factors below, but no change values are set yet — set one',
    )
    expect(screen.getAllByTestId(`inspector-intervention-${EMPTY}`)).toHaveLength(1)
    expect(inputFor(EMPTY)).toHaveValue('')
    expect(inputFor(SET)).toHaveValue('')
    expect(proposeOptionIntervention).not.toHaveBeenCalled()
  })

  it.each([
    ['refused', OPTION_INTERVENTION_NOT_SAVED_DECLINED, false],
    ['unverified', OPTION_INTERVENTION_UNCONFIRMED, true],
    ['blocked', OPTION_INTERVENTION_BLOCKED, true],
  ] as const)('keeps the existing %s settlement disclosure and recovery on the empty row', async (settlement, message, retryable) => {
    mount()
    await enter(EMPTY)
    const onSendSettled = proposeOptionIntervention.mock.calls[0][2].onSendSettled
    await act(async () => onSendSettled(settlement, { refusal: 'declined' }))
    const line = screen.getByTestId(`intervention-unapplied-${EMPTY}`)
    expect(line.textContent).toBe(message)
    expect(inputFor(EMPTY)).toHaveValue('500')
    expect(inputFor(EMPTY)).toHaveAttribute('aria-describedby', line.id)
    expect(inputFor(EMPTY)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByTestId(`intervention-unapplied-retry-${EMPTY}`) !== null).toBe(retryable)
    expect(screen.queryByTestId('option-intervention-notice')).toBeNull()
    expect(screen.queryByTestId(`inspector-intervention-${EMPTY}-provenance`)).toBeNull()
    fireEvent.click(screen.getByTestId(`intervention-unapplied-dismiss-${EMPTY}`))
    expect(inputFor(EMPTY)).toHaveValue('')
    expect(screen.queryByTestId(`intervention-unapplied-${EMPTY}`)).toBeNull()
  })

  it('admits a real zero target and keeps numeric-entry refusal/discard on the same row', async () => {
    proposeOptionIntervention.mockReturnValue('not_encodable')
    mount()
    await enter(EMPTY, 'unreadable')
    expect(screen.getByTestId(`intervention-entry-refusal-${EMPTY}`)).toHaveTextContent('Not saved')
    expect(inputFor(EMPTY)).toHaveValue('unreadable')
    expect(proposeOptionIntervention).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId(`intervention-unapplied-dismiss-${EMPTY}`))
    expect(inputFor(EMPTY)).toHaveValue('')
    await enter(EMPTY, '0')
    expect(proposeOptionIntervention.mock.calls[0].slice(0, 2)).toEqual([EMPTY, 0])
    fireEvent.click(screen.getByTestId(`intervention-unapplied-dismiss-${EMPTY}`))
    expect(inputFor(EMPTY)).toHaveValue('')
  })

  it.each(['scale', '£'])('keeps the existing model-scale admission when %s has no conversion reference', async unit => {
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n =>
      n.id === EMPTY ? { ...n, data: { ...n.data, observedState: { unit } } } : n,
    ) })
    mount()
    await enter(EMPTY, '£500')
    expect(screen.getByTestId(`intervention-entry-refusal-${EMPTY}`)).toHaveTextContent('model scale')
    expect(proposeOptionIntervention).not.toHaveBeenCalled()
    await enter(EMPTY, '0.5')
    expect(proposeOptionIntervention).toHaveBeenCalledTimes(1)
    expect(proposeOptionIntervention.mock.calls[0].slice(0, 2)).toEqual([EMPTY, 0.5])
  })

  it('source scan: OptionPanel never calls the forbidden local intervention writer', () => {
    const source = readFileSync('src/canvas/ui/inspector-v2/panels/OptionPanel.tsx', 'utf8')
    expect(source).not.toMatch(/\bsetIntervention\s*\(/)
  })
})

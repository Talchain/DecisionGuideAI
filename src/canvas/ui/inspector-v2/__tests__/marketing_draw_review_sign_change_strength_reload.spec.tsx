import { beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { USER_EDGE_DEFAULTS } from '../../../domain/edges'
import { useStructuralAddEdgeEvents } from '../../../conversation/useStructuralAddEdgeEvents'
import { mergeServerGraphOnHydrate } from '../../../utils/mergeServerGraph'
import { overlayEdge } from '../../../utils/mergeAppliedGraph'

vi.mock('../../../../flags', async (original) => ({
  ...await original<typeof import('../../../../flags')>(), isOrchestratorV2Enabled: () => true,
}))
const send = vi.fn()
vi.mock('../../../conversation/ConversationContext', async (original) => ({
  ...await original<typeof import('../../../conversation/ConversationContext')>(),
  useOptionalConversationContext: () => ({ sendSystemEvent: send }),
}))
let saved: any
const data = () => useCanvasStore.getState().edges[0].data
function reloadSavedGraph() {
  const persisted = JSON.stringify({ nodes: [
    { id: 'marketing', kind: 'factor', label: 'Marketing' },
    { id: 'revenue', kind: 'outcome', label: 'Revenue' },
  ], edges: [{ ...saved, id: 'e1' }] })
  act(() => {
    useCanvasStore.setState({ nodes: [], edges: [], lastAuthoritativeGraph: null })
    expect(mergeServerGraphOnHydrate(JSON.parse(persisted)).accepted).toBe(true)
  })
}
function Panel() {
  useStructuralAddEdgeEvents(send)
  return <EdgePanel edgeId="e1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
}
function band(name: string) { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}:`) })) }
beforeEach(() => {
  saved = undefined
  useCanvasStore.getState().reset()
  useCanvasStore.setState({
    currentScenarioId: '33333333-4444-4555-8666-777777777777', lastServerGraphHash: 'base',
    nodes: [
      { id: 'marketing', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing' } },
      { id: 'revenue', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ], edges: [], pendingStructuralAddEdges: [], lastAuthoritativeGraph: null,
  } as never)
  useCanvasStore.getState().addEdge({ id: 'e1', source: 'marketing', target: 'revenue', data: { ...USER_EDGE_DEFAULTS } } as never)
  send.mockImplementation(async (event: any) => {
    const p = event.payload
    const direction = p.effect_direction ?? (p.direction_intent === 'positive' || p.direction_intent === 'negative' ? p.direction_intent : saved?.effect_direction)
    saved = { from: 'marketing', to: 'revenue', strength: { mean: (direction === 'negative' ? -1 : 1) * p.magnitude, std: 0.15 }, effect_direction: direction, provenance: { source: 'user_specified' }, provenance_display: 'user_set' }
    useCanvasStore.setState({ edges: [overlayEdge(useCanvasStore.getState().edges[0], saved, { acquireServerStrengthOnNoop: true })] } as never)
    return 'SENT'
  })
})

it('marketing_draw_review_sign_change_strength_reload', async () => {
  const view = render(<Panel />)
  expect(data()?.direction).toBeUndefined()
  expect(data()?.structuralAddStandDown).toBe('strength_not_stated')
  expect(screen.getByText('Does Marketing help or hurt Revenue?')).toBeTruthy()
  band('Strong')
  expect(data()?.weight).toBe(0.55)
  expect(data()?.directionSource).toBeUndefined()
  expect(data()?.direction).toBeUndefined()
  expect(screen.getByRole('button', { name: 'Helps' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Hurts' })).toHaveAttribute('aria-pressed', 'false')
  expect(send).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Hurts' }))
  await waitFor(() => expect(saved.strength.mean).toBe(-0.55))
  expect(data()?.directionSource).toBe('user')
  band('Very strong')
  await waitFor(() => expect(saved.strength.mean).toBe(-0.85))
  expect(send.mock.calls[1][0].payload.direction_intent).toBe('preserve')
  view.unmount()
  reloadSavedGraph()
  render(<Panel />)
  expect(data()).toMatchObject({ direction: 'negative', directionSource: 'user', weight: 0.85 })
  expect(screen.getByTestId('edge-direction-decreases')).toHaveAttribute('aria-pressed', 'true')
})

it('explicit-positive control: direction first still waits for a stated band', async () => {
  render(<Panel />)
  fireEvent.click(screen.getByRole('button', { name: 'Helps' }))
  expect(send).not.toHaveBeenCalled()
  band('Strong')
  await waitFor(() => expect(saved.strength.mean).toBe(0.55))
  expect(data()).toMatchObject({ direction: 'positive', directionSource: 'user' })
})

it('an older queued positive add cannot land after a newer negative review, including reload', async () => {
  useCanvasStore.setState({ lastServerGraphHash: null })
  const view = render(<Panel />)
  band('Strong')
  fireEvent.click(screen.getByRole('button', { name: 'Helps' }))
  expect(useCanvasStore.getState().pendingStructuralAddEdges[0]).toMatchObject({ direction: 'positive' })
  fireEvent.click(screen.getByRole('button', { name: 'Hurts' }))
  band('Very strong')
  expect(send).not.toHaveBeenCalled()
  act(() => useCanvasStore.setState({ lastServerGraphHash: 'base' }))
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  expect(saved.strength.mean).toBe(-0.85)
  expect(send.mock.calls[0][0].payload).toMatchObject({ effect_direction: 'negative', magnitude: 0.85 })
  view.unmount()
  reloadSavedGraph()
  expect(data()).toMatchObject({ direction: 'negative', directionSource: 'user', weight: 0.85 })
})

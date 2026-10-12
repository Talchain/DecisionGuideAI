/**
 * ⭐ B (5) — Helps / Hurts on a drawn link goes through EdgePanel's ONE registered writer
 * (`graphWriteRegistry`: EdgePanel `updateEdgeData`, the structural-add retry), never a direct
 * `updateEdge` (9c84986). The stated direction then rides the structural-add event the stated band sends.
 * Behavioural partner of noDirectUiGraphWrites' static census: the store's two edge writers are wrapped,
 * and a direct `updateEdge` is any call that does not arrive through `updateEdgeData`.
 */
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { USER_EDGE_DEFAULTS } from '../../../domain/edges'
import { useStructuralAddEdgeEvents } from '../../../conversation/useStructuralAddEdgeEvents'

vi.mock('../../../../flags', async (original) => ({
  ...await original<typeof import('../../../../flags')>(), isOrchestratorV2Enabled: () => true,
}))
const send = vi.fn()
vi.mock('../../../conversation/ConversationContext', async (original) => ({
  ...await original<typeof import('../../../conversation/ConversationContext')>(),
  useOptionalConversationContext: () => ({ sendSystemEvent: send }),
}))
const data = () => useCanvasStore.getState().edges[0].data
function Panel() {
  useStructuralAddEdgeEvents(send)
  return <EdgePanel edgeId="e1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
}
function band(name: string) { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}:`) })) }

let writes: { via: 'updateEdgeData' | 'direct updateEdge'; id: string; data: Record<string, unknown> | undefined }[]
beforeEach(() => {
  writes = []
  send.mockReset()
  send.mockResolvedValue('SENT')
  useCanvasStore.getState().reset()
  useCanvasStore.setState({
    currentScenarioId: '33333333-4444-4555-8666-777777777777', lastServerGraphHash: 'base',
    nodes: [
      { id: 'marketing', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing' } },
      { id: 'revenue', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ], edges: [], pendingStructuralAddEdges: [], lastAuthoritativeGraph: null,
  } as never)
  useCanvasStore.getState().addEdge({ id: 'e1', source: 'marketing', target: 'revenue', data: { ...USER_EDGE_DEFAULTS } } as never)
  const { updateEdge, updateEdgeData } = useCanvasStore.getState()
  let inRegisteredWriter = 0
  useCanvasStore.setState({
    updateEdgeData: (id: string, patch: Record<string, unknown>) => {
      writes.push({ via: 'updateEdgeData', id, data: patch })
      inRegisteredWriter++
      try { updateEdgeData(id, patch as never) } finally { inRegisteredWriter-- }
    },
    updateEdge: (id: string, updates: { data?: Record<string, unknown> }) => {
      if (!inRegisteredWriter) writes.push({ via: 'direct updateEdge', id, data: updates.data })
      updateEdge(id, updates as never)
    },
  } as never)
})

it('Helps on a drawn link writes the direction through updateEdgeData, never a direct updateEdge; the band then sends it', async () => {
  render(<Panel />)
  expect(data()?.direction).toBeUndefined()
  fireEvent.click(screen.getByRole('button', { name: 'Helps' }))
  expect(writes).toEqual([{ via: 'updateEdgeData', id: 'e1', data: expect.objectContaining({ direction: 'positive', directionSource: 'user' }) }])
  expect(data()).toMatchObject({ direction: 'positive', directionSource: 'user' })
  expect(send).not.toHaveBeenCalled()
  band('Strong')
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  expect(send.mock.calls[0][0].payload).toMatchObject({ effect_direction: 'positive', magnitude: 0.55 })
  expect(writes.filter(w => w.via === 'direct updateEdge')).toEqual([])
})

it('Hurts after a stated band: the same registered writer keeps the stated strength and carries the negative sign', async () => {
  render(<Panel />)
  band('Strong')
  expect(data()?.weight).toBe(0.55)
  writes = []
  fireEvent.click(screen.getByRole('button', { name: 'Hurts' }))
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  expect(writes.filter(w => w.via === 'direct updateEdge')).toEqual([])
  expect(writes[0]).toEqual({ via: 'updateEdgeData', id: 'e1', data: expect.objectContaining({ direction: 'negative', directionSource: 'user', weight: 0.55 }) })
  expect(data()).toMatchObject({ direction: 'negative', directionSource: 'user', weight: 0.55 })
  expect(send.mock.calls[0][0].payload).toMatchObject({ effect_direction: 'negative', magnitude: 0.55 })
})

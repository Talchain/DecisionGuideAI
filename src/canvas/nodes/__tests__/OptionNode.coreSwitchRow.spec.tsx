/**
 * Core's option switch is the engine's working, not a change the option makes (DL, Paul's brief 21 Oct). Its row ("… in
 * place · Not in use → In use") is not on the option card; a real change on the same card still is. Served courier shape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const optionData = { label: 'Switching to a new courier partner', type: 'option', interventions: { new_courier_partner__on: 1, price: 0.8 } }
const option = { id: 'new_courier_partner', type: 'option', position: { x: 0, y: 0 }, data: optionData }
const sw = { id: 'new_courier_partner__on', type: 'factor', position: { x: 0, y: 0 },
  data: { label: 'Switching to a new courier partner in place', observedState: { unit: '', value: 0, cap: 1 } } }
const price = { id: 'price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', observedState: { unit: 'fraction', value: 0.4 } } }

beforeEach(() => useCanvasStore.setState({ nodes: [], edges: [], ceeAnalysisReady: null, viewMode: 'expert', results: { status: 'complete', report: {} } } as never))
afterEach(cleanup)

const mount = (nodes: unknown[]) => {
  useCanvasStore.setState({ nodes } as never)
  return render(<ReactFlowProvider><OptionNode id={option.id} type="option" data={optionData} selected={false} isConnectable
    positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable /></ReactFlowProvider>)
}

describe('option card: no row for core\'s own switch', () => {
  it('⭐ the switch row is gone; the option\'s real change stays', () => {
    mount([option, sw, price])
    expect(screen.queryByText(/in place/)).toBeNull()
    expect(screen.queryByText(/Not in use/)).toBeNull()
    expect(screen.getAllByText(/80%/).length).toBeGreaterThan(0)
  })
  it('CONTROL: a factor that is not the mapper\'s switch keeps its row', () => {
    const own = { ...sw, data: { ...sw.data, label: 'Courier partner uptake' } }
    mount([option, own, price])
    expect(screen.getAllByText(/Courier partner uptake/).length).toBeGreaterThan(0)
  })
})

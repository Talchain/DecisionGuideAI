import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'

const ID = 'founder_poc_testing_time'
const position = { x: 123, y: 456 }
const server = (frame?: number) => ({ nodes: [{ id: ID, kind: 'factor', label: 'Founder PoC testing time',
  observed_state: { raw_value: 48, value: 0.8, cap: 60, unit: 'hours per week', source: 'cee_inference' },
  ...(frame === undefined ? {} : { scale_frame: frame }) }], edges: [] })
const local = () => useCanvasStore.getState().nodes.find(n => n.id === ID)!
beforeEach(() => {
  useCanvasStore.setState({ currentScenarioId: '11111111-2222-4333-8444-555555555555',
    nodes: [{ id: ID, type: 'factor', position, data: { label: 'Founder PoC testing time', kind: 'factor', scale_frame: 80 } }],
    edges: [], importPendingServerRegistration: false, pendingEmittedEdits: 0, lastAuthoritativeGraph: null,
    history: { past: [], future: [] } } as never)
})
describe('accepted server merge owns the saved frame', () => {
  it('drops an obsolete omitted frame, retaining the saved quantity and local position', () => {
    expect(mergeServerGraphOnHydrate(server()).accepted).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(local().data, 'scale_frame')).toBe(false)
    expect(local().data.observedState).toMatchObject({ raw_value: 48, cap: 60, unit: 'hours per week', source: 'cee_inference' })
    expect(local().position).toEqual(position)
  })
  it('keeps the exact frame the server actually supplies', () => {
    expect(mergeServerGraphOnHydrate(server(60)).accepted).toBe(true)
    expect(local().data.scale_frame).toBe(60)
    expect(local().position).toEqual(position)
  })
  it('a read without authoritative identity cannot clear an omitted frame', () => {
    expect(mergeServerGraphOnHydrate(server(), { authoritativeRead: false }).accepted).toBe(true)
    expect(local().data.scale_frame).toBe(80)
    expect(local().position).toEqual(position)
  })
  it('a refused merge cannot drop a local frame', () => {
    expect(mergeServerGraphOnHydrate({ nodes: [], edges: [] }).accepted).toBe(false)
    expect(local().data.scale_frame).toBe(80)
    expect(local().position).toEqual(position)
  })
})

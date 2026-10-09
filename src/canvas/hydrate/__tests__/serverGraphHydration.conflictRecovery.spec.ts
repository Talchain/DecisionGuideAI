import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer, type HydrateFromServerOptions } from '../serverGraphHydration'

const SID = '11111111-2222-4333-8444-555555555555'
const identity = { kind: 'graph_identity_hash', value: 'a'.repeat(64), algorithm: 'sha256',
  projection_version: 'identity.v1', graph_schema_version: 'graph_v3', normaliser_version: '1' }
const options = { requireServedScenario: true, reapplyServerGraph: true } as HydrateFromServerOptions
const body = { schema: 'scenario_graph.v1', scenario_id: SID, graph_present: true,
  graph_identity_hash: identity, graph: { nodes: [{ id: 'factor', kind: 'factor', label: 'Spend',
    observed_state: { value: 414, unit: 'GBP' } }], edges: [] } }
let fetchSpy: ReturnType<typeof vi.fn<[], Promise<Response>>>
function value() { return (useCanvasStore.getState().nodes[0]?.data.observedState as { value?: number } | undefined)?.value }
beforeEach(() => {
  useCanvasStore.setState({ currentScenarioId: SID, importPendingServerRegistration: false,
    serverGraphIdentity: null, lastAuthoritativeGraph: null,
    nodes: [{ id: 'factor', type: 'factor', position: { x: 123, y: 456 },
      data: { label: 'Spend', kind: 'factor', display_value: '221 GBP', observedState: { value: 221, unit: 'GBP' } } }],
    edges: [], history: { past: [], future: [] } } as never)
  fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => body } as Response))
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => { vi.unstubAllGlobals() })

describe('S2 recovery uses the existing server merge', () => {
  it('S2 cached accepted identity cannot retain the reverted local 221', async () => {
    // First accepted read models the winner having already installed its identity.
    expect(await hydrateCanvasFromServer(SID)).toBe('merged')
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n => ({ ...n,
      data: { ...n.data, observedState: { value: 221, unit: 'GBP' } } })) } as never)
    expect(await hydrateCanvasFromServer(SID, options)).toBe('merged')
    expect(value()).toBe(414)
    expect(useCanvasStore.getState().nodes[0].position).toEqual({ x: 123, y: 456 })
  })

  it('S3 recovery drops an omitted display string while ordinary boot keeps its existing overlay rule', async () => {
    expect(await hydrateCanvasFromServer(SID)).toBe('merged')
    expect(factorDisplayText(useCanvasStore.getState().nodes[0].data)).toBe('221 GBP')
    expect(await hydrateCanvasFromServer(SID, options)).toBe('merged')
    expect(factorDisplayText(useCanvasStore.getState().nodes[0].data)).toBe('414')
  })

  it('S3 recovery preserves the server display string when the server carries it', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...body,
      graph: { ...body.graph, nodes: body.graph.nodes.map(n => ({ ...n, display_value: '414 GBP' })) },
    }) } as Response)
    expect(await hydrateCanvasFromServer(SID, options)).toBe('merged')
    expect(factorDisplayText(useCanvasStore.getState().nodes[0].data)).toBe('414 GBP')
  })

  it('S2 ordinary hydration retains its unchanged behaviour', async () => {
    await hydrateCanvasFromServer(SID)
    expect(await hydrateCanvasFromServer(SID)).toBe('unchanged')
  })

  it('S2 canApply is checked after the read before replacing values', async () => {
    expect(await hydrateCanvasFromServer(SID, { ...options, canApply: () => false })).toBe('skipped')
    expect(value()).toBe(221)
  })

  it('S2 refuses a foreign scenario even with overlapping ids', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...body,
      scenario_id: '22222222-2222-4333-8444-555555555555' }) } as Response)
    expect(await hydrateCanvasFromServer(SID, options)).toBe('skipped')
    expect(value()).toBe(221)
  })

  it('S2 an unusable graph is not a successful refresh', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...body, graph: { nodes: [], edges: [] } }) } as Response)
    expect(await hydrateCanvasFromServer(SID, options)).toBe('mergeRefused')
    expect(value()).toBe(221)
  })
})

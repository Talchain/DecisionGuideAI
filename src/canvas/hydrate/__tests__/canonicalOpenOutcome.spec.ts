/**
 * ONE AUTHORITY for "did this model open?": CEE's canonical graph read, bound by identity (DL 0df0e1, 5 Oct 2026).
 * Driven through the REAL `hydrateCanvasFromServer` with `fetch` stubbed at the transport, as the refusal spec does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import {
  awaitCanonicalOpen,
  canonicalOpenSequence,
  recordCanonicalOpen,
  __resetCanonicalOpenForTests,
} from '../canonicalOpenOutcome'

const ROUTE = '11111111-2222-4333-8444-555555555555'
const OTHER = '99999999-8888-4777-8666-555555555555'

function body(scenarioId: string, graphPresent = true) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: scenarioId,
    graph: graphPresent ? { nodes: [{ id: 'goal-1', kind: 'goal', label: 'Revenue' }], edges: [] } : null,
    graph_present: graphPresent,
    brief_text: null,
    layout_present: false,
    request_id: 'req-canonical',
  }
}
const json = (status: number, b: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => b }) as unknown as Response

let fetchSpy: ReturnType<typeof vi.fn>
beforeEach(() => {
  __resetCanonicalOpenForTests()
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  useCanvasStore.setState({ currentScenarioId: ROUTE, nodes: [], edges: [], serverGraphIdentity: null } as never)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the canonical read records whether the model opened, bound to the scenario it was asked for', () => {
  it('⭐ 200 for the SAME scenario_id: opened', async () => {
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(200, body(ROUTE)))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('opened')
  })

  it('⭐ 200 carrying ANOTHER scenario_id is not this model opening (identity binding)', async () => {
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(200, body(OTHER)))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('not_opened')
  })

  it('a refusal (404, not readable) is not opened', async () => {
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(404, { error: 'not_found' }))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('not_opened')
  })

  it('a KNOWN scenario with no graph yet (graph_present false, same id) opened: CEE answered for it', async () => {
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(200, body(ROUTE, false)))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('opened')
  })
})

// A canvas node in the store's own shape: what another model (or an unsaved draft) puts on screen.
const onScreen = (id: string) => ({ id, type: 'decision', position: { x: 0, y: 0 }, data: { label: `On screen ${id}` } })

describe('⭐ opened means the model is ON THE CANVAS, not only that CEE answered (no mask over another model)', () => {
  it('⭐ same-tab switch A→B: CEE serves B, but the store still holds A → not opened (A is what the user sees)', async () => {
    useCanvasStore.setState({ currentScenarioId: OTHER, nodes: [onScreen('a-1')], edges: [] } as never)
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(200, body(ROUTE)))
    await expect(hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })).resolves.toBe('skipped')
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('not_opened')
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(['a-1'])
  })

  it('⭐ the merge REFUSES B over an unbound draft (zero overlap) → not opened (the draft stays on screen)', async () => {
    useCanvasStore.setState({ currentScenarioId: null, nodes: [onScreen('draft-1')], edges: [] } as never)
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(200, body(ROUTE)))
    await expect(hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })).resolves.toBe('mergeRefused')
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('not_opened')
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(['draft-1'])
  })

  it('⭐ a known scenario with no graph yet, while the canvas holds ANOTHER model → not opened', async () => {
    useCanvasStore.setState({ currentScenarioId: OTHER, nodes: [onScreen('a-1')], edges: [] } as never)
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(200, body(ROUTE, false)))
    await expect(hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })).resolves.toBe('absent')
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('not_opened')
  })

  it('a known scenario with no graph yet over an unbound DRAFT (nodes, no id) → not opened (the draft is on screen)', async () => {
    useCanvasStore.setState({ currentScenarioId: null, nodes: [onScreen('draft-1')], edges: [] } as never)
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(200, body(ROUTE, false)))
    await expect(hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })).resolves.toBe('absent')
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('not_opened')
  })

  it('control: a known scenario with no graph yet over an EMPTY, unbound canvas → opened', async () => {
    useCanvasStore.setState({ currentScenarioId: null, nodes: [], edges: [] } as never)
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(200, body(ROUTE, false)))
    await expect(hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })).resolves.toBe('absent')
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('opened')
  })

  it('⭐ the server graph has not moved since this canvas applied it (`unchanged`, the reload path) → opened', async () => {
    const identity = { value: 'v5:same', projectionVersion: 'v5' }
    useCanvasStore.setState({ currentScenarioId: ROUTE, nodes: [onScreen('goal-1')], edges: [], serverGraphIdentity: identity } as never)
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(200, { ...body(ROUTE), graph_identity_hash: { value: 'v5:same', projection_version: 'v5' } }))
    await expect(hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })).resolves.toBe('unchanged')
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('opened')
  })

  it('control: B merged onto an empty, unbound canvas → opened, and B is on screen', async () => {
    useCanvasStore.setState({ currentScenarioId: null, nodes: [], edges: [] } as never)
    const since = canonicalOpenSequence()
    fetchSpy.mockResolvedValue(json(200, body(ROUTE)))
    await expect(hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })).resolves.toBe('merged')
    await expect(awaitCanonicalOpen(ROUTE, since, 50)).resolves.toBe('opened')
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain('goal-1')
  })
})

describe('an answer only decides a load that began before it', () => {
  it('an answer recorded BEFORE the waiter began never decides it; the next answer does', async () => {
    recordCanonicalOpen(ROUTE, 'opened') // an earlier read (an earlier page state, an earlier account)
    const since = canonicalOpenSequence()
    const waiting = awaitCanonicalOpen(ROUTE, since, 1_000)
    recordCanonicalOpen(ROUTE, 'not_opened')
    await expect(waiting).resolves.toBe('not_opened')
  })

  it('no answer within the bound: timeout', async () => {
    vi.useFakeTimers()
    const waiting = awaitCanonicalOpen(ROUTE, canonicalOpenSequence(), 20_000)
    vi.advanceTimersByTime(20_000)
    await expect(waiting).resolves.toBe('timeout')
  })

  it('an answer for ANOTHER scenario never decides this one', async () => {
    vi.useFakeTimers()
    const waiting = awaitCanonicalOpen(ROUTE, canonicalOpenSequence(), 1_000)
    recordCanonicalOpen(OTHER, 'opened')
    vi.advanceTimersByTime(1_000)
    await expect(waiting).resolves.toBe('timeout')
  })
})

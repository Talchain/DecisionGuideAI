/**
 * INVESTOR STEP 0 — "Open the example decision" (DL 5936312621 / 5936446785).
 * Rows: the seed is RC's D1 capture UNMODIFIED, and RC's three invariants hold on it (5936325909); every click mints a
 * FRESH id; nothing ever writes over an existing scenario; the open is the id switch the cold-reload read keys on.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const register = vi.fn()
const sessionActive = vi.fn(() => false)
const identity = vi.fn(async () => ({ userId: null as string | null, accessToken: null as string | null }))
vi.mock('../../../adapters/cee/registerScenarioGraph', () => ({ registerScenarioGraph: (...a: unknown[]) => register(...a) }))
vi.mock('../../../lib/persistenceSession', () => ({ isPersistenceSessionActive: () => sessionActive() }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: () => identity() }))
const hydrateMock = vi.fn()
vi.mock('../../hydrate/serverGraphHydration', async (orig) => ({
  ...(await orig<typeof import('../../hydrate/serverGraphHydration')>()),
  hydrateCanvasFromServer: (...a: unknown[]) => hydrateMock(...a),
}))

import { openExampleDecision, EXAMPLE_DECISION_BRIEF, EXAMPLE_DECISION_PROVENANCE, __resetExampleDecisionForTests } from '../exampleDecision'
import { useCanvasStore } from '../../store'
import { useBootGraphReadStore, beginBootGraphRead, settleBootGraphRead } from '../../hydrate/bootGraphRead'
import type { HydrationOutcome } from '../../hydrate/serverGraphHydration'
import { EXAMPLE_DECISION_GOAL_LABEL, EXAMPLE_DECISION_OPTION_COUNT } from '../../components/StarterDecisions'

type G = { nodes: Array<{ id: string; kind: string; label: string; proposed_by?: string }>; edges: Array<{ from: string; to: string; provenance?: { magnitude?: string } }> }
const SHIPPED_TEXT = readFileSync(join(__dirname, '..', 'd1.graph.json'), 'utf8')
const SHIPPED = JSON.parse(SHIPPED_TEXT) as G
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const POINTER = 'olumi-canvas-current-scenario-id'
const ACK = { status: 'registered', identity: null, nodeCount: 13, edgeCount: 19, requestId: 'r' }

describe('the seed is RC’s D1, unmodified, and RC’s invariants hold on it', () => {
  it('the shipped graph hashes to the pinned value extracted from capture eeeff8b4 (13 nodes / 19 edges)', () => {
    expect(EXAMPLE_DECISION_PROVENANCE.captureSha256.startsWith('eeeff8b4')).toBe(true)
    expect(sha(JSON.stringify(SHIPPED))).toBe(EXAMPLE_DECISION_PROVENANCE.graphSha256)
    expect([SHIPPED.nodes.length, SHIPPED.edges.length]).toEqual([13, 19])
  })

  it('invariant 1: exactly the two named links are olumi_placeholder (M1 one-click + RC S1 target)', () => {
    const ph = SHIPPED.edges.filter((e) => e.provenance?.magnitude === 'olumi_placeholder').map((e) => `${e.from}->${e.to}`).sort()
    expect(ph).toEqual([
      'sprint_capacity_for_ai_reporting->ai_reporting_module_availability',
      'sprint_capacity_for_integration_fix->integration_step_bug_resolution',
    ])
  })

  it('invariant 2: split_sprint_capacity is Olumi-proposed (CEE derives excluded_olumi_proposed from it)', () => {
    expect(SHIPPED.nodes.find((n) => n.id === 'split_sprint_capacity')?.proposed_by).toBe('olumi')
  })

  it('invariant 3: the risk sits on an option’s path to the goal', () => {
    const next = (id: string) => SHIPPED.edges.filter((e) => e.from === id).map((e) => e.to)
    const reach = (from: string) => {
      const seen = new Set<string>(); const q = [from]
      while (q.length) { const c = q.shift()!; for (const n of next(c)) if (!seen.has(n)) { seen.add(n); q.push(n) } }
      return seen
    }
    const options = SHIPPED.nodes.filter((n) => n.kind === 'option').map((n) => n.id)
    expect(options.some((o) => reach(o).has('revenue_lost_to_trial_abandonment'))).toBe(true)
    expect(reach('revenue_lost_to_trial_abandonment').has('quarterly_revenue')).toBe(true)
  })

  it('the card’s words are the graph’s own: goal label and option count', () => {
    expect(SHIPPED.nodes.find((n) => n.kind === 'goal')?.label).toBe(EXAMPLE_DECISION_GOAL_LABEL)
    expect(SHIPPED.nodes.filter((n) => n.kind === 'option')).toHaveLength(EXAMPLE_DECISION_OPTION_COUNT)
  })
})

describe('openExampleDecision: a fresh scenario every time, never over a model, opened only when read back', () => {
  const PREVIOUS = 'b5b5b5b5-c6c6-4d7d-8e8e-f9f9f9f9f9f9'
  const OTHER = 'd7d7d7d7-e8e8-4f9f-8a0a-b1b1b1b1b1b1'
  const SEED_IDS = SHIPPED.nodes.map((n) => n.id)
  let unsubHook: (() => void) | null = null
  /** Stand-in for `useServerGraphHydration`: on an id change it begins the boot read and settles it with `outcome`. */
  function hydrationHook(outcome: HydrationOutcome | 'never') {
    let seen = useCanvasStore.getState().currentScenarioId
    unsubHook = useCanvasStore.subscribe((st) => {
      if (st.currentScenarioId === seen) return
      seen = st.currentScenarioId
      const id = st.currentScenarioId
      // Only the scenario this flow REGISTERED has a graph to read; any other id (a user's own empty pick) reads nothing.
      if (!id || outcome === 'never' || !register.mock.calls.some((c) => c[0] === id)) return
      queueMicrotask(() => {
        const token = beginBootGraphRead(id)
        if (outcome === 'merged') useCanvasStore.setState({ nodes: SEED_IDS.map((nid) => ({ id: nid, position: { x: 0, y: 0 }, data: {} })) as never })
        settleBootGraphRead(id, token, outcome)
      })
    })
  }
  const pointer = () => localStorage.getItem(POINTER)

  beforeEach(() => {
    unsubHook?.(); unsubHook = null
    register.mockReset(); sessionActive.mockReset(); sessionActive.mockReturnValue(false)
    identity.mockReset(); identity.mockResolvedValue({ userId: null, accessToken: null })
    hydrateMock.mockReset(); __resetExampleDecisionForTests()
    localStorage.clear(); localStorage.setItem(POINTER, PREVIOUS)
    useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: PREVIOUS })
    useBootGraphReadStore.setState({ byScenario: {} })
  })

  it('registers the VERBATIM graph into a new id (empty-scenario assertion, D1 brief) and reports opened only once D1’s node ids are read back', async () => {
    hydrationHook('merged')
    register.mockResolvedValueOnce(ACK)
    const r = await openExampleDecision()
    const [id, graph, opts] = register.mock.calls[0] as [string, unknown, Record<string, unknown>]
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(id).not.toBe(PREVIOUS)
    expect(sha(JSON.stringify(graph))).toBe(EXAMPLE_DECISION_PROVENANCE.graphSha256)
    expect(opts.expectNoGraph).toBe(true)
    expect(opts.initialBriefText).toBe(EXAMPLE_DECISION_BRIEF)
    expect(r).toEqual({ status: 'opened', scenarioId: id })
    expect(useCanvasStore.getState().currentScenarioId).toBe(id)
    expect(pointer()).toBe(id)
    expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual([...SEED_IDS].sort())
  })

  it('CONTROL: with no read-back the promise stays PENDING after the switch (opened is never claimed early)', async () => {
    hydrationHook('never')
    register.mockResolvedValueOnce(ACK)
    let settled = false
    void openExampleDecision({ readBackTimeoutMs: 60_000 }).then(() => { settled = true })
    await vi.waitFor(() => expect(useCanvasStore.getState().currentScenarioId).not.toBe(PREVIOUS))
    await new Promise((r) => setTimeout(r, 30))
    expect(settled).toBe(false)
  })

  it('⛔ register OK + read FAILS → not_read_back, the toastable result; ONE write, never a second mint', async () => {
    hydrationHook('unavailable')
    register.mockResolvedValue(ACK)
    const r = await openExampleDecision()
    expect(register).toHaveBeenCalledTimes(1)
    const id = register.mock.calls[0][0] as string
    expect(r).toEqual({ status: 'not_read_back', scenarioId: id, read: 'unavailable' })
    // The server holds D1 under this id, so a reload opens it: the pointer stays on it.
    expect(pointer()).toBe(id)
  })

  it('⛔ register OK + the read never lands → not_read_back on the timeout, still one write', async () => {
    hydrationHook('never')
    register.mockResolvedValue(ACK)
    const r = await openExampleDecision({ readBackTimeoutMs: 40 })
    expect(r).toMatchObject({ status: 'not_read_back', read: 'timeout' })
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('⛔ delete-all then re-open: the previous scenario’s server identity is CLEARED before the new id is adopted', async () => {
    useCanvasStore.setState({
      serverGraphIdentity: { value: 'stale-d1', projectionVersion: 'identity.v1' },
      lastAuthoritativeGraph: { nodes: [{ id: 'quarterly_revenue' }], edges: [] },
      lastServerGraphHash: 'stale-hash',
    } as never)
    let atSwitch: Record<string, unknown> | null = null
    const unsub = useCanvasStore.subscribe((st) => {
      if (atSwitch === null && st.currentScenarioId !== PREVIOUS) atSwitch = { ...(st as unknown as Record<string, unknown>) }
    })
    hydrationHook('merged')
    register.mockResolvedValueOnce(ACK)
    expect((await openExampleDecision()).status).toBe('opened')
    unsub()
    expect(atSwitch).not.toBeNull()
    expect(atSwitch!.serverGraphIdentity).toBeNull()
    expect(atSwitch!.lastAuthoritativeGraph).toBeNull()
    expect(atSwitch!.lastServerGraphHash).toBeNull()
  })

  it('two clicks → two different fresh ids', async () => {
    hydrationHook('merged')
    register.mockResolvedValue(ACK)
    await openExampleDecision()
    const first = useCanvasStore.getState().currentScenarioId
    useCanvasStore.setState({ nodes: [], edges: [] })
    await openExampleDecision()
    const ids = register.mock.calls.map((c) => c[0] as string)
    expect(new Set([...ids, PREVIOUS]).size).toBe(3)
    expect(useCanvasStore.getState().currentScenarioId).toBe(ids[1])
    expect(first).toBe(ids[0])
  })

  it.each(['conflict', 'unavailable', 'rejected', 'refused', 'notRegistrable'] as const)(
    '⛔ register %s → nothing switches: the current scenario and its pointer are untouched',
    async (status) => {
      register.mockResolvedValueOnce({ status })
      expect(await openExampleDecision()).toEqual({ status: 'not_opened', reason: status })
      expect(useCanvasStore.getState().currentScenarioId).toBe(PREVIOUS)
      expect(pointer()).toBe(PREVIOUS)
    },
  )

  it('⛔ signed in at the click → no write, no mint', async () => {
    sessionActive.mockReturnValue(true)
    expect(await openExampleDecision()).toEqual({ status: 'signed_in' })
    expect(register).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().currentScenarioId).toBe(PREVIOUS)
  })

  it('⛔ DEFERRED LOGIN resolved before the mint (identity carries a user) → signed_in, no write, no mint', async () => {
    identity.mockResolvedValueOnce({ userId: 'u-1', accessToken: 'jwt' })
    expect(await openExampleDecision()).toEqual({ status: 'signed_in' })
    expect(register).not.toHaveBeenCalled()
    expect(pointer()).toBe(PREVIOUS)
  })

  it('⛔ DEFERRED LOGIN during the write → signed_in, NO switch (the guest scenario is left, the pointer untouched)', async () => {
    hydrationHook('merged')
    register.mockImplementationOnce(async () => { sessionActive.mockReturnValue(true); return ACK })
    expect(await openExampleDecision()).toEqual({ status: 'signed_in' })
    expect(useCanvasStore.getState().currentScenarioId).toBe(PREVIOUS)
    expect(pointer()).toBe(PREVIOUS)
  })

  it('⛔ SWITCHED MID-FLIGHT (another empty scenario selected during the write) → canvas_changed, the user’s choice stands', async () => {
    hydrationHook('merged')
    register.mockImplementationOnce(async () => {
      useCanvasStore.setState({ currentScenarioId: OTHER }); localStorage.setItem(POINTER, OTHER)
      return ACK
    })
    expect(await openExampleDecision()).toEqual({ status: 'canvas_changed' })
    expect(useCanvasStore.getState().currentScenarioId).toBe(OTHER)
    expect(pointer()).toBe(OTHER)
  })

  it('⛔ COMPLETED RUN → delete-all → open D1: NOTHING of the old Run is inherited (each field, at the switch)', async () => {
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100 },
      analysisStateV1: { kind: 'old-run' },
      analysisFreshness: { status: 'current' },
      v5AnalysisFact: { run: 'old' },
      hasCompletedFirstRun: true,
    } as never)
    let atSwitch: Record<string, unknown> | null = null
    const unsub = useCanvasStore.subscribe((st) => {
      if (atSwitch === null && st.currentScenarioId !== PREVIOUS) atSwitch = { ...(st as unknown as Record<string, unknown>) }
    })
    hydrationHook('merged')
    register.mockResolvedValueOnce(ACK)
    expect((await openExampleDecision()).status).toBe('opened')
    unsub()
    expect((atSwitch!.results as { status: string }).status).toBe('idle')
    expect(atSwitch!.analysisStateV1).toBeNull()
    expect(atSwitch!.analysisFreshness).toBeNull()
    expect(atSwitch!.v5AnalysisFact).toBeNull()
    expect(atSwitch!.hasCompletedFirstRun).toBe(false)
    expect((atSwitch!.history as { past: unknown[] }).past).toEqual([])
  })

  it('⛔ a login that RESOLVES during the write while the mirrored session flag is still false → no switch', async () => {
    hydrationHook('merged')
    identity.mockResolvedValueOnce({ userId: null, accessToken: null }).mockResolvedValueOnce({ userId: 'u-1', accessToken: 'jwt' })
    register.mockResolvedValueOnce(ACK)
    expect(sessionActive()).toBe(false)
    expect(await openExampleDecision()).toEqual({ status: 'signed_in' })
    expect(useCanvasStore.getState().currentScenarioId).toBe(PREVIOUS)
    expect(pointer()).toBe(PREVIOUS)
  })

  it('a retry after not_read_back RE-READS the created scenario: no second write, no second mint', async () => {
    hydrationHook('unavailable')
    register.mockResolvedValue(ACK)
    const first = await openExampleDecision()
    expect(first.status).toBe('not_read_back')
    const id = register.mock.calls[0][0] as string
    hydrateMock.mockImplementationOnce(async (sid: string) => {
      useCanvasStore.setState({ nodes: SEED_IDS.map((nid) => ({ id: nid, position: { x: 0, y: 0 }, data: {} })) as never })
      return 'merged'
    })
    expect(await openExampleDecision()).toEqual({ status: 'opened', scenarioId: id })
    expect(register).toHaveBeenCalledTimes(1)
    expect(hydrateMock).toHaveBeenCalledTimes(1)
    expect(hydrateMock.mock.calls[0][0]).toBe(id)
  })

  it('⛔ content that arrived during the write is not replaced: the id does not switch', async () => {
    register.mockImplementationOnce(async () => {
      useCanvasStore.setState({ nodes: [{ id: 'n', position: { x: 0, y: 0 }, data: {} }] as never })
      return ACK
    })
    expect(await openExampleDecision()).toEqual({ status: 'canvas_changed' })
    expect(useCanvasStore.getState().currentScenarioId).toBe(PREVIOUS)
    expect(pointer()).toBe(PREVIOUS)
  })
})

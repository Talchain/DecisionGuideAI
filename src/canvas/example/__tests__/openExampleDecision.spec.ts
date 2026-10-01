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
vi.mock('../../../adapters/cee/registerScenarioGraph', () => ({ registerScenarioGraph: (...a: unknown[]) => register(...a) }))
vi.mock('../../../lib/persistenceSession', () => ({ isPersistenceSessionActive: () => sessionActive() }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { openExampleDecision, EXAMPLE_DECISION_BRIEF, EXAMPLE_DECISION_PROVENANCE } from '../exampleDecision'
import { useCanvasStore } from '../../store'
import { useBootGraphReadStore } from '../../hydrate/bootGraphRead'
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

describe('openExampleDecision: a fresh scenario every time, never over a model', () => {
  const PREVIOUS = 'b5b5b5b5-c6c6-4d7d-8e8e-f9f9f9f9f9f9'
  beforeEach(() => {
    register.mockReset(); sessionActive.mockReset(); sessionActive.mockReturnValue(false)
    localStorage.clear(); localStorage.setItem(POINTER, PREVIOUS)
    useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: PREVIOUS })
    useBootGraphReadStore.setState({ byScenario: {} })
  })

  it('registers the VERBATIM graph into a new id with the empty-scenario assertion and the D1 brief, then opens that id', async () => {
    register.mockResolvedValueOnce(ACK)
    const r = await openExampleDecision()
    expect(register).toHaveBeenCalledTimes(1)
    const [id, graph, opts] = register.mock.calls[0] as [string, unknown, Record<string, unknown>]
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(id).not.toBe(PREVIOUS)
    expect(sha(JSON.stringify(graph))).toBe(EXAMPLE_DECISION_PROVENANCE.graphSha256)
    expect(opts.expectNoGraph).toBe(true)
    expect(opts.initialBriefText).toBe(EXAMPLE_DECISION_BRIEF)
    expect(r).toEqual({ status: 'opened', scenarioId: id })
    expect(useCanvasStore.getState().currentScenarioId).toBe(id)
    expect(localStorage.getItem(POINTER)).toBe(id)
    expect(useBootGraphReadStore.getState().byScenario[id]?.state).toBe('registered')
  })

  it('two clicks → two different fresh ids', async () => {
    register.mockResolvedValue(ACK)
    await openExampleDecision()
    useCanvasStore.setState({ nodes: [], edges: [] })
    await openExampleDecision()
    const ids = register.mock.calls.map((c) => c[0] as string)
    expect(new Set([...ids, PREVIOUS]).size).toBe(3)
  })

  it.each(['conflict', 'unavailable', 'rejected', 'refused', 'notRegistrable'] as const)(
    '⛔ %s → nothing switches: the current scenario and its pointer are untouched',
    async (status) => {
      register.mockResolvedValueOnce({ status })
      const r = await openExampleDecision()
      expect(r).toEqual({ status: 'not_opened', reason: status })
      expect(useCanvasStore.getState().currentScenarioId).toBe(PREVIOUS)
      expect(localStorage.getItem(POINTER)).toBe(PREVIOUS)
    },
  )

  it('⛔ a signed-in session never mints a guest scenario or writes', async () => {
    sessionActive.mockReturnValue(true)
    expect(await openExampleDecision()).toEqual({ status: 'signed_in' })
    expect(register).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().currentScenarioId).toBe(PREVIOUS)
  })

  it('⛔ content that arrived during the write is not replaced: the id does not switch', async () => {
    register.mockImplementationOnce(async () => {
      useCanvasStore.setState({ nodes: [{ id: 'n', position: { x: 0, y: 0 }, data: {} }] as never })
      return ACK
    })
    expect(await openExampleDecision()).toEqual({ status: 'canvas_changed' })
    expect(useCanvasStore.getState().currentScenarioId).toBe(PREVIOUS)
    expect(localStorage.getItem(POINTER)).toBe(PREVIOUS)
  })
})

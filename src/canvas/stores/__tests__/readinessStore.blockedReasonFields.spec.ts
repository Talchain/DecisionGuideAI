/**
 * readinessStore — the STRUCTURED V3 verdict fields the blocked-state copy is
 * composed from must survive the normaliser.
 *
 * ⚠ Why this file exists (adversarial review of PR #520, 28 Jul — MUTATION
 * SURVIVOR M2). Reverting the `options_ready` / `options_total` /
 * `goal_node_valid` forward in `readinessStore.ts` — and NOTHING else — left
 * 314/314 tests GREEN. The forward is the single point where the schema-skew
 * hazard bites: this normaliser builds an EXPLICIT object, so a field not named
 * in it is silently dropped before any UI code can see it, and the composer
 * then loses its cross-check and its `tooFewOptions` rung with no alarm.
 *
 * The pins below therefore run the REAL fetch path (mocked transport, real
 * normaliser, real store) and assert both the fields AND the user-visible
 * consequence at the gate, so the wiring cannot regress under green.
 *
 * ⚠ ANTI-TAUTOLOGY: the fixture is CEE's own V3 graph-readiness body — the one
 * captured from Paul's failing journey on 28 Jul (five options, one
 * `needs_encoding`, `can_run_analysis: false`) — not this repo's types.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'
import { canRunAnalysis } from '../../utils/canRunAnalysis'
import {
  BLOCKED_REASON_COPY,
  selectOptionsNeedingValues,
} from '../../utils/composeBlockedReason'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

/** CEE's V3 body for Paul's model: 5 options, 4 ready, goal present, blocked. */
const CEE_V3_BLOCKED_RESPONSE = {
  readiness_score: 90,
  readiness_level: 'ready',
  confidence_level: 'high',
  confidence_explanation: 'V3 analysis not ready: 1 option(s) blocked: opt_extend',
  can_run_analysis: false,
  improvements: [],
  options_ready: 4,
  options_total: 5,
  goal_node_valid: true,
} as const

const PAUL_ANALYSIS_READY = {
  options: [
    { id: 'opt_build', label: 'Build it in house', status: 'ready' },
    { id: 'opt_buy', label: 'Buy a vendor platform', status: 'ready' },
    { id: 'opt_hybrid', label: 'Hybrid build and buy', status: 'ready' },
    { id: 'opt_wait', label: 'Wait a year', status: 'ready' },
    { id: 'opt_extend', label: 'Partner with a consultancy', status: 'needs_encoding' },
  ],
}

function mockCeeResponse(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

function seedCanvasWithNodes(count: number) {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Factor ${i}`, kind: 'factor' },
  }))
  useCanvasStore.setState({
    nodes: nodes as never,
    edges: [
      {
        id: 'edge-0-1',
        source: 'node-0',
        target: 'node-1',
        data: { weight: 0.5, direction: 'positive' },
      },
    ] as never,
  })
}

/** Drive one full fetch cycle and hand back what the store settled on. */
async function readinessAfterCeeSays(body: Record<string, unknown>) {
  mockFetch.mockResolvedValue(mockCeeResponse(body))
  seedCanvasWithNodes(4)
  useReadinessStore.getState().startListening()
  await vi.runAllTimersAsync()
  const { readiness } = useReadinessStore.getState()
  expect(readiness).not.toBeNull()
  return readiness!
}

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  useReadinessStore.getState().reset()
  clearInflightCache()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe("the verdict's structured fields survive the normaliser", () => {
  it('forwards options_ready, options_total and goal_node_valid verbatim', async () => {
    const readiness = await readinessAfterCeeSays({ ...CEE_V3_BLOCKED_RESPONSE })

    // Pre-forward these were all `undefined` — silently, with no error anywhere.
    expect(readiness.options_ready).toBe(4)
    expect(readiness.options_total).toBe(5)
    expect(readiness.goal_node_valid).toBe(true)
  })

  it('the fetched verdict reaches the gate as the sentence Paul should have seen', async () => {
    // End-to-end pin: transport → normaliser → store → gate → copy.
    //
    // ⚠ HONEST SCOPE. This one does NOT depend on the forward — with the counts
    // absent there is simply no cross-check, and a one-entry list still names
    // its option. It is here for the path, not for the fields. The three tests
    // that DO bite when the forward is reverted are the cross-check, the
    // tooFewOptions and the goal cases below.
    const readiness = await readinessAfterCeeSays({ ...CEE_V3_BLOCKED_RESPONSE })

    const gate = canRunAnalysis({
      graphHealth: null,
      readiness,
      hasBlockers: false,
      nodeCount: 18,
      optionsNeedingValues: selectOptionsNeedingValues(PAUL_ANALYSIS_READY),
    })

    expect(gate.allowed).toBe(false)
    expect(gate.reason).toBe(BLOCKED_REASON_COPY.oneOption('Partner with a consultancy', true))
  })

  it('the stale-evidence cross-check exists ONLY because the counts arrive', async () => {
    // The load-bearing consequence of forwarding options_ready/options_total.
    // The verdict says ONE option is outstanding; the client list carries TWO
    // (a turn landed between the fetch and the render). With the counts
    // forwarded the disagreement is detectable and the copy degrades to the
    // verdict's own number with no name. Without them there is no cross-check
    // at all, and the panel confidently names two options on stale evidence.
    const readiness = await readinessAfterCeeSays({ ...CEE_V3_BLOCKED_RESPONSE })

    const gate = canRunAnalysis({
      graphHealth: null,
      readiness,
      hasBlockers: false,
      nodeCount: 18,
      optionsNeedingValues: [
        { id: 'opt_extend', label: 'Partner with a consultancy' },
        { id: 'opt_wait', label: 'Wait a year' },
      ],
    })

    expect(gate.reason).toBe(BLOCKED_REASON_COPY.manyOptions(1, true))
    expect(gate.reason).not.toContain('Partner with a consultancy')
    expect(gate.reason).not.toContain('Wait a year')
  })

  it('the tooFewOptions rung is reachable only because options_total arrives', async () => {
    const readiness = await readinessAfterCeeSays({
      ...CEE_V3_BLOCKED_RESPONSE,
      options_ready: 1,
      options_total: 1,
    })

    const gate = canRunAnalysis({
      graphHealth: null,
      readiness,
      hasBlockers: false,
      nodeCount: 6,
    })

    expect(gate.reason).toBe(BLOCKED_REASON_COPY.tooFewOptions)
  })

  it('the goal rung is reachable only because goal_node_valid arrives', async () => {
    const readiness = await readinessAfterCeeSays({
      ...CEE_V3_BLOCKED_RESPONSE,
      options_ready: 5,
      options_total: 5,
      goal_node_valid: false,
    })

    const gate = canRunAnalysis({
      graphHealth: null,
      readiness,
      hasBlockers: false,
      nodeCount: 18,
    })

    expect(gate.reason).toBe(BLOCKED_REASON_COPY.goalMissing)
  })
})

describe('malformed or absent fields degrade to LESS SPECIFIC TRUE copy, never a claim', () => {
  it.each([
    ['absent (older CEE / V1 response)', {}],
    ['wrong type', { options_ready: '4', options_total: '5', goal_node_valid: 'yes' }],
    ['null', { options_ready: null, options_total: null, goal_node_valid: null }],
  ])('%s ⇒ undefined, and the gate makes no claim', async (_label, overrides) => {
    const {
      options_ready: _r,
      options_total: _t,
      goal_node_valid: _g,
      ...base
    } = CEE_V3_BLOCKED_RESPONSE
    const readiness = await readinessAfterCeeSays({ ...base, ...overrides })

    expect(readiness.options_ready).toBeUndefined()
    expect(readiness.options_total).toBeUndefined()
    expect(readiness.goal_node_valid).toBeUndefined()

    const gate = canRunAnalysis({
      graphHealth: null,
      readiness,
      hasBlockers: false,
      nodeCount: 18,
    })
    expect(gate.reason).toBe(BLOCKED_REASON_COPY.unspecified)
  })
})

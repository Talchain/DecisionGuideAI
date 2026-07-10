/**
 * R4 UI half — ui_directive dispatcher (surfacing gates 3–5).
 *
 * CEE's first slice (merged dark, CEE PR #408) emits at most ONE directive
 * per fresh run_analysis turn: verb `highlight`, typed target refs, no free
 * text. The UI executes it at applyV5State (the once-per-envelope
 * side-effect site — never render-driven, so re-renders can't re-fire it):
 *
 * - `highlight` targets join the SAME coalesced pulse the applied-edit path
 *   uses (fail-closed in-graph filter, one 2s ring, no viewport movement —
 *   the AI cannot hijack what the user is doing).
 * - Rate limit: exactly ONE directive executed per envelope (the producer
 *   contract); extras are deferred, never silently executed.
 * - `focus` / `open_inspector` are schema-valid but DEFERRED fail-closed in
 *   this slice (viewport/panel-moving verbs need their own rate-limit
 *   design); they must no-op with a deferred record, never crash.
 * - Directives are instructions, not content: the mapper renders nothing
 *   (pinned in mapV5Blocks.holds0150.test.ts); execution must be visible
 *   only as the highlight itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'

const { pulseMock } = vi.hoisted(() => ({ pulseMock: vi.fn() }))
vi.mock('../../canvas/utils/appliedEditPulse', () => ({
  pulseAppliedTargets: pulseMock,
  __resetAppliedEditPulseForTests: vi.fn(),
  PULSE_COALESCE_MS: 100,
  PULSE_DURATION_MS: 2000,
}))

import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

function baseResponse(overrides: Partial<OlumiResponse> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    ...overrides,
  }
}

function makeStore(
  nodes: V5ApplicatorStore['nodes'] = [],
  edges: V5ApplicatorStore['edges'] = [],
): V5ApplicatorStore {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    setGoalConstraints: vi.fn(),
    backfillGoalThreshold: vi.fn(),
    nodes,
    edges,
  }
}

const directive = (verb: string, targets: Array<{ id: string; label: string; kind: string }>) =>
  ({ type: 'ui_directive', verb, targets }) as never

beforeEach(() => {
  pulseMock.mockClear()
})

describe('applyV5State — ui_directive dispatcher (R4)', () => {
  it('executes a highlight directive: one pulse carrying the target ids', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [directive('highlight', [{ id: 'opt_a', label: 'Option A', kind: 'option' }])],
      }),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].nodeIds).toContain('opt_a')
    expect(result.applied).toContain('ui_directive:highlight:opt_a')
  })

  it('routes edge-kind targets to edgeIds (same collapse rule as the pills)', () => {
    applyV5State(
      baseResponse({
        blocks: [
          directive('highlight', [
            { id: 'opt_a', label: 'Option A', kind: 'option' },
            { id: 'e1', label: 'Influence', kind: 'edge' },
          ]),
        ],
      }),
      makeStore(),
    )
    const arg = pulseMock.mock.calls[0][0]
    expect(arg.nodeIds).toEqual(['opt_a'])
    expect(arg.edgeIds).toEqual(['e1'])
  })

  it('RATE LIMIT: only the FIRST directive in an envelope executes; extras are deferred', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [
          directive('highlight', [{ id: 'opt_a', label: 'A', kind: 'option' }]),
          directive('highlight', [{ id: 'opt_b', label: 'B', kind: 'option' }]),
        ],
      }),
      makeStore(),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].nodeIds).toEqual(['opt_a'])
    expect(
      result.deferred.some((d) => d.reason === 'ui_directive_rate_limited'),
    ).toBe(true)
  })

  it('focus verb is DEFERRED fail-closed (viewport-moving verbs are a later slice)', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [directive('focus', [{ id: 'opt_a', label: 'A', kind: 'option' }])],
      }),
      makeStore(),
    )
    expect(pulseMock).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'ui_directive_verb_deferred')).toBe(true)
  })

  it('open_inspector verb is DEFERRED fail-closed', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [directive('open_inspector', [{ id: 'opt_a', label: 'A', kind: 'option' }])],
      }),
      makeStore(),
    )
    expect(pulseMock).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'ui_directive_verb_deferred')).toBe(true)
  })

  it('unknown verb (newer producer) defers without crashing', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [directive('start_tour', [{ id: 'opt_a', label: 'A', kind: 'option' }])],
      }),
      makeStore(),
    )
    expect(pulseMock).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'ui_directive_verb_deferred')).toBe(true)
  })

  it('a directive with no targets defers and never fires an empty pulse', () => {
    const result = applyV5State(
      baseResponse({ blocks: [directive('highlight', [])] }),
      makeStore(),
    )
    expect(pulseMock).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'ui_directive_no_targets')).toBe(true)
  })

  it('a directive pulse coalesces with server-applied patch targets (one pulse per envelope)', () => {
    const node = { id: 'node-1', data: { label: 'Factor', observedState: {} } } as never
    applyV5State(
      baseResponse({
        blocks: [
          {
            type: 'graph_patch',
            status: 'applied',
            operation: 'set_factor_value',
            target_id: 'node-1',
            after: { value: 42 },
          } as never,
          directive('highlight', [{ id: 'opt_a', label: 'A', kind: 'option' }]),
        ],
      }),
      makeStore([node]),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    const arg = pulseMock.mock.calls[0][0]
    expect([...arg.nodeIds].sort()).toEqual(['node-1', 'opt_a'])
  })
})

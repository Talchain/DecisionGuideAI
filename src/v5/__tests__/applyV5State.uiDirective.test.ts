/**
 * R4 UI half — ui_directive dispatcher (surfacing gates 3–5).
 *
 * CEE emits at most ONE directive per turn: a typed verb + typed target refs,
 * no free text. The UI executes it at applyV5State (the once-per-envelope
 * side-effect site — never render-driven, so re-renders can't re-fire it).
 * Three verbs are wired, each reusing the SAME seam a user action uses — the
 * AI can point at the graph, never do something the user cannot:
 *
 * - `highlight` targets join the SAME coalesced pulse the applied-edit path
 *   uses (fail-closed in-graph filter, one 2s ring, no viewport movement).
 * - `focus` centres the viewport on a single target via the guidance
 *   click-to-focus seam (focusNodeById / focusEdgeById).
 * - `open_inspector` selects a single target via the user-selection seam
 *   (selectNodeWithoutHistory / selectEdgeWithoutHistory) so inspector-v2
 *   opens/retargets — selection only, no camera move.
 * - An UNKNOWN verb (a newer producer) DEFERS fail-closed; it must no-op with
 *   a deferred record, never crash.
 * - Rate limit: exactly ONE directive executed per envelope (the producer
 *   contract); extras are deferred, never silently executed.
 * - Every verb is fail-closed on the target id: an off-canvas / unknown id is
 *   recorded not-found and never executed (the negative controls below).
 * - Directives NEVER mutate graph data (no updateNode / updateEdgeData /
 *   setGoalConstraints from any verb).
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

const { focusNodeMock, focusEdgeMock } = vi.hoisted(() => ({
  focusNodeMock: vi.fn(),
  focusEdgeMock: vi.fn(),
}))
vi.mock('../../canvas/utils/focusHelpers', () => ({
  focusNodeById: focusNodeMock,
  focusEdgeById: focusEdgeMock,
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
    selectNodeWithoutHistory: vi.fn(),
    selectEdgeWithoutHistory: vi.fn(),
    goalConstraints: null,
    nodes,
    edges,
  }
}

const directive = (
  verb: string,
  targets: Array<{ id: string; label: string; kind: string }>,
) => ({ type: 'ui_directive', verb, targets }) as never

beforeEach(() => {
  pulseMock.mockClear()
  focusNodeMock.mockClear()
  focusEdgeMock.mockClear()
})

describe('applyV5State — ui_directive dispatcher (R4)', () => {
  it('executes a highlight directive: one pulse carrying the target ids', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [directive('highlight', [{ id: 'opt_a', label: 'Option A', kind: 'option' }])],
      }),
      makeStore([{ id: 'opt_a', data: {} } as never]),
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
      makeStore(
        [{ id: 'opt_a', data: {} } as never],
        [{ id: 'e1', source: 'a', target: 'b' } as never],
      ),
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
      makeStore([
        { id: 'opt_a', data: {} } as never,
        { id: 'opt_b', data: {} } as never,
      ]),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].nodeIds).toEqual(['opt_a'])
    expect(
      result.deferred.some((d) => d.reason === 'ui_directive_rate_limited'),
    ).toBe(true)
  })

  // ── focus ────────────────────────────────────────────────────────────────
  it('focus verb centres the viewport on a NODE via focusNodeById (guidance seam)', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [directive('focus', [{ id: 'opt_a', label: 'A', kind: 'option' }])],
      }),
      makeStore([{ id: 'opt_a', data: {} } as never]),
    )
    expect(focusNodeMock).toHaveBeenCalledTimes(1)
    expect(focusNodeMock).toHaveBeenCalledWith('opt_a')
    expect(focusEdgeMock).not.toHaveBeenCalled()
    expect(pulseMock).not.toHaveBeenCalled()
    expect(result.applied).toContain('ui_directive:focus:opt_a')
  })

  it('focus verb centres the viewport on an EDGE via focusEdgeById', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [directive('focus', [{ id: 'e1', label: 'Influence', kind: 'edge' }])],
      }),
      makeStore([], [{ id: 'e1', source: 'a', target: 'b' } as never]),
    )
    expect(focusEdgeMock).toHaveBeenCalledWith('e1')
    expect(focusNodeMock).not.toHaveBeenCalled()
    expect(result.applied).toContain('ui_directive:focus:e1')
  })

  it('focus NEGATIVE CONTROL: an unknown target id no-ops silently (fail-closed)', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [directive('focus', [{ id: 'ghost', label: 'Deleted', kind: 'option' }])],
      }),
      makeStore([{ id: 'opt_a', data: {} } as never]),
    )
    expect(focusNodeMock).not.toHaveBeenCalled()
    expect(focusEdgeMock).not.toHaveBeenCalled()
    expect(result.applied.some((a) => a.startsWith('ui_directive:focus'))).toBe(false)
    expect(
      result.deferred.some(
        (d) => d.reason === 'ui_directive_target_not_found' && d.detail === 'ghost',
      ),
    ).toBe(true)
  })

  it('focus is single-target: acts on the first resolvable target, defers the rest', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [
          directive('focus', [
            { id: 'opt_a', label: 'A', kind: 'option' },
            { id: 'opt_b', label: 'B', kind: 'option' },
          ]),
        ],
      }),
      makeStore([
        { id: 'opt_a', data: {} } as never,
        { id: 'opt_b', data: {} } as never,
      ]),
    )
    expect(focusNodeMock).toHaveBeenCalledTimes(1)
    expect(focusNodeMock).toHaveBeenCalledWith('opt_a')
    expect(result.applied).toContain('ui_directive:focus:opt_a')
    expect(
      result.deferred.some(
        (d) => d.reason === 'ui_directive_extra_target_ignored' && d.detail === 'opt_b',
      ),
    ).toBe(true)
  })

  // ── open_inspector ─────────────────────────────────────────────────────────
  it('open_inspector selects a NODE via selectNodeWithoutHistory (no camera move)', () => {
    const store = makeStore([{ id: 'opt_a', data: {} } as never])
    const result = applyV5State(
      baseResponse({
        blocks: [directive('open_inspector', [{ id: 'opt_a', label: 'A', kind: 'option' }])],
      }),
      store,
    )
    expect(store.selectNodeWithoutHistory).toHaveBeenCalledWith('opt_a')
    expect(store.selectEdgeWithoutHistory).not.toHaveBeenCalled()
    expect(focusNodeMock).not.toHaveBeenCalled()
    expect(pulseMock).not.toHaveBeenCalled()
    expect(result.applied).toContain('ui_directive:open_inspector:opt_a')
  })

  it('open_inspector selects an EDGE via selectEdgeWithoutHistory', () => {
    const store = makeStore([], [{ id: 'e1', source: 'a', target: 'b' } as never])
    const result = applyV5State(
      baseResponse({
        blocks: [directive('open_inspector', [{ id: 'e1', label: 'Influence', kind: 'edge' }])],
      }),
      store,
    )
    expect(store.selectEdgeWithoutHistory).toHaveBeenCalledWith('e1')
    expect(store.selectNodeWithoutHistory).not.toHaveBeenCalled()
    expect(result.applied).toContain('ui_directive:open_inspector:e1')
  })

  it('open_inspector NEGATIVE CONTROL: an unknown target id no-ops silently (fail-closed)', () => {
    const store = makeStore([{ id: 'opt_a', data: {} } as never])
    const result = applyV5State(
      baseResponse({
        blocks: [directive('open_inspector', [{ id: 'ghost', label: 'Gone', kind: 'option' }])],
      }),
      store,
    )
    expect(store.selectNodeWithoutHistory).not.toHaveBeenCalled()
    expect(store.selectEdgeWithoutHistory).not.toHaveBeenCalled()
    expect(result.applied.some((a) => a.startsWith('ui_directive:open_inspector'))).toBe(false)
    expect(
      result.deferred.some(
        (d) => d.reason === 'ui_directive_target_not_found' && d.detail === 'ghost',
      ),
    ).toBe(true)
  })

  it('unknown verb (newer producer) defers without crashing', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [directive('start_tour', [{ id: 'opt_a', label: 'A', kind: 'option' }])],
      }),
      makeStore(),
    )
    expect(pulseMock).not.toHaveBeenCalled()
    expect(focusNodeMock).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'ui_directive_verb_deferred')).toBe(true)
  })

  it('a DEFERRED first directive (unknown verb) does not burn the budget — the next valid one executes', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [
          directive('start_tour', [{ id: 'opt_a', label: 'A', kind: 'option' }]), // unknown verb
          directive('highlight', [{ id: 'opt_b', label: 'B', kind: 'option' }]),
        ],
      }),
      makeStore([{ id: 'opt_b', data: {} } as never]),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].nodeIds).toEqual(['opt_b'])
    expect(result.deferred.some((d) => d.reason === 'ui_directive_verb_deferred')).toBe(true)
  })

  it('an EXECUTED focus burns the budget — a following highlight is rate-limited', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [
          directive('focus', [{ id: 'opt_a', label: 'A', kind: 'option' }]),
          directive('highlight', [{ id: 'opt_b', label: 'B', kind: 'option' }]),
        ],
      }),
      makeStore([
        { id: 'opt_a', data: {} } as never,
        { id: 'opt_b', data: {} } as never,
      ]),
    )
    expect(focusNodeMock).toHaveBeenCalledTimes(1)
    expect(pulseMock).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'ui_directive_rate_limited')).toBe(true)
  })

  it('an off-canvas target is recorded as not-found, never as an execution (highlight)', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [
          directive('highlight', [
            { id: 'ghost', label: 'Deleted', kind: 'option' },
            { id: 'opt_a', label: 'A', kind: 'option' },
          ]),
        ],
      }),
      makeStore([{ id: 'opt_a', data: {} } as never]),
    )
    expect(pulseMock.mock.calls[0][0].nodeIds).toEqual(['opt_a'])
    expect(result.applied).toContain('ui_directive:highlight:opt_a')
    expect(result.applied).not.toContain('ui_directive:highlight:ghost')
    expect(
      result.deferred.some(
        (d) => d.reason === 'ui_directive_target_not_found' && d.detail === 'ghost',
      ),
    ).toBe(true)
  })

  it('a directive with no targets defers and never fires an empty pulse', () => {
    const result = applyV5State(
      baseResponse({ blocks: [directive('highlight', [])] }),
      makeStore(),
    )
    expect(pulseMock).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'ui_directive_no_targets')).toBe(true)
  })

  it('directives NEVER mutate graph data (no node/edge/constraint writes from any verb)', () => {
    for (const verb of ['highlight', 'focus', 'open_inspector']) {
      const store = makeStore(
        [{ id: 'opt_a', data: {} } as never],
        [{ id: 'e1', source: 'a', target: 'b' } as never],
      )
      applyV5State(
        baseResponse({
          blocks: [directive(verb, [{ id: 'opt_a', label: 'A', kind: 'option' }])],
        }),
        store,
      )
      expect(store.updateNode).not.toHaveBeenCalled()
      expect(store.updateEdgeData).not.toHaveBeenCalled()
      expect(store.setGoalConstraints).not.toHaveBeenCalled()
    }
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
      makeStore([node, { id: 'opt_a', data: {} } as never]),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    const arg = pulseMock.mock.calls[0][0]
    expect([...arg.nodeIds].sort()).toEqual(['node-1', 'opt_a'])
  })
})

// ============================================================================
// 0.32.0 panel verbs (Lane 2, P3 UI agency) — `open_panel` / `open_section`.
//
// These dispatch on `ui_target` (a closed schema vocabulary), NOT graph
// targets, and reuse the SAME seams user-driven navigation uses:
//   - open_panel   → useUIStore.forceActivateOutputTab(tab) — the open+activate
//                    seam auto-dock and Dock-back use (bumps the version
//                    counter so OutputsDock opens even when the tab value is
//                    unchanged).
//   - open_section → useUIStore.requestModelTabSection(section) +
//                    forceActivateOutputTab('diagnostics') — the assistant
//                    variant of PreAnalysisPanel's "See all relationships"
//                    handoff (which uses setActiveOutputTab because ITS dock
//                    is already open; the force variant also opens the dock).
//
// Assertions run against the REAL uiStore (no mock): identity-bound to the
// exact tab id / section id / version-counter semantics the dock consumes.
// ============================================================================
import { useUIStore } from '../../stores/uiStore'

const panelDirective = (verb: string, ui_target: unknown) =>
  ({ type: 'ui_directive', verb, targets: [], ui_target }) as never

describe('applyV5State — ui_directive panel verbs (0.32.0, P3)', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeOutputTab: 'results',
      activeOutputTabVersion: 0,
      activeRightPanel: null,
      pendingModelTabSection: null,
    })
  })

  it('open_panel {kind:tab, id:compare} force-activates the compare tab (value + version bump)', () => {
    const before = useUIStore.getState().activeOutputTabVersion
    const result = applyV5State(
      baseResponse({
        blocks: [panelDirective('open_panel', { kind: 'tab', id: 'compare' })],
      }),
      makeStore(),
    )
    expect(useUIStore.getState().activeOutputTab).toBe('compare')
    expect(useUIStore.getState().activeOutputTabVersion).toBe(before + 1)
    expect(result.applied).toContain('ui_directive:open_panel:compare')
  })

  it('open_panel {kind:tab, id:results} bumps the version even when the tab value is unchanged (the dock-reopen contract)', () => {
    // activeOutputTab is ALREADY 'results' — the force-activate seam must still
    // bump the version counter, because that is what makes OutputsDock's sync
    // effect open the dock when only the version changed.
    const before = useUIStore.getState().activeOutputTabVersion
    const result = applyV5State(
      baseResponse({
        blocks: [panelDirective('open_panel', { kind: 'tab', id: 'results' })],
      }),
      makeStore(),
    )
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(useUIStore.getState().activeOutputTabVersion).toBe(before + 1)
    expect(result.applied).toContain('ui_directive:open_panel:results')
  })

  it('open_section {kind:model_section, id:relationships} requests the section AND activates diagnostics', () => {
    const before = useUIStore.getState().activeOutputTabVersion
    const result = applyV5State(
      baseResponse({
        blocks: [
          panelDirective('open_section', { kind: 'model_section', id: 'relationships' }),
        ],
      }),
      makeStore(),
    )
    expect(useUIStore.getState().pendingModelTabSection).toBe('relationships')
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
    expect(useUIStore.getState().activeOutputTabVersion).toBe(before + 1)
    expect(result.applied).toContain('ui_directive:open_section:relationships')
  })

  it('open_section reaches every schema-legal section id (no dead-end vocabulary)', () => {
    for (const id of ['options', 'factors', 'relationships', 'risks', 'modelcard']) {
      useUIStore.setState({ pendingModelTabSection: null, activeOutputTab: 'results' })
      const result = applyV5State(
        baseResponse({
          blocks: [panelDirective('open_section', { kind: 'model_section', id })],
        }),
        makeStore(),
      )
      expect(useUIStore.getState().pendingModelTabSection).toBe(id)
      expect(result.applied).toContain(`ui_directive:open_section:${id}`)
    }
  })

  it('a panel verb with a MISSING ui_target defers fail-closed and touches nothing', () => {
    const before = useUIStore.getState().activeOutputTabVersion
    const result = applyV5State(
      baseResponse({ blocks: [{ type: 'ui_directive', verb: 'open_panel', targets: [] } as never] }),
      makeStore(),
    )
    expect(result.deferred.some((d) => d.reason === 'ui_directive_missing_ui_target')).toBe(true)
    expect(result.applied.filter((a) => a.startsWith('ui_directive:'))).toEqual([])
    expect(useUIStore.getState().activeOutputTabVersion).toBe(before)
    expect(useUIStore.getState().pendingModelTabSection).toBeNull()
  })

  it('a verb/kind MISMATCH defers fail-closed (open_panel with a model_section target)', () => {
    const before = useUIStore.getState().activeOutputTabVersion
    const result = applyV5State(
      baseResponse({
        blocks: [panelDirective('open_panel', { kind: 'model_section', id: 'relationships' })],
      }),
      makeStore(),
    )
    expect(
      result.deferred.some((d) => d.reason === 'ui_directive_ui_target_kind_mismatch'),
    ).toBe(true)
    expect(useUIStore.getState().activeOutputTabVersion).toBe(before)
    expect(useUIStore.getState().pendingModelTabSection).toBeNull()
  })

  it('RATE LIMIT holds across verb families: a graph directive first, panel second → panel defers', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [
          directive('highlight', [{ id: 'opt_a', label: 'A', kind: 'option' }]),
          panelDirective('open_panel', { kind: 'tab', id: 'compare' }),
        ],
      }),
      makeStore([{ id: 'opt_a', data: {} } as never]),
    )
    expect(result.applied).toContain('ui_directive:highlight:opt_a')
    expect(result.deferred.some((d) => d.reason === 'ui_directive_rate_limited')).toBe(true)
    expect(useUIStore.getState().activeOutputTab).toBe('results') // untouched
  })

  it('RATE LIMIT holds in the other direction: a panel directive BURNS the budget for graph verbs', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [
          panelDirective('open_panel', { kind: 'tab', id: 'compare' }),
          directive('focus', [{ id: 'opt_a', label: 'A', kind: 'option' }]),
        ],
      }),
      makeStore([{ id: 'opt_a', data: {} } as never]),
    )
    expect(result.applied).toContain('ui_directive:open_panel:compare')
    expect(focusNodeMock).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'ui_directive_rate_limited')).toBe(true)
  })

  it('an INVALID panel directive does not burn the budget — the next valid one executes', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [
          { type: 'ui_directive', verb: 'open_panel', targets: [] } as never, // missing ui_target
          panelDirective('open_section', { kind: 'model_section', id: 'risks' }),
        ],
      }),
      makeStore(),
    )
    expect(result.deferred.some((d) => d.reason === 'ui_directive_missing_ui_target')).toBe(true)
    expect(result.applied).toContain('ui_directive:open_section:risks')
    expect(useUIStore.getState().pendingModelTabSection).toBe('risks')
  })

  it('panel verbs NEVER mutate graph data and are NOT routed to the unknown-verb defer', () => {
    for (const [verb, ui_target] of [
      ['open_panel', { kind: 'tab', id: 'results' }],
      ['open_section', { kind: 'model_section', id: 'factors' }],
    ] as const) {
      const store = makeStore(
        [{ id: 'opt_a', data: {} } as never],
        [{ id: 'e1', source: 'a', target: 'b' } as never],
      )
      const result = applyV5State(
        baseResponse({ blocks: [panelDirective(verb, ui_target)] }),
        store,
      )
      expect(store.updateNode).not.toHaveBeenCalled()
      expect(store.updateEdgeData).not.toHaveBeenCalled()
      expect(store.setGoalConstraints).not.toHaveBeenCalled()
      expect(result.deferred.some((d) => d.reason === 'ui_directive_verb_deferred')).toBe(false)
      expect(pulseMock).not.toHaveBeenCalled()
      expect(focusNodeMock).not.toHaveBeenCalled()
      expect(focusEdgeMock).not.toHaveBeenCalled()
    }
  })

  it('a truly unknown verb (a FUTURE producer) still defers via ui_directive_verb_deferred', () => {
    const result = applyV5State(
      baseResponse({
        blocks: [panelDirective('open_settings', { kind: 'tab', id: 'results' })],
      }),
      makeStore(),
    )
    expect(result.deferred.some((d) => d.reason === 'ui_directive_verb_deferred')).toBe(true)
    expect(result.applied.filter((a) => a.startsWith('ui_directive:'))).toEqual([])
  })
})

/**
 * CEE response consumption — UI-side cross-boundary contract tests.
 *
 * Loads the 6 fixtures copied from olumi-assistants-service (byte-identical
 * to tests/fixtures/cross-service/) and asserts that:
 *   1. The draft adapter (adaptDraftResponse + mapDraftCoachingFromResponse)
 *      preserves coaching, provenance, and partial-coaching graceful
 *      degradation.
 *   2. The store lifecycle (setDraftCoaching + resetCanvas) clears coaching
 *      state correctly across draft transitions.
 *   3. The V5 response router (routeV5Response) classifies stale, fresh,
 *      and failure responses correctly.
 *   4. No raw entity-IDs (fac_, opt_, etc.) leak through into the user-
 *      facing prose paths the UI renders.
 *
 * Tests classified `not_route_verified` are noted in the report; the V5
 * happy-path rendering needs full conversation/canvas mounting which is
 * out of scope for v1 of this brief.
 */
import { describe, it, expect } from 'vitest'

import draftWithCoaching from '../fixtures/cee-responses/draft-graph.success.with-coaching-and-provenance.json'
import draftNoCoaching from '../fixtures/cee-responses/draft-graph.success.no-coaching.json'
import draftPartialCoaching from '../fixtures/cee-responses/draft-graph.success.partial-coaching.json'
import v5Stale from '../fixtures/cee-responses/v5-turn.explain-stale.json'
import v5Failure from '../fixtures/cee-responses/v5-turn.failure-with-recovery-chip.json'
import v5Fresh from '../fixtures/cee-responses/v5-turn.explain-fresh.json'

import {
  adaptDraftResponse,
  mapDraftCoachingFromResponse,
} from '../../src/adapters/cee/client'
import { edgeProvenanceDisplayPatch } from '../../src/canvas/utils/draftIngestion'
import { useCanvasStore } from '../../src/canvas/store'
import { routeV5Response } from '../../src/v5/responseRouter'
import type { OlumiResponse } from '@talchain/schemas/boundary'

// Canonical source: olumi-assistants-service/src/orchestrator/shared/entity-id-pattern.ts:25
const ENTITY_ID_LEAK_RE =
  /\b(?:fac|opt|goal|dec|out|risk|con|factor|option|decision|outcome|constraint)[_:-][a-z0-9_:-]+\b/i

// User-facing prose paths in the adapter output. Anything else (node ids,
// edge from/to, intervention map keys, etc.) is structural by design.
const USER_FACING_DRAFT_PATHS = [
  'coaching.summary',
  'coaching.strengthen_items[*].label',
  'coaching.strengthen_items[*].detail',
  'coaching.widening_log[*].label',
  'coaching.widening_log[*].reason',
  'coaching.bias_signals[*].detail',
  'nodes[*].label',
  'nodes[*].description',
  'edges[*].provenance.reasoning',
  'options[*].label',
  'options[*].description',
]

const USER_FACING_V5_PATHS = [
  'assistant_text',
  'blocks[*].narrative',
  'blocks[*].content',
  'blocks[*].summary',
  'suggested_actions[*].label',
  'suggested_actions[*].message',
  'insights[*].text',
]

function* walkStrings(value: unknown, path: string): Generator<[string, string]> {
  if (typeof value === 'string') {
    yield [path, value]
  } else if (Array.isArray(value)) {
    for (const child of value) {
      const childPath = path ? `${path}[*]` : '[*]'
      yield* walkStrings(child, childPath)
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      yield* walkStrings(v, path ? `${path}.${k}` : k)
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Draft response consumption
// ──────────────────────────────────────────────────────────────────────────

describe('draft-graph response consumption', () => {
  it('full coaching preserved — fixture 1 → camelCase coaching state', () => {
    const result = adaptDraftResponse(draftWithCoaching)
    expect(result.draftCoaching).not.toBeNull()
    const c = result.draftCoaching!
    expect(typeof c.summary).toBe('string')
    expect(c.summary!.length).toBeGreaterThan(0)
    expect(c.strengthenItems.length).toBeGreaterThanOrEqual(2)
    expect(c.wideningLog.length).toBeGreaterThanOrEqual(2)
    expect(c.biasSignals.length).toBeGreaterThanOrEqual(1)

    // Strengthen items keep all five wire fields when present
    const item = c.strengthenItems[0]
    expect(item).toMatchObject({
      id: expect.any(String),
      label: expect.any(String),
      detail: expect.any(String),
      actionType: expect.any(String),
    })

    // wideningLog wire field node_id mapped to camelCase nodeId
    expect(c.wideningLog[0]).toMatchObject({
      nodeId: expect.any(String),
      label: expect.any(String),
      reason: expect.any(String),
    })

    // biasSignals preserve target as-is (structural pointer)
    expect(c.biasSignals[0]).toMatchObject({
      type: expect.any(String),
      detail: expect.any(String),
    })
  })

  it('no coaching graceful — fixture 2 → coaching is null, no error', () => {
    const result = adaptDraftResponse(draftNoCoaching)
    expect(result.draftCoaching).toBeNull()
    expect(result.nodes.length).toBeGreaterThan(0)
  })

  it('partial coaching graceful — fixture 3 → summary null, arrays empty', () => {
    const result = adaptDraftResponse(draftPartialCoaching)
    expect(result.draftCoaching).not.toBeNull()
    const c = result.draftCoaching!
    expect(c.summary).toBeNull()
    expect(c.strengthenItems).toEqual([])
    expect(c.wideningLog).toEqual([])
    expect(c.biasSignals).toEqual([])
  })

  it('node provenance preserved on adapted nodes — fixture 1', () => {
    const result = adaptDraftResponse(draftWithCoaching)
    const valid = new Set(['from_brief', 'ai_inferred', 'user_set'])
    const observed = new Set<string>()
    for (const n of result.nodes as Array<Record<string, unknown>>) {
      const p = n.provenance
      if (typeof p === 'string') {
        expect(valid.has(p)).toBe(true)
        observed.add(p)
      }
    }
    expect(observed.size).toBeGreaterThanOrEqual(3)
  })

  it('edge provenance_display → camelCase provenanceDisplay via edgeProvenanceDisplayPatch — fixture 1', () => {
    const fixture = draftWithCoaching as { edges: Array<Record<string, unknown>> }
    const valid = new Set(['from_brief', 'ai_inferred', 'user_set'])
    const observed = new Set<string>()
    for (const e of fixture.edges) {
      const patch = edgeProvenanceDisplayPatch(e)
      if (patch.provenanceDisplay) {
        expect(valid.has(patch.provenanceDisplay)).toBe(true)
        observed.add(patch.provenanceDisplay)
      }
    }
    expect(observed.size).toBeGreaterThanOrEqual(3)
  })

  it('missing provenance_display graceful — patch returns empty object', () => {
    expect(edgeProvenanceDisplayPatch({})).toEqual({})
    expect(edgeProvenanceDisplayPatch({ provenance_display: 'invalid' })).toEqual({})
    expect(edgeProvenanceDisplayPatch({ provenance_display: 'from_brief' })).toEqual({
      provenanceDisplay: 'from_brief',
    })
  })

  it('mapDraftCoachingFromResponse handles null/non-object input', () => {
    expect(mapDraftCoachingFromResponse(null)).toBeNull()
    expect(mapDraftCoachingFromResponse(undefined)).toBeNull()
    expect(mapDraftCoachingFromResponse('not an object')).toBeNull()
  })

  it('bias_signals[].target is a structural pointer — preserved as-is, not user-facing prose', () => {
    const result = adaptDraftResponse(draftWithCoaching)
    const signal = result.draftCoaching!.biasSignals[0]
    // target is preserved verbatim (it's a node-id pointer the UI uses for highlighting)
    expect(typeof signal.target === 'string' || signal.target === undefined).toBe(true)
    if (signal.target) {
      // The signal.detail should NOT contain the literal target ID — that's
      // the contract. Detail is user-facing prose; target is structural.
      expect(signal.detail.includes(signal.target)).toBe(false)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Store lifecycle
// ──────────────────────────────────────────────────────────────────────────

describe('canvas store coaching lifecycle', () => {
  // resetCanvas requires existing nodes/edges to fire — push minimal state first.
  function withGraphState(): void {
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test', kind: 'goal' } }],
      edges: [],
    })
  }

  it('coaching populated after setDraftCoaching with fixture 1 result', () => {
    const result = adaptDraftResponse(draftWithCoaching)
    useCanvasStore.getState().setDraftCoaching(result.draftCoaching!)
    expect(useCanvasStore.getState().draftCoaching).toEqual(result.draftCoaching)
  })

  it('coaching cleared by resetCanvas', () => {
    const r1 = adaptDraftResponse(draftWithCoaching)
    useCanvasStore.getState().setDraftCoaching(r1.draftCoaching!)
    expect(useCanvasStore.getState().draftCoaching).not.toBeNull()

    withGraphState()
    useCanvasStore.getState().resetCanvas()
    expect(useCanvasStore.getState().draftCoaching).toBeNull()
  })

  it('stale-coaching guard: applying fixture 1 then fixture 2 (no coaching) clears state', () => {
    const r1 = adaptDraftResponse(draftWithCoaching)
    useCanvasStore.getState().setDraftCoaching(r1.draftCoaching!)
    expect(useCanvasStore.getState().draftCoaching).not.toBeNull()

    const r2 = adaptDraftResponse(draftNoCoaching)
    useCanvasStore.getState().setDraftCoaching(r2.draftCoaching) // null
    expect(useCanvasStore.getState().draftCoaching).toBeNull()
  })

  it('partial-coaching guard: applying fixture 1 then fixture 3 leaves no leftover', () => {
    const r1 = adaptDraftResponse(draftWithCoaching)
    useCanvasStore.getState().setDraftCoaching(r1.draftCoaching!)
    expect(useCanvasStore.getState().draftCoaching!.strengthenItems.length).toBeGreaterThan(0)

    const r3 = adaptDraftResponse(draftPartialCoaching)
    useCanvasStore.getState().setDraftCoaching(r3.draftCoaching!)
    const after = useCanvasStore.getState().draftCoaching!
    expect(after.summary).toBeNull()
    expect(after.strengthenItems).toEqual([])
    expect(after.wideningLog).toEqual([])
    expect(after.biasSignals).toEqual([])
  })
})

// ──────────────────────────────────────────────────────────────────────────
// V5 turn consumption
// ──────────────────────────────────────────────────────────────────────────

describe('V5 turn response consumption', () => {
  it('responseRouter classifies fixture 4 (stale explanation) as blocks', () => {
    const route = routeV5Response({
      kind: 'olumi_response',
      response: v5Stale as unknown as OlumiResponse,
    } as never)
    expect(route.kind).toBe('blocks')
    if (route.kind === 'blocks') {
      // Staleness prefix is preserved verbatim in assistant_text
      expect(route.response.assistant_text.startsWith(
        'These results are from a prior run',
      )).toBe(true)
      // Rerun chip is the only suggested_action with action_type=run_analysis
      const runAnalysisChips = route.response.suggested_actions.filter(
        (c) => c.action_type === 'run_analysis',
      )
      expect(runAnalysisChips).toHaveLength(1)
      expect(runAnalysisChips[0].label).toBe('Rerun analysis')
    }
  })

  it('responseRouter classifies fixture 5 (failure with error block) as typed_error', () => {
    const route = routeV5Response({
      kind: 'olumi_response',
      response: v5Failure as unknown as OlumiResponse,
    } as never)
    expect(route.kind).toBe('typed_error')
    if (route.kind === 'typed_error') {
      expect(route.code).toBe('UPSTREAM_TIMEOUT')
    }
  })

  it('fixture 5 (failure) carries a non-empty recovery chip with the previous user message', () => {
    expect(v5Failure.suggested_actions.length).toBeGreaterThanOrEqual(1)
    const chip = v5Failure.suggested_actions[0]
    expect(chip.label).toBe('Try again')
    // Prompt-style chips OMIT action_type
    expect((chip as { action_type?: string }).action_type).toBeUndefined()
    expect(chip.message.length).toBeGreaterThan(0)
  })

  it('responseRouter classifies fixture 6 (fresh explanation) as blocks with no rerun chip', () => {
    const route = routeV5Response({
      kind: 'olumi_response',
      response: v5Fresh as unknown as OlumiResponse,
    } as never)
    expect(route.kind).toBe('blocks')
    if (route.kind === 'blocks') {
      expect(route.response.assistant_text.startsWith(
        'These results are from a prior run',
      )).toBe(false)
      const runAnalysisChips = route.response.suggested_actions.filter(
        (c) => c.action_type === 'run_analysis',
      )
      expect(runAnalysisChips).toHaveLength(0)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Output safety — entity-ID and forbidden-term scans
// ──────────────────────────────────────────────────────────────────────────

const FORBIDDEN_USER_TEXT = [
  'winner',
  'recommended',
  'error',
  'failed',
  'handler',
  'Zod',
  'executor',
  'AI service',
]

describe('rendered output safety (path-aware scans)', () => {
  it('no entity-ID leaks in user-facing draft-graph prose paths (fixture 1)', () => {
    for (const [path, str] of walkStrings(draftWithCoaching, '')) {
      const normalised = path.replace(/\[\d+\]/g, '[*]')
      if (!USER_FACING_DRAFT_PATHS.includes(normalised)) continue
      // Apply the same regex the CEE egress guard uses; the UI never
      // resolves entity IDs (no graph context here), so any match is a
      // contract violation. The CEE-side test validates "confirmed leaks
      // only" using the production sanitiser; on the UI side there is no
      // sanitiser — every leak is by definition unconfirmed but visible.
      expect(
        ENTITY_ID_LEAK_RE.test(str),
        `entity-ID leak at ${path}: ${str.slice(0, 120)}`,
      ).toBe(false)
    }
  })

  it('no entity-ID leaks in user-facing V5 prose paths (fixtures 4-6)', () => {
    for (const fixture of [v5Stale, v5Failure, v5Fresh]) {
      for (const [path, str] of walkStrings(fixture, '')) {
        const normalised = path.replace(/\[\d+\]/g, '[*]')
        if (!USER_FACING_V5_PATHS.includes(normalised)) continue
        expect(
          ENTITY_ID_LEAK_RE.test(str),
          `entity-ID leak at ${path}: ${str.slice(0, 120)}`,
        ).toBe(false)
      }
    }
  })

  it('no forbidden terms in user-facing draft-graph prose (fixture 1)', () => {
    for (const [path, str] of walkStrings(draftWithCoaching, '')) {
      const normalised = path.replace(/\[\d+\]/g, '[*]')
      if (!USER_FACING_DRAFT_PATHS.includes(normalised)) continue
      const lower = str.toLowerCase()
      for (const term of FORBIDDEN_USER_TEXT) {
        expect(
          lower.includes(term.toLowerCase()),
          `forbidden term '${term}' at ${path}: ${str.slice(0, 120)}`,
        ).toBe(false)
      }
    }
  })

  it('no forbidden terms in user-facing V5 prose (fixtures 4-6)', () => {
    for (const fixture of [v5Stale, v5Failure, v5Fresh]) {
      for (const [path, str] of walkStrings(fixture, '')) {
        const normalised = path.replace(/\[\d+\]/g, '[*]')
        if (!USER_FACING_V5_PATHS.includes(normalised)) continue
        const lower = str.toLowerCase()
        for (const term of FORBIDDEN_USER_TEXT) {
          expect(
            lower.includes(term.toLowerCase()),
            `forbidden term '${term}' at ${path}: ${str.slice(0, 120)}`,
          ).toBe(false)
        }
      }
    }
  })

  it('bias_signals[].target is NEVER concatenated into bias_signals[].detail (fixture 1)', () => {
    const result = adaptDraftResponse(draftWithCoaching)
    for (const signal of result.draftCoaching!.biasSignals) {
      if (signal.target) {
        expect(
          signal.detail.includes(signal.target),
          `bias signal detail leaks target '${signal.target}': ${signal.detail.slice(0, 120)}`,
        ).toBe(false)
      }
    }
  })
})

/**
 * Provenance honesty across the boot merge — adversarial-review finding A1.
 *
 * The three probes the review reproduced by execution, turned into
 * identity-bound pins. Every assertion below names its node by ID and asserts
 * through the SAME predicates the UI paints with (`isReviewedByUser`,
 * `isReviewedEdge`) rather than by poking at a key a renderer may not read —
 * a value predicate another object could satisfy is how a test passes on the
 * wrong object (trap 19).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import {
  isReviewedByUser,
  isReviewedEdge,
} from '../../components/pre-analysis/utils/isReviewedByUser'

const SCENARIO = '11111111-2222-4333-8444-555555555555'

function seed(nodes: unknown[], edges: unknown[] = []): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: structuredClone(nodes) as never,
    edges: structuredClone(edges) as never,
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
  } as never)
}

function nodeById(id: string): Node {
  return useCanvasStore.getState().nodes.find((n: any) => n.id === id) as unknown as Node
}
function edgeById(id: string): Edge {
  return useCanvasStore.getState().edges.find((e: any) => e.id === id) as unknown as Edge
}

/** A node stamped in the CAMEL key only — the shape probe (a) is about. */
function camelStampedNode(value: number) {
  return {
    id: 'factor-1',
    type: 'factor',
    position: { x: 10, y: 20 },
    data: {
      label: 'Spend',
      kind: 'factor',
      observedState: { value, source: 'user' },
    },
  }
}

/** A node stamped in BOTH keys — what `withObservedStateUpdate` writes. */
function dualStampedNode(value: number) {
  return {
    id: 'factor-1',
    type: 'factor',
    position: { x: 10, y: 20 },
    data: {
      label: 'Spend',
      kind: 'factor',
      observedState: { value, source: 'user' },
      observed_state: { value, source: 'user' },
    },
  }
}

/** CEE's bag can never carry a user source — the enum has no such member. */
function serverNode(value: number, source = 'cee_inference') {
  return {
    id: 'factor-1',
    kind: 'factor',
    label: 'Spend',
    observed_state: { value, source },
  }
}

beforeEach(() => {
  seed([camelStampedNode(0.6)])
})

describe('A1 probe 1 — an IDENTICAL round-trip must PRESERVE the stamp', () => {
  it('keeps "checked by you" when the server returns the same value', () => {
    seed([camelStampedNode(0.6)])
    mergeServerGraphOnHydrate({ nodes: [serverNode(0.6)], edges: [] })
    expect(isReviewedByUser(nodeById('factor-1'))).toBe(true)
  })

  it('keeps it on a DUAL-key node too, in both spellings', () => {
    seed([dualStampedNode(0.6)])
    mergeServerGraphOnHydrate({ nodes: [serverNode(0.6)], edges: [] })
    const data = nodeById('factor-1').data as any
    expect(data.observedState.source).toBe('user')
    expect(data.observed_state.source).toBe('user')
    expect(isReviewedByUser(nodeById('factor-1'))).toBe(true)
  })

  it('does not INVENT the snake key on a camel-only node', () => {
    seed([camelStampedNode(0.6)])
    mergeServerGraphOnHydrate({ nodes: [serverNode(0.6)], edges: [] })
    const data = nodeById('factor-1').data as any
    expect(data.observedState.source).toBe('user')
    expect(data.observed_state).toBeUndefined()
  })

  it('a stamp-only round-trip is a STRICT no-op — no store write', () => {
    seed([camelStampedNode(0.6)])
    const before = useCanvasStore.getState().nodes
    const res = mergeServerGraphOnHydrate({ nodes: [serverNode(0.6)], edges: [] })
    expect(res.updatedNodeCount).toBe(0)
    expect(useCanvasStore.getState().nodes).toBe(before)
  })
})

describe('A1 probe 2 — a CHANGED value must kill the review claim in BOTH spellings', () => {
  it('clears the stamp when the server moves the number', () => {
    seed([camelStampedNode(0.6)])
    mergeServerGraphOnHydrate({ nodes: [serverNode(0.9)], edges: [] })
    expect(nodeById('factor-1').data).toMatchObject({ observedState: { value: 0.9 } })
    expect(isReviewedByUser(nodeById('factor-1'))).toBe(false)
  })

  it('THE FALSE-REVIEW CASE: the SNAKE stamp must not survive a changed value', () => {
    // `isReviewedByUser` resolves snake BEFORE camel, and the mapper never
    // emits the snake key — so without an explicit clear the badge claims
    // "checked by you" over the SERVER'S number. This is the assertion that
    // goes RED if the snake-clear is dropped.
    seed([dualStampedNode(0.6)])
    mergeServerGraphOnHydrate({ nodes: [serverNode(0.9)], edges: [] })

    const data = nodeById('factor-1').data as any
    expect(data.observedState.value).toBe(0.9)
    expect(data.observed_state?.source).toBeUndefined()
    expect(data.observedState?.source).not.toBe('user')
    expect(isReviewedByUser(nodeById('factor-1'))).toBe(false)
  })

  it('clears a TOP-LEVEL data.source user stamp too (the third rung)', () => {
    seed([
      {
        id: 'factor-1',
        type: 'factor',
        position: { x: 10, y: 20 },
        data: {
          label: 'Spend',
          kind: 'factor',
          source: 'user_confirmed',
          observedState: { value: 0.6 },
        },
      },
    ])
    mergeServerGraphOnHydrate({ nodes: [serverNode(0.9)], edges: [] })
    expect((nodeById('factor-1').data as any).source).toBeUndefined()
    expect(isReviewedByUser(nodeById('factor-1'))).toBe(false)
  })

  it('leaves a PRODUCER stamp alone — the server owns that field', () => {
    seed([
      {
        id: 'factor-1',
        type: 'factor',
        position: { x: 10, y: 20 },
        data: {
          label: 'Spend',
          kind: 'factor',
          observedState: { value: 0.6, source: 'brief_extraction' },
        },
      },
    ])
    mergeServerGraphOnHydrate({ nodes: [serverNode(0.9, 'cee_inference')], edges: [] })
    expect((nodeById('factor-1').data as any).observedState.source).toBe('cee_inference')
  })
})

describe('A1 probe 3 — an edge stamp must not outlive the weight it describes', () => {
  const edge = (weight: number) => ({
    id: 'e1',
    source: 'factor-1',
    target: 'goal-1',
    data: { weight, userReviewedStrength: true },
  })

  const nodes = () => [
    camelStampedNode(0.6),
    { id: 'goal-1', type: 'goal', position: { x: 300, y: 40 }, data: { label: 'Profit', kind: 'goal' } },
  ]

  it('clears userReviewedStrength when the server changes the weight', () => {
    seed(nodes(), [edge(0.7)])
    mergeServerGraphOnHydrate({
      nodes: [serverNode(0.6)],
      edges: [{ id: 'e1', from: 'factor-1', to: 'goal-1', weight: 0.2 }],
    })
    expect((edgeById('e1').data as any).weight).toBe(0.2)
    expect(isReviewedEdge(edgeById('e1'))).toBe(false)
  })

  it('KEEPS userReviewedStrength when the weight is unchanged', () => {
    seed(nodes(), [edge(0.7)])
    mergeServerGraphOnHydrate({
      nodes: [serverNode(0.6)],
      edges: [{ id: 'e1', from: 'factor-1', to: 'goal-1', weight: 0.7 }],
    })
    expect(isReviewedEdge(edgeById('e1'))).toBe(true)
  })
})

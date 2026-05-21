/**
 * Regression: V5 fresh-draft → applyLayout → non-stacked positions.
 *
 * The class of bug this guards against (2026-05-13 P0):
 *   1. V5 response carries an inline draft_graph with N nodes.
 *   2. `applyDraftResult` writes every node at position `{0,0}` and calls
 *      `setPendingLayout(true, { isFirstLoad: true })`. The second arg
 *      signals layoutGraph to subtract ANALYSIS_PANEL_WIDTH from the
 *      canvas on this first auto-arrange so the freshly laid-out graph
 *      fits the visible area with the dock open. Keep this assertion in
 *      sync with applyDraftResult's layout signal — both the source call
 *      shape in `src/canvas/utils/applyDraftResult.ts` and the direct
 *      assertion in `src/canvas/utils/__tests__/applyDraftResult.spec.ts`
 *      must be updated together if the call shape changes again.
 *   3. The measure-then-layout pipeline (or its 500 ms fallback) calls
 *      `applyLayout()`, which reads `pendingLayoutIsFirstLoad` from the
 *      store and threads it through to layoutGraph as `{ isFirstLoad }`.
 *   4. Expected: positions become non-zero; no "Layout failed" banner.
 *
 * Two parallel suites:
 *   A. **Direct applyLayout** — seeds nodes at {0,0}, calls
 *      `store.applyLayout()`. Isolates layoutGraph / ELK / post-ELK steps.
 *   B. **Full applyDraftResult chain** — calls `applyDraftResult` with a
 *      realistic CEE-shaped fixture (nodes, edges, analysis_ready,
 *      quality), then drives layout via `handleLayoutWithRecovery`. Tests
 *      the same code path the live V5 inline-draft flow uses (sans the
 *      React Flow measurement gate, which is exercised by
 *      ReactFlowGraph.layoutLifecycle.integration.spec.tsx).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { applyDraftResult } from '../utils/applyDraftResult'
import { useLayoutProgressStore } from '../layoutProgressStore'
import { handleLayoutWithRecovery } from '../layout/handleLayoutWithRecovery'

interface BuildOpts {
  factors: number
  options: number
  risks: number
}

function buildGraphAtOrigin(opts: BuildOpts): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  nodes.push({
    id: 'decision',
    type: 'decision',
    position: { x: 0, y: 0 },
    data: { label: 'Decision', kind: 'decision' },
  })

  for (let i = 0; i < opts.options; i++) {
    const id = `option-${i}`
    nodes.push({
      id,
      type: 'option',
      position: { x: 0, y: 0 },
      data: { label: `Option ${i}`, kind: 'option' },
    })
    edges.push({ id: `e-d-${id}`, source: 'decision', target: id, type: 'styled' })
  }

  for (let i = 0; i < opts.factors; i++) {
    const id = `factor-${i}`
    nodes.push({
      id,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: `Factor ${i}`, kind: 'factor' },
    })
    const opt = `option-${i % Math.max(1, opts.options)}`
    edges.push({ id: `e-${opt}-${id}`, source: opt, target: id, type: 'styled' })
  }

  for (let i = 0; i < opts.risks; i++) {
    const id = `risk-${i}`
    nodes.push({
      id,
      type: 'risk',
      position: { x: 0, y: 0 },
      data: { label: `Risk ${i}`, kind: 'risk' },
    })
    edges.push({ id: `e-d-${id}`, source: 'decision', target: id, type: 'styled' })
  }

  nodes.push({
    id: 'goal',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Goal', kind: 'goal' },
  })
  for (const n of nodes) {
    if (n.id === 'goal' || n.id === 'decision' || n.type === 'option') continue
    edges.push({ id: `e-${n.id}-goal`, source: n.id, target: 'goal', type: 'styled' })
  }

  return { nodes, edges }
}

function buildCeeDraftPayload(opts: BuildOpts): unknown {
  // CEE draft shape mirrors what applyDraftResult expects: nodes have
  // `id`, `kind`, `label`, optional `observed_state`. Edges use `from`/`to`.
  const optionIds: string[] = []
  const factorIds: string[] = []
  const riskIds: string[] = []

  const rawNodes: Array<Record<string, unknown>> = []
  rawNodes.push({ id: 'decision', kind: 'decision', label: 'Decision' })

  for (let i = 0; i < opts.options; i++) {
    const id = `option-${i}`
    optionIds.push(id)
    rawNodes.push({ id, kind: 'option', label: `Option ${i}` })
  }
  for (let i = 0; i < opts.factors; i++) {
    const id = `factor-${i}`
    factorIds.push(id)
    rawNodes.push({ id, kind: 'factor', label: `Factor ${i}`, observed_state: { value: 0.5, baseline: 0.5 } })
  }
  for (let i = 0; i < opts.risks; i++) {
    const id = `risk-${i}`
    riskIds.push(id)
    rawNodes.push({ id, kind: 'risk', label: `Risk ${i}` })
  }
  rawNodes.push({ id: 'goal', kind: 'goal', label: 'Goal' })

  const rawEdges: Array<Record<string, unknown>> = []
  for (const oid of optionIds) {
    rawEdges.push({ id: `e-d-${oid}`, from: 'decision', to: oid, weight: 0.5, belief: 0.8 })
  }
  factorIds.forEach((fid, i) => {
    const oid = optionIds[i % Math.max(1, optionIds.length)] ?? 'decision'
    rawEdges.push({ id: `e-${oid}-${fid}`, from: oid, to: fid, weight: 0.5, belief: 0.7 })
  })
  for (const rid of riskIds) {
    rawEdges.push({ id: `e-d-${rid}`, from: 'decision', to: rid, weight: 0.5, belief: 0.6 })
  }
  for (const n of rawNodes) {
    if (n.id === 'goal' || n.id === 'decision' || n.kind === 'option') continue
    rawEdges.push({ id: `e-${n.id as string}-goal`, from: n.id, to: 'goal', weight: 0.5, belief: 0.7 })
  }

  // analysis_ready: minimal valid shape (just enough for hasAnalysisReady()).
  return {
    nodes: rawNodes,
    edges: rawEdges,
    analysis_ready: {
      goal_node_id: 'goal',
      options: optionIds.map((id) => ({ id, label: id, interventions: {}, is_baseline: false })),
    },
    quality: { overall: 7, structure: 7, coverage: 7, causality: 7, safety: 7 },
  }
}

function isStacked(nodes: Node[]): boolean {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity
  for (const n of nodes) {
    const x = typeof n.position?.x === 'number' ? n.position.x : 0
    const y = typeof n.position?.y === 'number' ? n.position.y : 0
    xMin = Math.min(xMin, x); xMax = Math.max(xMax, x)
    yMin = Math.min(yMin, y); yMax = Math.max(yMax, y)
  }
  return (xMax - xMin) < 40 && (yMax - yMin) < 40
}

const cases: Array<{ name: string; shape: BuildOpts; expectedTotal: number }> = [
  { name: '5 nodes',  shape: { factors: 2, options: 1, risks: 0 }, expectedTotal: 5 },
  { name: '12 nodes', shape: { factors: 8, options: 2, risks: 0 }, expectedTotal: 12 },
  { name: '16 nodes', shape: { factors: 10, options: 3, risks: 1 }, expectedTotal: 16 },
  { name: '30 nodes', shape: { factors: 23, options: 4, risks: 1 }, expectedTotal: 30 },
]

describe('A. Direct applyLayout on nodes at {0,0}', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  for (const c of cases) {
    it(`${c.name} — succeeds and produces non-stacked positions`, async () => {
      const { nodes, edges } = buildGraphAtOrigin(c.shape)
      expect(nodes.length).toBe(c.expectedTotal)
      expect(isStacked(nodes)).toBe(true)

      useCanvasStore.setState({ nodes, edges, pendingLayout: true })

      let threw: unknown = null
      try {
        await useCanvasStore.getState().applyLayout({ skipHistory: true })
      } catch (err) {
        threw = err
      }

      expect(threw).toBe(null)
      const state = useCanvasStore.getState()
      expect(state.pendingLayout).toBe(false)
      expect(state.layoutInProgress).toBe(false)
      expect(isStacked(state.nodes)).toBe(false)
    })
  }
})

describe('B. Full applyDraftResult chain + handleLayoutWithRecovery', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    useLayoutProgressStore.getState().cancel()
  })

  for (const c of cases) {
    it(`${c.name} — applyDraftResult writes at origin, handleLayoutWithRecovery succeeds, no failure banner`, async () => {
      const payload = buildCeeDraftPayload(c.shape) as Parameters<typeof applyDraftResult>[0]
      const result = applyDraftResult(payload)
      expect(result.nodeCount).toBe(c.expectedTotal)

      // After applyDraftResult: all nodes at {0,0}, pendingLayout=true.
      const afterDraft = useCanvasStore.getState()
      expect(isStacked(afterDraft.nodes)).toBe(true)
      expect(afterDraft.pendingLayout).toBe(true)
      expect(afterDraft.layoutRequestId).toBeGreaterThan(0)

      // Drive the same path useMeasureThenLayout uses on fallback fire.
      const capturedId = afterDraft.layoutRequestId
      await new Promise<void>((resolve, reject) => {
        let settled = false
        handleLayoutWithRecovery(
          () => useCanvasStore.getState().applyLayout({ skipHistory: true, requestId: capturedId }),
          {
            onSuccess: () => {
              if (!settled) { settled = true; resolve() }
            },
          },
        )
        // Reject only when the progress store flips to 'error'. We do NOT
        // poll for 'idle' — that's the initial state and would self-resolve
        // before applyLayout has run.
        const errPoll = setInterval(() => {
          const s = useLayoutProgressStore.getState()
          if (s.status === 'error' && !settled) {
            settled = true
            clearInterval(errPoll)
            reject(new Error(`progress-store reported failure: ${s.message}`))
          }
        }, 10)
        setTimeout(() => {
          clearInterval(errPoll)
          if (!settled) {
            settled = true
            reject(new Error('handleLayoutWithRecovery onSuccess never fired'))
          }
        }, 5000)
      })

      const state = useCanvasStore.getState()
      expect(state.pendingLayout).toBe(false)
      expect(state.layoutInProgress).toBe(false)
      expect(isStacked(state.nodes)).toBe(false)
      expect(useLayoutProgressStore.getState().status).toBe('idle')
    })
  }
})

/**
 * Local freshness dirty-overlay — store-integration contract.
 *
 * Drives the REAL canvas store through REAL edit actions (no mocked detector) to
 * prove the overlay reuses the existing analysis-affecting edit recognition:
 *   - analysis-affecting edits set the overlay (value, structural, undo/redo);
 *   - cosmetic edits do NOT set it;
 *   - a new analysis_ready clears it; absence retains it;
 *   - CEE 'stale' is never downgraded;
 *   - scenario load / reset clear both the verdict and the overlay.
 * The display verdict is read through resolveDisplayedFreshness, the same pure
 * rule the UI uses.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import type { EdgeData } from '../../domain/edges'
import { resolveDisplayedFreshness } from '../analysisFreshness'
import { createScenario } from '../scenarios'

const T1 = '2026-06-23T10:00:00.000Z'
const T2 = '2026-06-23T12:00:00.000Z'
const T3 = '2026-06-23T14:00:00.000Z'

const node = (id: string): Node =>
  ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } }) as Node
const edge = (id: string, source: string, target: string): Edge<EdgeData> =>
  ({ id, source, target, data: {} as EdgeData }) as Edge<EdgeData>

function seed(nodes: Node[] = [node('n1'), node('n2')], edges: Edge<EdgeData>[] = []) {
  useCanvasStore.setState({
    nodes,
    edges,
    history: { past: [], future: [] },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    ceeAnalysisReady: null,
  })
}

/** Apply a CEE 'fresh' verdict (and clear any pending overlay, as a real run does). */
function applyFresh(computedAt = T1) {
  useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', computed_at: computedAt })
}

const dirty = () => useCanvasStore.getState().analysisFreshnessDirty
const verdict = () => useCanvasStore.getState().analysisFreshness?.freshness
const displayed = () => {
  const s = useCanvasStore.getState()
  return resolveDisplayedFreshness(s.analysisFreshness, s.analysisFreshnessDirty)
}

beforeEach(() => {
  seed()
})

describe('dirty overlay — analysis-affecting edits downgrade a retained fresh verdict', () => {
  it('#1 factor value / observedState edit → displayed unknown', () => {
    applyFresh()
    expect(displayed()).toBe('fresh') // precondition: clean fresh
    useCanvasStore.getState().updateNode('n1', { data: { observedState: { value: 0.7, baseline: 0.5 } } as Node['data'] })
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
    expect(verdict()).toBe('fresh') // CEE verdict itself is untouched (source of truth)
  })

  it('#1b edge weight / belief / confidence edit → displayed unknown', () => {
    seed([node('n1'), node('n2')], [edge('e1', 'n1', 'n2')])
    applyFresh()
    useCanvasStore.getState().updateEdge('e1', { data: { weight: 1.5 } as EdgeData })
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
  })

  it('#2 structural node add → displayed unknown', () => {
    applyFresh()
    useCanvasStore.getState().addNode({ x: 1, y: 1 }, 'factor')
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
  })

  it('#2b structural node remove → displayed unknown', () => {
    applyFresh()
    useCanvasStore.getState().deleteNodeById('n1')
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
  })

  it('#2c structural edge add → displayed unknown', () => {
    applyFresh()
    useCanvasStore.getState().addEdge({ source: 'n1', target: 'n2', data: {} as EdgeData } as Omit<Edge<EdgeData>, 'id'>)
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
  })

  it('#2d structural edge remove → displayed unknown', () => {
    seed([node('n1'), node('n2')], [edge('e1', 'n1', 'n2')])
    applyFresh()
    useCanvasStore.getState().deleteEdgeById('e1')
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
  })

  it('#2e inline goal-target edit (goal_threshold_raw) → displayed unknown', () => {
    // The live Model-tab GoalSection writes goal_threshold_raw via updateNode; the
    // V2 adapter derives the PLoT goal_threshold from it, so this is analytical.
    applyFresh()
    useCanvasStore.getState().updateNode('n1', {
      data: { goal_threshold_raw: 80, threshold_source: 'user', threshold_confirmed: false } as Node['data'],
    })
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
  })

  it('#3 undo of an analysis-affecting edit → displayed unknown', () => {
    applyFresh()
    useCanvasStore.getState().updateNode('n1', { data: { observedState: { value: 0.7 } } as Node['data'] })
    applyFresh(T2) // a fresh re-run clears the overlay so we isolate undo's effect
    expect(dirty()).toBe(false)
    useCanvasStore.getState().undo()
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
  })

  it('#3b redo of an analysis-affecting edit → displayed unknown', () => {
    applyFresh(T1)
    useCanvasStore.getState().updateNode('n1', { data: { observedState: { value: 0.7 } } as Node['data'] })
    applyFresh(T2) // newer run clears the overlay
    useCanvasStore.getState().undo()
    applyFresh(T3) // newer-still run clears again, to isolate redo's effect
    expect(dirty()).toBe(false)
    useCanvasStore.getState().redo()
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
  })
})

describe('dirty overlay — cosmetic edits never dirty', () => {
  it('#4 label-only edit does not dirty', () => {
    applyFresh()
    useCanvasStore.getState().updateNode('n1', { data: { label: 'Renamed' } as Node['data'] })
    expect(dirty()).toBe(false)
    expect(displayed()).toBe('fresh')
  })

  it('#4b position-only edit does not dirty', () => {
    applyFresh()
    useCanvasStore.getState().updateNode('n1', { position: { x: 99, y: 99 } })
    expect(dirty()).toBe(false)
    expect(displayed()).toBe('fresh')
  })
})

describe('dirty overlay — verdict lifecycle', () => {
  it('#5 missing analysis_ready on a non-edit turn retains the last CEE verdict', () => {
    applyFresh()
    useCanvasStore.getState().setAnalysisFreshness(undefined) // analyse turn without analysis_ready
    expect(verdict()).toBe('fresh')
    expect(dirty()).toBe(false)
    expect(displayed()).toBe('fresh')
  })

  it('#6 a new analysis_ready clears the dirty overlay', () => {
    applyFresh()
    useCanvasStore.getState().updateNode('n1', { data: { observedState: { value: 0.7 } } as Node['data'] })
    expect(dirty()).toBe(true)
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', computed_at: T2 })
    expect(dirty()).toBe(false)
    expect(displayed()).toBe('fresh')
  })

  it('#6b a re-delivered (echoed) analysis_ready does NOT clear the dirty overlay', () => {
    // computed_at is absent from the CEE contract; an echoed identical payload on a
    // conversational turn must not flip the notice back to fresh after a real edit.
    const payload = { freshness: 'fresh' as const, freshness_reason: 'graph_hash_match' }
    useCanvasStore.getState().setAnalysisFreshness(payload)
    useCanvasStore.getState().updateNode('n1', { data: { observedState: { value: 0.7 } } as Node['data'] })
    expect(dirty()).toBe(true)
    useCanvasStore.getState().setAnalysisFreshness(payload) // echo of the same run
    expect(dirty()).toBe(true) // overlay retained
    expect(displayed()).toBe('unknown')
  })

  it('#7 a CEE stale verdict is never downgraded, even after a local edit', () => {
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', computed_at: T1 })
    useCanvasStore.getState().updateNode('n1', { data: { observedState: { value: 0.7 } } as Node['data'] })
    expect(dirty()).toBe(true) // overlay set...
    expect(verdict()).toBe('stale')
    expect(displayed()).toBe('stale') // ...but stale is never downgraded
  })
})

describe('dirty overlay — scenario / reset boundaries', () => {
  it('#8 loadScenario resets BOTH the CEE verdict and the dirty overlay', () => {
    const s = createScenario({ name: 'Scenario A', nodes: [node('s1')], edges: [] })
    applyFresh()
    useCanvasStore.getState().updateNode('n1', { data: { observedState: { value: 0.7 } } as Node['data'] })
    expect(dirty()).toBe(true)
    expect(verdict()).toBe('fresh')

    useCanvasStore.getState().loadScenario(s.id)
    expect(useCanvasStore.getState().analysisFreshness).toBeNull()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(displayed()).toBeNull() // no verdict → no notice
  })

  it('#8b resetCanvas clears both the verdict and the dirty overlay', () => {
    applyFresh()
    useCanvasStore.getState().updateNode('n1', { data: { observedState: { value: 0.7 } } as Node['data'] })
    expect(dirty()).toBe(true)
    useCanvasStore.getState().resetCanvas()
    expect(useCanvasStore.getState().analysisFreshness).toBeNull()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })
})

describe('#9 no forbidden freshness paths', () => {
  // The overlay must never depend on v5AnalysisFact.freshness, useStaleGuard,
  // _context_summary, or any client graph hash. Comments legitimately *mention*
  // those names ("deliberately independent of …"), so scan comment-stripped code.
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'))

  it('the dedicated freshness modules use no forbidden API', () => {
    const freshnessFiles = [
      'src/canvas/store/analysisFreshness.ts',
      'src/components/results/AnalysisFreshnessNotice.tsx',
    ]
    for (const f of freshnessFiles) {
      const code = read(f)
      expect(code, f).not.toMatch(/v5AnalysisFact/)
      expect(code, f).not.toMatch(/useStaleGuard/)
      expect(code, f).not.toMatch(/_context_summary/)
      expect(code, f).not.toMatch(/generateGraphHash|computeClientHash/)
    }
  })

  it('the store never reads v5AnalysisFact.freshness, useStaleGuard, or _context_summary', () => {
    // The store legitimately holds an unrelated `v5AnalysisFact` slice; what is
    // forbidden is sourcing freshness from `v5AnalysisFact.freshness`.
    const code = read('src/canvas/store.ts')
    expect(code).not.toMatch(/v5AnalysisFact\s*\??\.\s*freshness/)
    expect(code).not.toMatch(/useStaleGuard/)
    expect(code).not.toMatch(/_context_summary/)
  })
})

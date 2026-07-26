/**
 * U1 — the Zustand primitive-selector rule the card's own header states.
 *
 * ─── THE DEFECT ────────────────────────────────────────────────────────────
 * #486 (C2) replaced two PRIMITIVE subscriptions (`s.goalThreshold` and an
 * inline `goalUnitRaw` read) with `useCanvasStore((s) => s.nodes)` plus a
 * `useMemo`, justified in-file by the claim that the `nodes` array reference
 * "is stable in the store".
 *
 * That claim is FALSE while the user edits. `canvas/store.ts` (`onNodesChange`)
 * does `applyNodeChanges(changes, s.nodes)` inside `set((s) => …)`, and
 * `applyNodeChanges` returns a NEW array for every change it applies —
 * including `type: 'position'`, i.e. once per drag frame. Zustand's default
 * `Object.is` equality therefore stopped suppressing anything: the card
 * re-rendered its whole subtree on every frame of every node drag.
 *
 * The live path makes that the normal case rather than an edge case: OutputsDock
 * mounts the card under `!isPreRun && hasInlineSummary && resultsSectionData`,
 * i.e. precisely when a completed analysis is on screen beside the canvas —
 * which is when a user drags nodes to revise the graph.
 *
 * ─── WHAT THIS SPEC PINS ───────────────────────────────────────────────────
 * 1. A position-only node change, dispatched through the store's REAL
 *    `onNodesChange` action, does not commit the card again.
 * 2. Replacing `goalConstraints` with a NEW array of equal content does not
 *    commit it again (the other object subscription #486 added).
 * 3. POSITIVE CONTROLS: changes that DO alter what the card renders commit it.
 *    Without these, (1) and (2) could pass because the counter is broken, or
 *    because the card never commits for any reason at all.
 * 4. The invariant the single primitive selector relies on:
 *    `computeSuccessState().isSet === (displayText !== null)` on EVERY return
 *    site, so one primitive carries both facts the card consumes. If a future
 *    branch breaks that, this fails loudly rather than the card silently
 *    rendering "success measure missing" beside a value.
 *
 * ─── EVIDENCE TYPE (stated plainly — CLAUDE.md trap 3) ─────────────────────
 * MEASURED, in jsdom, for the thing at issue: React COMMITS of the card's
 * subtree, counted by `<Profiler onRender>`. Those are plain JS and are
 * observable here. What jsdom cannot prove — and what this spec therefore does
 * NOT claim — is anything about layout, paint, or wall-clock frame cost in a
 * real browser. The claim is "the subtree does not re-commit", not "the frame
 * got faster".
 */
import { Profiler } from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { act, render } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { DecisionOverviewCard } from '../DecisionOverviewCard'
import { useCanvasStore } from '../../../../canvas/store'
import { computeSuccessState } from '../../../../canvas/components/pre-analysis-v3/selectors/computeSuccessState'

const READY = { status: 'ready', options: [{ id: 'o1' }], goal_node_id: 'g1' }

const GOAL_NODE: Node = {
  id: 'g1',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'Maximise total profit', goal_threshold_raw: 150000, goal_threshold_unit: 'GBP' },
}

const OPTION_NODE: Node = {
  id: 'o1',
  type: 'option',
  position: { x: 200, y: 0 },
  data: { label: 'Option A' },
}

function resetCanvas(overrides: Record<string, unknown> = {}) {
  localStorage.setItem('feature.decisionOverview', '1')
  useCanvasStore.setState({
    ceeAnalysisReady: READY,
    goalThreshold: null,
    nodes: [GOAL_NODE, OPTION_NODE],
    goalConstraints: null,
    currentBriefText: null,
    graphHealth: null,
    ...overrides,
  } as never)
}

/**
 * `<Profiler onRender>` fires once per COMMIT of the profiled subtree. A store
 * notification a selector suppresses produces no commit at all, so the count
 * does not move; one it does not suppress produces a commit. The `Profiler`
 * wrapper itself never re-renders on its own — nothing above it subscribes to
 * anything — so every observed commit originates in the card's own selectors.
 */
function mountProfiled() {
  let commits = 0
  const utils = render(
    <Profiler
      id="decision-overview-card"
      onRender={() => {
        commits++
      }}
    >
      <DecisionOverviewCard title="t" />
    </Profiler>,
  )
  return { ...utils, commits: () => commits }
}

describe('U1: the card commits only when a value it renders changes', () => {
  beforeEach(() => {
    resetCanvas()
  })

  it('does NOT re-commit on a position-only node change (the drag frame)', () => {
    const { commits } = mountProfiled()
    const before = commits()
    expect(before).toBeGreaterThan(0) // the mount itself committed
    const nodesBefore = useCanvasStore.getState().nodes

    act(() => {
      // Exactly what React Flow dispatches per drag frame, routed through the
      // store's REAL action — so this cannot pass by faking a cheaper update
      // than the product performs.
      useCanvasStore.getState().onNodesChange([
        { id: 'g1', type: 'position', position: { x: 40, y: 12 }, dragging: true },
      ] as never)
    })

    // PREMISE, proven not assumed: the store really did apply the change AND
    // really did hand out a NEW array identity. If either were false this test
    // would be vacuous — the whole defect is that identity churn.
    expect(useCanvasStore.getState().nodes.find((n) => n.id === 'g1')?.position).toEqual({
      x: 40,
      y: 12,
    })
    expect(useCanvasStore.getState().nodes).not.toBe(nodesBefore)

    expect(commits()).toBe(before)
  })

  it('does NOT re-commit when goalConstraints is replaced by an equal-content array', () => {
    resetCanvas({ goalConstraints: [{ provenance: 'inferred', value: 1 }] })
    const { commits } = mountProfiled()
    const before = commits()

    act(() => {
      useCanvasStore.setState({ goalConstraints: [{ provenance: 'inferred', value: 1 }] } as never)
    })

    expect(commits()).toBe(before)
  })

  it('POSITIVE CONTROL: it DOES re-commit when the success measure itself changes', () => {
    const { commits } = mountProfiled()
    const before = commits()

    act(() => {
      useCanvasStore.setState({
        nodes: [
          { ...GOAL_NODE, data: { ...(GOAL_NODE.data as object), goal_threshold_raw: 999 } },
          OPTION_NODE,
        ],
      } as never)
    })

    expect(commits()).toBeGreaterThan(before)
  })

  it('POSITIVE CONTROL: it DOES re-commit when the option count changes', () => {
    const { commits } = mountProfiled()
    const before = commits()

    act(() => {
      useCanvasStore.setState({
        nodes: [GOAL_NODE, OPTION_NODE, { ...OPTION_NODE, id: 'o2' }],
      } as never)
    })

    expect(commits()).toBeGreaterThan(before)
  })

  // The coupling the single primitive selector relies on, enumerated over every
  // return site of computeSuccessState so a new branch cannot break it quietly.
  it('INVARIANT: computeSuccessState.isSet === (displayText !== null) on every branch', () => {
    const cases: Array<{ name: string; node: Node | null; ready: Record<string, unknown> | null }> = [
      { name: 'no goal node', node: null, ready: null },
      {
        name: 'user-set measure',
        node: { ...GOAL_NODE, data: { threshold_source: 'user', success_threshold: 20 } },
        ready: null,
      },
      { name: 'CEE-derived display anchor on the node', node: GOAL_NODE, ready: READY },
      {
        name: 'CEE-derived anchor from analysisReady only',
        node: { ...GOAL_NODE, data: { label: 'g' } },
        ready: { goal_threshold_raw: 7, goal_threshold_unit: '%' },
      },
      {
        name: 'normalised-only threshold (degraded to unset)',
        node: { ...GOAL_NODE, data: { goal_threshold: 0.2 } },
        ready: null,
      },
      {
        name: 'goal node with nothing on it',
        node: { ...GOAL_NODE, data: { label: 'g' } },
        ready: null,
      },
    ]

    for (const c of cases) {
      const s = computeSuccessState(c.node, c.ready, null, null)
      expect(s.isSet, `${c.name}: isSet must equal displayText !== null`).toBe(s.displayText !== null)
    }
  })
})

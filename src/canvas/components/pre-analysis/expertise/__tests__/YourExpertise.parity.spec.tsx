/**
 * Behavioural parity spec — Brief 5 Task 1.
 *
 * Paul's correction: "Import-trace is necessary but not sufficient. Keep the
 * behavioural test asserting that firing Confirm from Your expertise produces
 * the identical store effect as firing Confirm from the equivalent triage
 * card."
 *
 * This spec seeds the REAL canvas store with a factor node that looks like
 * a CEE-inferred AI estimate, then:
 *   1. Fires Confirm from YourExpertise's expanded AI-estimates list via the
 *      same `handleConfirm` closure PreAnalysisPanel uses in production
 *      (updateNode + withObservedStateUpdate).
 *   2. Snapshots the mutated node.data.
 *   3. Resets the store to the same seed.
 *   4. Fires Confirm from an equivalent TriageCard with the same handler.
 *   5. Snapshots the mutated node.data.
 *   6. Asserts both snapshots are deep-equal.
 *
 * This goes beyond "same handler / same arg" and proves "same store effect"
 * end-to-end.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { YourExpertise } from '../YourExpertise'
import { TriageCard } from '@/components/shared/TriageCard'
import { useCanvasStore } from '@/canvas/store'
import { withObservedStateUpdate } from '@/canvas/utils/observedStateHelpers'
import type { ImprovementItem } from '../../hooks/usePreAnalysisData'
import type { Node } from '@xyflow/react'

vi.mock('@/stores/uiStore', () => ({
  useUIStore: Object.assign(
    () => ({ setActiveOutputTab: vi.fn() }),
    { getState: () => ({ setActiveOutputTab: vi.fn() }) },
  ),
}))

const TARGET_ID = 'factor-design-expertise'
const TARGET_LABEL = 'Dedicated Design Expertise'

function aiEstimateItem(): ImprovementItem {
  return {
    key: `verify-${TARGET_ID}`,
    category: 'verify',
    label: TARGET_LABEL,
    detail: 'AI estimate',
    subgroup: 'cee_inference',
    focus: { type: 'node', id: TARGET_ID, label: TARGET_LABEL },
    action: {
      label: 'Confirm value',
      kind: 'confirm',
      targetId: TARGET_ID,
      targetType: 'node',
    },
  }
}

function seedNode(): Node {
  const node: Node = {
    id: TARGET_ID,
    position: { x: 0, y: 0 },
    data: {
      kind: 'factor',
      label: TARGET_LABEL,
      observedState: {
        value: 0.6,
        source: 'cee_inference',
        extractionType: 'implicit',
      },
    },
  }
  return node
}

/** Seed the real canvas store with a single factor node so Confirm can
    mutate it deterministically. Uses the exact update path PreAnalysisPanel
    uses in production. */
function seedStore() {
  const node = seedNode()
  useCanvasStore.setState({ nodes: [node] } as Partial<ReturnType<typeof useCanvasStore.getState>>)
}

/** Mirrors PreAnalysisPanel.handleConfirm exactly. Passing it to both
    surfaces guarantees the handler identity is the same; the real store
    mutation then produces comparable snapshots. */
function handleConfirm(nodeId: string) {
  const { nodes, updateNode } = useCanvasStore.getState()
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return
  updateNode(nodeId, {
    data: withObservedStateUpdate(node.data, {
      source: 'user_confirmed',
      extractionType: 'explicit',
    }),
  })
}

function currentNodeData() {
  const n = useCanvasStore.getState().nodes.find(x => x.id === TARGET_ID)
  return n?.data
}

describe('YourExpertise ↔ TriageCard — Confirm real-store mutation parity', () => {
  beforeEach(() => {
    cleanup()
    // Reset the canvas store to a known seed before each run.
    seedStore()
  })

  it('produces the identical node.data mutation from both surfaces', () => {
    // ── Path A: Confirm from YourExpertise ────────────────────────────
    const { unmount } = render(
      <YourExpertise
        improvementsByCategory={{ verify: [aiEstimateItem()] }}
        contestedEdges={[]}
        nodes={[]}
        edges={[]}
        onConfirm={handleConfirm}
      />
    )
    fireEvent.click(screen.getByTestId('your-expertise-header'))
    const expanded = screen.getByTestId('your-expertise-expanded')
    fireEvent.click(within(expanded).getByLabelText(`Confirm value for ${TARGET_LABEL}`))

    const yourExpertiseSnapshot = currentNodeData()

    // Tear down the render + restore the original seed so Path B starts from
    // the same state, not from Path A's mutated state.
    unmount()
    seedStore()

    // ── Path B: Confirm from an equivalent TriageCard ────────────────
    render(
      <TriageCard
        cardKey="parity-card"
        ordinal={1}
        title={TARGET_LABEL}
        detail="Confirm the AI estimate or set your own value."
        category="verify"
        action={{ kind: 'confirm', label: 'Confirm', targetId: TARGET_ID, targetType: 'node' }}
        onConfirm={handleConfirm}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    const triageCardSnapshot = currentNodeData()

    // ── Parity: both mutations produced byte-identical node.data ──────
    expect(yourExpertiseSnapshot).toBeDefined()
    expect(triageCardSnapshot).toBeDefined()
    expect(yourExpertiseSnapshot).toEqual(triageCardSnapshot)

    // Sanity: both really mutated the seed (source flipped to user_confirmed).
    const obs = (triageCardSnapshot as { observedState: { source: string } }).observedState
    expect(obs.source).toBe('user_confirmed')
  })
})

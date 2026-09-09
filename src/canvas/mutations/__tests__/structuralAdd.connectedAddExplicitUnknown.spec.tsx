/**
 * ⭐⭐⭐ THE EXPLICIT-UNKNOWN GUARANTEE, EXTENDED TO THE **CONNECTED** ADD PATH.
 *
 * `structuralAdd.explicitUnknown.spec.tsx` pins the guarantee for
 * `store.addNode` and says, in terms, that it is NOT a claim about
 * `addNodeWithEdge`. This file closes that hole for the RENDER half. The two
 * are named apart and neither restates the other's scope: the derived manifest
 * of the canvas's creation paths — AT LEAST nine, not four — lives on
 * `pendingStructuralAdds` in `canvas/store.ts`, and that block is the only
 * place that states it. The "at least" is load-bearing: a flat count there was
 * short again within the hour.
 *
 * ⚠ RENDERING AN EXPLICIT UNKNOWN AND BEING DURABLY SAVED ARE DIFFERENT
 * CLAIMS. This file makes the first, and only the first. Nothing here gains a
 * durable `structural_add` intent.
 *
 * The rule is the founder's and it is unchanged: *"a new factor arrives as an
 * explicit unknown, never a fabricated number. Don't 'helpfully' seed one."*
 *
 * The original defect seeded `data: { label, kind, category: 'external' }`.
 * The external-factor count now reads "Linked to {N} outcome{s}." and counts
 * distinct existing outcome targets of outgoing edges. An outgoing edge to a
 * risk alone no longer exercises that branch. This fixture therefore invokes
 * "Add connected factor" on an outcome: `getEdgeDirectionForKind('outcome')`
 * returns `'to-target'`, putting the new factor at the edge's source. Adding
 * `category: 'external'` back must expose the linked-outcome count, while the
 * real uncategorised seed must still render no digit with badges suppressed.
 * Historically the counter included every outgoing edge: that defect applied
 * to adds invoked on factor, outcome, risk and goal targets, but not decision
 * or option targets whose edge direction differs. The new outcome-only filter
 * narrows the positive-control fixture; it does not erase that earlier scope.
 *
 * ⚠ AND IT IS NOT THE ONLY PATH: `insertFactorBetweenAction` splits an edge and
 * lands the new factor in the SOURCE position BY CONSTRUCTION — no direction
 * caveat at all. It seeded the same category on both of its writers, and it is
 * pinned in `contextMenu/__tests__/actions.spec.ts` rather than here, because
 * it installs by bare `setState` rather than through a store add action.
 *
 * ⭐ THE SEED CAUSED THREE HARMS, NOT ONE, AND THE OTHER TWO HAVE NO DIRECTION
 * CONDITION — which is why the fix is the seed rather than the render gate:
 *   1. the fabricated digit above;
 *   2. `isFactorNeedsInput` early-returns `false` on `category === 'external'`,
 *      so the "needs your judgement" affordance stayed DARK on a brand-new
 *      factor with no value — the same shape as the ignorance-prior exemption
 *      that helper's own header records as a measured defect;
 *   3. `DecisionNode`'s triage line `continue`s past an external factor, so a
 *      new valueless factor could never be named as the top gap.
 *
 * ⭐⭐ THE FIXTURE IS DERIVED FROM THE REAL STORE ACTION, NEVER HAND-BUILT, AND
 * THAT IS THE LOAD-BEARING DIFFERENCE FROM THE `addNode` FILE. That file MOCKS
 * `../../store` in order to mount `FactorNode`, and its own header records the
 * consequence: a mutant seeding a value into `store.addNode` left it GREEN at
 * 9/9. Here the store is REAL, the gesture is REAL, and the data mounted into
 * `FactorNode` is read back out of the store — so a re-seed of `category`
 * cannot pass this file by leaving a literal behind.
 *
 * ⭐⭐ AND THE POSITIVE CONTROL IS A DISCRIMINATING PAIR, because "renders no
 * digit" is an ABSENCE claim and an absence claim with no demonstrated presence
 * is vacuous (CLAUDE.md trap 13). The SAME topology, the SAME mount, the SAME
 * assertion — with `category: 'external'` put back by hand — MUST render the
 * digit. If that control ever stops firing, this file has stopped discriminating
 * and every "no digit" result below is worthless.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'

import { isFactorNeedsInput } from '../../utils/observedStateHelpers'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null }),
  ),
}))
// Spread the real flags module so a newly-added flag never goes silently absent
// and throws at render (CLAUDE.md trap 12 — a `vi.mock` factory REPLACES the
// module).
//
// ⚠⚠ BADGES ARE PINNED **OFF**, AND THAT POSTURE CUTS OPPOSITE WAYS FOR THE TWO
// KINDS OF ASSERTION IN THIS FILE. An earlier version of this comment called it
// "the STRICTER posture" full stop. That is true of only one of them, and it is
// not the one this file mainly exists for:
//
//   · For the POSITIVE CONTROL (`the digit DOES render`) it IS stricter. The
//     digit is found with no help from a badge, so the control cannot be
//     passing on a number some other flag put on screen.
//
//   · For the ABSENCE assertion (`renders NO NUMBER AT ALL`) it is the WEAKER
//     posture, not the stronger one — and that assertion is the point of the
//     file. Pinning badges off REMOVES a potential source of digits, which
//     makes "no digit" EASIER to satisfy. The strict posture for that direction
//     would be badges ON.
//
// So the scope of the absence claim is: a connected-add factor renders no digit
// **with the evidence-gap badge suppressed**. It is not a claim about the
// badge-on posture, and this file must not be read as making one. Stated rather
// than silently narrowed — a control whose direction of conservatism is assumed
// rather than derived is how a guard ends up watching one door (CLAUDE.md
// trap 22b).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../../nodes/shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// ⚠ `../../store` IS DELIBERATELY NOT MOCKED. See the header.
import { FactorNode } from '../../nodes/FactorNode'
import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

/** Every digit-bearing token. The fabrication direction's detector. */
const ANY_NUMBER = /\d/

/** The clicked node the user invokes "Add connected factor" on. */
const OUTCOME_TARGET: Node = {
  id: '1',
  type: 'outcome',
  position: { x: 0, y: 0 },
  data: { label: 'Supply continuity', kind: 'outcome' },
} as Node

/** A genuine, user-stated ZERO. The erasure direction's fixture. */
const GENUINE_ZERO = {
  label: 'Outages last quarter',
  observedState: { value: 0, raw_value: 0, source: 'user_confirmed' },
}

/**
 * Put the store in the state the context-menu item runs against, and perform
 * the REAL gesture.
 *
 * Returns the created node id and the data the store actually wrote — the
 * fixture every layer below consumes.
 */
function performConnectedFactorAdd(): { nodeId: string; data: Record<string, unknown> } {
  useCanvasStore.setState({
    currentScenarioId: null,
    lastServerGraphHash: null,
    lastAuthoritativeGraph: null,
    pendingStructuralAdds: [],
    structuralAddLifecycle: [],
    _externalMutationActive: 0,
    nodes: [OUTCOME_TARGET] as unknown as Node[],
    edges: [],
    history: { past: [], future: [] },
    engineLimits: null,
    results: { status: 'idle', report: null },
    ceeAnalysisReady: null,
  } as never)

  // `getEdgeDirectionForKind('outcome')` returns `'to-target'`, so the new
  // factor has an outgoing edge to an existing outcome. Both the direction
  // and target kind are required for the positive control to expose a count.
  const nodeId = useCanvasStore.getState().addNodeWithEdge(
    { x: 150, y: 0 },
    'factor',
    OUTCOME_TARGET.id,
    'to-target',
  )
  expect(typeof nodeId).toBe('string')

  const created = useCanvasStore.getState().nodes.find((n) => n.id === nodeId)
  expect(created, 'the gesture must have created a node').toBeTruthy()
  return { nodeId: nodeId as string, data: (created!.data ?? {}) as Record<string, unknown> }
}

const baseProps = {
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: false,
  selectable: true,
  draggable: true,
}

function renderFactor(id: string, data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} id={id} data={{ type: 'factor', ...data }} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
  } as never)
})

// ───────────────────────────────────────────────────────────────────────────
// LAYER 0 — the PRECONDITION, pinned in-test
// ───────────────────────────────────────────────────────────────────────────

describe('LAYER 0 — the topology enables the linked-outcome count', () => {
  it('⭐ the created factor is the source of an edge to an existing outcome', () => {
    // ⚠ WITHOUT THIS, EVERY "NO DIGIT" RESULT BELOW COULD BE THE FIXTURE
    // FAILING TO TRIGGER RATHER THAN THE CODE BEHAVING (CLAUDE.md trap 13b).
    // Assert both prerequisites of the live count, not just edge direction.
    const { nodeId } = performConnectedFactorAdd()
    const { nodes, edges } = useCanvasStore.getState()
    expect(nodes.find((node) => node.id === OUTCOME_TARGET.id)?.type).toBe('outcome')
    expect(edges.filter((edge) => edge.source === nodeId)).toEqual([
      expect.objectContaining({ source: nodeId, target: OUTCOME_TARGET.id }),
    ])
  })

  it('⭐⭐ POSITIVE CONTROL — with `category: "external"` PUT BACK, the digit DOES render', () => {
    // The discriminating half of the pair. Same store, same topology, same
    // mount, same assertion — only the category differs. If this ever fails,
    // this file has stopped being able to see the defect it exists to pin and
    // the "no digit" tests below prove nothing.
    const { nodeId, data } = performConnectedFactorAdd()
    const { container } = renderFactor(nodeId, { ...data, category: 'external' })
    expect(container.textContent ?? '').toContain('Linked to 1 outcome.')
    expect(container.textContent ?? '').toMatch(ANY_NUMBER)
  })

  it('counts distinct outcome targets, excluding duplicate edges and other node kinds', () => {
    const { nodeId, data } = performConnectedFactorAdd()
    const { nodes, edges } = useCanvasStore.getState()
    const connectedEdge = edges.find((edge) => edge.source === nodeId)
    expect(connectedEdge).toBeDefined()
    useCanvasStore.setState({
      nodes: [
        ...nodes,
        {
          id: 'another-outcome',
          type: 'outcome',
          position: { x: 0, y: 150 },
          data: { label: 'Customer retention', kind: 'outcome' },
        },
        {
          id: 'risk-target',
          type: 'risk',
          position: { x: 0, y: 300 },
          data: { label: 'Supply shock', kind: 'risk' },
        },
      ],
      edges: [
        ...edges,
        { ...connectedEdge!, id: 'duplicate-outcome-edge' },
        { ...connectedEdge!, id: 'another-outcome-edge', target: 'another-outcome' },
        { ...connectedEdge!, id: 'risk-edge', target: 'risk-target' },
      ],
    })

    const { container } = renderFactor(nodeId, { ...data, category: 'external' })
    expect(container.textContent ?? '').toContain('Linked to 2 outcomes.')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// LAYER 1 — what the gesture CREATES
// ───────────────────────────────────────────────────────────────────────────

describe('LAYER 1 — a connected-add gesture seeds no category and no value', () => {
  it('⭐ the created `node.data` key set is exactly label + kind', () => {
    // ⚠ ASSERTED AS A KEY SET, not by spot-checking absences. "No category" and
    // "no observedState" are two spot checks that both pass while a third key
    // rides along; the SET cannot be satisfied by anything but the truth.
    // `kind` is present and correct — it is the node's own taxonomy, not a
    // claim about its value — and `resolveNodeTypeLiteral` reads it.
    const { data } = performConnectedFactorAdd()
    expect(Object.keys(data).sort()).toEqual(['kind', 'label'])
  })

  it('names the value carriers explicitly, so a rename of one cannot slip past the set check', () => {
    const { data } = performConnectedFactorAdd()
    for (const carrier of [
      'category',
      'prior',
      'observedState',
      'observed_state',
      'value',
      'raw_value',
      'display_value',
      'probability',
      'utility',
      'baseline',
      'intercept',
    ]) {
      expect(
        Object.prototype.hasOwnProperty.call(data, carrier),
        `a connected-add node must not carry "${carrier}"`,
      ).toBe(false)
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// LAYER 2 — the render PREDICATES gate on status, never on category
// ───────────────────────────────────────────────────────────────────────────

describe('LAYER 2 — status, never a category exemption', () => {
  it('⭐ FABRICATION DIRECTION: a connected-add factor reads as "needs input"', () => {
    // This is the affordance the `category: 'external'` seed suppressed. It is
    // ungated — not behind `graphBadges`, not behind a priority rank — and it
    // is what makes the unknown EXPLICIT rather than merely blank.
    const { data } = performConnectedFactorAdd()
    expect(isFactorNeedsInput(data)).toBe(true)
  })

  it('⭐⭐ TWIN — the external EXEMPTION still works for a factor that genuinely is external', () => {
    // The opposite-direction twin: removing the SEED must not remove the
    // EXEMPTION. A factor CEE classified external, carrying its prior as its
    // evidence, still earns silence.
    expect(isFactorNeedsInput({ label: 'FX rate', category: 'external' })).toBe(false)
  })

  it('⭐⭐ TWIN — ERASURE DIRECTION: a GENUINE `0` is stated data and must NOT read as unknown', () => {
    expect(isFactorNeedsInput(GENUINE_ZERO)).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// LAYER 3 — what a user actually SEES on a real mount
// ───────────────────────────────────────────────────────────────────────────

describe('LAYER 3 — the real node mount, in the real post-gesture topology', () => {
  it('⭐⭐ FABRICATION DIRECTION: a connected-add factor renders NO NUMBER AT ALL', () => {
    // ⚠ The strongest form available: not "does not render 1", not "does not
    // render the sentence", but NO DIGIT ANYWHERE. A weaker assertion would
    // pass while a different fabricated figure rendered.
    const { nodeId, data } = performConnectedFactorAdd()
    const { container } = renderFactor(nodeId, data)
    expect(container.textContent ?? '').not.toMatch(ANY_NUMBER)
    // And it is not silently blank either: the label is there.
    expect(container.textContent).toContain('New factor')
  })

  it('⭐⭐ TWIN — ERASURE DIRECTION: a node carrying a GENUINE `0` still SHOWS its `0`', () => {
    // The whole point of gating on status rather than falsiness. If this ever
    // goes red because the zero vanished, the "explicit unknown" work has
    // started eating real measurements.
    const { nodeId } = performConnectedFactorAdd()
    const { container } = renderFactor(nodeId, GENUINE_ZERO)
    expect(container.textContent ?? '').toMatch(/0/)
  })
})

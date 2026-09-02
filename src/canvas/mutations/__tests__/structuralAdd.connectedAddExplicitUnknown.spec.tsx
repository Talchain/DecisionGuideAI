/**
 * ⭐⭐⭐ THE EXPLICIT-UNKNOWN GUARANTEE, EXTENDED TO THE **CONNECTED** ADD PATH.
 *
 * `structuralAdd.explicitUnknown.spec.tsx` pins the guarantee for
 * `store.addNode` and says, in terms, that it is NOT a claim about
 * `addNodeWithEdge`. This file closes that hole. The two are named apart and
 * neither restates the other's scope: the measured coverage of all four
 * creation paths lives on `pendingStructuralAdds` in `canvas/store.ts`.
 *
 * The rule is the founder's and it is unchanged: *"a new factor arrives as an
 * explicit unknown, never a fabricated number. Don't 'helpfully' seed one."*
 *
 * ⚠⚠ WHAT WAS ACTUALLY WRONG, AND THE PRIOR RECORD OF IT WAS TOO BROAD.
 * `addNodeWithEdge` seeded `data: { label, kind, category: 'external' }`, and
 * `FactorNode.tsx` renders "Uncertainty here affects {N} outcome{s}." whenever
 * `nodeCategory === 'external' && outcomesAffected > 0`. The scope block
 * recorded that an edge-creating add GUARANTEES that condition. **It does
 * not** — `outcomesAffected` counts edges whose SOURCE is this node
 * (`FactorNode.tsx`'s `edges.filter(e => e.source === props.id)`), so the digit
 * renders only when the new node is the edge's source. Derived at
 * `contextMenu/actions.ts`: `getEdgeDirectionForKind` returns `'to-target'`
 * for every kind except decision/option, and `'to-target'` puts the NEW node in
 * the source position. So the fabrication fires on "Add connected factor"
 * invoked on a factor, outcome or risk — and not on the same item invoked on a
 * decision or an option, nor on the option/outcome/risk items, which all pass
 * `'from-target'` explicitly.
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
// module). Badges pinned OFF is the STRICTER posture: it removes the
// evidence-gap badge from the picture entirely, so any digit this file finds is
// found without help from a flag that may be off in production.
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
const RISK_TARGET: Node = {
  id: '1',
  type: 'risk',
  position: { x: 0, y: 0 },
  data: { label: 'Supply shock', kind: 'risk' },
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
    nodes: [RISK_TARGET] as unknown as Node[],
    edges: [],
    history: { past: [], future: [] },
    engineLimits: null,
    results: { status: 'idle', report: null },
    ceeAnalysisReady: null,
  } as never)

  // `'to-target'` is what `getEdgeDirectionForKind('risk')` returns, and it is
  // the direction that puts the NEW node in the SOURCE position — the only
  // arrangement in which `outcomesAffected` can exceed zero. Named here rather
  // than passed blind, because the whole discrimination rests on it.
  const nodeId = useCanvasStore.getState().addNodeWithEdge(
    { x: 150, y: 0 },
    'factor',
    RISK_TARGET.id,
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

describe('LAYER 0 — the topology this file asserts against really is the fabricating one', () => {
  it('⭐ the created node is the EDGE SOURCE, so `outcomesAffected` is non-zero', () => {
    // ⚠ WITHOUT THIS, EVERY "NO DIGIT" RESULT BELOW COULD BE THE FIXTURE
    // FAILING TO TRIGGER RATHER THAN THE CODE BEHAVING (CLAUDE.md trap 13b).
    // `FactorNode` computes `outcomesAffected` as
    // `edges.filter(e => e.source === props.id).length`; this asserts the store
    // produced exactly that arrangement.
    const { nodeId } = performConnectedFactorAdd()
    const edges = useCanvasStore.getState().edges
    expect(edges.filter((e) => e.source === nodeId)).toHaveLength(1)
  })

  it('⭐⭐ POSITIVE CONTROL — with `category: "external"` PUT BACK, the digit DOES render', () => {
    // The discriminating half of the pair. Same store, same topology, same
    // mount, same assertion — only the category differs. If this ever fails,
    // this file has stopped being able to see the defect it exists to pin and
    // the "no digit" tests below prove nothing.
    const { nodeId, data } = performConnectedFactorAdd()
    const { container } = renderFactor(nodeId, { ...data, category: 'external' })
    expect(container.textContent ?? '').toMatch(/Uncertainty here affects 1 outcome/)
    expect(container.textContent ?? '').toMatch(ANY_NUMBER)
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

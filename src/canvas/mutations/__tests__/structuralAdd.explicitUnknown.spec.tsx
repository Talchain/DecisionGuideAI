/**
 * ⭐⭐⭐ THE EXPLICIT-UNKNOWN GUARANTEE — the load-bearing property of the durable
 * add writer, pinned in BOTH DIRECTIONS.
 *
 * The rule, in the founder's terms: *"structural_add is deliberate about values:
 * a new factor arrives as an explicit unknown, never a fabricated number. Don't
 * 'helpfully' seed one."* A new node must arrive with its value genuinely absent
 * AND must render as an explicit unknown — not `0`, not `50%`, not a placeholder
 * that reads as a measurement.
 *
 * ⚠⚠ WHY BOTH DIRECTIONS, AND WHY THIS FILE EXISTS AT ALL. A one-direction
 * corpus is a guard watching one door (CLAUDE.md trap 22b), and the harm here is
 * SYMMETRIC with two opposite failure modes:
 *
 *   · FABRICATION — a node with no value renders a number. The number carries
 *     the USER's provenance, so the product asserts the user stated something
 *     they never stated. This estate has already shipped the adjacent version of
 *     this and measured it: `hasObservedData`'s header records CEE defaulting a
 *     factor to a neutral number, and the predicate that decides whether to say
 *     "no observed data" being SATISFIED BY THE PLACEHOLDER THAT MEANS THERE IS
 *     NONE.
 *
 *   · ERASURE — a node with a GENUINE `0` renders as unknown. `0` is a real
 *     observed value ("None" for a binary factor), and every falsiness-gated
 *     read (`value || 0`, `value ? … : …`, `!range_min`) destroys it silently.
 *
 * So the gate must be the STATUS — `typeof value === 'number'`, `!= null`, and
 * `prior_is_unquantified === true` — and NEVER the truthiness of the number.
 * Each test below therefore ships its opposite-direction twin, adjacently.
 *
 * ⚠⚠ SCOPE, STATED BEFORE THE CLAIM RATHER THAN AFTER IT: everything below is
 * about the `store.addNode` path — the pane context menu, the Command Palette
 * "Add …" commands, the pre-analysis AddRow and the hero goal field. It is NOT
 * a claim about every way a node can be created. `addNodeWithEdge` seeds
 * `category: 'external'` and its factors DO render "Uncertainty here affects
 * {N} outcome{s}." (`FactorNode.tsx:668-671`) — pre-existing, identical at
 * base, and out of this lane's scope. See the block on `pendingStructuralAdds`
 * in `canvas/store.ts` for the measured coverage of all four creation paths.
 *
 * ⭐ THE LAYERS ARE TESTED SEPARATELY BECAUSE THEY CAN FAIL SEPARATELY:
 *   1. what `store.addNode` CREATES        (nothing to seed)
 *   2. what the WIRE PAYLOAD carries       (nowhere to put one)
 *   3. what the RENDER PREDICATES answer   (status, never falsiness)
 *   4. what a user actually SEES           (a real FactorNode mount)
 * A green layer 1-3 with a broken layer 4 is exactly the "component witnesses
 * never compose into a journey claim" trap, so layer 4 mounts the real node.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { PRIOR_IS_UNQUANTIFIED_FIELD, isUnquantifiedPrior } from '../../domain/nodes'
import {
  hasAnyStatedValue,
  hasObservedData,
  isFactorNeedsInput,
} from '../../utils/observedStateHelpers'
import {
  WIRE_ADDABLE_NODE_KINDS,
  buildStructuralAddWirePayload,
  captureStructuralAdd,
} from '../structuralAdd'

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
// module). Badges are pinned OFF, which is the STRICTER posture: it removes the
// evidence-gap badge from the picture entirely, so anything this file finds is
// found without help from a flag that may be off in production.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../../nodes/shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { FactorNode } from '../../nodes/FactorNode'
import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

/**
 * EXACTLY what `store.addNode` writes into `node.data`, held as a LITERAL.
 *
 * ⚠⚠ THIS FIXTURE CANNOT GUARD THE STORE, AND SAYING OTHERWISE WOULD BE THE
 * OVERCLAIM THIS ESTATE PAYS FOR MOST OFTEN. An earlier version of this comment
 * asserted "if a future edit seeds a value here, THIS is the line that goes
 * red". **That was false, and a mutant proved it**: seeding
 * `observedState: { value: 0.5 }` into `store.addNode` left this whole file
 * GREEN at 9/9 and was caught only by
 * `canvas/__tests__/store.structuralAddCapture.spec.ts`, which drives the real
 * action. This file MOCKS `../../store` (it must, to mount `FactorNode`), so it
 * is structurally incapable of observing a store change.
 *
 * What this literal IS for: it is the SUBJECT of layers 2–4, and pinning its key
 * set here is what stops those layers quietly testing a richer node than the
 * product actually creates. The store-side guard lives in the store spec, and
 * the two are named apart so neither is mistaken for the other.
 */
const GESTURE_CREATED_NODE_DATA = { label: 'Supplier concentration risk' }

/** A genuine, user-stated ZERO. The erasure direction's fixture. */
const GENUINE_ZERO = {
  label: 'Outages last quarter',
  observedState: { value: 0, raw_value: 0, source: 'user_confirmed' },
}

// ───────────────────────────────────────────────────────────────────────────
// LAYER 1 — what the gesture CREATES
// ───────────────────────────────────────────────────────────────────────────

describe('LAYER 1 — a gesture-created node carries no value of any kind', () => {
  it('⭐ the fixture the rest of this file tests has exactly ONE key, and it is the label', () => {
    // ⚠ ASSERTED AS A KEY SET, not by spot-checking absences. "No `prior`" and
    // "no `observedState`" are two spot checks that both pass while a third key
    // rides along; the SET cannot be satisfied by anything but the truth.
    //
    // ⚠ AND ITS SCOPE IS THE FIXTURE, NOT THE STORE — see the fixture's own
    // header. The guard that actually catches `store.addNode` seeding a value is
    // `store.structuralAddCapture.spec.ts`'s "THE CREATED NODE CARRIES NO
    // VALUE", proven by mutant M1.
    expect(Object.keys(GESTURE_CREATED_NODE_DATA)).toEqual(['label'])
  })

  it('names the value carriers explicitly, so a rename of one cannot slip past the set check', () => {
    for (const carrier of [
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
        Object.prototype.hasOwnProperty.call(GESTURE_CREATED_NODE_DATA, carrier),
        `a gesture-created node must not carry "${carrier}"`,
      ).toBe(false)
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// LAYER 2 — what the WIRE carries
// ───────────────────────────────────────────────────────────────────────────

describe('LAYER 2 — the wire payload has nowhere to put a value, and puts none there', () => {
  it('⭐ a captured add emits exactly four keys, none of them a value', () => {
    const captured = captureStructuralAdd({
      nodesAfter: [
        {
          id: 'fac_new',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: GESTURE_CREATED_NODE_DATA,
        } as never,
      ],
      nodeId: 'fac_new',
      baseGraphHash: 'f3d31f75957c5cb5',
      externalMutationActive: false,
      persistableKinds: WIRE_ADDABLE_NODE_KINDS,
      resolveKind: () => 'factor',
      makeId: () => 'i1',
    })
    expect(captured.ok).toBe(true)
    if (!captured.ok) return

    const payload = buildStructuralAddWirePayload({
      ...captured.intent,
      baseGraphHash: 'f3d31f75957c5cb5',
    })
    expect(Object.keys(payload).sort()).toEqual([
      'base_graph_hash',
      'label',
      'node_id',
      'node_kind',
    ])
    // And no value smuggled inside a key that IS allowed.
    expect(JSON.stringify(payload)).not.toMatch(/"(value|prior|observed_state|probability)"/)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// LAYER 3 — the render PREDICATES gate on status, never on falsiness
// ───────────────────────────────────────────────────────────────────────────

describe('LAYER 3 — status, never falsiness', () => {
  it('⭐ FABRICATION DIRECTION: a gesture-created node reads as "needs input" and holds no stated value', () => {
    expect(hasAnyStatedValue(GESTURE_CREATED_NODE_DATA)).toBe(false)
    expect(hasObservedData(GESTURE_CREATED_NODE_DATA)).toBe(false)
    // The ungated affordance — not behind `graphBadges`, not behind a priority
    // rank. This is what makes the unknown EXPLICIT rather than merely blank.
    expect(isFactorNeedsInput(GESTURE_CREATED_NODE_DATA)).toBe(true)
  })

  it('⭐⭐ TWIN — ERASURE DIRECTION: a GENUINE `0` is stated data and must NOT read as unknown', () => {
    // `0` is falsy. Every one of these would answer the wrong way under a
    // truthiness gate, and the user's real measurement would be erased.
    expect(hasAnyStatedValue(GENUINE_ZERO)).toBe(true)
    expect(hasObservedData(GENUINE_ZERO)).toBe(true)
    expect(isFactorNeedsInput(GENUINE_ZERO)).toBe(false)
  })

  it('the discriminator is the FLAG, not the range — two byte-identical priors, opposite answers', () => {
    const ignorance = {
      distribution: 'uniform',
      range_min: 0,
      range_max: 1,
      [PRIOR_IS_UNQUANTIFIED_FIELD]: true,
    }
    const { [PRIOR_IS_UNQUANTIFIED_FIELD]: _flag, ...genuine } = ignorance
    // PRECONDITION PINNED IN-TEST (trap 13b): the two differ ONLY by the flag,
    // so a passing result is the predicate's doing and not the fixture's.
    expect(genuine).toEqual({ distribution: 'uniform', range_min: 0, range_max: 1 })
    expect(isUnquantifiedPrior(ignorance)).toBe(true)
    expect(isUnquantifiedPrior(genuine)).toBe(false)
    // And the flag must be a real `true`, never a truthy stand-in.
    expect(isUnquantifiedPrior({ ...genuine, [PRIOR_IS_UNQUANTIFIED_FIELD]: 'true' })).toBe(false)
    expect(isUnquantifiedPrior({ ...genuine, [PRIOR_IS_UNQUANTIFIED_FIELD]: 1 })).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// LAYER 4 — what a user actually SEES on a real mount
// ───────────────────────────────────────────────────────────────────────────

/** Every digit-bearing token. The fabrication direction's detector. */
const ANY_NUMBER = /\d/

function topology() {
  return {
    hoveredOptionId: null,
    nodes: [
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Supplier concentration risk' } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
    ],
    edges: [
      {
        id: 'e1',
        source: 'factor-1',
        target: 'outcome-1',
        data: { weight: 1, direction: 'positive', weightSource: 'cee' },
      },
    ],
    ceeAnalysisReady: null,
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode: 'expert' as const,
  }
}

const baseProps = {
  id: 'factor-1',
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

function renderFactor(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} data={{ type: 'factor', ...data }} />
    </ReactFlowProvider>,
  )
}

describe('LAYER 4 — the real node mount', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // ⚠ `clearAllMocks` clears CALLS, not IMPLEMENTATIONS, so a return value set
    // in one case leaks into every case after it. Pinned explicitly so the
    // default is order-independent.
    const flags = await import('../../../flags')
    vi.mocked(flags.isGraphBadgesEnabled).mockReturnValue(false)
    vi.mocked(useCanvasStore).mockImplementation(((selector: (s: unknown) => unknown) =>
      selector(topology())) as never)
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

  it('⭐⭐ FABRICATION DIRECTION: a gesture-created node renders NO NUMBER AT ALL', () => {
    // ⚠ The strongest form available: not "does not render 0", not "does not
    // render 50%", but NO DIGIT ANYWHERE. A weaker assertion would pass while a
    // different fabricated figure rendered — the estate has shipped a `0.01`
    // fallback on this very component, so the specific-value form is not enough.
    const { container } = renderFactor(GESTURE_CREATED_NODE_DATA)
    expect(container.textContent ?? '').not.toMatch(ANY_NUMBER)
    // And it is not silently blank either: the label is there.
    expect(container.textContent).toContain('Supplier concentration risk')
  })

  it('⭐⭐ TWIN — ERASURE DIRECTION: a node carrying a GENUINE `0` still SHOWS its `0`', () => {
    // The whole point of gating on status rather than falsiness. If this ever
    // goes red because the zero vanished, the "explicit unknown" work has
    // started eating real measurements.
    const { container } = renderFactor(GENUINE_ZERO)
    expect(container.textContent ?? '').toMatch(/0/)
  })

  it('a gesture-created node is marked as needing input — the unknown is EXPLICIT, not blank', () => {
    // The pill is rendered by BaseNode from `isFactorNeedsInput`, and it is NOT
    // behind `graphBadges` (pinned off above) nor behind a priority rank. This
    // is the affordance that makes the absence legible to a user.
    expect(isFactorNeedsInput(GESTURE_CREATED_NODE_DATA)).toBe(true)
    // TWIN, asserted on the same predicate the render consumes, so the two
    // cannot drift apart.
    expect(isFactorNeedsInput(GENUINE_ZERO)).toBe(false)
  })
})

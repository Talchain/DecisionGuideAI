/**
 * ⭐⭐ THE GOAL NOTICE'S IMPERATIVE IS TRUE ON THE CANVAS — SETTLED BY DERIVATION,
 * 10 Sep 2026, AND PINNED HERE SO IT STOPS BEING RE-OPENED.
 *
 * `GOAL_LABEL_FROM_BRIEF_COPY.canvasNodeNotice` ends with "Double-click the node
 * to write it in your own words." That imperative is only honest on a surface
 * from which the goal label can actually be edited. It was twice suspected of
 * being a dead instruction on the canvas, because `GoalNode.tsx` hosts no
 * writer and a sweep of the rendering directory returns a clean zero.
 *
 * ⚠ THE MEMBER WAS RENAMED FROM `notice`, AND THE RENAME IS NOT COSMETIC. One
 * member served three surfaces; each now binds the one named for it, because
 * each answers for its own writer (this node double-clicks; the pre-analysis
 * hero edits its Goal field in place; the Model tab row hosts no goal-LABEL
 * writer at all). The arms below pin THIS surface and no other.
 *
 * THE WRITER IS NOT IN THE RENDERING FILE. It is one store call away:
 *
 *   GoalNode click        → ReactFlowGraph `handleNodeClick` (:1343)
 *                           → setShowFullInspector(true)
 *   GoalNode double-click → `handleNodeDoubleClick` → `requestNodeRename`
 *                           → the inspector opens WITH THE TITLE IN EDIT STATE
 *   InspectorShell header → `EditableLabel onSave={onLabelChange}`
 *   InspectorRouter       → `store.updateNodeLabel`, NOT the panel's `setLabel`
 *   store.ts:3137         → `provenanceAfterHumanAuthoredLabel(kind)` returns
 *                           'user_set' when, and only when, kind === 'goal'
 *
 * So `goalLabelIsUnconfirmedBriefExtract` goes false and the marker retires —
 * precisely what the notice promises. The imperative is TRUE here.
 *
 * ⚠ THIS FILE PINS THE CANVAS ALONE. The hero renders the same member today and
 * SHOULD NOT -- its goal field is a read-only span (`goalSuccessTarget:
 * 'disabled'`, a hardcoded constant, so posture-independent). Do not add an arm
 * asserting the two surfaces agree: it would RED on the hero's correct fix.
 *
 * ⚠ WHY A SOURCE-READING ARM EXISTS BELOW. A value assertion cannot prove a
 * REFERENCE: it passes on a byte-identical copy of the sentence. If a later
 * change introduces a second, imperative-free member of this constant and
 * repoints one surface at it, only a guard that reads which MEMBER each surface
 * binds can see it. That is the drift this file exists to catch.
 */
/**
 * ⭐ THE CANVAS OBEYS THE CLAIM AXIS — because a correct predicate nothing calls
 * is this estate's signature defect.
 *
 * `domain/__tests__/nodeProvenanceClaim.spec.ts` proves the RULE. This proves
 * the CARD obeys it, by rendering the real node components and asking what is on
 * the card — not by reading the source and agreeing with it.
 *
 * ⚠ THE DEFECTS IT PINS, measured on deployed staging and not on a fixture:
 *   · on `be33648b` the GOAL card carried "From brief" (this mark) 18px above
 *     "From your brief" (`GOAL_LABEL_FROM_BRIEF_COPY`) — ONE wire literal in two
 *     spellings, which a reader cannot tell is one fact;
 *   · every non-factor card read the value vocabulary ("AI estimate") about a
 *     number that does not exist on it — 21 of 25 captured non-factor nodes
 *     carry no value key at all.
 *
 * ⛔ BOTH DIRECTIONS, EVERY TIME. A change that suppressed the mark everywhere,
 * or made every card structural, would satisfy the goal and option cases here
 * while deleting the signal the founder specifically valued. The factor cases
 * are load-bearing, not decoration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
  })),
}))

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { useCanvasStore } from '../../store'
import { GoalNode } from '../GoalNode'
import {
  GOAL_LABEL_FROM_BRIEF_COPY,
  GOAL_LABEL_FROM_BRIEF_TESTID,
} from '../../domain/goalLabelProvenance'

/* ReactFlow's NodeProps requires a dozen fields no assertion here reads; the
   casts below are the sibling node specs' own pattern. */
const baseProps = {
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function mockStore(over: Record<string, unknown>) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      viewMode: 'expert',
      ...over,
    } as never),
  )
}

/**
 * ⚠ BOUND BY IDENTITY — the node id, never a value predicate another node could
 * satisfy. Each case renders exactly one card, so the mark found is that card's.
 */
function renderNode(
  Comp: (p: any) => any,
  type: string,
  id: string,
  data: Record<string, unknown>,
) {
  mockStore({ nodes: [{ id, type, data }] })
  return render(
    <ReactFlowProvider>
      <Comp {...(baseProps as any)} type={type} id={id} data={data as any} />
    </ReactFlowProvider>,
  )
}


/*
 * ⚠ REPOINTED, NOT RELAXED. This was `'Edit it to say what you want to
 * achieve.'`, the imperative of the single `notice` member that used to serve
 * three surfaces. That member is gone: the surfaces no longer share one
 * sentence, because they no longer share one writer. The canvas's own act is a
 * DOUBLE-CLICK on this node, and `canvasNodeNotice` is the member that names
 * it — so this constant is the clause whose presence keeps THIS surface's
 * promise, and the arms below still RED if the sentence is repointed at an
 * imperative-free variant.
 */
const IMPERATIVE = 'Double-click the node to write it in your own words.'
/* `fileURLToPath(import.meta.url)`, not `__dirname` — the pattern this repo's
   own `inspector-v2/__tests__/inspectorNoRawIds.spec.tsx:227` uses in a `.tsx`
   spec, so it is known to resolve under this vitest config. */
const HERE = dirname(fileURLToPath(import.meta.url))
const GOAL_NODE_SRC = readFileSync(join(HERE, '..', 'GoalNode.tsx'), 'utf-8')

beforeEach(() => {
  vi.clearAllMocks()
})

describe("⛔ the goal notice's imperative is honest on the canvas", () => {
  /* ⚠ THE INSTRUMENT CONTROL, FIRST. Both source arms below assert an ABSENCE
     (`not.toContain`), and an absence assertion over an EMPTY string passes by
     testing nothing. A path that silently resolves wrong reads as a clean pass.
     So prove the read can SEE a presence before trusting the absence. */
  it('the source read is non-empty and contains a known marker', () => {
    expect(GOAL_NODE_SRC.length).toBeGreaterThan(1000)
    expect(GOAL_NODE_SRC).toContain('GOAL_LABEL_FROM_BRIEF_TESTID')
  })

  it('the canvas marker carries the FULL notice, imperative included', () => {
    renderNode(GoalNode, 'goal', 'goal_1', {
      label: 'Grow revenue',
      type: 'goal',
      provenance: 'from_brief',
    })
    // Bound by the surface's OWN testid, never by a text predicate another
    // element on the card could also satisfy.
    const own = screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)
    expect(own.getAttribute('title')).toBe(GOAL_LABEL_FROM_BRIEF_COPY.canvasNodeNotice)
  })

  it('and the imperative clause is PRESENT, not merely the prefix', () => {
    renderNode(GoalNode, 'goal', 'goal_1', {
      label: 'Grow revenue',
      type: 'goal',
      provenance: 'from_brief',
    })
    // A distinct signature from the test above ON PURPOSE: repointing this
    // surface at an imperative-free variant keeps the `toBe` green if that
    // variant is what the constant now names, and REDs only here.
    expect(screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID).getAttribute('title'))
      .toContain(IMPERATIVE)
  })

  it('GoalNode binds the notice BY REFERENCE, not by a copied string', () => {
    // Source-reading, because a value assertion passes on a duplicate literal.
    expect(GOAL_NODE_SRC).toContain('GOAL_LABEL_FROM_BRIEF_COPY.canvasNodeNotice')
    // And the sentence is not inlined anywhere in this file.
    expect(GOAL_NODE_SRC).not.toContain(IMPERATIVE)
  })

  it('the constant itself still carries the imperative', () => {
    // The precondition for all four arms above, pinned in-test: without it they
    // would be satisfied by a change that simply deleted the promise.
    expect(GOAL_LABEL_FROM_BRIEF_COPY.canvasNodeNotice).toContain(IMPERATIVE)
  })
})

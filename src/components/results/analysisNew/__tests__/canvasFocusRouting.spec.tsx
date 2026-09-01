/**
 * ⭐⭐ "SHOW ON CANVAS" RESOLVES THE TARGET IT WAS GIVEN, AND SAYS SO WHEN IT
 * CANNOT — the two live defects in `AnalysisNewTabBody`'s `focusTarget`.
 *
 * ## What was broken, derived at the bytes before it was fixed
 *
 * `focusTarget` read `if (onFocusNode) onFocusNode(id); else
 * focusModelTarget(id)`. There is exactly ONE production mount
 * (`OutputsDock.tsx:3504` — the only non-test reference to the component) and
 * it ALWAYS supplies `onFocusNode`, so the `else` branch was DEAD IN
 * PRODUCTION and the capable resolver was reachable only from tests.
 *
 * The two are NOT interchangeable, which is why the dead branch mattered:
 *
 *   `onFocusNode`        = `focusExistingTarget(id, 'node')` — NODE-SCOPED,
 *                          returns void, no-ops silently on anything else.
 *   `focusModelTarget`   = the UNIVERSAL resolver (canvas node id, canvas edge
 *                          id, arrow-form `a->b`, producer id on `edge.data`),
 *                          and it RETURNS whether anything resolved.
 *
 * 1. **A structurally dead button.** `buildAnalysisNewViewModel.ts:714` emits
 *    `targetId: assumed.edgeId` — declared "Canvas edge id — the focus target"
 *    (`selectAssumedStrengthToResolve.ts:163`) — into the node-only path. That
 *    "Show on canvas" could never work, on any run, for any user.
 *    `focusHelpers.ts:173` names this exact shape.
 * 2. **Every target failed silently.** The boolean was discarded, so a stale
 *    or deleted target moved nothing and said nothing.
 *
 * ## Why this file does NOT mock `focusModelTarget`
 *
 * A mocked resolver returning `true` would pass the edge case while the real
 * routing stayed broken — it would assert that the component calls A helper,
 * not that an EDGE id resolves. So the real `focusHelpers` runs against a
 * seeded `useCanvasStore`, and the assertions bind to WHICH primitive the
 * resolver reached and WITH WHICH id, through `registerFocusHelpers`. That is
 * the difference between testing the wiring and testing the fix.
 *
 * ## Scope, stated so it is not inherited as more than it is (trap 3)
 *
 * This proves the RESOLUTION and the NOTICE. It proves nothing about a
 * viewport moving — jsdom cannot, and `focusNodeById`/`focusEdgeById` are
 * observed here as registered spies rather than as a real ReactFlow. Their own
 * behaviour is pinned by the canvas suite.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }))

/**
 * `importOriginal`-spread, never a bare factory: a bare factory REPLACES the
 * module, so any other export this tree reaches for would be silently
 * `undefined` (CLAUDE.md trap 12 — the flags-mock allowlist that killed 51
 * tests). Only the toast channel is substituted; `focusHelpers` is NOT mocked
 * at all, by design (see the header).
 */
vi.mock('../../../../canvas/ToastContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../canvas/ToastContext')>()),
  useShowToastSafe: () => showToast,
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { focusExistingTarget, registerFocusHelpers } from '../../../../canvas/utils/focusHelpers'
import { useCanvasStore } from '../../../../canvas/store'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeData } from './analysisNewFixtures'

/** The canvas this run is about. One node target, one EDGE target. */
const NODE_ID = 'f_adopt'
const EDGE_ID = 'e_adopt_goal'
const ABSENT_ID = 'f_deleted_between_render_and_click'

const focusNodeSpy = vi.fn()
const focusEdgeSpy = vi.fn()
let unregister: (() => void) | null = null

beforeEach(() => {
  focusNodeSpy.mockClear()
  focusEdgeSpy.mockClear()
  showToast.mockClear()
  dockFocusHandler.mockClear()
  unregister = registerFocusHelpers(focusNodeSpy, focusEdgeSpy)
  useCanvasStore.setState({
    nodes: [{ id: NODE_ID }, { id: 'goal_margin' }],
    edges: [{ id: EDGE_ID, source: NODE_ID, target: 'goal_margin' }],
  } as never)
})
afterEach(() => {
  unregister?.()
  unregister = null
  cleanup()
})

/**
 * A run carrying BOTH target kinds in the Uncertainty section.
 *
 * - the assumed-strength finding, whose `targetId` is a canvas EDGE id
 *   (`buildAnalysisNewViewModel.ts:714`)
 * - a sensitive-assumption finding, whose `targetId` is a canvas NODE id
 *   (`:921`, `u.affectedNodes[0]`)
 *
 * Both in one fixture on purpose: the node case is the CONTROL that proves the
 * edge case is about edges rather than about focus being broken generally.
 */
function runWithBothTargetKinds(
  over: { edgeId?: string; nodeId?: string } = {},
): ResultsSectionDataReturn {
  return makeData({
    recommendation: { robustnessVerdict: 'fragile' },
    confidence: {
      evidenceGapsAssessed: true,
      evidenceGaps: [],
      robustnessStatus: 'computed',
      uncertainties: [
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'raw',
          userMessage: 'Customer adoption is the assumption the result is most sensitive to.',
          displayText: 'Customer adoption is the assumption the result is most sensitive to.',
          severity: 'critical',
          affectedNodes: [over.nodeId ?? NODE_ID],
          eValue: 1.8,
        },
      ],
    } as never,
    assumedStrength: {
      selected: {
        edgeId: over.edgeId ?? EDGE_ID,
        fromLabel: 'Customer adoption',
        toLabel: 'Sustained margin',
        switchProbability: 0.31,
        alternativeWinnerLabel: 'Hold price',
        strengthProvenance: 'ai_inferred',
      },
      refusalReason: null,
      assumedFragileCount: 2,
    } as never,
  })
}

/**
 * Open Uncertainty, expand every row it holds, and return the focus buttons in
 * document order paired with the id each will dispatch.
 *
 * ⚠ THE BUTTONS ARE READ BY THEIR OWN `data-target`, NOT BY POSITION. Two rows
 * render the same testid prefix, so an index would bind to "whichever row is
 * first" — a value predicate another object satisfies (trap 19). The id a
 * button will actually send is what identifies it.
 */
function openUncertaintyAndCollectFocusButtons() {
  fireEvent.click(screen.getByTestId('analysis-new-uncertainty-toggle'))
  for (const toggle of screen.getAllByTestId('analysis-new-uncertainty-toggle')) {
    if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
  }
  for (const row of screen.getAllByTestId('analysis-new-uncertainty-row')) {
    const rowToggle = row.querySelector('[data-testid="analysis-new-uncertainty-toggle"]')
    if (rowToggle && rowToggle.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(rowToggle)
    }
  }
  return screen.queryAllByTestId('analysis-new-uncertainty-focus')
}

/**
 * ⭐⭐ THE DOCK'S REAL HANDLER, NOT AN INERT STUB — and this is load-bearing.
 *
 * `OutputsDock.tsx:1524-1531` is `focusExistingTarget(nodeId, 'node')` plus a
 * highlight. A `vi.fn()` in its place swallows EVERYTHING, so the old code
 * would look equally broken for nodes and for edges and the two cases below
 * could not be told apart — the mutant would kill both and prove only that
 * something changed.
 *
 * Reproducing the handler's actual behaviour is what makes the pair
 * discriminating: under the pre-fix code the NODE case passes (the dock
 * handler resolves nodes perfectly well) and the EDGE case fails (it cannot
 * resolve an edge, and says nothing). That asymmetry IS the production
 * defect, so the corpus reproduces the defect rather than a caricature of it
 * (trap 16 — a fixture you wrote yourself is not evidence about the wire).
 */
const dockFocusHandler = vi.fn((nodeId: string) => {
  focusExistingTarget(nodeId, 'node')
})

const renderBody = (data: ResultsSectionDataReturn, onFocusNode?: (id: string) => void) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_focus"
      onFocusNode={onFocusNode ?? dockFocusHandler}
    />,
  )

describe('"Show on canvas" resolves EDGE targets, not only node targets', () => {
  it('routes a canvas EDGE id to the edge primitive — the button that could never work', () => {
    // ⭐ THE DEFECT CASE. `onFocusNode` is supplied exactly as the one
    // production mount supplies it, so this is the production path and not a
    // configuration only tests can reach.
    renderBody(runWithBothTargetKinds())
    const buttons = openUncertaintyAndCollectFocusButtons()

    // PRECONDITION, PINNED IN-TEST: the edge-targeted affordance really is on
    // screen. Without this the case passes vacuously the day the finding stops
    // rendering — which is exactly how a guard rots (trap 13).
    expect(buttons.length, 'no focus affordance rendered — this case would be vacuous').toBeGreaterThan(0)

    for (const b of buttons) fireEvent.click(b)

    // Bound to the EDGE primitive AND the exact id. "focus was called" would be
    // satisfied by the node row alone.
    expect(focusEdgeSpy).toHaveBeenCalledWith(EDGE_ID)
    // A resolvable target says nothing. A notice here would be the opposite
    // defect — a working control that claims it failed.
    expect(showToast).not.toHaveBeenCalled()
  })

  it('still routes a canvas NODE id to the node primitive', () => {
    // The CONTROL for the case above: it proves the edge assertion is about
    // EDGES, not about focus having been broken across the board. It is also
    // the regression guard on the path that already worked.
    renderBody(runWithBothTargetKinds())
    const buttons = openUncertaintyAndCollectFocusButtons()
    expect(buttons.length).toBeGreaterThan(0)
    for (const b of buttons) fireEvent.click(b)

    expect(focusNodeSpy).toHaveBeenCalledWith(NODE_ID)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('the two targets reach DIFFERENT primitives on the same render', () => {
    // ⭐ The discrimination, in one assertion. A resolver that sent everything
    // to `focusNodeById` would satisfy the node case above and destroy the edge
    // one; a resolver that sent everything to `focusEdgeById` would do the
    // reverse. Only routing BY KIND satisfies both at once.
    renderBody(runWithBothTargetKinds())
    for (const b of openUncertaintyAndCollectFocusButtons()) fireEvent.click(b)

    expect(focusEdgeSpy.mock.calls.map(([id]) => id)).toContain(EDGE_ID)
    expect(focusNodeSpy.mock.calls.map(([id]) => id)).toContain(NODE_ID)
    expect(focusNodeSpy.mock.calls.map(([id]) => id)).not.toContain(EDGE_ID)
    expect(focusEdgeSpy.mock.calls.map(([id]) => id)).not.toContain(NODE_ID)
  })
})

describe('a target that is no longer on the canvas fails LOUDLY, exactly once', () => {
  it('shows the notice and moves nothing', () => {
    // The other half of the fix: the boolean was discarded, so this said
    // nothing at all. The condition is real — a node deleted between render and
    // click, or a recovered session whose ids no longer match.
    renderBody(runWithBothTargetKinds({ nodeId: ABSENT_ID, edgeId: 'e_also_gone' }))
    const buttons = openUncertaintyAndCollectFocusButtons()
    expect(buttons.length, 'no focus affordance rendered — this case would be vacuous').toBeGreaterThan(0)

    fireEvent.click(buttons[0])

    // EXACTLY one — not "at least one". A notice per resolution attempt inside
    // one click would be its own defect.
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith(COPY.canvas.focusFailed)
    // And nothing moved: a notice plus a camera move would be worse than either.
    expect(focusNodeSpy).not.toHaveBeenCalled()
    expect(focusEdgeSpy).not.toHaveBeenCalled()
  })

  it('says NOTHING on a target that does resolve', () => {
    // The discriminating twin. Without it, a component that always notified
    // would pass the case above and cry wolf on every working click.
    renderBody(runWithBothTargetKinds())
    for (const b of openUncertaintyAndCollectFocusButtons()) fireEvent.click(b)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('the notice is the IMPORTED sentence, not a respelling', () => {
    // `COPY.canvas.focusFailed` is derived from `strengthen/strengthenCopy.ts:51`
    // and is the same sentence the two sibling call sites use. Asserting the
    // constant rather than a literal is what keeps the three from drifting
    // apart (trap 12); asserting it is NON-EMPTY is what stops this passing on
    // an accidentally-blank constant.
    expect(COPY.canvas.focusFailed.length).toBeGreaterThan(10)
  })
})

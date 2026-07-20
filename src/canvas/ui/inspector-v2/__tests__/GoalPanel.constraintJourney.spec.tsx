/**
 * GOAL-CONSTRAINT JOURNEY FIXTURE — the one test that reproduces the live
 * staging P1: "Add constraint" poisoned every subsequent analysis run with a
 * PLoT 422 (CONSTRAINT_TARGET_NOT_FOUND on node "undefined").
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Five separate defects survived in this path because the existing adapter spec
 * asserted a HAND-WRITTEN constraint object rather than one the UI had actually
 * produced. It blessed the invalid shape:
 *
 *     { id: 'c1', label: 'Revenue >= 500', operator: '>=', value: 500 }
 *
 * — no `constraint_id`, no `node_id`. Every assertion passed. The wire 422'd.
 *
 * So this fixture drives the REAL journey end to end and never hand-writes the
 * constraint:
 *
 *     render GoalPanel → click "Add constraint" → pick a factor from the real
 *     dropdown → set operator + value → click Add → read the REAL store →
 *     feed it to the REAL adapter → assert on the REAL request bytes
 *
 * The constraint under test is whatever the UI actually minted. Nothing here
 * can pass by describing a shape the product does not build.
 *
 * THE ORACLE IS DERIVED, NOT MIRRORED
 * -----------------------------------
 * Shape conformance is checked against `DraftGoalConstraintSchema` imported
 * from @talchain/schemas — the contract itself, not a local restatement of it.
 * If the contract tightens, this test fails rather than silently passing
 * against a stale copy (CLAUDE.md verification trap #12).
 *
 * Target resolution is checked against the request's OWN `graph.nodes`, which
 * is precisely what PLoT's `validateGoalConstraints` does
 * (plot-lite-service `src/validation/preflight-v2.ts`): `nodeMap.get(node_id)`
 * miss => CONSTRAINT_TARGET_NOT_FOUND blocker => 422. Deriving the check from
 * the emitted request means it cannot drift from what we actually send.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DraftGoalConstraintSchema } from '@talchain/schemas/boundary'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import {
  buildV2RequestFromAnalysisReady,
  executeV2RunWithAnalysisReady,
} from '../../../../adapters/plot/v2/adapter'
import type { CEEAnalysisReady } from '../../../../adapters/cee/types'

// A factor whose ID is deliberately NOTHING like its label. If the panel
// captures the label instead of the ID, `node_id` cannot accidentally resolve.
const FACTOR_ID = 'fac_first_year_cost'
const FACTOR_LABEL = 'First-year cost'

const GOAL_ID = 'goal_margin'

const nodes = [
  {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: FACTOR_LABEL, kind: 'factor', value: 40000 },
  },
  {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 200, y: 0 },
    data: { label: 'Margin', kind: 'goal' },
  },
]

const edges = [
  {
    id: 'e1',
    source: FACTOR_ID,
    target: GOAL_ID,
    data: { weight: 0.5, direction: 'positive', beliefExists: 0.8 },
  },
]

const analysisReady: CEEAnalysisReady = {
  options: [
    {
      id: 'opt1',
      label: 'Option A',
      status: 'ready',
      interventions: { [FACTOR_ID]: { value: 30000, source: 'brief_extraction' } },
    },
  ],
  goal_node_id: GOAL_ID,
  // The user's success target. Defect 5 deleted this the moment a constraint
  // existed, silently dropping the target from every run.
  goal_threshold: 0.6,
}

function seedStore(overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState(
    {
      ...useCanvasStore.getState(),
      nodes,
      edges,
      goalConstraints: null,
      goalThreshold: 0.6,
      results: { status: 'idle', report: null },
      ...overrides,
    } as never,
    true,
  )
}

/**
 * Drive the real UI: open the form, pick the factor, type the value, submit.
 * Returns whatever the panel wrote to the store — never a hand-built object.
 */
function addConstraintViaUI({ operatorValue = '<=', value = '50000' } = {}) {
  render(<GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)

  fireEvent.click(screen.getByTestId('add-constraint-button'))

  const factorSelect = screen.getByLabelText('Constraint target factor')
  const optionValues = Array.from(
    (factorSelect as HTMLSelectElement).querySelectorAll('option'),
  ).map((o) => (o as HTMLOptionElement).value)

  fireEvent.change(factorSelect, { target: { value: FACTOR_ID } })
  fireEvent.change(screen.getByLabelText('Constraint operator'), {
    target: { value: operatorValue },
  })
  fireEvent.change(screen.getByLabelText('Constraint target value'), {
    target: { value },
  })
  fireEvent.click(screen.getByTestId('confirm-add-constraint'))

  return {
    constraints: useCanvasStore.getState().goalConstraints,
    optionValues,
  }
}

/** Build the outbound PLoT request from whatever the UI put in the store. */
function buildRequestFromStore() {
  const { goalConstraints } = useCanvasStore.getState()
  const { request } = buildV2RequestFromAnalysisReady(
    useCanvasStore.getState().nodes as never,
    useCanvasStore.getState().edges as never,
    analysisReady,
    [],
    undefined,
    { goalConstraints },
  )
  return request
}

describe('GOAL-CONSTRAINT JOURNEY — UI "Add constraint" to PLoT request bytes', () => {
  beforeEach(() => {
    seedStore()
  })

  // ── Defect 2: the panel captured the label, not the node ID ──────────────
  it('the factor dropdown carries NODE IDs, so a selection can name a real node', () => {
    seedStore()
    const { optionValues } = addConstraintViaUI()

    // The label must not be usable as an option value — that is the whole bug.
    expect(optionValues).toContain(FACTOR_ID)
    expect(optionValues).not.toContain(FACTOR_LABEL)
  })

  // POSITIVE CONTROL for the oracle. A conformance assertion is worthless if
  // the validator cannot fail (CLAUDE.md trap #13) — and the schema resolving
  // to `undefined` off a wrong import path is a live hazard here, since it is
  // exported from '@talchain/schemas/boundary', not the package root. Prove the
  // oracle both LOADS and REJECTS the exact shape that shipped the P1.
  it('CONTROL: the schema oracle is loaded and rejects the pre-fix constraint', () => {
    expect(DraftGoalConstraintSchema).toBeDefined()

    const preFixShape = { id: 'c1', label: FACTOR_LABEL, operator: '>=', value: 500 }
    const rejected = DraftGoalConstraintSchema.safeParse(preFixShape)
    expect(rejected.success).toBe(false)

    const missingKeys = rejected.success
      ? []
      : rejected.error.issues.map((i) => i.path.join('.'))
    expect(missingKeys).toContain('constraint_id')
    expect(missingKeys).toContain('node_id')
  })

  // ── Defects 1 + 2: the emitted constraint must satisfy the CONTRACT ──────
  it('the constraint the UI mints conforms to DraftGoalConstraintSchema', () => {
    seedStore()
    const { constraints } = addConstraintViaUI()

    expect(constraints).toHaveLength(1)

    // The contract itself is the oracle. constraint_id and node_id are both
    // required min(1) — the pre-fix object had neither.
    const parsed = DraftGoalConstraintSchema.safeParse(constraints![0])
    expect(parsed.success).toBe(true)

    expect(constraints![0].node_id).toBe(FACTOR_ID)
    expect(constraints![0].constraint_id).toBeTruthy()
    // A user-typed constraint is explicit, not inferred from the brief.
    expect(constraints![0].provenance).toBe('explicit')
  })

  // ── THE LIVE 422, REPRODUCED: node_id must resolve in the request graph ──
  it('the outbound request resolves every constraint target against graph.nodes', () => {
    seedStore()
    addConstraintViaUI()
    const request = buildRequestFromStore()

    expect(request.goal_constraints).toHaveLength(1)

    // This is PLoT's preflight, derived from the request we actually send:
    // a nodeMap miss is CONSTRAINT_TARGET_NOT_FOUND, which 422s the run.
    const graphNodeIds = new Set(request.graph.nodes.map((n) => n.id))
    for (const c of request.goal_constraints!) {
      expect(c.node_id).toBeDefined()
      expect(String(c.node_id)).not.toBe('undefined')
      expect(graphNodeIds.has(c.node_id!)).toBe(true)
    }
  })

  // ── Defect 5: adding a constraint must not delete the success target ─────
  it('goal_threshold SURVIVES alongside goal_constraints', () => {
    seedStore()
    addConstraintViaUI()
    const request = buildRequestFromStore()

    expect(request.goal_constraints).toHaveLength(1)
    // PLoT Phase 1e applies constraint-over-threshold precedence itself and
    // records the repair. Deleting it client-side destroyed the user's target
    // before the producer could route or report on it.
    expect(request.goal_threshold).toBe(0.6)
  })

  // ── Defect 4: '=' is a PLoT CONSTRAINT_INVALID_OPERATOR blocker ──────────
  it('the operator dropdown offers only the operators PLoT accepts', () => {
    seedStore()
    render(<GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    fireEvent.click(screen.getByTestId('add-constraint-button'))

    const operators = Array.from(
      screen.getByLabelText('Constraint operator').querySelectorAll('option'),
    ).map((o) => (o as HTMLOptionElement).value)

    expect(operators).toEqual(['>=', '<='])
    expect(operators).not.toContain('=')
  })

  // ── Defect 3: positional ids collide after delete-then-add ──────────────
  it('constraint ids stay unique across a delete-then-add cycle', () => {
    // The collision is only reachable by DRIVING THE UI through the real
    // sequence. An earlier version of this test minted the second id itself and
    // therefore passed with the positional scheme restored — it proved nothing.
    // `c${base.length + 1}` reissues an id that is already in use:
    //   add A -> base [] -> "c1"
    //   add B -> base [A] -> "c2"
    //   delete A -> base [B("c2")]
    //   add C -> base [B] -> "c2"  <-- collides with B
    // PLoT rejects that with CONSTRAINT_DUPLICATE_ID.
    seedStore({
      nodes: [
        ...nodes,
        {
          id: 'fac_headcount',
          type: 'factor',
          position: { x: 0, y: 120 },
          data: { label: 'Headcount', kind: 'factor', value: 10 },
        },
        {
          id: 'fac_runway',
          type: 'factor',
          position: { x: 0, y: 240 },
          data: { label: 'Runway', kind: 'factor', value: 12 },
        },
      ],
    })

    const addFor = (factorId: string, value: string) => {
      const view = render(
        <GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />,
      )
      fireEvent.click(view.getByTestId('add-constraint-button'))
      fireEvent.change(view.getByLabelText('Constraint target factor'), {
        target: { value: factorId },
      })
      fireEvent.change(view.getByLabelText('Constraint target value'), { target: { value } })
      fireEvent.click(view.getByTestId('confirm-add-constraint'))
      view.unmount()
    }

    addFor(FACTOR_ID, '50000')
    addFor('fac_headcount', '10')

    // The user deletes the FIRST constraint.
    const afterTwo = useCanvasStore.getState().goalConstraints!
    expect(afterTwo).toHaveLength(2)
    useCanvasStore.getState().setGoalConstraints([afterTwo[1]])

    // ...and adds another. This is the reissue point.
    addFor('fac_runway', '12')

    const finalConstraints = useCanvasStore.getState().goalConstraints!
    expect(finalConstraints).toHaveLength(2)

    const ids = finalConstraints.map((c) => c.constraint_id ?? c.id)
    expect(new Set(ids).size).toBe(ids.length)

    // And the request must carry both — the UI-SEM-086 gate drops duplicates,
    // so a collision here silently costs the user a constraint.
    const request = buildRequestFromStore()
    expect(request.goal_constraints).toHaveLength(2)
  })
})

describe('GOAL-CONSTRAINT JOURNEY — legacy/poisoned constraints do not brick the run', () => {
  beforeEach(() => {
    seedStore()
  })

  // ── Defect 6: node_id must ride the same idMap as every other ID ────────
  it('normalises constraint node_id through the graph idMap', () => {
    // An imported graph whose IDs PLoT will not accept verbatim. Every other
    // ID is normalised; node_id used to skip it and then fail to resolve.
    const importedId = 'Factor With Spaces!'
    useCanvasStore.setState(
      {
        ...useCanvasStore.getState(),
        nodes: [
          { ...nodes[0], id: importedId, data: { ...nodes[0].data } },
          nodes[1],
        ],
        edges: [{ ...edges[0], source: importedId }],
        goalConstraints: [
          {
            constraint_id: 'c-imported',
            node_id: importedId,
            operator: '<=' as const,
            value: 50000,
          },
        ],
      } as never,
      true,
    )

    const { request } = buildV2RequestFromAnalysisReady(
      useCanvasStore.getState().nodes as never,
      useCanvasStore.getState().edges as never,
      {
        ...analysisReady,
        options: [
          {
            id: 'opt1',
            label: 'Option A',
            status: 'ready',
            interventions: { [importedId]: { value: 30000, source: 'brief_extraction' } },
          },
        ],
      },
      [],
      undefined,
      { goalConstraints: useCanvasStore.getState().goalConstraints },
    )

    expect(request.goal_constraints).toHaveLength(1)
    const graphNodeIds = new Set(request.graph.nodes.map((n) => n.id))
    // The constraint must point at the NORMALISED id, and that id must exist.
    expect(graphNodeIds.has(request.goal_constraints![0].node_id!)).toBe(true)
  })

  /**
   * THE LIVE PATH. useV2Run does NOT call the builder directly — it calls
   * executeV2RunWithAnalysisReady, which re-injects the user's threshold via its
   * `goalThreshold` parameter and, before this fix, deleted it again in a SECOND
   * XOR the brief never named. A fixture that only exercised the builder would
   * have gone green while the deployed wire was unchanged (CLAUDE.md trap #16:
   * trace the live call chain, not a symbol).
   */
  it('LIVE PATH: executeV2RunWithAnalysisReady sends both threshold and constraints', async () => {
    seedStore()
    addConstraintViaUI()

    // Capture the ACTUAL wire bytes: stub global fetch, which is what runV2 uses.
    let captured: Record<string, unknown> | undefined
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      captured = JSON.parse(String(init?.body ?? '{}'))
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ request_id: 'r1', analysis_status: 'complete' }),
        text: async () => '',
      }
    }) as never

    try {
      await executeV2RunWithAnalysisReady(
        { baseUrl: 'http://plot.test' } as never,
        useCanvasStore.getState().nodes as never,
        useCanvasStore.getState().edges as never,
        analysisReady,
        GOAL_ID,
        'req-1',
        // The user's normalised threshold, re-injected exactly as useV2Run does.
        0.6,
        undefined,
        undefined,
        useCanvasStore.getState().goalConstraints,
      )
    } finally {
      globalThis.fetch = realFetch
    }

    expect(captured).toBeDefined()
    expect(captured!.goal_constraints).toHaveLength(1)
    // The success target must reach the wire.
    expect(captured!.goal_threshold).toBe(0.6)
  })

  it('drops a pre-fix constraint that names no node, keeping the rest of the run alive', () => {
    seedStore({
      // Exactly what the old handleAddConstraint wrote, and what is sitting in
      // real users' persisted graphs right now.
      goalConstraints: [
        { id: 'c1', label: FACTOR_LABEL, operator: '>=' as const, value: 500 },
      ],
    })

    const request = buildRequestFromStore()

    // Dropped rather than forwarded: forwarding it 422s the ENTIRE analysis.
    expect(request.goal_constraints).toBeUndefined()
    // And the user's success target is still there to run against.
    expect(request.goal_threshold).toBe(0.6)
  })
})

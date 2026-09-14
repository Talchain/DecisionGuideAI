/**
 * THE GOAL ADVANCED EDITOR READS THE CONSTRAINTS THAT EXIST — and names them
 * honestly when it does.
 *
 * ## The dead read
 *
 * `GoalAdvancedEditor` read its constraints from the GOAL NODE'S DATA BAG
 * (`n.data.goal_constraints`). Nothing in the product writes that key. Measured
 * at `2e8e6d43`: all 89 production occurrences of `goal_constraints` are the
 * camelCase store slice, `results.report.goal_constraints`, the persisted
 * graph's TOP-LEVEL `graph.goal_constraints`, the wire request, or the debug
 * bundle — not one is a node-data write. `domain/nodes.ts:26-29` says so in the
 * product's own words: constraints surface as *"badge data on GoalNode
 * (store.goalConstraints + results.report.goal_constraints), not as standalone
 * canvas nodes."*
 *
 * CONTRAST CONTROL for that sweep, so "no writer" is a fact and not a blind
 * probe: the SAME probe over `goal_threshold_raw` — a sibling key this very
 * editor reads off the same bag — finds three node-data writes
 * (`useInspectorMutations.ts:284-288`, `applyDraftResult.ts:692-694`,
 * `applyV5State.ts:1084`). The instrument can see node-data writes; there are
 * none to see for this key.
 *
 * So the group rendered "No constraints defined" permanently, including for a
 * model whose constraints were sitting in the store one selector away.
 *
 * ## Why repointing the selector is NOT the whole fix
 *
 * The row rendered `String(c.label ?? c.node_id ?? '#' + (i+1))`.
 * `CEEGoalConstraint.label` is documented "genuinely absent in practice"
 * (`adapters/cee/types.ts:278-285`) and production node ids are HASHES. So the
 * moment constraints actually flowed, the first span would print a raw wire id
 * as the constraint's NAME — trading a silent empty section for a section full
 * of hashes. Both halves are pinned here, because a fix for either alone is a
 * defect.
 *
 * ⚠ AND THE GUARD THAT SHOULD HAVE CAUGHT IT READ ZERO. `inspectorNoRawIds
 * .spec.tsx` scans this exact file — recursively, `editors/` included — and
 * passed, because its matcher is anchored on the literal `.data?.label`. This
 * leak reads `c.label`: the label of a WIRE OBJECT, not of a node data bag. A
 * guard written from the one spelling its author had just fixed agrees with
 * every other spelling (trap 12d — derivation proves agreement, never
 * completeness). That matcher is widened in the same commit as this spec, and
 * the widening immediately surfaced a SECOND live site
 * (`OptionAdvancedEditor.tsx:41`), pinned there with a reason rather than
 * silently fixed by this lane.
 *
 * ## What this spec does NOT claim
 *
 * ⚠ NOT VISIBILITY. jsdom performs no layout. And ⚠ NOT THAT EDITING WORKS:
 * the goal panel renders inside `<fieldset disabled>` because `goal` is absent
 * from `AUTHORITY_OWNING_PANELS` (`InspectorRouter.tsx:350`), so this makes a
 * READ-ONLY DISPLAY TRUTHFUL and nothing more. Constraint editing is genuinely
 * missing and the unlock is CEE-side.
 *
 * ## Fixtures are typed to the producer's real domain
 *
 * `constraint()` returns `CEEGoalConstraint`, whose `operator` is the CLOSED
 * union `'>=' | '<='` (schema-authoritative: CEE normalises away '<', '>' and
 * the Unicode forms) and whose `provenance` is
 * `'explicit' | 'inferred' | 'proxy'`. The COMPILER, not a reviewer, refuses a
 * payload the producer cannot emit — a sibling lane has just been burned by
 * fixtures carrying impossible values, whose suite was green against wire
 * shapes that cannot exist, so correcting the reader turned the FIXTURES red
 * and made the fix look like the error.
 *
 * Expected strings are DERIVED from the producers, not guessed:
 * `renderLimitOperator('<=')` → `≤` (`statedLimits.ts:41-45`);
 * `classifyUnit('£')` → `{kind:'symbol',canonical:'£'}` and `classifyUnit('%')`
 * → `{kind:'percent',canonical:'%'}` (`unitClassifier.ts:124,135`), which
 * `goalConstraintText` renders as `£250` and `15%` respectively
 * (`goalConstraintText.ts:21-24`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { CEEGoalConstraint } from '../../../../adapters/cee/types'

/**
 * A string that could only ever be a wire id: hash-shaped, and it appears
 * nowhere else in any fixture. An assertion naming it is bound to THIS
 * constraint's target and cannot be satisfied by another element (trap 19).
 */
const TARGET_NODE_ID = 'fac_9e41b7c2_unit_economics'
/** Resolvable target's human name — the string the row must show instead. */
const TARGET_LABEL = 'Customer acquisition cost'
/** A node_id that resolves to NOTHING, so the row has no name to fall back on. */
const ORPHAN_NODE_ID = 'fac_d3adb33f_orphan_probe'
const GOAL_ID = 'goal_root'

/** The goal node's own label, distinct from every constraint string. */
const GOAL_LABEL = 'Reach break-even'

interface MockState {
  nodes: unknown[]
  goalConstraints: CEEGoalConstraint[] | null
}

const mock: MockState = { nodes: [], goalConstraints: null }

function state() {
  return {
    nodes: mock.nodes,
    goalConstraints: mock.goalConstraints,
    updateNode: vi.fn(),
    edges: [],
  }
}

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(state())),
    { getState: state },
  ),
}))

import { GoalAdvancedEditor } from '../editors/GoalAdvancedEditor'

/**
 * Typed factory. `operator` and `value` are REQUIRED on the producer's
 * interface, so every fixture states them; everything else is optional on the
 * wire and therefore optional here.
 */
function constraint(over: Partial<CEEGoalConstraint> = {}): CEEGoalConstraint {
  return { operator: '<=', value: 250, ...over }
}

function goalNode(extra: Record<string, unknown> = {}) {
  return { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: GOAL_LABEL, ...extra } }
}

function targetNode() {
  return {
    id: TARGET_NODE_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: TARGET_LABEL },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mock.nodes = [goalNode(), targetNode()]
  mock.goalConstraints = null
})

afterEach(() => cleanup())

describe('the goal Advanced editor reads constraints from the store slice', () => {
  it('⭐ THE DEAD READ: a constraint in the STORE renders, and the empty state does NOT', () => {
    // The constraint exists ONLY where the product actually puts it — the
    // camelCase store slice. Node data carries no `goal_constraints`, exactly
    // as in production. Before the fix this renders "No constraints defined".
    mock.goalConstraints = [
      constraint({ node_id: TARGET_NODE_ID, operator: '<=', value: 250, unit: '£', provenance: 'explicit' }),
    ]

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    // Both directions in one test, so neither can pass vacuously: the honest
    // row must be PRESENT and the empty state must be GONE. Asserting only the
    // absence of the empty state would pass on a crashed render; asserting only
    // the presence of the row would pass if the empty state rendered beside it.
    expect(screen.getByText(`${TARGET_LABEL} ≤ £250`)).toBeInTheDocument()
    expect(screen.queryByText('No constraints defined')).toBeNull()
  })

  it('⭐ THE LEAK: an unlabelled constraint shows its TARGET’S NAME, never the wire id', () => {
    // `label` absent — the documented normal case. The old row printed
    // `c.node_id`, i.e. a hash, as the constraint's name.
    mock.goalConstraints = [
      constraint({ node_id: TARGET_NODE_ID, operator: '<=', value: 250, unit: '£' }),
    ]

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    // POSITIVE half first. Without it the negative below passes on an empty
    // section — which is precisely the state this whole spec exists to end, and
    // would make the guard agree with the defect it replaced.
    expect(screen.getByText(`${TARGET_LABEL} ≤ £250`)).toBeInTheDocument()
    expect(screen.queryByText(TARGET_NODE_ID)).toBeNull()
    // Not merely "not as the whole row" — nowhere in the rendered subtree.
    expect(document.body.textContent).not.toContain(TARGET_NODE_ID)
  })

  it('⭐ THE LEAK, UNRESOLVABLE TARGET: states no-name rather than printing the id', () => {
    // The harder half. When the constraint names a node the graph does not
    // hold, there is no label to resolve to — and that is exactly when a
    // `?? node_id` fallback fires. The honest answer is a no-name string.
    //
    // ⚠ THE EXPECTED STRING IS `'Constraint'`, NOT `'Untitled'`, AND GETTING
    // THAT WRONG IS WORTH RECORDING. I first derived `'Untitled'` from
    // `resolveElementLabel`, whose whole purpose is the honest no-name
    // fallback — but `goalConstraintText:12` only REACHES that resolver when a
    // target was found: `(target ? resolveElementLabel(target.data)
    // : 'Constraint')`. An unresolvable `node_id` takes the other arm. So the
    // producer's own semantics, not the resolver's, decide this string
    // (trap 13c — an expectation written from my reading of what a helper
    // "ought" to return is a wrong oracle that a green mutant kit would have
    // certified). Both answers are honest; only one is what the code does.
    mock.goalConstraints = [
      constraint({ node_id: ORPHAN_NODE_ID, operator: '>=', value: 15, unit: '%', provenance: 'inferred' }),
    ]

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    expect(screen.getByText('Constraint ≥ 15% · Inferred limit')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(ORPHAN_NODE_ID)
  })

  it('a stated label wins over the resolved target name', () => {
    // Discriminates the resolution order: the constraint's OWN label is
    // preferred, so this cannot pass because the resolver happened to return
    // the target's name.
    mock.goalConstraints = [
      constraint({ label: 'Marketing budget', node_id: TARGET_NODE_ID, operator: '<=', value: 250, unit: '£' }),
    ]

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    expect(screen.getByText('Marketing budget ≤ £250')).toBeInTheDocument()
    expect(screen.queryByText(`${TARGET_LABEL} ≤ £250`)).toBeNull()
  })

  it('renders the operator as a GLYPH, not the raw ASCII the wire carries', () => {
    // The old row printed `String(c.operator)` — the literal `<=`. A user-facing
    // surface echoing the wire's ASCII is the same class of defect as echoing
    // its ids, one notch less severe.
    mock.goalConstraints = [constraint({ label: 'Churn', operator: '<=', value: 5, unit: '%' })]

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    expect(screen.getByText('Churn ≤ 5%')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('<=')
  })

  it('never FABRICATES a direction for a limit it cannot state', () => {
    // The old row's `c.operator ?? '≥'` asserted "at least" for a constraint
    // whose operator was missing, and `c.value ?? '—'` showed a dash beside it.
    // A fabricated direction is worse than an admitted gap: it is a claim about
    // the user's own boundary. `value: NaN` is the type-legal way to reach the
    // formatter's honest-absence arm (`operator`/`value` are both REQUIRED on
    // `CEEGoalConstraint`, so an absent operator is not expressible — which is
    // itself the point: the fabrication guarded a state the contract forbids).
    mock.goalConstraints = [constraint({ label: 'Runway', value: Number.NaN })]

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    expect(screen.getByText('Runway · limit not captured')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('≥')
  })

  it('surfaces PROVENANCE, which the three-span row dropped entirely', () => {
    // The old layout had three spans — label, operator, value — and no room for
    // the origin. An inferred limit read identically to one the user stated.
    mock.goalConstraints = [
      constraint({ label: 'Headcount', operator: '<=', value: 12, provenance: 'proxy' }),
    ]

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    expect(screen.getByText('Headcount ≤ 12 · Proxy limit')).toBeInTheDocument()
  })

  it('CONTRAST CONTROL: an empty slice still states the absence', () => {
    // The empty state is correct when there genuinely are no constraints, and a
    // fix that simply deleted the group would also satisfy every assertion
    // above. This pins that the group still answers the question when the model
    // has no limits.
    mock.goalConstraints = []

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    expect(screen.getByText('No constraints defined')).toBeInTheDocument()
  })

  it('CONTRAST CONTROL: a null slice states the absence too', () => {
    // `goalConstraints` is `CEEGoalConstraint[] | null` on the store, and null
    // is its INITIAL value — the state a fresh user is in. A fix that handled
    // only the array case would crash here.
    mock.goalConstraints = null

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    expect(screen.getByText('No constraints defined')).toBeInTheDocument()
  })

  it('CONTRAST CONTROL: a stale node-data `goal_constraints` bag is NOT read', () => {
    // The defect's mirror. If a bag ever did carry the key — a replayed old
    // session, a hand-edited import — reading it would resurrect the dead path
    // and disagree with every other constraint surface in the product. The
    // store slice is the single authority, so a node-data bag must contribute
    // nothing, and its contents must not appear.
    mock.nodes = [
      goalNode({ goal_constraints: [{ label: 'Ghost limit from node data', operator: '>=', value: 99 }] }),
      targetNode(),
    ]
    mock.goalConstraints = [constraint({ label: 'Real limit', operator: '<=', value: 7 })]

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    expect(screen.getByText('Real limit ≤ 7')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Ghost limit from node data')
  })

  it('renders every constraint, bound one row per constraint', () => {
    // A `.map` that dropped all but the first would satisfy the single-row
    // tests above. Each expectation names its OWN constraint's text, so no row
    // can stand in for another.
    mock.goalConstraints = [
      constraint({ label: 'First limit', operator: '<=', value: 1 }),
      constraint({ label: 'Second limit', operator: '>=', value: 2 }),
      constraint({ label: 'Third limit', operator: '<=', value: 3 }),
    ]

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    expect(screen.getByText('First limit ≤ 1')).toBeInTheDocument()
    expect(screen.getByText('Second limit ≥ 2')).toBeInTheDocument()
    expect(screen.getByText('Third limit ≤ 3')).toBeInTheDocument()
    expect(screen.queryByText('No constraints defined')).toBeNull()
  })

  it('the sibling Threshold group still renders — this change is scoped', () => {
    // A mutation that broke the threshold rows would otherwise be invisible
    // here, and this is the GREEN half of the discriminating mutant pair: an
    // unrelated sibling change in the same editor must not red the constraint
    // claims, and a constraint change must not red this.
    mock.nodes = [goalNode({ goal_threshold_raw: 40, goal_threshold_unit: 'users', goal_threshold_cap: 100 }), targetNode()]
    mock.goalConstraints = []

    render(<GoalAdvancedEditor nodeId={GOAL_ID} />)

    expect(screen.getByText('Threshold parameters')).toBeInTheDocument()
    expect(screen.getByText('Raw threshold')).toBeInTheDocument()
    expect(screen.getByText('Constraints')).toBeInTheDocument()
  })
})

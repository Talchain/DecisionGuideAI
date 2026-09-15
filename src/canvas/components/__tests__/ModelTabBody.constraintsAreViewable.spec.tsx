/**
 * THE MODEL TAB SHOWS THE MODEL'S CONSTRAINTS — Paul's question, pinned.
 *
 * Paul asked: *"When the AI talks about constraints, what is it actually talking
 * about? Do we have constraints in the model? If so, how do they work, and where
 * can the user view and edit them?"*
 *
 * Constraints DID render before this — on the goal node's transient hover pills,
 * in the Inspector's `GoalPanel`, and on the Analysis tab. But the Inspector is
 * MUTUALLY EXCLUSIVE with the tab dock (opening any tab closes it), so there was
 * no surface a user could keep open beside their work that listed them. This
 * spec pins the surface that closes that gap, and pins the two things about it
 * that are easy to lose:
 *
 *   1. IT IS ON THE MOUNT PATH. The assertion renders `ModelTabBody` — the
 *      container `OutputsDock` actually loads — not the section in isolation.
 *      ⚠ This matters more here than usual: every OTHER section imported from
 *      `model-tab/` sits behind `LEGACY_DETAILED_EDITOR_MOUNTED = false`
 *      (`ModelTabBody.tsx:131`) and is dead code. A section-level spec would
 *      stay green if this one were moved inside that gate and shipped dark —
 *      which is precisely the failure this estate keeps repeating (trap 3b: a
 *      green suite is not evidence about a component the deployment does not
 *      render).
 *   2. IT IS READ-ONLY. Constraint editing is a genuinely missing capability,
 *      and the estate has already shipped the mistake of faking it — the
 *      Inspector renders an add-constraint form and a value input that do not
 *      write (`useInspectorMutations.ts:199` admits it in the product's own
 *      words). A second dead control would be the worst outcome of this work,
 *      so the absence of one is asserted, not assumed.
 *
 * ⚠ WHAT THIS SPEC DOES **NOT** PROVE: VISIBILITY. jsdom performs no layout, so
 * nothing here can show the section is on screen, unoccluded or above the fold.
 * It pins RENDERED TEXT CONTENT and CONTAINMENT IN THE MOUNT PATH. A real-browser
 * witness is the only thing that can settle visibility, and this file does not
 * claim to be one.
 *
 * ⚠ FIXTURES ARE TYPED TO THE PRODUCER'S REAL DOMAIN. `constraintFixture`
 * returns `CEEGoalConstraint`, whose `operator` is the CLOSED union
 * `'>=' | '<='` (`adapters/cee/types.ts:300`, schema-authoritative: CEE
 * normalises away '<', '>' and the Unicode forms) and whose `provenance` is
 * `'explicit' | 'inferred' | 'proxy'`. So the compiler — not a reviewer —
 * refuses a payload the producer cannot emit. A sibling lane has just been
 * burned by fixtures carrying impossible values: its suite was green against
 * wire shapes that cannot exist, and correcting the reader turned the FIXTURES
 * red, which made the fix look like the error.
 *
 * The expected display strings are DERIVED, not guessed: `renderLimitOperator`
 * maps ASCII `<=` → `≤` (`statedLimits.ts:41-46`) and `classifyUnit('%')`
 * returns `{kind:'percent'}` (`unitClassifier.ts:97,135`), which
 * `goalConstraintText` renders as a bare `N%`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

const mockGraph: { nodes: unknown[]; edges: unknown[]; goalConstraints: unknown } = {
  nodes: [],
  edges: [],
  goalConstraints: null,
}

function getMockState() {
  return {
    nodes: mockGraph.nodes,
    edges: mockGraph.edges,
    goalConstraints: mockGraph.goalConstraints,
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    ceePipelineTrace: null,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    currentScenarioId: null,
    currentStage: null,
    graphEditedSinceLastRun: false,
    goalThreshold: null,
    goalThresholdRepresentation: null,
  }
}

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(getMockState())),
    { getState: getMockState },
  ),
}))

vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ModelTabBody } from '../ModelTabBody'
import {
  GOAL_CONSTRAINTS_SECTION_TESTID,
  GOAL_CONSTRAINT_ROW_TESTID,
  GOAL_CONSTRAINT_UNATTACHED_TESTID,
  GOAL_CONSTRAINTS_COPY,
} from '../model-tab/GoalConstraintsSection'
import { GOAL_CONSTRAINT_PROVENANCE_TESTID } from '../../ui/inspector-v2/shared/GoalConstraintProvenance'

const FACTOR_ID = 'fac_churn'
/** Identities are the binding, not labels or values (trap 19). */
const ATTACHED_ID = 'constraint_fac_churn_max'
const UNATTACHED_ID = 'constraint_orphan_max'
const CHURN_QUOTE = 'keep monthly churn under 4%'

function factorNode(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Monthly churn',
      category: 'observable',
      observedState: { value: 0.5, source: 'cee_inference' },
    },
  } as unknown as Node
}

/**
 * Typed to the producer's real shape — see the header. An impossible
 * `operator` or `provenance` is a COMPILE error, not a green test.
 */
function constraintFixture(overrides: Partial<CEEGoalConstraint> = {}): CEEGoalConstraint {
  return {
    constraint_id: ATTACHED_ID,
    node_id: FACTOR_ID,
    label: 'Monthly churn',
    operator: '<=',
    value: 4,
    unit: '%',
    source_quote: CHURN_QUOTE,
    provenance: 'explicit',
    ...overrides,
  }
}

const DEFAULT_PROPS = {
  showDebug: false,
  hasDiagnostics: false,
  diagnostics: null,
  hasTrim: false,
  effectiveCorrelationId: null,
  correlationMismatch: false,
  correlationIdHeader: null,
  robustness: null,
}

function mount() {
  render(<ModelTabBody {...DEFAULT_PROPS} nodes={[factorNode()]} edges={[]} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGraph.nodes = [factorNode()]
  mockGraph.edges = []
  mockGraph.goalConstraints = [constraintFixture()]
})

afterEach(() => cleanup())

describe("the Model tab answers 'what constraints are on this model?'", () => {
  it('renders the constraints section inside the Model tab — the mount path, by containment', () => {
    mount()
    const tab = screen.getByTestId('model-tab')
    const section = screen.getByTestId(GOAL_CONSTRAINTS_SECTION_TESTID)
    expect(tab.contains(section)).toBe(true)
  })

  it('states the constraint in the user’s units, bound to the constraint’s OWN identity', () => {
    mount()
    // Bound by identity — a value predicate ("the row saying 4%") could be
    // satisfied by a different constraint entirely (trap 19).
    const row = screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID(ATTACHED_ID))
    /**
     * ⭐⭐ ON A PERCENT CONSTRAINT THE ROW IS THE READER'S VERBATIM WORDS, NOT
     * A RECONSTRUCTION — changed 15 Sep 2026, and the reason is measured.
     *
     * The producer's `value` on a percent unit may be a RATIO or PERCENTAGE
     * POINTS and nothing on the wire says which. Both conventions are live:
     * this fixture is `value: 4, unit: '%'` meaning four percent, while the
     * shipped `pricing-model` starter sends `value: 1.1, unit: '%'` for a brief
     * that says "net revenue retention above 110%". The old reconstruction
     * rendered that second one as "≥ 1.1%" — a hundred times under — on the
     * canvas, beside a goal card reading "Target: 110%" off the same quantity.
     *
     * The goal path escapes this only because the producer sends it TWICE
     * (`goal_threshold: 1.1` + `goal_threshold_raw: 110`). A constraint has no
     * raw twin, so `${value}%` is a scale the UI is asserting and cannot know.
     *
     * ⛔ THE ASCII→GLYPH CLAIM THIS TEST WAS WRITTEN FOR IS NOT LOST — it moves
     * to the currency case below, where the value is unambiguous and the
     * reconstruction still runs.
     */
    expect(row.textContent).toContain('keep monthly churn under 4%')
    expect(row.textContent).not.toContain('≤ 4%')
  })

  it('CONTRAST: a CURRENCY constraint still reconstructs, ASCII rendered as a glyph', () => {
    // No scale ambiguity on a currency unit — 49 is £49 — so the compact form
    // wins and the quote stays on its own provenance line. This is the half of
    // the original assertion that still holds, kept rather than dropped.
    mockGraph.goalConstraints = [constraintFixture({
      label: 'Monthly price', operator: '<=', value: 49, unit: '£',
      source_quote: 'Keep the monthly price at or below £49',
    })]
    mount()
    const row = screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID(ATTACHED_ID))
    expect(row.textContent).toContain('Monthly price ≤ £49')
    expect(row.textContent).not.toContain('<=')
  })

  it("shows the user's OWN WORDS — on its own line where the limit does not already carry them", () => {
    // ⚠ A CURRENCY constraint, deliberately. On a percent one the limit
    // sentence IS the quote (see above), so repeating it underneath would
    // print one sentence twice — `goalConstraintTextUsesQuote` is shared by the
    // formatter and this line so they cannot disagree about which carries it.
    mockGraph.goalConstraints = [constraintFixture({
      label: 'Monthly price', operator: '<=', value: 49, unit: '£',
    })]
    mount()
    const provenance = screen.getByTestId(GOAL_CONSTRAINT_PROVENANCE_TESTID(ATTACHED_ID))
    expect(provenance.textContent).toContain('You said')
    // Verbatim. A tidied or truncated quote is no longer evidence of anything.
    expect(provenance.textContent).toContain(CHURN_QUOTE)
  })

  it('⛔ and it STANDS DOWN when the limit already is the quote — no sentence twice', () => {
    mount() // the default fixture is the PERCENT one
    expect(
      screen.queryByTestId(GOAL_CONSTRAINT_PROVENANCE_TESTID(ATTACHED_ID)),
    ).toBeNull()
  })

  it('renders NO provenance line for a constraint Olumi inferred — never fabricates "You said"', () => {
    // An inferred constraint carries no source_quote. Asserting "You said" is
    // absent is only meaningful if the ROW is present, so both are asserted.
    mockGraph.goalConstraints = [
      constraintFixture({ source_quote: undefined, provenance: 'inferred' }),
    ]
    mount()
    const row = screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID(ATTACHED_ID))
    expect(row).toBeInTheDocument()
    expect(row.textContent).toContain('Inferred limit')
    expect(
      screen.queryByTestId(GOAL_CONSTRAINT_PROVENANCE_TESTID(ATTACHED_ID)),
    ).toBeNull()
  })

  it('says so when a constraint names no element of this model — and stays silent when it does', () => {
    // ⭐ THE DISCRIMINATION, IN ONE TEST. Two constraints, one attached and one
    // orphaned, in the SAME render: the note must appear on exactly one. A
    // single-constraint absence assertion would pass just as well if the note
    // were never rendered at all, or if the section were missing entirely.
    mockGraph.goalConstraints = [
      constraintFixture(),
      constraintFixture({
        constraint_id: UNATTACHED_ID,
        node_id: 'fac_does_not_exist',
        label: 'Support headcount',
        source_quote: undefined,
      }),
    ]
    mount()

    const orphan = screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID(UNATTACHED_ID))
    expect(orphan.textContent).toContain(GOAL_CONSTRAINTS_COPY.unattached)

    const attached = screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID(ATTACHED_ID))
    expect(attached).toBeInTheDocument()
    expect(
      screen.queryByTestId(GOAL_CONSTRAINT_UNATTACHED_TESTID(ATTACHED_ID)),
    ).toBeNull()
  })

  it('⛔ offers NO edit control — editing is missing, and a dead control would be worse than none', () => {
    mount()
    const section = screen.getByTestId(GOAL_CONSTRAINTS_SECTION_TESTID)
    // Non-vacuous by construction: the section is present and carries the row,
    // so "no inputs" is a statement about a populated section.
    expect(section.contains(screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID(ATTACHED_ID)))).toBe(true)
    expect(section.querySelectorAll('input')).toHaveLength(0)
    expect(section.querySelectorAll('button')).toHaveLength(0)
    expect(section.querySelectorAll('select')).toHaveLength(0)
    expect(section.querySelectorAll('textarea')).toHaveLength(0)
    // And it says which it is, rather than leaving the user to discover it.
    expect(section.textContent).toContain(GOAL_CONSTRAINTS_COPY.readOnly)
  })

  it('renders nothing at all when the model has no constraints — absence is absence', () => {
    mockGraph.goalConstraints = null
    mount()
    // The tab still renders: this asserts the SECTION is absent, not that the
    // render failed (which would make every other assertion here vacuous too).
    expect(screen.getByTestId('model-tab')).toBeInTheDocument()
    expect(screen.queryByTestId(GOAL_CONSTRAINTS_SECTION_TESTID)).toBeNull()
  })

  /*
   * ⚠ NO IN-FILE "COLLECTED COUNT" ASSERTION, DELIBERATELY — the first draft of
   * this spec had one and it was a TAUTOLOGY. A test asserting that it is itself
   * running cannot fail: if this file collected ZERO, that test would not
   * execute either, so it certified nothing while LOOKING like the guard the
   * standing brief asks for. (The brief's real requirement is an assertion about
   * the RUNNER'S REPORT, which no test inside the file can make about itself.)
   *
   * The obligation is discharged where it can actually be discharged — at the
   * run: this file's collected count is asserted BY NAME against vitest's own
   * output, and recorded in the PR body. A spec that collects zero is invisible
   * to the suite total, the exit code and the failure count alike, so the check
   * has to happen outside the file that would be missing.
   */
})

/**
 * GoalConstraintsSection — the constraints on this model, on the Model tab.
 *
 * ## WHY THIS EXISTS
 *
 * Paul's question, verbatim: *"When the AI talks about constraints, what is it
 * actually talking about? Do we have constraints in the model? If so, how do
 * they work, and where can the user view and edit them?"*
 *
 * The answer to the first two was already YES — and the answer to "where can
 * the user view them" was the gap. A bound constraint rendered in exactly three
 * live places before this component, and NONE of them was a standing view the
 * user could keep open beside their work:
 *
 *   · the goal node's HOVER pills (`canvas/nodes/GoalNode.tsx`) — transient;
 *   · the Inspector overlay's `GoalPanel` — and the Inspector is MUTUALLY
 *     EXCLUSIVE with the tab dock, so opening any tab CLOSES it;
 *   · the Analysis tab — ruled out of scope.
 *
 * So a user reading the word "constraint" in chat had nowhere to go and look at
 * the list. This is that list, on a tab that stays open.
 *
 * ## WHAT IT REUSES RATHER THAN REINVENTS
 *
 * Every formatting decision here already existed and is imported, not rewritten
 * — the two surfaces must never be able to disagree about what a constraint
 * SAYS (trap 12: the hand-maintained mirror is this estate's dominant defect):
 *
 *   · `goalConstraintText` — the one formatter, which itself composes
 *     `renderLimitOperator` (ASCII `>=` → `≥`) and `formatStatedLimitValue`
 *     (units, currency symbols), resolves the target's label through
 *     `resolveElementLabel`, and appends `· Inferred limit` / `· Proxy limit`
 *     for a constraint Olumi did not get from the user's own words.
 *   · `GoalConstraintProvenance` — the `You said: "…"` line. This is the part
 *     that actually answers Paul's question: it ties the constraint back to the
 *     user's own sentence. It renders NOTHING when no `source_quote` is stored,
 *     which is deliberate and load-bearing — putting "You said" over an
 *     Olumi-inferred constraint would launder a machine guess as a human
 *     statement.
 *   · `DataBar` and `constraintConfidenceColour` — the existing probability
 *     encodings. `constraintConfidenceColour` is used instead of re-typing
 *     `0.7`/`0.4` so this surface cannot drift from the thresholds
 *     `types/constraints.ts` owns.
 *
 * ## ⛔ READ-ONLY, AND THAT IS NOT A SHORTCUT
 *
 * This component renders NO edit control, and that is the single most important
 * thing about it. Constraint editing is a GENUINELY MISSING capability, and the
 * estate has already shipped the mistake of faking it: the Inspector renders an
 * add-constraint form and a value input that do not write, and the product
 * itself admits as much (`useInspectorMutations.ts:199` — *"The other fields
 * here are read-only for now because those changes can't yet be saved."*). A
 * second dead control would be worse than no control, so there is none.
 *
 * The copy therefore says only what is true OF THIS SURFACE — that limits are
 * shown here and not edited here — and points the user NOWHERE. Pointing at the
 * Inspector would be pointing at inert controls; pointing at chat would be a
 * claim about CEE's `add_constraint` breadth that cannot be derived from this
 * repo. When the only honest signpost is no signpost, say nothing.
 *
 * ## THE ONE HONESTY DISTINCTION THIS LAYER CAN ACTUALLY MAKE
 *
 * A constraint that binds to an element of this model and one that does not are
 * different things, and the user needs to be able to tell them apart. That
 * distinction IS derivable here, and only in a narrow, purely STRUCTURAL sense:
 * does `node_id` name a node that exists in `nodes`? That is exactly the
 * `CONSTRAINT_TARGET_NOT_FOUND` class in `prepareGoalConstraintsForRequest`
 * (`adapters/plot/v2/adapter.ts:1461-1473`).
 *
 * ⚠ AND THE CLAIM IS SCOPED TO THAT, DELIBERATELY. This component does NOT say
 * an unattached constraint "will not be analysed", because that is a TRANSPORT
 * claim this layer cannot support: the analysis path is UI → CEE → PLoT and
 * **CEE reloads its own persisted graph**, so what the UI's own request builder
 * would drop is not evidence about what the engine receives. The narrow
 * structural sentence is true at every deploy state; the transport sentence
 * would be a guess. Stating the smaller true thing is the whole discipline.
 *
 * ## ⛔ WHAT THIS SECTION DELIBERATELY DOES NOT RENDER
 *
 * **The joint "chance of hitting every target" figure.** `GoalPanel` shows it,
 * and it was left out here on purpose. That number's canonical owner is
 * `useNodeDisplayMetadata` (`jointGoalProbability`), which carries the
 * withholding and possessive gating that exists precisely so a second surface
 * cannot narrate the owner's number without entitlement — and `GoalPanel`
 * additionally suppresses its own copy of the line under `goalFitSubstituted`
 * (ROADMAP 2.283: under substitution the joint figure IS the goal figure, so
 * printing both is one measurement reported as two findings). Reading
 * `probability_of_joint_goal` straight off the report here would bypass both
 * guards to add a number Paul's question never asked for. A PER-CONSTRAINT
 * probability carries no such entitlement — it is a satisfaction rate for one
 * stated limit — so that one is rendered, through the existing encodings.
 */

import { goalConstraintText } from '../../utils/goalConstraintText'
import { GoalConstraintProvenance } from '../../ui/inspector-v2/shared/GoalConstraintProvenance'
import { DataBar } from '../../ui/shared/DataBar'
import { constraintConfidenceColour } from '../../../types/constraints'
import { typography } from '../../../styles/typography'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

/**
 * A constraint as this surface receives it.
 *
 * This is the store slice's OWN element type, unwidened: `CEEGoalConstraint`
 * already declares `probability?: number | null`, so the
 * `& { probability?: number }` intersection `GoalPanel` carries buys nothing
 * here and would only invite a reader to think a second shape is in play. The
 * alias exists to NAME the role, not to change the type.
 */
export type DisplayGoalConstraint = CEEGoalConstraint

export interface GoalConstraintsSectionProps {
  /**
   * The model's constraints. `null`/`undefined`/empty all render NOTHING —
   * absence is rendered as absence, never as an empty frame asserting that a
   * list was consulted.
   */
  constraints: readonly DisplayGoalConstraint[] | null | undefined
  /**
   * The model's nodes. Used for two things and nothing else: resolving a
   * constraint's target LABEL (via `goalConstraintText`) and deciding whether
   * its `node_id` names an element of this model at all.
   */
  nodes: readonly { id: string; data?: unknown }[]
}

/** The section's root testid, exported so a spec cannot drift from it (trap 12). */
export const GOAL_CONSTRAINTS_SECTION_TESTID = 'model-goal-constraints-section'

/** Per-row testid, DERIVED from the row's identity at both ends. */
export const GOAL_CONSTRAINT_ROW_TESTID = (constraintId: string): string =>
  `model-goal-constraint-${constraintId}`

/** The "names nothing in this model" note, per row. */
export const GOAL_CONSTRAINT_UNATTACHED_TESTID = (constraintId: string): string =>
  `model-goal-constraint-${constraintId}-unattached`

export const GOAL_CONSTRAINTS_COPY = {
  heading: 'Constraints',
  /**
   * Answers Paul's question in the product rather than in a document: this list
   * IS what the word means when Olumi uses it.
   */
  intro: 'The limits recorded on this model — what Olumi means when it refers to your constraints.',
  /**
   * ⚠ Scoped to THIS surface on purpose. Not "constraints cannot be edited"
   * (a claim about other surfaces) and not a signpost to a control that does
   * not work.
   */
  readOnly: 'Read-only — limits are shown here, not edited here.',
  /** The narrow structural fact. No transport claim. See the header. */
  unattached: "Doesn't match an element in this model.",
} as const

/**
 * Stable identity for a row: `constraint_id`, else the legacy `id`, else the
 * position.
 *
 * ⚠ WRITTEN AS STATEMENTS RATHER THAN `constraint_id ?? id ?? i` ON PURPOSE.
 * `modelTabNoRawIdFallback.sourceScan.spec.ts` bans the shape
 * `?? <expr>.(id|source|target)` in this directory — its `RAW_ID_FALLBACK` is
 * NOT anchored on a nearby `label`, so the terse spelling would have turned a
 * green gate red for a React key that never reaches the screen. The guard is
 * right to be blunt; this is the honest way to satisfy it rather than widen it.
 */
function constraintIdentity(constraint: DisplayGoalConstraint, index: number): string {
  const explicit = constraint.constraint_id
  if (typeof explicit === 'string' && explicit.length > 0) return explicit
  const legacy = constraint.id
  if (typeof legacy === 'string' && legacy.length > 0) return legacy
  return `index-${index}`
}

/**
 * Does this constraint name an element of THIS model?
 *
 * A missing `node_id`, or one that resolves against no node, both mean no. This
 * is a structural question about the graph in hand — see the header for why it
 * is deliberately not dressed up as a statement about the engine.
 */
function namesAnElementInThisModel(
  constraint: DisplayGoalConstraint,
  nodes: readonly { id: string }[],
): boolean {
  const target = constraint.node_id
  if (typeof target !== 'string' || target.length === 0) return false
  return nodes.some(node => node.id === target)
}

/** A probability is only a probability when it is a finite number. */
function finiteProbability(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

export function GoalConstraintsSection({
  constraints,
  nodes,
}: GoalConstraintsSectionProps) {
  // Absence is absence. A model with no recorded limit renders exactly as it
  // did before this component existed.
  if (!Array.isArray(constraints) || constraints.length === 0) return null

  return (
    <section
      data-testid={GOAL_CONSTRAINTS_SECTION_TESTID}
      aria-label={GOAL_CONSTRAINTS_COPY.heading}
      className="border border-panel-border rounded-lg p-2 space-y-1.5"
    >
      <header className="space-y-0.5">
        <h3 className={`${typography.panelHeader} text-text-header`}>
          {GOAL_CONSTRAINTS_COPY.heading}
        </h3>
        <p className={`${typography.panelBody} text-text-light`}>
          {GOAL_CONSTRAINTS_COPY.intro}
        </p>
      </header>

      <div className="space-y-1.5">
        {constraints.map((constraint, index) => {
          const identity = constraintIdentity(constraint, index)
          const constraintText = goalConstraintText(constraint, nodes)
          const probability = finiteProbability(constraint.probability)
          const attached = namesAnElementInThisModel(constraint, nodes)

          return (
            <div
              key={identity}
              data-testid={GOAL_CONSTRAINT_ROW_TESTID(identity)}
              className="px-2.5 py-1.5 bg-panel border border-panel-border rounded-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`${typography.panelBody} text-text-body break-words`}>
                  {constraintText}
                </span>
                {probability !== null && (
                  <span
                    className={`${typography.panelMeta} shrink-0 ${constraintConfidenceColour(probability)}`}
                  >
                    {Math.round(probability * 100)}%
                  </span>
                )}
              </div>

              {/* The user's own words, verbatim, under the constraint they
                  produced. Renders nothing for an Olumi-inferred constraint. */}
              <GoalConstraintProvenance
                constraintId={identity}
                sourceQuote={constraint.source_quote}
              />

              {probability !== null && (
                <div className="mt-1">
                  <DataBar value={probability} label={constraintText} size="standard" />
                </div>
              )}

              {!attached && (
                <p
                  data-testid={GOAL_CONSTRAINT_UNATTACHED_TESTID(identity)}
                  className={`${typography.panelMeta} text-text-light mt-1`}
                >
                  {GOAL_CONSTRAINTS_COPY.unattached}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className={`${typography.panelMeta} text-text-light`}>
        {GOAL_CONSTRAINTS_COPY.readOnly}
      </p>
    </section>
  )
}

export default GoalConstraintsSection

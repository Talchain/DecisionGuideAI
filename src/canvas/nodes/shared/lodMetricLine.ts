/**
 * `resolveLodMetricLine` — the ONE line a node still says when it is too small
 * to say anything else.
 *
 * ⭐ THE DEFECT THIS EXISTS TO CLOSE, MEASURED ON DEPLOYED `ec4cba73`.
 * Driven as a guest below the legibility floor: **15 of 15 factor bodies
 * hidden, and ZERO reduced lines rendered.** The reduced line had shipped, was
 * correct, and was invisible — because it asked every factor for its STATED
 * VALUE, and on a real model most factors have not been given one.
 *
 * Stated as the rule, because it generalises to the whole zoom ladder:
 *
 *   ⛔ THE REDUCED LINE MUST ASK FOR THE DATUM THE NODE RELIABLY **HAS**,
 *      NEVER THE ONE IT MOST OFTEN **LACKS**.
 *
 * A factor that has no stated value still has an influence score, and that
 * score is already on its card at full zoom. The card was holding a perfectly
 * good number and the reduced line was not reading it.
 *
 * ⚠ WHY THIS IS A MODULE AND NOT FOUR BRANCHES IN `BaseNode`. Every value here
 * is READ FROM ITS OWNER and never composed: `factorDisplayText` for a factor's
 * value, `displayMetadata` for every figure, `formatWinProbability` for a win
 * share, `calculateRiskSeverity` for a severity band. This decides WHEN a node
 * may say something at low zoom; it never decides WHAT the number is. A second
 * formatter living here is how one datum comes to have two answers two pixels
 * apart (CLAUDE.md trap 12), and the low-zoom line is the worst place for that,
 * because the body it would disagree with is hidden.
 *
 * ⛔⛔ AND THE RULE THAT BOUNDS THE WHOLE FILE — A FIGURE WHOSE HONESTY DEPENDS
 * ON AN ADJACENT DISCLOSURE MAY NOT APPEAR HERE.
 *
 * There is room for one line. There is no room for a caveat beside it, and a
 * number that needs a caveat is not made safe by shrinking the type. So an
 * outcome's achievement probability is shown only on the basis that carries no
 * mandatory caveat, and withheld on the basis that does — derived from the same
 * `achievementProbabilityIsModelledBasis` gate `OutcomeNode` itself renders
 * `GOAL_FIT_BASIS_CAVEAT_COPY` from, not from a second reading of the rule.
 * Fail-closed everywhere: an absent gate value withholds.
 *
 * ⚠ SCOPE, STATED RATHER THAN IMPLIED (trap 20). This resolves the reduced line
 * for FACTOR, OPTION, RISK and OUTCOME — the four types whose figure is
 * reachable from `data` + `displayMetadata`.
 *
 * ⚠⚠ AND THE SCOPE DECISION WRITTEN HERE FIRST WAS WRONG, IN THE MOST VISIBLE
 * PLACE AVAILABLE. It read: *"`decision`, `goal` and `action` are untouched and
 * still render nothing: a decision card has no single headline quantity."* The
 * premise was true and the conclusion was not — it left THE ANCHOR OF THE MODEL
 * as an empty box below the floor, which Paul then reported for a third time.
 * Measured on deployed `7d717c13`: that card's body holds "Segment leads in 48%
 * of scenarios…" rendered `visibility: hidden`, with nothing put in its place.
 * Every other type got a line and the one a reader looks at first got none.
 *
 * `decision` and `goal` now declare their own line through `BaseNode`'s
 * `lodMetric` prop, because both read a datum this module cannot see — a
 * leader-claim PERMISSION and a user-stated threshold respectively. `action`
 * remains unattempted.
 *
 * ⭐ THE LESSON, because it is the second time in one night: a scope note that
 * says "not attempted" reads as a decision and gets inherited as one. Write
 * down what the EXCLUDED case will look like on screen, not just why it is
 * excluded — "renders nothing" and "is an empty box" are the same fact, and
 * only one of them makes the cost obvious.
 *
 * ⭐⭐ THE DEFECT THAT REOPENED, AND WHY (measured in a real browser on deployed
 * `f3b1ca87`, 1 Sep 2026). Two fixes had already shipped for "the cards go
 * blank when I zoom out". On the pre-analysis Headcount starter, **14 of 16
 * cards still rendered an empty box** at 0.49 zoom — and 0.49 is not an exotic
 * place to be: "Show whole model" lands a real model at **0.488**, so the
 * ordinary gesture for *"let me see the whole thing"* put the user straight
 * into it.
 *
 * The cause was one shape, repeated in every branch: **every rule here except a
 * factor's stated value asked for an ANALYSIS-DERIVED metric** — an influence
 * score, a win share, an achievement probability, a risk severity computed from
 * probability × impact — and `goal` and `decision` fell to `default: null`
 * unconditionally. So the feature was weakest exactly where the gesture is most
 * used, because **zooming out to grasp the whole model is something people do
 * BEFORE they analyse.** The product assumed analysis had run.
 *
 * ⛔ THE RULE, RESTATED AT ITS FULL STRENGTH: ASK FOR THE DATUM THE CARD IS
 * ALREADY DISPLAYING AT FULL ZOOM. Not the one an analysis would produce. Every
 * branch below now has a pre-analysis answer, and each one reads the very
 * string or number the card shows one zoom step up:
 *
 *   factor   stated value → influence → **its prior range** ("Range: 0.3 to 0.9")
 *   option   win share    → **how many factors it changes**
 *   risk     severity     → **its strength to the goal** ("Strength 45% · est.")
 *   outcome  achievement  → **its strength to the goal**
 *   goal     **its target, or "No target set"**
 *   decision **how many options it compares**
 *
 * ⚠ THE ORDER IS PURELY ADDITIVE AND THAT IS DELIBERATE. Every rule that
 * resolved to a line before this change resolves to the SAME line now; the new
 * arms are reached only where the old ones returned `null`, i.e. only where the
 * user was being shown an empty box. A fix for a blank card must not be able to
 * change a card that was already speaking (the opposite-direction twin,
 * CLAUDE.md trap 22b).
 *
 * ⚠ TWO OF THESE FIGURES LIVE OUTSIDE `data` AND `displayMetadata`, WHICH IS THE
 * WHOLE REASON THEY WERE UNREACHABLE. A risk's strength lives on its EDGE to
 * the goal and an option's change count lives in `ceeAnalysisReady`. They
 * arrive as the `facts` input below, resolved by their own owners
 * (`bridgeStrengthToGoal.ts`) and passed in — never re-derived here.
 *
 * ⚠ `action` remains DELIBERATELY NOT ATTEMPTED (trap 20: the scope of this
 * change is what it says, not what it suggests).
 */
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'
import { collapseEstimateDisplay } from './collapseEstimateDisplay'
import { isSuppressedUnit, formatWinProbability } from '../../utils/labelUtils'
import { calculateRiskSeverity } from '../../utils/graphDisplayCalculations'
import type { RiskImpact } from '../../domain/nodes'
import type { NodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { resolveFactorPriorRange } from './factorPriorRange'
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'
import type { BridgeStrengthToGoal } from './bridgeStrengthToGoal'

/**
 * The facts a reduced line needs that DO NOT live on the node.
 *
 * ⚠ THIS INPUT EXISTS BECAUSE THE ABSENCE OF IT WAS THE DEFECT. A risk's
 * strength is a property of its EDGE to the goal; an option's change count
 * lives in `ceeAnalysisReady`; a decision's option count is a graph traversal.
 * A resolver handed only `data` and `displayMetadata` cannot see any of them,
 * so those three card types could only ever speak once an ANALYSIS had run —
 * and the whole-model gesture happens before that.
 *
 * Every field is RESOLVED BY ITS OWNER and passed in already computed. Nothing
 * here is derived in this file.
 */
export interface LodMetricFacts {
  /** `resolveBridgeStrengthToGoal` — risk and outcome. */
  bridgeStrength?: BridgeStrengthToGoal | null
  /**
   * How many factors this option changes (`OptionNode.totalInterventionCount`).
   * `null` when unknown, which is not the same as zero and withholds.
   */
  optionInterventionCount?: number | null
  /** How many options this decision compares (`DecisionNode.optionCount`). */
  decisionOptionCount?: number | null
  /** `OptionNode.isBaselineOption` — checked BEFORE any count, as it is there. */
  optionIsBaseline?: boolean | null
}

export interface LodMetricLineInputs {
  nodeType: string
  /** The React Flow node's `data`, untouched — read, never rewritten. */
  data: Record<string, unknown> | undefined
  label: string
  displayMetadata: NodeDisplayMetadata
  /** Off-node facts, resolved by their owners. Absent ⇒ those arms withhold. */
  facts?: LodMetricFacts
}

/** A factor's stated value, via the shared entry point every factor surface uses. */
function factorStatedValue(data: Record<string, unknown>, label: string): string | null {
  const observed = data.observedState as Record<string, unknown> | undefined
  // CEE sometimes leaks an internal factor_type descriptor ("binary", "cost",
  // "other") into `unit`. Every other caller passes it through this guard first
  // and `factorDisplayText` does not, so without this the reduced line could
  // read "0.5 other" while the body beneath it reads something else.
  const normalised = isSuppressedUnit(observed?.unit as string | undefined)
    ? { ...data, observedState: { ...observed, unit: null } }
    : data
  // The same rest-state shortening the body applies (R6): a trailing
  // all-numeric parenthetical is the raw default showing through. Display only —
  // it can shorten the string and can never change the value it states.
  const text = collapseEstimateDisplay(factorDisplayText(normalised, label))
  return text && text.trim().length > 0 ? text : null
}

/**
 * A risk's / an outcome's strength to the goal, worded as the card words it.
 *
 * The NOUN is mandatory and is not decoration: UI-SEM-089 — an unlabelled
 * percentage beside a goal reads as a COMPUTED CONTRIBUTION, and this figure is
 * an assumed edge weight. `RiskNode` keeps the noun on both of its branches for
 * exactly this reason, so a reduced line that dropped it would re-open the
 * defect that rule exists to close, at the zoom where the user can check it
 * least.
 *
 * The estimate marker rides along for the same reason it does on the card: "45%
 * strength" and "45% strength · est." are different claims about who put the
 * number there. Nothing is re-rounded — the percentage is the owner's.
 */
function bridgeStrengthLine(bridge: BridgeStrengthToGoal | null | undefined): string | null {
  const pct = bridge?.bridgeStrengthPct
  if (pct == null) return null
  return `Strength ${pct}%${bridge?.bridgeIsEstimated ? ' \u00b7 est.' : ''}`
}

export function resolveLodMetricLine({
  nodeType,
  data,
  label,
  displayMetadata,
  facts,
}: LodMetricLineInputs): string | null {
  if (!data) return null

  switch (nodeType) {
    case 'factor': {
      // Value first — it is the more specific thing to know about a factor, and
      // it is what this line said before. Influence is the FALLBACK, not the
      // replacement, so no card loses information it had.
      const stated = factorStatedValue(data, label)
      if (stated !== null) return stated

      // Fail-closed on provenance, exactly as `FactorNode`'s own influence row
      // does: no provenance means no influence number is rendered. The label is
      // carried because a bare percentage on a factor names no quantity — the
      // card's full-zoom row says "Influence" beside its bar for the same
      // reason.
      const { influence, influenceProvenance } = displayMetadata
      if (influence != null && influenceProvenance != null) {
        return `Influence ${Math.round(influence * 100)}%`
      }

      // ⭐ THE PRE-ANALYSIS ARM, AND THE ONE THAT CLOSES THE DEFECT. Both rules
      // above are ANALYSIS-DERIVED or user-supplied, and on a freshly drafted
      // model an external factor usually has neither — its only figure is the
      // prior range CEE gave it, which its card is already showing as
      // "Range: 0.3 to 0.9". Read from the same owner the card reads, so the
      // two cannot state different ranges for one factor.
      //
      // `valueDisplay: null` is correct and not a shortcut: this arm is only
      // reached when `factorStatedValue` returned null, so there is no value
      // line for the range to duplicate, and the owner's dedupe is a no-op.
      return resolveFactorPriorRange({
        data,
        nodeCategory: data.category as string | undefined,
        observedState: data.observedState as { unit?: string | null; cap?: number | null } | undefined,
        valueDisplay: null,
      })
    }

    case 'option': {
      // The win share, through the shared formatter that owns the sub-1% floor.
      // ⚠ The FIGURE, not the sentence: the option card's full-zoom readout is a
      // comparative phrase that truncates to nothing at this size. Paul's
      // ruling on card density (31 Aug) is the same shape one zoom level up —
      // "show the bar with the percentage next to it", the sentence on hover.
      if (displayMetadata.isResultsMode && displayMetadata.winRate != null) {
        return `Ahead ${formatWinProbability(displayMetadata.winRate)}`
      }

      // ⭐ THE PRE-ANALYSIS ARM. Before a run an option has no win share, and
      // what its card shows instead is the set of factor changes it makes
      // ("Account executive… Very low → High (0.75)"). That list is far too
      // long for one line at this size, so the reduced line states its SIZE —
      // the shortest true thing the card is already saying.
      //
      // ⛔ IT COUNTS, IT NEVER CHARACTERISES. "2 factor changes" is a fact about
      // the option's own definition and needs no analysis, no caveat and no
      // adjacent disclosure. Zero is a real and useful answer here (a
      // status-quo option genuinely changes nothing, and its card says so),
      // which is exactly why the withholding case has to be `null` — UNKNOWN —
      // and not 0. Absence of the fact is not absence of changes.
      // ⚠ THE PRECEDENCE IS `OptionNode`'S OWN, IN ITS ORDER, AND THE ORDER IS
      // THE CORRECTNESS. Baseline first, then "none specified", then the
      // count. A first cut read the count alone and said "Changes 2 factors"
      // about the status-quo card whose body reads "No changes to factors" —
      // the interventions are BACKFILLED onto a baseline, so the raw count is
      // real and describes something the card deliberately does not claim.
      // The corpus caught it; a self-authored fixture would not have.
      if (facts?.optionIsBaseline === true) return 'No changes to factors'
      const changes = facts?.optionInterventionCount
      if (changes == null) return null
      if (changes === 0) return 'No changes specified'
      return `Changes ${changes} factor${changes === 1 ? '' : 's'}`
    }

    case 'risk': {
      // Qualitative by construction, so it needs no caveat and no unit, and it
      // is the same band the card's own severity pill shows.
      const severity = calculateRiskSeverity(
        data.probability as number | undefined,
        data.impact as RiskImpact | undefined,
      )
      if (severity !== null) {
        return `${severity.charAt(0).toUpperCase()}${severity.slice(1)} risk`
      }

      // ⭐ THE PRE-ANALYSIS ARM. `calculateRiskSeverity` needs BOTH probability
      // and impact, and a drafted risk node routinely carries neither — its
      // `data` is a label and a provenance stamp and nothing else (measured on
      // deployed `f3b1ca87`). What its card actually shows is the strength of
      // its edge to the goal, and that is available the moment the graph exists.
      return bridgeStrengthLine(facts?.bridgeStrength)
    }

    case 'outcome': {
      const { achievementProbability, achievementProbabilityIsModelledBasis } = displayMetadata
      // ⭐ THE PRE-ANALYSIS ARM, reached whenever the achievement figure is
      // absent OR withheld by the caveat gate below. Either way the card is not
      // silent at full zoom: it shows its strength to the goal ("65% strength ·
      // est."), which needs no analysis and carries no mandatory caveat.
      if (achievementProbability == null) return bridgeStrengthLine(facts?.bridgeStrength)
      // ⛔ THE CAVEAT GATE. On the modelled basis `OutcomeNode` is REQUIRED to
      // render `GOAL_FIT_BASIS_CAVEAT_COPY` adjacent to this figure. One line
      // cannot carry both, so the figure is withheld rather than shown stripped
      // of the disclosure that makes it honest.
      if (achievementProbabilityIsModelledBasis === true) {
        return bridgeStrengthLine(facts?.bridgeStrength)
      }
      return `Achievement ${Math.round(achievementProbability * 100)}%`
    }

    case 'goal': {
      // ⭐ PREVIOUSLY UNREACHABLE BY DESIGN — "a goal's figure is the one most
      // entangled with withholding rules", which was true of its ACHIEVEMENT
      // PROBABILITY and was then applied to the whole card. The goal's target is
      // a different quantity with none of that entanglement: it is the number
      // the USER set, it needs no run, and `GoalNode` renders it as
      // "Target: 15%" with no caveat anywhere near it.
      //
      // The priority is `GoalNode`'s own, not a second reading of it: a
      // user-set `success_threshold` counts first, then the CEE-backfilled
      // `goal_threshold_raw`. Rendering goes through `formatGoalTarget`, the
      // single unit-string authority, so the canvas card and this line cannot
      // print one target two ways.
      const userThreshold = data.threshold_source === 'user'
        ? (data.success_threshold as number | null | undefined)
        : undefined
      const raw = userThreshold != null ? userThreshold : (data.goal_threshold_raw as string | number | null | undefined)
      const hasThreshold = raw != null && String(raw).trim() !== ''
      if (hasThreshold) {
        const numeric = typeof raw === 'number' ? raw : Number(raw)
        const formatted = Number.isFinite(numeric)
          ? formatGoalTarget(numeric, data.goal_threshold_unit as string | undefined)
          : null
        return `Target: ${formatted ?? String(raw)}`
      }
      // ⛔ AND THE NO-TARGET CASE IS THE POINT, NOT AN AFTERTHOUGHT. A goal
      // with no target is the state EVERY model is in before somebody sets one
      // — the single most common goal card there is. Saying "No target set" is
      // honest, is the card's OWN words, and is strictly more useful than an
      // empty box, which is indistinguishable from a broken render. It states
      // an ABSENCE and can never be mistaken for a value.
      return 'No target set'
    }

    case 'decision': {
      // ⭐ PREVIOUSLY UNREACHABLE BY DESIGN — "a decision card has no single
      // headline quantity". That is still true of its VERDICT, and this is not
      // its verdict.
      //
      // ⛔ WHAT THIS DELIBERATELY DOES NOT SAY. The decision card's full-zoom
      // body is a triage line ("Top gap: validate Platform Engineer Headcount
      // Added") or, after a run, a leader claim ("Freeze Hiring leads it"). The
      // first does not survive truncation to one short line with its meaning
      // intact — it names the factor, and the name IS the content. The second
      // is a LEADER CLAIM, governed by permission rules this file has no
      // business re-deriving; naming a leader here that the confirmation
      // withholds is precisely the harm CLAUDE.md trap 21 records.
      //
      // So the line states the one fact about a decision that is always true,
      // always available, never needs a run and never needs a caveat: how many
      // alternatives are in play. On a whole-model view that is also the thing
      // a reader most wants from the anchor node.
      const count = facts?.decisionOptionCount
      if (count == null) return null
      if (count === 0) return 'No options linked yet'
      return `${count} option${count === 1 ? '' : 's'}`
    }

    default:
      return null
  }
}

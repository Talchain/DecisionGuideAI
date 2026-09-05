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
 * ⭐⭐ AND THE DEFECT REOPENED ANYWAY, FOR FACTORS AND OPTIONS (measured in a
 * real browser on deployed `f3b1ca87`, 1 Sep 2026). On the pre-analysis
 * Headcount starter, **14 of 16 cards still rendered an empty box** at 0.49
 * zoom — and 0.49 is not an exotic place to be: "Show whole model" lands a real
 * model at **0.488**, so the ordinary gesture for *"let me see the whole
 * thing"* put the user straight into it.
 *
 * The cause was one shape, repeated: **every rule here except a factor's stated
 * value asked for an ANALYSIS-DERIVED metric** — an influence score, a win
 * share, an achievement probability, a severity computed from probability ×
 * impact. So the feature was weakest exactly where the gesture is most used,
 * because **zooming out to grasp the whole model is something people do BEFORE
 * they analyse.** The product assumed analysis had run.
 *
 * ⛔ THE RULE, RESTATED AT ITS FULL STRENGTH: ASK FOR THE DATUM THE CARD IS
 * ALREADY DISPLAYING AT FULL ZOOM. Not the one an analysis would produce. The
 * two types this module still owns end-to-end now each have a pre-analysis
 * answer, and each reads the very string or number the card shows one zoom step
 * up:
 *
 *   factor   stated value → influence → **its prior range** ("Range: 0.3 to 0.9")
 *   option   win share    → **how many factors it changes**
 *
 * ⚠ THE ORDER IS PURELY ADDITIVE AND THAT IS DELIBERATE. Every rule that
 * resolved to a line before this change resolves to the SAME line now; the new
 * arms are reached only where the old ones returned `null`, i.e. only where the
 * user was being shown an empty box. A fix for a blank card must not be able to
 * change a card that was already speaking (the opposite-direction twin,
 * CLAUDE.md trap 22b).
 *
 * ⚠⚠ SCOPE, AND WHY IT SHRANK — THE HALF OF THIS CHANGE THAT WAS DELETED RATHER
 * THAN SHIPPED (1 Sep 2026). This started out ALSO giving `risk`, `outcome`,
 * `goal` and `decision` pre-analysis arms here. While it sat open, #1074
 * (risk/outcome) and #1085 (goal/decision) shipped the same capability through
 * the OTHER mechanism — the owner formats its own line and passes it as
 * `BaseNode`'s `lodMetric` prop, where it WINS over this resolver. Both
 * mechanisms were correct; keeping both would have left four arms here that the
 * mount can never reach, with unit specs certifying their precedence in detail.
 *
 * ⛔ THAT IS THE DANGEROUS SHAPE, NOT MERELY THE REDUNDANT ONE. A green spec
 * about code no mount reaches is a guard agreeing with itself (CLAUDE.md trap
 * 13b), and it was PROVEN dark by a mutant pair: neutering the resolver's risk
 * arm left the component spec GREEN, while neutering `RiskNode`'s own
 * `lodMetric` REDs it. The deployed mechanism wins; the unreachable arms and
 * the specs that certified them are gone.
 *
 * ⚠ SO THE LIVE OWNERSHIP MAP IS NOW SPLIT, AND IT IS SPLIT ON PURPOSE (trap
 * 21 — two authorities answering different questions look like an
 * inconsistency to reconcile, and aligning them is the wrong fix):
 *
 *   factor · option · action     → THIS MODULE (no `lodMetric` prop is passed)
 *   risk · outcome               → `RiskNode` / `OutcomeNode` (#1074)
 *   goal · decision              → `GoalNode` / `DecisionNode` (#1085)
 *
 * ⭐ `action` MOVED INTO THIS MODULE ON 2 SEP 2026 (Z2), and the honest reading
 * of the line it replaced — "DELIBERATELY NOT ATTEMPTED (trap 20)" — is that it
 * recorded an UNKNOWN rather than a finding that action had nothing to say. It
 * had something to say: `ActionNode` renders `data.description` as its whole
 * body and passes no `lodMetric`, so this resolver was already its live path and
 * was returning `null` down it.
 *
 * The test that keeps this map honest is still the contrast control in
 * `BaseNode.lodBodyLine.spec.tsx`, RE-POINTED from a cross-type absence into a
 * WITHIN-TYPE pair: an action WITH a description gets a line, one WITHOUT gets
 * none. That is a strictly stronger guard — the old form would have gone green
 * on any widening whatever, including one that printed an empty line, while the
 * pair discriminates on the datum itself.
 */
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'
import { collapseEstimateDisplay } from './collapseEstimateDisplay'
import { isSuppressedUnit, formatWinProbability } from '../../utils/labelUtils'
import { calculateRiskSeverity } from '../../utils/graphDisplayCalculations'
import type { RiskImpact } from '../../domain/nodes'
import type { NodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { resolveFactorPriorRange } from './factorPriorRange'
import { METRIC_NOUN } from './metricVocabulary'

/**
 * The facts a reduced line needs that DO NOT live on the node.
 *
 * ⚠ THIS INPUT EXISTS BECAUSE THE ABSENCE OF IT WAS THE DEFECT. An option's
 * change count lives in `ceeAnalysisReady`, not on the node, so a resolver
 * handed only `data` and `displayMetadata` could not see it — which is why an
 * option card could only ever speak once an ANALYSIS had run, and the
 * whole-model gesture happens before that.
 *
 * ⚠ IT CARRIES OPTION FACTS ONLY, AND THE ABSENCES ARE THE SCOPE. Risk and
 * outcome read their bridge strength, and decision its option count, from their
 * OWN components, which format the line themselves and pass it as `lodMetric`
 * (see the ownership map above). Adding a field here for a type whose line is
 * declared by its owner would build a second answer to a settled question.
 *
 * Every field is RESOLVED BY ITS OWNER and passed in already computed. Nothing
 * here is derived in this file.
 */
export interface LodMetricFacts {
  /**
   * How many factors this option changes (`OptionNode.totalInterventionCount`),
   * via the shared owner `optionInterventionCount.ts` — never recounted here.
   * `null` when unknown, which is not the same as zero and withholds.
   */
  optionInterventionCount?: number | null
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
        // ⚠ THE REGISTER, NOT A LITERAL — and this line is why. It read
        // `Ahead ${…}` while `:305` two hundred lines below already read
        // `${METRIC_NOUN.chance}`, so a rename in the register changed the
        // zoomed-IN card and left this zoomed-OUT one saying the old word.
        // The estate adjudicated this exact case in this exact file for the
        // sibling noun (`Achievement` -> `Chance`) and took it here rather
        // than deferring, precisely so the board could not say two words for
        // one number at two zoom levels. Nothing REDded because the canvas
        // noun guard filters sources to `*Node.tsx` and this file is not one.
        return `${METRIC_NOUN.ahead} ${formatWinProbability(displayMetadata.winRate)}`
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
      // ⚠ NO PRE-ANALYSIS FALLBACK HERE, AND ITS ABSENCE IS THE DECISION. A
      // drafted risk routinely carries neither probability nor impact, so this
      // returns `null` — but the card is NOT blank, because `RiskNode` declares
      // its own `Strength N% est.` line through `lodMetric`, which wins before
      // this function is ever called (#1074, merged and deployed). An arm here
      // would be unreachable code with a spec certifying its precedence.
      if (severity === null) return null
      return `${severity.charAt(0).toUpperCase()}${severity.slice(1)} risk`
    }

    case 'outcome': {
      const { achievementProbability, achievementProbabilityIsModelledBasis } = displayMetadata
      // ⚠ AS FOR RISK ABOVE: no pre-analysis fallback, because `OutcomeNode`
      // declares its own strength line through `lodMetric` and it wins here.
      if (achievementProbability == null) return null
      // ⛔ THE CAVEAT GATE. On the modelled basis `OutcomeNode` is REQUIRED to
      // render `GOAL_FIT_BASIS_CAVEAT_COPY` adjacent to this figure. One line
      // cannot carry both, so the figure is withheld rather than shown stripped
      // of the disclosure that makes it honest.
      if (achievementProbabilityIsModelledBasis === true) return null
      return `${METRIC_NOUN.chance} ${Math.round(achievementProbability * 100)}%`
    }

    case 'action': {
      /**
       * ⭐ Z2 — THE BLANK ACTION CARD. `action` was the one type with no reduced
       * line at all, so below the legibility floor it rendered its coloured
       * shape, its title, and nothing else. On the whole-model view — where
       * every shipped starter parks, between zoom 0.26 and 0.38 — that is a box.
       *
       * ⚠ WHY THIS ARM IS REACHED WHERE A `risk` ARM WOULD BE DEAD CODE, and it
       * was checked at the bytes rather than assumed: `ActionNode.tsx:11` passes
       * NO `lodMetric` prop, so this resolver IS the live path for an action.
       * Risk, outcome, goal and decision each format their own line and pass it
       * as `lodMetric`, where `BaseNode` gives it precedence — an arm here for
       * any of those four is unreachable with a green unit spec, which is the
       * trap recorded at the head of this file.
       *
       * ⚠ AND WHY `description` IS THE RIGHT DATUM, not merely an available one:
       * `ActionNode.tsx:12-16` renders `data.description` as the card's ENTIRE
       * body. So the reduced line is a shortening of the very string the card
       * shows one zoom step up — the same rule factor and option already follow
       * — and it cannot state a second, differently-derived fact about the node.
       *
       * FIRST LINE ONLY, because the line is absolutely positioned inside a
       * hidden body and must not grow the card's box; a description pasted from
       * a brief routinely carries newlines. Withholds on absent, non-string,
       * empty and whitespace-only — a blank line with a testid is the defect
       * this arm exists to remove, not a smaller version of it.
       */
      const description = data.description
      if (typeof description !== 'string') return null
      const firstLine = description.split('\n')[0]?.trim() ?? ''
      return firstLine.length > 0 ? firstLine : null
    }

    // ⚠ `goal` and `decision` fall through DELIBERATELY.
    //
    // Neither is silent — each declares its own line through `BaseNode`'s
    // `lodMetric` prop (#1085), because each reads a datum this module cannot
    // see: a user-stated threshold and a leader-claim PERMISSION respectively. A
    // goal arm here would print `Target: 15%` beside a prop that prints the same
    // target from a different expression, and a decision arm would be a second,
    // differently-counted answer to "how many options?". Both were written, and
    // both are deleted rather than shipped dark.
    default:
      return null
  }
}

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
 * number that needs a caveat is not made safe by shrinking the type. An
 * outcome's achievement probability used to be shown here only on the basis
 * that carries no mandatory caveat; contract v3.1 withdraws it on every basis
 * (it is the goal's figure, not the outcome's — see the outcome arm).
 * Fail-closed everywhere: an absent gate value withholds.
 *
 * ⚠ SCOPE, STATED RATHER THAN IMPLIED (trap 20). This resolves the reduced line
 * for FACTOR, OPTION, RISK and OUTCOME — the four types whose figure is
 * reachable from `data` + `displayMetadata`. (Since contract v3.1 the OUTCOME
 * arm always withholds.)
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
 *   risk                         → `RiskNode` (#1074) — its recorded size;
 *                                  else this module's severity arm
 *   outcome                      → nobody: no line (contract v3.1, gap U1)
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
import { factorValueSourceMark } from './valueSourceMark'
import { DRIVER_LINE_COPY, LAST_RUN_PREFIX, OPTION_RESULT_COPY } from './metricVocabulary'

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
  /**
   * The factor's ranked influence readout, from `useInfluenceRank` — the SAME
   * owner and the same two conditions `FactorNode` renders at full zoom.
   *
   * ⚠ ABSENT MEANS WITHHOLD THE RANK, NOT WITHHOLD THE ROW. The percentage
   * below it is a licensed rendering in its own right and is what the card
   * itself shows on the same branch; what was wrong was showing it where a
   * rank existed, so one number carried two claims at two zoom levels.
   */
  influenceRank?: { caption: string; setSizeText: string } | null
  /**
   * ⭐ THE DRIVER RANK, in the one wording every rung uses (ED 02:31Z D1a:
   * "`Driver N of M`, not `Driver #N of M`"; ED 11:52Z: "no pseudo-precise
   * `% influence` on the face"). Resolved by `BaseNode` from the SAME
   * licence as the card's driver line (`driverRankFor`): a current run, or a
   * known-changed model's last run (labelled through `influenceFromLastRun`).
   * Never-run / cannot-confirm withhold it on both rungs. Absent ⇒ no
   * analysis-derived line at all.
   */
  driverRank?: { rank: number; setSize: number } | null
  /**
   * The option result's caption, by run currency (`OPTION_RESULT_COPY`) — the
   * same caption the card shows at full zoom. Absent ⇒ the result is withheld.
   */
  optionResultCaption?: string | null
  /**
   * The model has changed since the run the influence figure came from — the
   * card's own `useModelChangedSinceRun()`, passed through `BaseNode`.
   *
   * ⭐ LABELS THE DRIVER ARM ONLY. A stated value and a prior range are not
   * run-derived, so "Last run" beside them would be a claim about the wrong
   * object. And it is a PREFIX, not a suffix, for this line's own reason (see
   * the `est.` mark in `BaseNode`): the line is `truncate`d, so the first thing
   * an ellipsis eats is the END — the figure gives way and the label cannot.
   */
  influenceFromLastRun?: boolean
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
 * What the reduced line says, AND whether the figure in it is an unconfirmed
 * estimate.
 *
 * ⭐⭐ WHY THE MARK RIDES WITH THE TEXT INSTEAD OF BEING ASKED FOR SEPARATELY.
 * A second function answering "is this factor an estimate?" would be right
 * about the FACTOR and wrong about the LINE: this resolver has three factor
 * arms, and only the first states the factor's own value. The other two state
 * an INFLUENCE SCORE and a PRIOR RANGE — different objects, neither of them
 * the thing `est.` speaks about. Marking those would be trap 21 with the mark
 * pointed at the wrong number, which is worse than the omission being fixed.
 * So the arm that produces the string is the arm that decides the mark, and
 * they cannot be asked apart.
 */
export function resolveLodMetricLineDetail({
  nodeType,
  data,
  label,
  displayMetadata,
  facts,
}: LodMetricLineInputs): { text: string | null; unconfirmedEstimate: boolean } {
  const text = resolveText({ nodeType, data, label, displayMetadata, facts })
  if (text === null || nodeType !== 'factor' || !data) return { text, unconfirmedEstimate: false }

  /**
   * ⭐ BOUND BY CONTROL FLOW, NOT BY STRING EQUALITY (trap 19). The factor case
   * tries its stated value FIRST and returns it the moment it is non-null, so
   * a non-null `stated` is proof that `text` IS that value and that neither
   * the influence arm nor the prior-range arm was reached. Comparing the two
   * strings instead would be a value predicate another arm could satisfy.
   *
   * The precondition is pinned in-test rather than trusted here: the spec
   * asserts `text === stated` on the marked case, so a reordering of the
   * factor arms REDs instead of silently marking the wrong number.
   */
  const stated = factorStatedValue(data, label)
  // Paul 23 Sep contract feedback point 1: the reduced line reads the SAME
  // owner as the card face (`factorValueSourceMark`), so a value with no stamp
  // is `est.` at every zoom — never "unmarked = Olumi" at far zoom only.
  return { text, unconfirmedEstimate: stated !== null && factorValueSourceMark(data)?.kind === 'olumi' }
}

/**
 * The string alone. Kept because four owner components and every existing spec
 * ask this question and nothing else; it is `resolveLodMetricLineDetail().text`
 * by construction, so the two can never state different lines.
 */
export function resolveLodMetricLine(inputs: LodMetricLineInputs): string | null {
  return resolveLodMetricLineDetail(inputs).text
}

function resolveText({
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
        /**
         * ⭐ THE RANK FIRST, BECAUSE IT IS WHAT THE CARD SAYS. At full zoom
         * `FactorNode:762,780` renders `influenceRank.caption` beside
         * `influenceRank.setSizeText` — "Most influential · of 5" — and falls
         * back to the bare percentage only when the rank is unlicensed. This
         * line had no rank arm at all, so it ALWAYS took the fallback: the
         * same datum read as a RANK on one rung and as a PERCENTAGE on the
         * other, and a bare percentage invites "62% of the answer", which is
         * not what it measures.
         *
         * ⛔ THE SET SIZE RIDES WITH THE CAPTION AND IS NOT DROPPED FOR WIDTH.
         * "Most influential" alone is the claim a reader cannot check; the
         * denominator is the half that makes it checkable, and
         * `influenceRankReadout` composes its own `phrase` from both for
         * exactly that reason.
         */
        // ⛔ NO BARE `Influence N%` (ED 11:52Z: "no pseudo-precise `% influence`
        // on the face" — and this line IS the face at far zoom). The rank, in the
        // driver line's own words, or nothing analysis-derived: the prior range
        // below still speaks where one exists. (The #1209 register note that
        // lived here is honoured by construction — the words come from
        // `DRIVER_LINE_COPY`, the one register the card also reads.)
        // Ruling 3 (ROADMAP 2.651; #1891): a known-changed model's rank is
        // labelled, never withheld — and never invented on never-run or
        // cannot-confirm (`driverRank` is absent there).
        const driver = facts?.driverRank
        const lastRun = facts?.influenceFromLastRun === true ? LAST_RUN_PREFIX : ''
        // Contract v3.1 pt 5 stale form: "Last run · Driver N of M ranked".
        if (driver) return `${lastRun}${DRIVER_LINE_COPY.rank(driver.rank, driver.setSize, lastRun !== '')}`
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
        // `Ahead ${…}` while its sibling arm, the `achievementProbability`
        // return in this same function (withdrawn by contract v3.1), already
        // read the register's `chance` noun.
        // So a rename in the register changed the zoomed-IN card and left this
        // zoomed-OUT one saying the old word.
        //
        // ⚠ CITED BY SYMBOL, NOT BY LINE. An earlier version of this comment
        // said "`:305`, two hundred lines below"; both numbers were wrong (314,
        // and 56 lines) and a neighbouring edit would have falsified any
        // correct pair anyway. The sibling is findable by name for as long as
        // it exists, which a line number is not.
        // The estate adjudicated this exact case in this exact file for the
        // sibling noun (`Achievement` -> `Chance`) and took it here rather
        // than deferring, precisely so the board could not say two words for
        // one number at two zoom levels. Nothing REDded because the canvas
        // noun guard filters sources to `*Node.tsx` and this file is not one.
        // ⭐ MODEL-RELATIVE, NEVER `Support` (ED 11:52Z: "Do not use `Support`
        // as the result label … Any result shown at rest must be explicitly
        // model-relative, e.g. `Current model · 55% of runs`"). The caption is
        // resolved by BaseNode from the run's currency; absent, the line
        // falls through to the option's own change count.
        const caption = facts?.optionResultCaption
        if (caption) {
          return `${caption} · ${OPTION_RESULT_COPY.share(formatWinProbability(displayMetadata.winRate))}`
        }
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
      // returns `null`. `RiskNode` declares its own recorded size through
      // `lodMetric`, which wins when present; since contract v3.1 it no longer
      // falls back to a link-strength line (gap U1), so with no recorded size
      // this arm is the live path and a `null` keeps the card's body visible.
      if (severity === null) return null
      return `${severity.charAt(0).toUpperCase()}${severity.slice(1)} risk`
    }

    case 'outcome': {
      /**
       * ⛔ WITHHELD — contract v3.1 (VC-01): "Probability of a goal … must never
       * stand in" for another fact, and outcome records are distinct from their
       * connections. `achievementProbability` on an outcome is the recommended
       * OPTION's chance of reaching THE GOAL (`useNodeDisplayMetadata`),
       * identical on every outcome — the figure `OutcomeNode` removed from the
       * card on 17 Sep. This arm printed it as `Chance N%` wherever the card
       * declared no line of its own, and since v3.1 took the link-strength line
       * off the card (gap U1) that is every outcome. No outcome-scoped datum
       * exists on the wire, so the outcome has no reduced line.
       */
      return null
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

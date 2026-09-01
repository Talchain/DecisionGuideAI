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
 * ⚠ SCOPE, STATED RATHER THAN IMPLIED (trap 20). This changes what FACTOR,
 * OPTION, RISK and OUTCOME cards say below the legibility floor. `decision`,
 * `goal` and `action` are untouched and still render nothing: a decision card
 * has no single headline quantity, and a goal's figure is the one most
 * entangled with withholding rules. They are not "done" — they are DELIBERATELY
 * NOT ATTEMPTED HERE, and rowed in CANVAS-BACKLOG.md.
 */
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'
import { collapseEstimateDisplay } from './collapseEstimateDisplay'
import { isSuppressedUnit, formatWinProbability } from '../../utils/labelUtils'
import { calculateRiskSeverity } from '../../utils/graphDisplayCalculations'
import type { RiskImpact } from '../../domain/nodes'
import type { NodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

export interface LodMetricLineInputs {
  nodeType: string
  /** The React Flow node's `data`, untouched — read, never rewritten. */
  data: Record<string, unknown> | undefined
  label: string
  displayMetadata: NodeDisplayMetadata
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
      if (influence == null || influenceProvenance == null) return null
      return `Influence ${Math.round(influence * 100)}%`
    }

    case 'option': {
      // The win share, through the shared formatter that owns the sub-1% floor.
      // ⚠ The FIGURE, not the sentence: the option card's full-zoom readout is a
      // comparative phrase that truncates to nothing at this size. Paul's
      // ruling on card density (31 Aug) is the same shape one zoom level up —
      // "show the bar with the percentage next to it", the sentence on hover.
      if (!displayMetadata.isResultsMode || displayMetadata.winRate == null) return null
      return `Ahead ${formatWinProbability(displayMetadata.winRate)}`
    }

    case 'risk': {
      // Qualitative by construction, so it needs no caveat and no unit, and it
      // is the same band the card's own severity pill shows.
      const severity = calculateRiskSeverity(
        data.probability as number | undefined,
        data.impact as RiskImpact | undefined,
      )
      if (severity === null) return null
      return `${severity.charAt(0).toUpperCase()}${severity.slice(1)} risk`
    }

    case 'outcome': {
      const { achievementProbability, achievementProbabilityIsModelledBasis } = displayMetadata
      if (achievementProbability == null) return null
      // ⛔ THE CAVEAT GATE. On the modelled basis `OutcomeNode` is REQUIRED to
      // render `GOAL_FIT_BASIS_CAVEAT_COPY` adjacent to this figure. One line
      // cannot carry both, so the figure is withheld rather than shown stripped
      // of the disclosure that makes it honest.
      if (achievementProbabilityIsModelledBasis === true) return null
      return `Achievement ${Math.round(achievementProbability * 100)}%`
    }

    default:
      return null
  }
}

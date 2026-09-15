import type { CEEGoalConstraint } from '../../adapters/cee/types'
import { formatStatedLimitValue, renderLimitOperator } from '../../components/results/decision-overview/statedLimits'
import { classifyUnit } from '../../utils/unitClassifier'
import { resolveElementLabel } from '../domain/elementLabel'

/** State the recorded boundary and its origin, independently of probability or evidence quality. */
/**
 * ⭐ `omitLabel` EXISTS SO THERE IS STILL EXACTLY ONE FORMATTER.
 *
 * On the constrained factor's own card the target's name is the card's title,
 * so "Monthly churn ≤ 4%" prints it twice and costs a line of height on a
 * surface already fighting for it. The obvious shortcut is to format the
 * operator and value at the call site — which is how this estate's label
 * surfaces drifted apart in the first place, and `FactorNode` had already done
 * exactly that (see its constraint note). Unit classification, the `≤`
 * rendering, the `limit not captured` refusal and the provenance suffix all
 * stay here; only the name is suppressed.
 */
export interface GoalConstraintTextOptions {
  /** True on a surface that already names the constrained element. */
  readonly omitLabel?: boolean
}

export function goalConstraintText(
  constraint: CEEGoalConstraint,
  nodes: readonly { id: string; data?: unknown }[] = [],
  options: GoalConstraintTextOptions = {},
): string {
  const target = constraint.node_id ? nodes.find(n => n.id === constraint.node_id) : undefined
  const label = (typeof constraint.label === 'string' ? constraint.label.trim() : '') || (target ? resolveElementLabel(target.data) : 'Constraint')
  // Explicit constraints may come from the brief or a panel edit; neither means verified.
  const origin = constraint.provenance === 'inferred' ? ' · Inferred limit'
    : constraint.provenance === 'proxy' ? ' · Proxy limit' : ''
  const prefix = options.omitLabel ? '' : `${label} `

  /**
   * ⭐⭐⭐ ON A PERCENT LIMIT, THE READER'S OWN WORDS BEAT OUR RECONSTRUCTION —
   * and this was found in the running app, not in the code.
   *
   * The `pricing-model` starter states *"net revenue retention above 110%"*.
   * The producer sends that constraint as `value: 1.1, unit: '%'`, so the
   * reconstruction below appended the glyph to the ratio and rendered
   * **"≥ 1.1%"** — a hundred times under the brief, while the goal card two
   * inches away rendered **"Target: 110%"** off the same quantity. Measured at
   * the live store in the running app.
   *
   * ⛔ THE GOAL PATH ONLY GETS IT RIGHT BECAUSE THE PRODUCER SENDS IT TWICE:
   * `goal_threshold: 1.1` for compute and `goal_threshold_raw: 110` to display.
   * A constraint has NO raw twin, so on a percent unit there is nothing honest
   * to reconstruct from — multiplying by a hundred would be this function
   * guessing the producer's scale convention, which is the whole class of thing
   * the UI must not do.
   *
   * ⚠ SCOPED TO `percent`, AND THE NARROWNESS IS THE POINT. A first cut
   * preferred the quote for EVERY unit and `factorGoalContent.spec` caught it:
   * a currency limit reconstructs EXACTLY — `value: 49, unit: '£'` is £49, no
   * scale ambiguity anywhere — and "Monthly price ≤ £49" is tidier on a card
   * than "Keep the monthly price at or below £49". Two different harms were
   * sharing one predicate: a WRONG figure, and a merely longer one. Only the
   * first is worth the trade.
   *
   * `source_quote` is declared "verbatim span from the brief that produced this
   * constraint" — the reader's own sentence, recorded by the producer, needing
   * no interpretation. Where a percent limit carries none, the reconstruction
   * still runs and is still 100× out; that is a producer gap this layer cannot
   * close, and it is stated here rather than hidden.
   */
  const quote = typeof constraint.source_quote === 'string' ? constraint.source_quote.trim() : ''
  if (quote && classifyUnit(constraint.unit ?? null).kind === 'percent') {
    return options.omitLabel ? `\u201c${quote}\u201d${origin}` : `${label} \u00b7 \u201c${quote}\u201d${origin}`
  }

  if (typeof constraint.value !== 'number' || !Number.isFinite(constraint.value) || !constraint.operator) {
    // ⛔ Still never invents a direction — the ruled behaviour, unchanged. With
    // the label omitted the separator goes too, or it opens with a stray "·".
    return options.omitLabel ? `Limit not captured${origin}` : `${label} · limit not captured${origin}`
  }
  const { kind, canonical } = classifyUnit(constraint.unit ?? null)
  let value = formatStatedLimitValue(constraint.value, constraint.unit)
  if (kind === 'iso') value = `${canonical} ${constraint.value.toLocaleString('en-GB')}`
  else if (kind === 'symbol') value = `${canonical}${constraint.value.toLocaleString('en-GB')}`
  else if (kind === 'percent') value = `${constraint.value}%`
  else if (kind === 'other' && canonical.toLowerCase() !== 'count') value += ` ${canonical}`
  return `${prefix}${renderLimitOperator(constraint.operator)} ${value}${origin}`
}

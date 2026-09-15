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

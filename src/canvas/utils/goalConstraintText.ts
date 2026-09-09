import type { CEEGoalConstraint } from '../../adapters/cee/types'
import { formatStatedLimitValue, renderLimitOperator } from '../../components/results/decision-overview/statedLimits'
import { classifyUnit } from '../../utils/unitClassifier'
import { resolveElementLabel } from '../domain/elementLabel'

/** State the recorded boundary, independently of any computed probability. */
export function goalConstraintText(
  constraint: CEEGoalConstraint,
  nodes: readonly { id: string; data?: unknown }[] = [],
): string {
  const target = constraint.node_id ? nodes.find(n => n.id === constraint.node_id) : undefined
  const label = (typeof constraint.label === 'string' ? constraint.label.trim() : '') || (target ? resolveElementLabel(target.data) : 'Constraint')
  if (typeof constraint.value !== 'number' || !Number.isFinite(constraint.value) || !constraint.operator) {
    return `${label} · limit not captured`
  }
  const { kind, canonical } = classifyUnit(constraint.unit ?? null)
  let value = formatStatedLimitValue(constraint.value, constraint.unit)
  if (kind === 'iso') value = `${canonical} ${constraint.value.toLocaleString('en-GB')}`
  else if (kind === 'symbol') value = `${canonical}${constraint.value.toLocaleString('en-GB')}`
  else if (kind === 'percent') value = `${constraint.value}%`
  else if (kind === 'other' && canonical.toLowerCase() !== 'count') value += ` ${canonical}`
  return `${label} ${renderLimitOperator(constraint.operator)} ${value}`
}

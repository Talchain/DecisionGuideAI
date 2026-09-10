import type { ObservedState } from '../domain/nodes'
import { formatInterventionValue, unwrapInterventionValue } from './labelUtils'
import { resolveElementLabel } from '../domain/elementLabel'

type SettingNode = { id: string; type?: string; data?: Record<string, unknown> }
type SettingOption = { id: string; interventions?: unknown }

/** Full rows in stable canvas order; the preview alone limits their number. */
export function getFactorOptionRows(
  factorId: string,
  nodes: readonly SettingNode[],
  options: readonly SettingOption[] | null | undefined,
  observedState?: ObservedState,
) {
  return nodes.filter(n => (n.type ?? n.data?.kind ?? n.data?.type) === 'option').map(option => {
    const ceeOption = options?.find(o => o.id === option.id)
    const interventions = (ceeOption?.interventions ?? option.data?.interventions) as Record<string, unknown> | undefined
    const raw = interventions?.[factorId]
    return {
      id: option.id,
      label: resolveElementLabel(option.data),
      displayValue: factorOptionSetting(raw, observedState)
        ?? (raw === undefined ? 'No setting recorded' : 'Value not specified'),
    }
  })
}

/** The same option setting in the factor preview and its inspector. */
export function factorOptionSetting(raw: unknown, observedState?: ObservedState): string | null {
  const { value, displayValue } = unwrapInterventionValue(raw)
  if (displayValue) return displayValue
  if (value != null) {
    return formatInterventionValue(
      value, observedState?.unit ?? undefined, observedState?.factor_type ?? undefined, observedState?.cap ?? undefined,
      observedState?.value, observedState?.raw_value, { preserveTierLabel: true },
    ) || null
  }
  // Preserve qualitative settings; a string is never coerced into a number.
  const text = typeof raw === 'string' ? raw
    : raw != null && typeof raw === 'object' && 'value' in raw ? raw.value : null
  return typeof text === 'string' && text.trim() ? text : null
}

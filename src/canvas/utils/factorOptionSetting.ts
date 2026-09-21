import type { ObservedState } from '../domain/nodes'
import { formatInterventionValue, unwrapInterventionValue, joinInterventionDetails } from './labelUtils'
import { resolveElementLabel } from '../domain/elementLabel'

type SettingNode = { id: string; type?: string; data?: Record<string, unknown> }
type SettingOption = { id: string; interventions?: unknown; intervention_details?: unknown }

/**
 * ⭐⭐ THE ONE PLACE AN OPTION'S INTERVENTIONS ARE READ FOR DISPLAY — and it
 * exists because three surfaces read them and all three printed a number CEE
 * had already put into words.
 *
 * ── MEASURED ON THE DEPLOYED BUILD, guest, `usage-based-billing` ──────────
 * Hovering `opt_vendor`, whose `fac_eng_capacity` target is `0.2`:
 *
 *     the OPTION card says     → Low (0.2)        ← CEE's own `display_value`
 *     the FACTOR card says     → Very low          ← the UI's own band table
 *
 * **One datum, two surfaces, and the product contradicting its producer eight
 * pixels apart.** `qualitativeTierLabel` puts `0.2` in *Very low* (its bound is
 * `<= 0.2`); CEE put it in *Low*. Neither table is wrong — but only one of them
 * is the producer's, and the canvas is meant to be a thin layer over what the
 * producer said. A third factor rendered the bare `→ 0.2` on the same hover, so
 * the surface was not even self-consistent.
 *
 * ── THE CAUSE, at the bytes ───────────────────────────────────────────────
 * `ceeAnalysisReady.options[]` carries `interventions` as a FLAT map of numbers
 * and the authored strings in a SIBLING `intervention_details` map. Both
 * readers took `ceeOption.interventions ?? node.data.interventions` — the flat
 * numbers win, and the words were never looked at.
 *
 * ⚠ THE CEE MAP STILL WINS, DELIBERATELY. It is the payload the analysis
 * actually ran on; falling back to the node would show a target the run did not
 * use. What changes is that its details ride with it.
 *
 * ⭐ `joinInterventionDetails` IS NOT NEW. #1793 built it for `OptionNode`,
 * which is why that card has been right all along. This is the same owner,
 * reached by the surfaces that were left out — not a second implementation.
 */
export function resolveOptionInterventionsForDisplay(
  option: SettingNode | undefined,
  ceeOption: SettingOption | undefined,
): Record<string, unknown> | undefined {
  const ceeMap = ceeOption?.interventions as Record<string, unknown> | undefined
  if (ceeMap) {
    const details = ceeOption?.intervention_details as Record<string, unknown> | null | undefined
    return Object.fromEntries(joinInterventionDetails(ceeMap, details))
  }
  return option?.data?.interventions as Record<string, unknown> | undefined
}

/** Full rows in stable canvas order; the preview alone limits their number. */
export function getFactorOptionRows(
  factorId: string,
  nodes: readonly SettingNode[],
  options: readonly SettingOption[] | null | undefined,
  observedState?: ObservedState,
) {
  return nodes.filter(n => (n.type ?? n.data?.kind ?? n.data?.type) === 'option').map(option => {
    const ceeOption = options?.find(o => o.id === option.id)
    const interventions = resolveOptionInterventionsForDisplay(option, ceeOption)
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

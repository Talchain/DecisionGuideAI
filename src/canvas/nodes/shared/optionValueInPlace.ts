/**
 * ⭐ E1b — AN OPTION'S VALUE, EDITED ON THE OPTION CARD (Paul 29 Sep: edit the graph directly).
 *
 * The card row "What this option sets: Annual platform cost: £60k" becomes a `NodeValueEditor`. The frame, seed and
 * admission are the inspector's own (`optionTargetEntry`: "£80,000" / "80k" in the factor's unit → the model value),
 * so the card and `InterventionRow` cannot read one typed figure two ways. The write is the inspector's too
 * (`proposeOptionIntervention` → `option_intervention_edit`, with `base_graph_hash`).
 *
 * Every row with a numeric value is editable; the row's own text (including producer `displayValue`, e.g. "High")
 * stays the resting readout, and the open field is seeded on the frame's scale.
 */
import {
  admitOptionTargetEntry,
  optionTargetEntryAdornment,
  optionTargetEntrySeed,
  resolveOptionTargetEntryFrame,
} from '../../ui/inspector-v2/shared/optionTargetEntry'
import { toFiniteNumber } from '../../utils/labelUtils'
import { INTERVENTION_NO_CHANGE_EPSILON } from '../../utils/interventionDisplay'
import type { NodeValueEntryAdmission } from './NodeValueEditor'

export interface OptionValueChip {
  value: number
  displayValue?: string
  unit?: string
  cap?: number
  observedValue?: number
  observedRawValue?: string | number
}

export interface OptionValueInPlace {
  seedText: string
  prefix?: string
  scaleHint?: string
  admit: (draft: string) => NodeValueEntryAdmission
}

export function optionValueInPlace(chip: OptionValueChip): OptionValueInPlace | null {
  if (!Number.isFinite(chip.value)) return null
  const anchor = { observedValue: chip.observedValue, observedRawValue: toFiniteNumber(chip.observedRawValue) ?? undefined }
  const frame = resolveOptionTargetEntryFrame({ unit: chip.unit, cap: chip.cap, ...anchor })
  const adornment = optionTargetEntryAdornment(frame)
  return {
    seedText: optionTargetEntrySeed(chip.value, frame, anchor),
    prefix: adornment.prefix,
    scaleHint: frame.kind === 'model_scale' ? '0–1' : adornment.suffix,
    admit: (draft) => {
      const a = admitOptionTargetEntry(draft, frame, anchor, chip.value)
      if (!a.ok) return a
      // The saved figure, typed again (a £ round-trip can differ by float noise): nothing to send.
      return Math.abs(a.value - chip.value) <= INTERVENTION_NO_CHANGE_EPSILON ? { ok: true, value: chip.value } : a
    },
  }
}

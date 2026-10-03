/**
 * ⭐ WHAT-IF "PUT IT BACK" (DL #85 5942153284: option B, LOW). A changed value on the "Since the last run" card can be
 * put back: one click opens THE CARD'S OWN value editor PRE-FILLED with the earlier value, and the user commits it
 * with Enter through the existing writer (`useModelEditAuthority.proposeFactorValue`). This module never writes the
 * model: it only says WHICH editor to open with WHICH text.
 *
 * The earlier value is the producer's own `input_changes[].before.raw` for that factor (bound by the row's entity id and
 * field), in USER units: the served "What changed" rows display it as "£60,000" / "7%", which only a user-unit raw can
 * produce, and that is the editor's own seed scale (`resolveValueInputSeed`: `raw_value`, user units).
 *
 * ⛔ THE UNIT GUARD (DL condition): no "Put it back" unless the row's unit is the node's own display unit
 * (`observedState.unit`, both absent counts as equal). A mismatch could put a number in the wrong scale into the
 * editor, so the control is simply not offered.
 * ⛔ Only where the card HAS the editor: a controllable factor with a numeric value (FactorNode's own condition for
 * mounting `NodeValueEditor`).
 */
import { create } from 'zustand'
import type { RunDelta } from '@talchain/schemas/boundary'
import type { RunDeltaInputRow } from '../../components/results/analysisNew/runDeltaView'

export interface ValuePrefill {
  readonly nodeId: string
  readonly text: string
}

export interface ValuePrefillRequest extends ValuePrefill {
  /** Unique per click, so the editor opens once per request (and never again on a remount). */
  readonly seq: number
}

type NodeLike = { id: string; type?: string; data?: unknown }

/** Pure: the editor + text that would put this row's value back, or null when the card cannot honestly offer it. */
export function valuePrefillOfRow(
  row: RunDeltaInputRow,
  delta: RunDelta | null | undefined,
  nodes: ReadonlyArray<NodeLike>,
): ValuePrefill | null {
  if (row.kind !== 'factor_value' || row.field !== 'value' || row.change !== 'changed') return null
  const change = (delta?.input_changes ?? []).find(
    (c) => c.entity_kind === 'factor_value' && c.entity_id === row.entityId && c.field === 'value' && c.change === 'changed',
  )
  const before = change?.before as { raw?: unknown; unit?: unknown } | undefined
  if (!before || typeof before.raw !== 'number' || !Number.isFinite(before.raw)) return null

  const node = nodes.find((n) => n.id === row.entityId)
  if (!node || node.type !== 'factor') return null
  const data = (node.data ?? {}) as { category?: unknown; observedState?: { value?: unknown; unit?: unknown } }
  if (data.category !== 'controllable' || typeof data.observedState?.value !== 'number') return null

  const rowUnit = typeof before.unit === 'string' && before.unit.trim() !== '' ? before.unit.trim() : null
  const nodeUnit = typeof data.observedState.unit === 'string' && data.observedState.unit.trim() !== '' ? data.observedState.unit.trim() : null
  if (rowUnit !== nodeUnit) return null

  return { nodeId: node.id, text: String(before.raw) }
}

interface ValuePrefillState {
  readonly request: ValuePrefillRequest | null
  requestPrefill: (prefill: ValuePrefill) => void
  /** Called by the editor once it has opened with `seq`, so a later remount never re-opens it. */
  consumePrefill: (seq: number) => void
}

let nextSeq = 0

export const useValuePrefillStore = create<ValuePrefillState>((set, get) => ({
  request: null,
  requestPrefill: (prefill) => {
    nextSeq += 1
    set({ request: { ...prefill, seq: nextSeq } })
  },
  consumePrefill: (seq) => {
    if (get().request?.seq === seq) set({ request: null })
  },
}))

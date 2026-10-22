/**
 * WHAT THE MODEL IMPLIES WHEN THE AIM HAS NO TARGET (CEE #3660, DL 22 Oct: make it visible). The UI's one reader of the
 * graph read's `analysis_implied_quantity`: for the sized quantity nearest an aim with no target figure, each option's
 * p10/p50/p90 from the SAME Run, in that quantity's unit and in the Run's own option order. Model-relative: never a
 * chance, a target or a ranking. Or why the Run implies nothing (`withheld`, a code with no words of CEE's).
 *
 * ⛔ The UI renders it; it does not decide it (`theUiRendersItDoesNotDecide`). The words are CEE's: its quantity, unit and
 * deadline as written, framed exactly as CEE's own Run facts frame them (`run-facts.ts` `impliedByDeadlineOf`). The words
 * are chosen by CEE's `status` and `rests_on_olumi_estimates`, never by a number.
 *
 * A store of its own, keyed by the report hash (the `identityExactLinks.ts` precedent): the read applier skips rewriting a
 * report it already displays, and the turn that ran the analysis does not carry this, so the read that brings it is
 * usually that skipped re-read. Shown only while the Run is current: "as the model stands" is false once it has changed.
 */
import { create } from 'zustand'

import { useCanvasStore } from '../store'
import { selectRunAffirmedCurrent } from './analysisStateSelector'

export const IMPLIED_QUANTITY_READ_KEY = 'analysis_implied_quantity'

export interface ImpliedRange { readonly p10: number; readonly p50: number; readonly p90: number }
export type ImpliedQuantity =
  | {
    readonly status: 'computed'; readonly nodeId: string; readonly quantity: string; readonly unit: string
    /** In the Run's option order, as CEE sent it. */
    readonly byOption: readonly (readonly [string, ImpliedRange])[]
    readonly restsOnOlumiEstimates: boolean
    /** The aim's deadline as the person wrote it; null when none is declared. */
    readonly byWhen: string | null
  }
  | { readonly status: 'withheld'; readonly reason: string }

const isRec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** CEE's record, checked against its published shape (`goal-target/implied-quantity.ts`, version 1); anything else is null. */
export function readImpliedQuantity(raw: unknown): ImpliedQuantity | null {
  if (!isRec(raw) || raw.version !== 1) return null
  if (raw.status === 'withheld') {
    const reason = text(raw.reason)
    return reason === null ? null : { status: 'withheld', reason }
  }
  if (raw.status !== 'computed') return null
  const nodeId = text(raw.node_id); const quantity = text(raw.quantity); const unit = text(raw.unit)
  if (nodeId === null || quantity === null || unit === null || !isRec(raw.by_option)) return null
  if (typeof raw.rests_on_olumi_estimates !== 'boolean') return null
  if (raw.by_when !== null && text(raw.by_when) === null) return null
  const byOption: (readonly [string, ImpliedRange])[] = []
  for (const [id, r] of Object.entries(raw.by_option)) {
    if (!isRec(r) || !finite(r.p10) || !finite(r.p50) || !finite(r.p90)) return null
    byOption.push([id, { p10: r.p10, p50: r.p50, p90: r.p90 }])
  }
  if (byOption.length === 0) return null
  return { status: 'computed', nodeId, quantity, unit, byOption, restsOnOlumiEstimates: raw.rests_on_olumi_estimates,
    byWhen: raw.by_when === null ? null : text(raw.by_when) }
}

/** CEE's time scope, said as written: "within 3 weeks" as is, "March 2027" as "by March 2027" (`sayTimeScope`). */
function sayTimeScope(byWhen: string): string {
  return /^(by|within|in|before|over|during|at|until|on)\b/i.test(byWhen) ? byWhen : `by ${byWhen}`
}

/** CEE's label for it, word for word (`impliedByDeadlineOf`). */
export function impliedQuantityHeading(q: Extract<ImpliedQuantity, { status: 'computed' }>): string {
  return `What the model implies for ${q.quantity}${q.byWhen === null ? '' : ` ${sayTimeScope(q.byWhen)}`}, as the model stands`
}

/** A figure as CEE's facts give it: three significant figures. */
export function impliedFigure(v: number): string {
  return Number(v.toPrecision(3)).toLocaleString('en-GB')
}

export const IMPLIED_QUANTITY_COPY = {
  /** One option's p10–p90 and median, in CEE's own example words (#3660: "about 1 to 2 angels (most likely 1.5)"). */
  range: (p10: string, p90: string, p50: string, unit: string) => `about ${p10} to ${p90} ${unit} (most likely ${p50})`,
  /** Said only where CEE's census found Olumi's estimates among the quantity's own inputs. */
  restsOnOlumi: 'Rests on Olumi’s estimates',
} as const

interface HeldImpliedQuantity { readonly responseHash: string | null; readonly value: ImpliedQuantity | null }
export const useImpliedQuantityStore = create<{ held: HeldImpliedQuantity }>(() => ({
  held: { responseHash: null, value: null },
}))

/** Called by the read applier with the report hash its block maps to, BEFORE its dedupe. Absent or malformed = none. */
export function recordImpliedQuantity(responseHash: string | null | undefined, raw: unknown): void {
  const value = readImpliedQuantity(raw)
  useImpliedQuantityStore.setState({
    held: typeof responseHash === 'string' && value !== null ? { responseHash, value } : { responseHash: null, value: null },
  })
}

/** The implied quantity for the Run on screen, while that Run is current; else null. */
export function useImpliedQuantity(): ImpliedQuantity | null {
  const held = useImpliedQuantityStore((s) => s.held)
  return useCanvasStore((s) => {
    const hash = (s.results?.report as { model_card?: { response_hash?: unknown } } | null | undefined)?.model_card?.response_hash
    return held.value !== null && typeof hash === 'string' && hash === held.responseHash && selectRunAffirmedCurrent(s)
      ? held.value : null
  })
}

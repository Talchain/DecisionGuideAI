/**
 * RESULT-FIRST, TWO REQUESTS — the UI half (AI HARNESS contract #85 5931099857; CEE #2470).
 *
 * Request 1 is the typed Run: the full result, one deterministic line, and `narration: {status: 'pending', run_key}`.
 * The UI then sends request 2 on its own (`chip.id = 'agent-explain-run:' + run_key`, routed by id, never by text),
 * and the explanation arrives as `narration: {status: 'ready' | 'stale' | 'unavailable', run_key}`.
 *
 * ⛔ The auto-send fires only on a LIVE response, never on a transcript restore, and once per `run_key`. A ready
 * explanation whose `run_key` is not the latest Run's is about a Run the user is no longer looking at, so it is dropped.
 * Absent `narration` (CEE before #2470) is a no-op: the "Explain this result" chip stays the path.
 */
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

export const NARRATION_STATUSES = ['pending', 'ready', 'stale', 'unavailable'] as const
export type NarrationStatus = (typeof NARRATION_STATUSES)[number]

export interface TurnNarration {
  readonly status: NarrationStatus
  readonly runKey: string
}

export const EXPLAIN_RUN_CHIP_PREFIX = 'agent-explain-run:'
/** The chip's own words; request 2 is routed by its id. */
export const EXPLAIN_RUN_LABEL = 'Explain this result'

export function explainRunChipId(runKey: string): string {
  return `${EXPLAIN_RUN_CHIP_PREFIX}${runKey}`
}

/** `narration` from a parsed turn: top level first, then the additive sidecar. `null` = absent or not the contract. */
export function readNarration(response: unknown): TurnNarration | null {
  if (response === null || typeof response !== 'object') return null
  const top = (response as Record<string, unknown>).narration
  const additive = (response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  const raw = top !== undefined ? top : additive?.narration
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { status, run_key: runKey } = raw as Record<string, unknown>
  if (typeof status !== 'string' || !(NARRATION_STATUSES as readonly string[]).includes(status)) return null
  if (typeof runKey !== 'string' || runKey.trim() === '') return null
  return { status: status as NarrationStatus, runKey }
}

/** Request 1 of a Run (`pending` / `unavailable`) names the Run whose explanation may follow. */
export function namesALatestRun(n: TurnNarration | null): n is TurnNarration {
  return n !== null && (n.status === 'pending' || n.status === 'unavailable')
}

/** A ready explanation for a Run that is no longer the latest one: drop it rather than explain the wrong Run. */
export function isForeignExplanation(n: TurnNarration | null, latestRunKey: string | null): boolean {
  return n !== null && n.status === 'ready' && n.runKey !== latestRunKey
}

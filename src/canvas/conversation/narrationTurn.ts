/**
 * RESULT-FIRST, OPTIONAL EXPLAIN — the UI half of the same-Run contract.
 *
 * A typed Run returns the saved result and `narration: {status: 'pending', run_key}`.
 * Pending means the bound Explain control is available; it starts no request or busy state.
 * A user press sends request 2 by the existing chip id and receives ready, stale or unavailable narration.
 * A ready explanation for a different retained Run is dropped. Transcript restore never dispatches Explain.
 * Absent narration keeps the existing legacy control path.
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
  // A stale resend can explicitly say that the original Run identity is unknown.
  if (typeof runKey !== 'string' || (runKey.trim() === '' && !(status === 'stale' && runKey === ''))) return null
  return { status: status as NarrationStatus, runKey }
}

/**
 * Request 1 of a Run (`pending` / `unavailable`) names the Run whose explanation may follow; so does a Run press answered
 * whole in one reply (`ready` on the Run turn itself: core, served 22 Oct, whose reply was otherwise read as foreign).
 */
export function namesALatestRun(n: TurnNarration | null, isRunTurn = false): n is TurnNarration {
  return n !== null && (n.status === 'pending' || n.status === 'unavailable' || (isRunTurn && n.status === 'ready'))
}

/** A ready explanation for a Run that is no longer the latest one: drop it rather than explain the wrong Run. */
export function isForeignExplanation(n: TurnNarration | null, latestRunKey: string | null): boolean {
  return n !== null && n.status === 'ready' && n.runKey !== latestRunKey
}

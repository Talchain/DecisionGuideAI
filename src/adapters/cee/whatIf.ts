/**
 * A WHAT-IF ON THE CANVAS, NOTHING SAVED (canvas scenario comparison, slice 1; DL 21–22 Oct 2026).
 *
 *   POST /assist/v1/scenarios/{id}/what-if  →  `{ persisted: false, changes_applied, changes_refused, variants }` or
 *                                              `{ persisted: false, refusal, changes_refused }`
 *
 * The producer is CEE #3591 + #3602 (`routes/assist.v1.scenario-what-if.ts`, `orchestrator-v5/handlers/what-if-run.ts`):
 * the held gestures are applied to a COPY of the saved model and run beside the saved model on the same draws. No LLM, no
 * write, no Run fact. Its body is `.strict()` (`changes`, `crux?`, `base_graph_hash?`), so identity travels in the auth
 * headers only (the scenario-ownership plugin reads the bearer token), never as a body `user_id`.
 *
 * Cells are the Run's own displays (a figure or range through the goal-chance gate, or withheld with CEE's sentence why);
 * the raw percentage is never sent. The canvas shows CEE's words verbatim and composes none of its own about a result.
 */
import { logger } from '../../lib/logger'
import { sanitiseUserId } from '../../lib/guestIdentity'
import { buildTurnAuthHeaders } from '../../v5/turnAuthHeaders'
import { classifySignInRefusal } from './signInRefusal'

/** The same-origin Netlify edge path, a literal (see `scenarioGraph.ts`: an env-resolved base is the defect). */
export const WHAT_IF_BASE = '/bff/cee'

export function whatIfUrl(scenarioId: string): string {
  return `${WHAT_IF_BASE}/scenarios/${encodeURIComponent(scenarioId)}/what-if`
}

/** Two runs through PLoT (the saved model and the what-if): longer than a graph read, still a bound. */
const DEFAULT_TIMEOUT_MS = 60_000

/** One option's result as the Run displays it: a figure or range, or `not_shown` (CEE's sentence why). */
export interface WhatIfCell {
  readonly display: string | null
  readonly provisional: boolean
  readonly not_shown: string | null
}

export interface WhatIfOptionRow {
  readonly option_id: string
  readonly saved: WhatIfCell
  readonly what_if: WhatIfCell
  /** CEE's sentence on whether the move is beyond ordinary run-to-run variation; null when CEE sent none. */
  readonly variation_words: string | null
}

export type WhatIfOutcome =
  | {
      readonly status: 'ran'
      /** The what-if and the saved model drew the same samples (CEE proved it from PLoT's seed echoes). */
      readonly paired: boolean
      readonly options: readonly WhatIfOptionRow[]
      readonly changesRefused: number
    }
  | { readonly status: 'refused'; readonly reason: string }
  | { readonly status: 'signInRequired' }
  | { readonly status: 'unusable' }

const isRec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

function readCell(raw: unknown): WhatIfCell | null {
  if (!isRec(raw)) return null
  const display = strOrNull(raw.display)
  const notShown = strOrNull(raw.not_shown)
  // A cell with neither says nothing a reader can hold: CEE never sends one (`cellOf`), so one is a contract break.
  if (display === null && notShown === null) return null
  return { display, provisional: raw.provisional === true, not_shown: display === null ? notShown : null }
}

/**
 * The producer's answer, read strictly where it matters: only the `'all'` variant (every held change together) is
 * shown in slice 1, and a row missing either cell is dropped rather than shown half-empty.
 */
export function readWhatIfResponse(body: unknown): WhatIfOutcome {
  if (!isRec(body) || body.persisted !== false) return { status: 'unusable' }
  const refusal = strOrNull(body.refusal)
  if (refusal !== null) return { status: 'refused', reason: refusal }
  if (!Array.isArray(body.variants)) return { status: 'unusable' }
  const all = body.variants.find((v) => isRec(v) && v.change_index === 'all')
  if (!isRec(all) || typeof all.paired !== 'boolean' || !Array.isArray(all.options)) return { status: 'unusable' }
  const options: WhatIfOptionRow[] = []
  for (const row of all.options) {
    if (!isRec(row)) continue
    const optionId = strOrNull(row.option_id)
    const saved = readCell(row.saved)
    const whatIf = readCell(row.what_if)
    if (optionId === null || saved === null || whatIf === null) continue
    options.push({ option_id: optionId, saved, what_if: whatIf, variation_words: strOrNull(row.variation_words) })
  }
  if (options.length === 0) return { status: 'unusable' }
  return {
    status: 'ran',
    paired: all.paired,
    options,
    changesRefused: Array.isArray(body.changes_refused) ? body.changes_refused.length : 0,
  }
}

export interface RunWhatIfOptions {
  readonly userId: string | null
  readonly accessToken: string | null
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

/** One POST, one deadline, no retries (a what-if is the user's press; a retry is theirs). Every failure is typed. */
export async function runWhatIf(
  scenarioId: string,
  body: { readonly changes: readonly Record<string, unknown>[]; readonly base_graph_hash?: string },
  opts: RunWhatIfOptions,
): Promise<WhatIfOutcome> {
  const controller = new AbortController()
  const onCallerAbort = () => controller.abort()
  if (opts.signal) {
    if (opts.signal.aborted) return { status: 'unusable' }
    opts.signal.addEventListener('abort', onCallerAbort, { once: true })
  }
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null
  let response: Response
  try {
    response = await fetch(whatIfUrl(scenarioId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildTurnAuthHeaders({ userId: sanitiseUserId(opts.userId), accessToken: opts.accessToken }),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    logger.warn('what_if.transport_failure', { error: (err as Error)?.message ?? 'unknown' })
    return { status: 'unusable' }
  } finally {
    if (timer !== null) clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onCallerAbort)
  }
  let parsed: unknown = null
  try { parsed = await response.json() } catch { parsed = null }
  if (!response.ok) {
    if (classifySignInRefusal(response.status, parsed) !== null) return { status: 'signInRequired' }
    logger.warn('what_if.http_failure', { status: response.status })
    return { status: 'unusable' }
  }
  return readWhatIfResponse(parsed)
}

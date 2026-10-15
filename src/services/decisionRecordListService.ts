/**
 * ⭐ S9 (DL 5a, 15 Oct 2026): READ BACK the user's own decision records for a scenario from CEE.
 *
 * CEE serves `POST /assist/v1/decision-records/list` (`assist.v1.decision-records.ts`, #2519): the same JWT + owner check
 * as `/commit`, the caller's USER-AUTHORED rows only, newest first (`store-adapter.ts`, `created_at` descending), each in
 * the commit request's own field names. Until this read, a committed decision came back only from the browser that wrote
 * it.
 *
 * A guest makes NO call: CEE refuses an unowned scenario (DR001) by design, so a guest's record stays on this device.
 */
import { getSessionIdentity } from '../lib/supabase'

/** Same-origin Netlify edge seam (`/bff/cee/x` → `/assist/v1/x`), as the commit uses. */
const CEE_BFF_BASE = '/bff/cee'
export const DECISION_RECORD_LIST_PATH = '/decision-records/list'

/** One record as CEE's read-back returns it (`DecisionRecordListItem`, CEE). */
export interface DecisionRecordListItem {
  readonly record_id: string
  readonly created_at: string
  readonly review_date: string
  readonly position: 'chosen' | 'not_ready'
  readonly chosen_option_id?: string
  readonly chosen_option_label?: string
  readonly confidence_0_100?: number
  readonly expectation_statement?: string
  readonly rationale?: string
  readonly key_assumption?: string
  readonly revisit_trigger?: string
  readonly next_action?: string
}

export type DecisionRecordListResult =
  | { readonly status: 'ok'; readonly ownerId: string; readonly records: readonly DecisionRecordListItem[] }
  | { readonly status: 'guest' }
  | { readonly status: 'error'; readonly code: string }

const optString = (v: unknown): v is string | undefined => v === undefined || typeof v === 'string'

/** One row, read defensively: a row missing its identity, dates or position, or mistyped, is dropped, never guessed. */
export function readDecisionRecordListItem(raw: unknown): DecisionRecordListItem | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.record_id !== 'string' || r.record_id === '') return null
  if (typeof r.created_at !== 'string' || !Number.isFinite(Date.parse(r.created_at))) return null
  if (typeof r.review_date !== 'string') return null
  if (r.position !== 'chosen' && r.position !== 'not_ready') return null
  if (r.position === 'chosen' && (typeof r.chosen_option_id !== 'string' || r.chosen_option_id === ''
    || typeof r.chosen_option_label !== 'string'
    || typeof r.confidence_0_100 !== 'number' || !Number.isFinite(r.confidence_0_100))) return null
  for (const key of ['expectation_statement', 'rationale', 'key_assumption', 'revisit_trigger', 'next_action']) {
    if (!optString(r[key])) return null
  }
  return r as unknown as DecisionRecordListItem
}

export async function listDecisionRecords(scenarioId: string): Promise<DecisionRecordListResult> {
  let identity: Awaited<ReturnType<typeof getSessionIdentity>>
  try { identity = await getSessionIdentity() } catch { return { status: 'error', code: 'identity_unavailable' } }
  const { userId, accessToken } = identity
  if (!userId || !accessToken) return { status: 'guest' }
  let response: Response
  try {
    response = await fetch(`${CEE_BFF_BASE}${DECISION_RECORD_LIST_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ scenario_id: scenarioId }),
    })
  } catch { return { status: 'error', code: 'network_error' } }
  const body = (await response.json().catch(() => null)) as { records?: unknown; code?: unknown } | null
  if (!response.ok) return { status: 'error', code: typeof body?.code === 'string' ? body.code : `http_${response.status}` }
  if (body === null || !Array.isArray(body.records)) return { status: 'error', code: 'malformed_response' }
  const records = body.records.map(readDecisionRecordListItem).filter((r): r is DecisionRecordListItem => r !== null)
  return { status: 'ok', ownerId: userId, records }
}

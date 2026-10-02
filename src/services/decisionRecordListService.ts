/**
 * ⭐ DECIDE & REVIEW S1 (MG lease #85 5948537951): READ BACK a signed-in user's own decision records from CEE
 * (`POST /assist/v1/decision-records/list`, through the same `/bff/cee` seam as the commit).
 *
 * Until now a committed decision came back only from the browser that wrote it (`decisionRecordStore`, localStorage):
 * another device, another browser, or cleared storage showed nothing. CEE answers ONLY the scenario owner's
 * user-authored records (never the Run auto-capture's), and the same 404 for an absent scenario and someone else's.
 *
 * Never throws. A guest has no server records by design (CEE's DR001), so the call is not made.
 */
import { getSessionIdentity } from '../lib/supabase'
import {
  DECISION_RECORD_TEXT_FIELDS,
  type DecisionRecord,
  type DecisionRecordTextField,
} from '../components/results/modals/decisionRecordStore'

/** Same-origin Netlify edge seam for CEE-served routes (see `decisionRecordCommitService.ts`). */
const CEE_BFF_BASE = '/bff/cee'
/** Path under the seam. The edge rewrites `/bff/cee/x` → `/assist/v1/x`. */
export const DECISION_RECORD_LIST_PATH = '/decision-records/list'

export type DecisionRecordListResult =
  | { readonly status: 'ok'; readonly ownerId: string; readonly records: readonly DecisionRecord[] }
  | { readonly status: 'guest' }
  | { readonly status: 'error'; readonly code: string }

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/**
 * One listed record → the store's own record shape, or null when anything it would show is missing or out of range
 * (never half-true). Every text the server returned is, by construction, ON THE ACCOUNT, so it is named in
 * `storedTextFields` — the one licence `DecisionRecorded` reads before saying "on your account".
 */
export function readListedRecord(raw: unknown): DecisionRecord | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (!nonEmpty(r.record_id) || !nonEmpty(r.review_date) || !nonEmpty(r.created_at)) return null
  const savedAt = Date.parse(r.created_at)
  if (!Number.isFinite(savedAt)) return null
  const stored: DecisionRecordTextField[] = DECISION_RECORD_TEXT_FIELDS.filter((f) => nonEmpty(r[f]))
  const text = (f: DecisionRecordTextField): string => (nonEmpty(r[f]) ? r[f] : '')
  const common = {
    rationale: text('rationale'),
    assumptionToWatch: text('key_assumption'),
    revisitTrigger: text('revisit_trigger'),
    ...(nonEmpty(r.next_action) ? { nextAction: r.next_action } : {}),
    // `results.hash` at capture time is a device-side value; the server anchors to a GRAPH hash instead — a
    // different family, so it is never put here.
    analysisHash: null,
    savedAt,
    remote: {
      recordId: r.record_id,
      reviewDate: r.review_date,
      // CEE never stored which rung set the date; no surface reads it, and it is not invented here.
      reviewDateSource: 'read_back' as const,
      storedTextFields: stored,
    },
  }
  if (r.position === 'not_ready') return { ...common, position: 'not_ready' }
  if (r.position !== 'chosen') return null
  const confidence = r.confidence_0_100
  if (!nonEmpty(r.chosen_option_id) || !nonEmpty(r.chosen_option_label)) return null
  if (typeof confidence !== 'number' || !Number.isInteger(confidence) || confidence < 0 || confidence > 100) return null
  return {
    ...common,
    optionId: r.chosen_option_id,
    optionLabel: r.chosen_option_label,
    optionNumber: null,
    confidence,
    ...(nonEmpty(r.expectation_statement) ? { expectation: r.expectation_statement } : {}),
  }
}

export async function listDecisionRecords(scenarioId: string): Promise<DecisionRecordListResult> {
  let identity: Awaited<ReturnType<typeof getSessionIdentity>>
  try { identity = await getSessionIdentity() }
  catch { return { status: 'error', code: 'identity_unavailable' } }
  const { userId, accessToken } = identity
  if (!accessToken || !userId) return { status: 'guest' }

  let response: Response
  try {
    response = await fetch(`${CEE_BFF_BASE}${DECISION_RECORD_LIST_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ scenario_id: scenarioId }),
    })
  } catch {
    return { status: 'error', code: 'network_error' }
  }
  const body = (await response.json().catch(() => ({}))) as { code?: unknown; records?: unknown }
  if (!response.ok) return { status: 'error', code: typeof body.code === 'string' ? body.code : `http_${response.status}` }
  const records = Array.isArray(body.records)
    ? body.records.map(readListedRecord).filter((x): x is DecisionRecord => x !== null)
    : []
  return { status: 'ok', ownerId: userId, records }
}

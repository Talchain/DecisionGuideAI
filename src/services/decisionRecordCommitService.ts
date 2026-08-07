/**
 * Decision-record COMMIT — the durable half of "Record the decision"
 * (calibration R0, ROADMAP 2.727).
 *
 * The modal has been eliciting the user's chosen option, their confidence and
 * a revisit trigger since it shipped — and throwing all of it into
 * `sessionStorage`, where it dies with the browser session. This module is
 * the one thing standing between that and a durable, personal calibration
 * record: it POSTs the commit to CEE, which owns the write.
 *
 * ⚠ THE BASE IS A LITERAL, AND THAT IS LOAD-BEARING. `import.meta.env.VITE_*`
 * is inlined by Vite at TRANSFORM time, so an env-resolved base reads correct
 * in every vitest run and can still ship pointed at the wrong origin — that is
 * exactly how `elicitBelief` shipped dark for a day (see `adapters/cee/
 * client.ts`'s corrected header, ROADMAP 2.710), and how 2.387 shipped dark
 * before it. `/bff/cee` is owned by `netlify/edge-functions/cee-proxy.ts`,
 * which rewrites the prefix to `/assist/v1` and injects `X-Olumi-Assist-Key`
 * server-side; `vite.config.ts` proxies the same prefix in dev. The
 * co-located spec DERIVES this constant's expected value from `netlify.toml`'s
 * `cee-proxy` binding rather than restating it.
 *
 * ⚠ THE `Authorization` HEADER IS THE USER TOKEN, NOT A SERVICE CREDENTIAL.
 * The edge function forwards `authorization` verbatim as the user-token slot
 * and sets `X-Olumi-Assist-Key` separately, so the two never collide. No
 * bearer from this client is ever a PLoT credential — this base is
 * same-origin, and same-origin `/bff/*` seams get their credential injected
 * server-side.
 *
 * WHAT THIS MODULE DOES NOT DO: arithmetic on probabilities. The user's
 * confidence goes over the wire as the RAW 0–100 number they typed, and CEE
 * normalises it to the contract's [0,1] server-side. A UI that divides by 100
 * is a second place the scale can drift.
 */
import { getSessionIdentity } from '../lib/supabase'

/** Same-origin Netlify edge seam for CEE-served routes. A LITERAL — see header. */
const CEE_BFF_BASE = '/bff/cee'

/** Path under the seam. The edge rewrites `/bff/cee/x` → `/assist/v1/x`. */
export const DECISION_RECORD_COMMIT_PATH = '/decision-records/commit'

/** Which rung of CEE's review-date ladder produced the stored `review_date`. */
export type ReviewDateSource =
  | 'user_set'
  | 'default_horizon'
  | 'default_horizon_after_unparsed_trigger'

export interface DecisionRecordCommitInput {
  scenarioId: string
  chosenOptionId: string
  chosenOptionLabel: string
  /** RAW 0–100, exactly as the user typed it. Normalised server-side. */
  confidence0to100: number
  /** The user's forward-looking claim — the thing the outcome is scored against. */
  expectationStatement: string
  /** The modal's free-text "Revisit trigger or date", verbatim. */
  revisitTriggerOrDate?: string
  /**
   * Stable per-save id. Makes a network retry replay through CEE's dedupe
   * branch instead of writing a second record; a NEW save gets a NEW id, so a
   * genuinely different commit is never swallowed.
   */
  clientCommitId: string
}

export type DecisionRecordCommitResult =
  | {
      readonly status: 'saved'
      readonly recordId: string
      readonly reviewDate: string
      readonly reviewDateSource: ReviewDateSource
      /** true when CEE replayed an existing record rather than writing a new one. */
      readonly deduped: boolean
    }
  /** Not signed in — the record stays honestly local. Guests have no records by design. */
  | { readonly status: 'guest' }
  | { readonly status: 'error'; readonly code: string; readonly message: string }

interface CommitResponseBody {
  record_id?: unknown
  review_date?: unknown
  review_date_source?: unknown
  deduped?: unknown
  code?: unknown
  message?: unknown
}

const REVIEW_DATE_SOURCES: readonly ReviewDateSource[] = [
  'user_set',
  'default_horizon',
  'default_horizon_after_unparsed_trigger',
]

function readReviewDateSource(raw: unknown): ReviewDateSource {
  return typeof raw === 'string' && (REVIEW_DATE_SOURCES as readonly string[]).includes(raw)
    ? (raw as ReviewDateSource)
    : // An unrecognised rung is reported as the DEFAULT rung, never as
      // `user_set`: claiming the user set a date they did not set is the one
      // direction of this error that misleads.
      'default_horizon'
}

/**
 * Commit the decision durably. Never throws — the caller keeps its local copy
 * either way, so a failure degrades the record from "durable" to "on this
 * device", never to "lost".
 */
export async function commitDecisionRecord(
  input: DecisionRecordCommitInput,
): Promise<DecisionRecordCommitResult> {
  const { accessToken } = await getSessionIdentity()
  if (!accessToken) {
    // Guests genuinely have no records: CEE's RPC refuses an unowned scenario
    // with DR001 by design. Saying "guest" here, rather than attempting the
    // call and reporting an error, keeps the modal's copy honest.
    return { status: 'guest' }
  }

  let response: Response
  try {
    response = await fetch(`${CEE_BFF_BASE}${DECISION_RECORD_COMMIT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        scenario_id: input.scenarioId,
        chosen_option_id: input.chosenOptionId,
        chosen_option_label: input.chosenOptionLabel,
        // RAW 0–100 — the server owns the /100. See the module header.
        confidence_0_100: input.confidence0to100,
        expectation_statement: input.expectationStatement,
        ...(input.revisitTriggerOrDate !== undefined && input.revisitTriggerOrDate !== ''
          ? { revisit_trigger_or_date: input.revisitTriggerOrDate }
          : {}),
        client_commit_id: input.clientCommitId,
      }),
    })
  } catch (err) {
    return {
      status: 'error',
      code: 'network_error',
      message: err instanceof Error ? err.message : 'Network error',
    }
  }

  const body = (await response.json().catch(() => ({}))) as CommitResponseBody

  if (!response.ok) {
    return {
      status: 'error',
      code: typeof body.code === 'string' ? body.code : `http_${response.status}`,
      message:
        typeof body.message === 'string'
          ? body.message
          : 'We could not save this decision to your account.',
    }
  }

  if (typeof body.record_id !== 'string' || body.record_id === '') {
    // A 2xx with no record id is not a save. Reporting it as one would be the
    // exact "we saved it" claim this slice exists to make true.
    return {
      status: 'error',
      code: 'malformed_response',
      message: 'We could not confirm this decision was saved.',
    }
  }

  return {
    status: 'saved',
    recordId: body.record_id,
    reviewDate: typeof body.review_date === 'string' ? body.review_date : '',
    reviewDateSource: readReviewDateSource(body.review_date_source),
    deduped: body.deduped === true,
  }
}

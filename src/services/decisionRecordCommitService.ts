/**
 * Decision-record COMMIT — the durable half of "Record the decision"
 * (calibration R0, ROADMAP 2.727).
 *
 * The modal has been eliciting the user's chosen option, their confidence and
 * a revisit trigger since it shipped — and throwing all of it into a BROWSER
 * store, which does not follow the user to another machine, another browser or
 * a private window. This module is the one thing standing between that and a
 * durable, personal calibration record: it POSTs the commit to CEE, which owns
 * the write.
 *
 * ⚠ THE BROWSER STORE IS `localStorage`. Superseded text: ~~throwing all of it
 * into `sessionStorage`, where it dies with the browser session~~.
 * `decisionRecordStore` moved on 7 Sep 2026, so a local record now survives
 * the tab closing and "dies with the browser session" is no longer true. The
 * argument for this module is unchanged and never rested on that clause — a
 * per-device store is not a durable personal record however long it lives —
 * but a stale sentence in the header of the file that answers "why does this
 * exist?" is how the next reader inherits a wrong lifetime (CLAUDE.md trap 12).
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

/**
 * Upper bounds for the text the commit sends, matching the request shape the
 * CEE change implements (24 Sep 2026). The modal applies them as `maxLength`
 * so a user never builds a record the new route would refuse whole.
 */
export const DECISION_RECORD_TEXT_MAX_CHARS = 2000
export const DECISION_RECORD_NEXT_ACTION_MAX_CHARS = 500

/**
 * Fields sent whatever the position.
 *
 * ⚠ ADDITIVE KEYS, AND WHAT TODAY'S CEE DOES WITH THEM. `rationale`,
 * `key_assumption`, `next_action` and `position` are new request keys. The
 * deployed route (`assist.v1.decision-records.ts`, staging `3f412be1`) reads
 * the body key by key with `readString` and has no request schema, so it
 * IGNORES keys it does not read: an option commit that carries them is written
 * exactly as before. Its `.strict()` schemas apply to the write it BUILDS, not
 * to the request. It does not persist the text, and no response field says
 * whether an account kept it, so nothing here licenses an account claim for
 * the text (see `decisionRecordStore`'s header).
 *
 * ⚠ THE REVISIT TEXT ALREADY HAS A KEY. `revisit_trigger_or_date` has carried
 * the modal's revisit text verbatim since R0 (CEE parses it for a date and
 * drops the words). It is the existing convention, so there is no second
 * `revisit_trigger` key carrying the same words: a server that wants to keep
 * the text reads `revisit_trigger_or_date`.
 */
interface DecisionRecordCommitCommon {
  scenarioId: string
  /** The modal's free-text "Revisit trigger or date", verbatim. */
  revisitTriggerOrDate?: string
  /** Why the user holds this position. Sent as `rationale` when non-blank. */
  rationale?: string
  /** The assumption to watch. Sent as `key_assumption` when non-blank. */
  keyAssumption?: string
  /** What the user will do next. Sent as `next_action` when non-blank. */
  nextAction?: string
  /**
   * Stable per-save id. Makes a network retry replay through CEE's dedupe
   * branch instead of writing a second record; a NEW save gets a NEW id, so a
   * genuinely different commit is never swallowed.
   */
  clientCommitId: string
  /** Capture-time principal, checked again after asynchronous token retrieval. */
  expectedOwnerId: string | null
  /** Local consent/capture fence; never serialised into the request. */
  isCurrentCapture: () => boolean
}

/** The user chose an option. No `position` key is sent: absent means `'option'`. */
export interface OptionCommitInput extends DecisionRecordCommitCommon {
  position?: 'option'
  chosenOptionId: string
  chosenOptionLabel: string
  /** RAW 0–100, exactly as the user typed it. Normalised server-side. */
  confidence0to100: number
  /** The user's forward-looking claim — the thing the outcome is scored against. */
  expectationStatement: string
}

/**
 * "Not ready to choose". Sends `position: 'not_ready'` and NO option,
 * confidence or expectation — there is no choice for them to be about.
 *
 * ⚠ TODAY'S CEE REFUSES THIS COMMIT, AND THAT IS SAFE. Its route still requires
 * a confidence, an option and an expectation, so it answers 400
 * `invalid_confidence` before any write ("NO RPC CALL on a refusal"). The
 * caller already holds the local copy and reports the save as not confirmed.
 * Once CEE accepts the position, the same request is written with no UI change.
 */
export interface NotReadyCommitInput extends DecisionRecordCommitCommon {
  position: 'not_ready'
}

export type DecisionRecordCommitInput = OptionCommitInput | NotReadyCommitInput

/** `{ [key]: value }` for a non-blank string, `{}` otherwise — a blank is never sent. */
function textKey(key: string, value: string | undefined): Record<string, string> {
  return value !== undefined && value.trim() !== '' ? { [key]: value } : {}
}

/**
 * The request body, in a FIXED key order. For an option commit with none of
 * the new fields it is byte-identical to the pre-24-Sep body; the new keys are
 * appended after `client_commit_id` and only when they hold text.
 */
export function buildDecisionRecordCommitBody(input: DecisionRecordCommitInput): Record<string, unknown> {
  const added = {
    ...textKey('rationale', input.rationale),
    ...textKey('key_assumption', input.keyAssumption),
    ...textKey('next_action', input.nextAction),
  }
  if (input.position === 'not_ready') {
    return {
      scenario_id: input.scenarioId,
      position: 'not_ready',
      ...(input.revisitTriggerOrDate !== undefined && input.revisitTriggerOrDate !== ''
        ? { revisit_trigger_or_date: input.revisitTriggerOrDate }
        : {}),
      client_commit_id: input.clientCommitId,
      ...added,
    }
  }
  return {
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
    ...added,
  }
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
  let identity: Awaited<ReturnType<typeof getSessionIdentity>>
  try { identity = await getSessionIdentity() }
  catch {
    return { status: 'error', code: 'identity_unavailable', message: 'We could not confirm the account for this save.' }
  }
  const { userId, accessToken } = identity
  // Awaiting a token can cross an account change or a newer capture. Check
  // both before dispatch; response-only checks cannot undo sending old text.
  if (userId !== input.expectedOwnerId || !input.isCurrentCapture()) {
    return { status: 'error', code: 'capture_changed', message: 'The account or record changed before this save.' }
  }
  if (!accessToken || !userId) {
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
      body: JSON.stringify(buildDecisionRecordCommitBody(input)),
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

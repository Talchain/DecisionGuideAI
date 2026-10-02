/**
 * ACCOUNTS B3 — ask CEE to copy a guest decision into the signed-in account.
 *
 * Contract (frozen, CEE #2493 `src/routes/assist.v1.scenario-copy.ts`):
 * `POST /bff/cee/scenarios/:id/copy` (the edge rewrites it to `/assist/v1/...`),
 * `Authorization: Bearer <supabase access token>`, no body. The owner of the copy
 * is the token's verified `sub`; nothing in this request names a user.
 *
 * | Status | Body                                 | Outcome here     |
 * |--------|--------------------------------------|------------------|
 * | 200    | `{ scenario_id, created }`           | `copied`         |
 * | 404    | `{ code: 'scenario_not_copyable' }`  | `not_copyable`   |
 * | other  | 401 / 429 / 503 / network / anything | `retry_later`    |
 *
 * ⚠ ONLY THE NAMED 404 IS TERMINAL. A 404 without that code is NOT the copy
 * route answering: it is the edge allow-list or a CEE deploy that does not
 * serve the route yet. Treating it as terminal would make the caller forget the
 * guest id, and the guest's work would never reach the account.
 *
 * Never throws.
 */

/** Same-origin, credential-injecting seam (ROADMAP 2.710): a literal, never an env-resolved base. */
const CEE_BFF_BASE = '/bff/cee'

/** The one terminal refusal the copy route sends, for every reason it refuses a source. */
export const NOT_COPYABLE_CODE = 'scenario_not_copyable'

/** Bounded so a hung edge cannot hold a sign-in side effect open indefinitely. */
export const GUEST_COPY_TIMEOUT_MS = 15_000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type GuestCopyOutcome =
  | { kind: 'copied'; scenarioId: string; created: boolean }
  | { kind: 'not_copyable' }
  | { kind: 'retry_later'; reason: string }

export function guestCopyUrl(sourceScenarioId: string): string {
  return `${CEE_BFF_BASE}/scenarios/${encodeURIComponent(sourceScenarioId)}/copy`
}

export async function requestGuestCopy(
  sourceScenarioId: string,
  accessToken: string,
): Promise<GuestCopyOutcome> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  // The deadline covers the BODY too: a stalled body would otherwise hold the
  // run (and the module-wide in-flight slot) open with no timer left.
  const timer = controller ? setTimeout(() => controller.abort(), GUEST_COPY_TIMEOUT_MS) : null

  let response: Response
  let body: Record<string, unknown> | null
  try {
    response = await fetch(guestCopyUrl(sourceScenarioId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller?.signal,
    })
    body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  } catch (err) {
    return { kind: 'retry_later', reason: err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network_error' }
  } finally {
    if (timer) clearTimeout(timer)
  }
  if (controller?.signal.aborted) return { kind: 'retry_later', reason: 'timeout' }

  if (response.status === 200) {
    const scenarioId = body?.scenario_id
    // A 2xx that does not name a DIFFERENT well-formed scenario, with a boolean
    // `created`, is not a copy. Forgetting the guest id on it would lose the work.
    const wellFormed =
      typeof scenarioId === 'string' &&
      UUID_RE.test(scenarioId) &&
      scenarioId.toLowerCase() !== sourceScenarioId.toLowerCase() &&
      typeof body?.created === 'boolean'
    if (!wellFormed) return { kind: 'retry_later', reason: 'malformed_response' }
    return { kind: 'copied', scenarioId: scenarioId as string, created: body?.created === true }
  }

  if (response.status === 404 && body?.code === NOT_COPYABLE_CODE) {
    return { kind: 'not_copyable' }
  }

  return { kind: 'retry_later', reason: typeof body?.code === 'string' ? body.code : `http_${response.status}` }
}

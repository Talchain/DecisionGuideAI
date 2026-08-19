/**
 * COLLAB — the browser's only path to the panel routes.
 *
 * Everything goes to the same-origin `/bff/collab/*` seam, which
 * `netlify/edge-functions/collab-proxy.ts` rewrites to CEE `/collab/v1/*` and
 * where the caller-auth key is injected server-side. The key never enters this
 * bundle.
 *
 * ── TWO CREDENTIALS, TWO AUDIENCES, NEVER MIXED ───────────────────────────
 * • PARTICIPANT calls carry `x-collab-participant-token` — a per-round bearer
 *   capability held in memory only (`participantToken.ts`).
 * • OWNER calls carry `Authorization: Bearer <supabase access token>`.
 * A participant token is worthless on an owner route and vice versa; CEE checks
 * each independently, and neither is ever put in a URL.
 *
 * ⚠ THE TOKEN TRAVELS AS A HEADER, NEVER AS A QUERY PARAMETER. A query
 * parameter would land in `location.href` captures, proxy access logs and any
 * error report carrying a URL — the exact class of leak the boot-path strip
 * exists to close.
 */

import { getParticipantToken } from './participantToken'

/** Same-origin seam. A literal, so nothing can rewrite it to another host. */
const COLLAB_BASE = '/bff/collab'

export interface PacketTarget {
  target: { kind: 'factor' | 'edge'; id: string }
  label: string
  description: string | null
  unit: string | null
}

/**
 * The blind packet. NOTE WHAT IS NOT HERE: no sibling answers, no model value,
 * no response count, no roster. That absence is the feature, and it is enforced
 * server-side — this type simply refuses to describe anything else.
 */
export interface OpenPacket {
  round_id: string
  status: 'open'
  context_note: string | null
  graph_version_ref: string
  targets: PacketTarget[]
  self: {
    participant_id: string
    display_name: string
    completed_target_ids: string[]
  }
}

export interface RevealResponse {
  participant_id: string
  display_label: string
  value: number | null
  expression_raw: string | null
  confidence: number | null
  kind: string
}

export interface RevealView {
  round_id: string
  status: string
  graph_version_ref: string
  per_target: Array<{
    target: { kind: 'factor' | 'edge'; id: string }
    /** The words the panel was actually asked about — see the CEE type. */
    label: string
    model_value_at_version: number | null
    responses: RevealResponse[]
  }>
}

/**
 * The owner's roster view of a round (CEE `OpenPacketLikePreview`).
 *
 * ⚠ `display_name` HERE IS ALREADY R-2 RESOLVED. CEE projects it as
 * `p.pseudonym ?? p.display_name` (`collab/rounds-service.ts:217`), so a
 * redacted participant arrives pseudonymised and no client needs to know the
 * rule. That is precisely why render-time name resolution reads THIS and not
 * `openRoundRecord`'s `localStorage` copy, which a later redaction cannot reach.
 *
 * `targets` is declared because the route sends it, not because this UI uses it
 * — an undeclared field on a response type is how a reader concludes the server
 * does not send one.
 */
export interface RoundRosterView {
  round_id: string
  status: string
  targets: PacketTarget[]
  roster: Array<{
    participant_id: string
    display_name: string
    status: string
  }>
}

/* ── the disagreement view (CEE `DisagreementView`) ──────────────────────── */

export type DivergenceShape = 'no_answers' | 'single_view' | 'aligned' | 'split'
export type EvidenceStance = 'supports' | 'challenges' | 'qualifies'

export interface DisagreementPosition {
  participant_id: string
  display_label: string
  value: number | null
  /** The person's own words for why. Verbatim — render as given. */
  stated_basis: string | null
  confidence: number | null
  kind: string
  /** An end of the range, or null. NOT a ranking — ties are both marked. */
  pole: 'low' | 'high' | null
}

export interface DisagreementEvidence {
  event_id: string
  /** The SERVER stamp. Never rendered from a client-held id. */
  authored_by: string
  author_label: string
  stance: EvidenceStance
  /** The fixed word for the stance, chosen by CEE, never by this bundle. */
  stance_phrase: string
  kind: 'note' | 'link'
  body: string
  /** http/https only — validated and normalised server-side at append time. */
  url: string | null
  about_participant_id: string | null
  about_label: string | null
  created_at: string
}

export interface DisagreementTarget {
  target: { kind: 'factor' | 'edge'; id: string }
  label: string
  model_value_at_version: number | null
  shape: DivergenceShape
  answering_participants: number
  distinct_values: number
  /** Range endpoints. ⚠ NOT an aggregate — see the CEE type. */
  spread: { low: number; high: number; width: number } | null
  positions: DisagreementPosition[]
  positions_with_stated_basis: number
  evidence: DisagreementEvidence[]
  /**
   * ⭐ CODE-OWNED COPY, AUTHORED IN CEE. This bundle RENDERS these strings and
   * must never compose its own version of them: the sentences are pinned by a
   * CEE suite that asserts, over every string the module can emit, that none of
   * them resolves the disagreement. A UI that rewrote them locally would sit
   * outside that guarantee, and nothing here would notice.
   */
  headline: string
  question: string | null
}

export interface DisagreementView {
  round_id: string
  graph_version_ref: string
  /**
   * ⭐ CEE'S STANDING SENTENCE about what this surface is, served rather than
   * worded here — same rule as `headline` and `question`, and for the same
   * reason: the copy guard lives in CEE, so a sentence composed in this bundle
   * sits outside it. This one WAS composed here until the mount landed.
   *
   * ⚠ `null` IS A REAL STATE AND IS NOT AN ERROR. The two services deploy
   * independently, so a UI that ships ahead of its CEE will receive a payload
   * with no such member. The honest rendering of an absent sentence is no
   * sentence — never a local fallback, which would silently reinstate exactly
   * the second authority this field exists to remove.
   */
  standing_note: string | null
  per_target: DisagreementTarget[]
}

export interface CollabError {
  code: string
  message: string
  status: number
}

export class CollabRequestError extends Error {
  readonly code: string
  readonly status: number
  constructor(err: CollabError) {
    super(err.message)
    this.name = 'CollabRequestError'
    this.code = err.code
    this.status = err.status
  }
}

async function parseError(res: Response): Promise<CollabRequestError> {
  let code = 'collab_request_failed'
  let message = 'Something went wrong. Please try again.'
  try {
    const body = (await res.json()) as { code?: string; message?: string }
    if (typeof body.code === 'string') code = body.code
    if (typeof body.message === 'string') message = body.message
  } catch {
    /* a non-JSON body stays on the defaults */
  }
  return new CollabRequestError({ code, message, status: res.status })
}

function participantHeaders(): HeadersInit {
  const token = getParticipantToken()
  if (token === null) {
    throw new CollabRequestError({
      code: 'collab_token_invalid',
      message: 'This link is missing its access code. Open the original link again.',
      status: 401,
    })
  }
  return { 'x-collab-participant-token': token }
}

/* ── participant ─────────────────────────────────────────────────────────── */

export async function fetchOpenPacket(roundId: string): Promise<OpenPacket> {
  const res = await fetch(`${COLLAB_BASE}/packet/${encodeURIComponent(roundId)}`, {
    method: 'GET',
    headers: participantHeaders(),
  })
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as OpenPacket
}

export async function submitBelief(
  roundId: string,
  args: {
    targetId: string
    targetKind: 'factor' | 'edge'
    value: number
    expressionRaw: string | null
    confidence: number | null
    revision: boolean
  },
): Promise<{ authored_by: string; event_id: string }> {
  const res = await fetch(`${COLLAB_BASE}/packet/${encodeURIComponent(roundId)}/events`, {
    method: 'POST',
    headers: { ...participantHeaders(), 'Content-Type': 'application/json' },
    // ⚠ NO provenance member. The server stamps `authored_by` from the token;
    // a payload that offered one would be REFUSED, not ignored.
    body: JSON.stringify({
      kind: args.revision ? 'belief_revised' : 'belief_submitted',
      target: { kind: args.targetKind, id: args.targetId },
      belief: {
        value: args.value,
        // The participant's own words, verbatim — this is what makes the reveal
        // a record of reasoning rather than a row of numbers.
        expression_raw: args.expressionRaw,
        confidence: args.confidence,
      },
    }),
  })
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as { authored_by: string; event_id: string }
}

export async function declineTarget(
  roundId: string,
  args: { targetId: string; targetKind: 'factor' | 'edge' },
): Promise<void> {
  const res = await fetch(`${COLLAB_BASE}/packet/${encodeURIComponent(roundId)}/events`, {
    method: 'POST',
    headers: { ...participantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'declined',
      target: { kind: args.targetKind, id: args.targetId },
      belief: null,
    }),
  })
  if (!res.ok) throw await parseError(res)
}

export async function fetchParticipantReveal(roundId: string): Promise<RevealView> {
  const res = await fetch(`${COLLAB_BASE}/packet/${encodeURIComponent(roundId)}/reveal`, {
    method: 'GET',
    headers: participantHeaders(),
  })
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as RevealView
}

/**
 * Attach evidence to a position.
 *
 * ⚠ SAME ENDPOINT AS A BELIEF, BY DESIGN — see the CEE route header. Evidence is
 * a participant appending an attributed, round-scoped, target-bound row, with
 * the same authorisation and the same blindness properties as an answer, so it
 * comes through the one door rather than a second one that would need its own
 * copy of the token check.
 *
 * ⚠ NO provenance member, exactly like `submitBelief`. The server stamps
 * `authored_by` from the token; a payload that offered one would be REFUSED,
 * not ignored, so a client cannot quietly believe it controls attribution.
 */
export async function attachEvidence(
  roundId: string,
  args: {
    targetId: string
    targetKind: 'factor' | 'edge'
    kind: 'note' | 'link'
    /** The participant's own words. Sent verbatim. */
    body: string
    /** http/https only. CEE refuses anything else and normalises what it keeps. */
    url: string | null
    stance: EvidenceStance
    /** Whose position this speaks to, or null for the target at large. */
    aboutParticipantId: string | null
  },
): Promise<{ authored_by: string; event_id: string }> {
  const res = await fetch(`${COLLAB_BASE}/packet/${encodeURIComponent(roundId)}/events`, {
    method: 'POST',
    headers: { ...participantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'evidence_attached',
      target: { kind: args.targetKind, id: args.targetId },
      belief: null,
      evidence: {
        kind: args.kind,
        body: args.body,
        url: args.url,
        stance: args.stance,
        about_participant_id: args.aboutParticipantId,
      },
    }),
  })
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as { authored_by: string; event_id: string }
}

export async function fetchParticipantDisagreement(roundId: string): Promise<DisagreementView> {
  const res = await fetch(`${COLLAB_BASE}/packet/${encodeURIComponent(roundId)}/disagreement`, {
    method: 'GET',
    headers: participantHeaders(),
  })
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as DisagreementView
}

/* ── owner ───────────────────────────────────────────────────────────────── */

/**
 * ⭐⭐ TWO QUESTIONS, TWO NAMES — and they were ONE name until 17 Aug 2026.
 *
 * A credential refusal on the owner path has two producers, answering different
 * questions, and for a while both minted `sign_in_required` at status 401:
 *
 *   • `ownerNotSignedIn()` — "does this browser hold a credential to send?"
 *     Answered HERE, locally, before any request leaves. When the answer is no,
 *     the client has observed NOTHING about whether a session ever existed.
 *   • `ownerSignInRequired()` — "did the server accept the credential we sent?"
 *     Answered by the WIRE (401 from CEE's `requireOwnerUser`). Reaching it
 *     proves a non-empty bearer WAS sent and refused.
 *
 * Because both carried one code, `PanelSetupPage` could not tell them apart and
 * told a visitor with NO ACCOUNT "Your session has ended" — browser-witnessed
 * on deployed `81b5c966` with `S4.network.json === []`, i.e. zero requests, so
 * no server had said anything about any session. Naming the concepts apart is
 * the fix; aligning the copy would only have picked which half to lie to.
 *
 * ⚠ `status: 401` on the local mint is the status this refusal CORRESPONDS to,
 * never an observation — no response was received. Discriminate on the CODE.
 */
export function ownerNotSignedIn(): CollabRequestError {
  return new CollabRequestError({
    code: 'not_signed_in',
    message: 'Sign in to open or close a round.',
    status: 401,
  })
}

/**
 * The WIRE's credential refusal, described in one place so every path a user can
 * hit says the same sentence. `PanelSetupPage` renders `.message` verbatim.
 *
 * ⚠ NOT the local mint — see `ownerNotSignedIn()` above. "Sign in AGAIN" is a
 * claim about a session that existed, and it is true only once the server has
 * declined a bearer this browser actually sent.
 */
export function ownerSignInRequired(): CollabRequestError {
  return new CollabRequestError({
    code: 'sign_in_required',
    message: 'Sign in again to open or close a round.',
    status: 401,
  })
}

/**
 * ⚠ THE CHOKE POINT. Every owner request's Authorization value is built here,
 * and an empty token STOPS THE REQUEST rather than sending `Bearer `.
 *
 * This is not belt-and-braces. `Bearer ` is not a weak credential — at CEE it
 * is INDISTINGUISHABLE from sending no header at all (both answer 401
 * `sign_in_required`), so a caller that produces one gets a server error that
 * reads exactly like "you are signed out" and tells nobody that the browser
 * never had a token to send. That is precisely how this shipped: the page's
 * `?? ''` turned an absent field into a value the type system was happy with,
 * and the failure surfaced three hops away as an ordinary 401.
 *
 * ⚠ SCOPE OF THAT PROTECTION, STATED HONESTLY. This function is the only
 * builder of an owner `Bearer` TODAY, and two ratchets in
 * `__tests__/panelSetupOwnerAuth.spec.tsx` keep it that way at rest: the collab
 * base `/bff/collab` is referenced from this file and nowhere else in `src/`,
 * so a new caller cannot reach the seam without coming through here; and this
 * file constructs exactly one `Bearer` value. Nothing in the LANGUAGE enforces
 * it — the guarantee is the pair of ratchets, and it is only as good as they
 * are. An earlier version of this comment claimed the property was structural
 * ("no other way to build an owner header"); it was not, and nothing enforced
 * it at all until those ratchets existed.
 */
function ownerAuthorization(accessToken: string): string {
  // ⚠ `ownerNotSignedIn`, NOT `ownerSignInRequired`: nothing has been sent, so
  // nothing has been declined. This throw is the client refusing to send an
  // empty bearer — it is not a report of anything the server said.
  if (accessToken.trim() === '') throw ownerNotSignedIn()
  return `Bearer ${accessToken}`
}

function ownerHeaders(accessToken: string): HeadersInit {
  return { Authorization: ownerAuthorization(accessToken), 'Content-Type': 'application/json' }
}

export interface MintedRound {
  round_id: string
  graph_version_ref: string
  participants: Array<{
    participant_id: string
    display_name: string
    /**
     * The DURABLE workspace identity CEE stamped for this panellist — reused if
     * the owner picked an existing person, freshly minted otherwise. Returned so
     * the next round can offer this person for reuse without a round trip.
     */
    person_id: string
    token: string
  }>
}

/** One person who has been on a panel in this scenario. */
export interface WorkspacePerson {
  person_id: string
  display_name: string
  round_count: number
  last_seen_at: string
}

export async function mintRound(
  accessToken: string,
  args: {
    scenarioId: string
    contextNote: string | null
    targets: PacketTarget[]
    /**
     * ⚠ `person_id` PRESENT means "this IS that person" — an owner's explicit
     * claim, validated by CEE against this scenario. ABSENT means "someone new"
     * and mints a fresh identity.
     *
     * ⚠ NEVER send a person id the owner did not actually choose from the
     * roster. The server refuses an unknown one rather than minting silently,
     * but a client that guessed by matching names would be asking the server to
     * put one person's words under another person's name — the one failure this
     * whole seam is shaped to prevent.
     */
    participants: Array<{ display_name: string; person_id?: string }>
  },
): Promise<MintedRound> {
  const res = await fetch(`${COLLAB_BASE}/rounds`, {
    method: 'POST',
    headers: ownerHeaders(accessToken),
    body: JSON.stringify({
      scenario_id: args.scenarioId,
      context_note: args.contextNote,
      targets: args.targets,
      participants: args.participants,
    }),
  })
  if (!res.ok) throw await parseError(res)
  // ⚠ The raw participant tokens are in THIS response and nowhere else, ever.
  // The caller shows them once so the owner can send the links, and must not
  // persist them.
  return (await res.json()) as MintedRound
}

export async function closeRound(accessToken: string, roundId: string): Promise<void> {
  const res = await fetch(`${COLLAB_BASE}/rounds/${encodeURIComponent(roundId)}/close`, {
    method: 'POST',
    headers: ownerHeaders(accessToken),
    // ⚠ THE BODY IS LOAD-BEARING (W-F1, witnessed live 12 Aug 2026). A POST
    // declaring `Content-Type: application/json` with NO body is refused by
    // Fastify BEFORE the route handler runs (FST_ERR_CTP_EMPTY_JSON_BODY) and
    // CEE flattens that to 500 — so the owner could never close a round from
    // the UI. The close takes no parameters; the body is the empty JSON
    // object, never absent. Pinned by collabServiceRequestBodies.spec.ts.
    body: JSON.stringify({}),
  })
  if (!res.ok) throw await parseError(res)
}

export async function fetchOwnerReveal(
  accessToken: string,
  roundId: string,
): Promise<RevealView> {
  const res = await fetch(`${COLLAB_BASE}/rounds/${encodeURIComponent(roundId)}/reveal`, {
    method: 'GET',
    headers: { Authorization: ownerAuthorization(accessToken) },
  })
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as RevealView
}

export async function fetchOwnerDisagreement(
  accessToken: string,
  roundId: string,
): Promise<DisagreementView> {
  const res = await fetch(`${COLLAB_BASE}/rounds/${encodeURIComponent(roundId)}/disagreement`, {
    method: 'GET',
    headers: { Authorization: ownerAuthorization(accessToken) },
  })
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as DisagreementView
}

/**
 * Fetch a round's ROSTER — the owner-facing name source for render-time
 * attribution (D1).
 *
 * ── WHY THE PREVIEW ROUTE AND NOT THE REVEAL ──────────────────────────────
 * `/reveal` would also answer the question: it carries `display_label` per
 * response. It is the wrong choice on data minimisation, which is the same
 * principle that makes the graph persist ids only. Resolving one pill's name
 * would pull EVERY participant's number, verbatim wording and confidence into
 * the canvas — a whole round's beliefs to render one person's name. `/preview`
 * returns the roster and nothing else.
 *
 * ⚠ THE PREVIEW ROUTE IS NOT OPEN-ROUND-ONLY, despite its "pre-close" comment
 * at CEE. `ownerPreview` refuses only on a missing round or a non-owner caller
 * and returns `round.status` verbatim, so it answers for a CLOSED round too —
 * which is the only kind that can produce an attribution, because CEE refuses
 * an apply whose round is not applyable. Derived at
 * `collab/rounds-service.ts:192-221`, not inferred from the route's comment.
 */
export async function fetchRoundRoster(
  accessToken: string,
  roundId: string,
): Promise<RoundRosterView> {
  const res = await fetch(`${COLLAB_BASE}/rounds/${encodeURIComponent(roundId)}/preview`, {
    method: 'GET',
    headers: { Authorization: ownerAuthorization(accessToken) },
  })
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as RoundRosterView
}

/**
 * The people this owner has had on a panel in this scenario, most recent first.
 *
 * Owner-authed. Used to offer "the same Grace as last round" instead of silently
 * creating a second Grace — the only mechanism by which two participant rows
 * become one person, because merging is a claim only the owner can make.
 *
 * ⚠ Callers must treat an empty list as "nobody yet, or identity is still
 * round-scoped on this deployment" — NOT as an error. CEE returns `[]` for both,
 * and a scenario whose rows predate the person migration legitimately has no
 * reusable people.
 */
export async function fetchWorkspacePeople(
  accessToken: string,
  scenarioId: string,
): Promise<WorkspacePerson[]> {
  const res = await fetch(
    `${COLLAB_BASE}/scenarios/${encodeURIComponent(scenarioId)}/people`,
    { method: 'GET', headers: { Authorization: ownerAuthorization(accessToken) } },
  )
  if (!res.ok) throw await parseError(res)
  const body = (await res.json()) as { people?: WorkspacePerson[] }
  return Array.isArray(body.people) ? body.people : []
}

/**
 * Build the link an owner sends a participant.
 *
 * The token rides a REAL query string (before the hash), because the app is a
 * HashRouter and the boot-path strip removes `location.search` cleanly before
 * anything captures `location.href`.
 */
export function participantLink(roundId: string, token: string, origin?: string): string {
  const base = origin ?? (typeof location !== 'undefined' ? location.origin : '')
  return `${base}/?ct=${encodeURIComponent(token)}#/panel/${encodeURIComponent(roundId)}`
}

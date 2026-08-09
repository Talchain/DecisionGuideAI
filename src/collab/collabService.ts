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

/* ── owner ───────────────────────────────────────────────────────────────── */

function ownerHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
}

export interface MintedRound {
  round_id: string
  graph_version_ref: string
  participants: Array<{ participant_id: string; display_name: string; token: string }>
}

export async function mintRound(
  accessToken: string,
  args: {
    scenarioId: string
    contextNote: string | null
    targets: PacketTarget[]
    participants: Array<{ display_name: string }>
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
  })
  if (!res.ok) throw await parseError(res)
}

export async function fetchOwnerReveal(
  accessToken: string,
  roundId: string,
): Promise<RevealView> {
  const res = await fetch(`${COLLAB_BASE}/rounds/${encodeURIComponent(roundId)}/reveal`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as RevealView
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

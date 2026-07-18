/**
 * One-time guest-draft import — login UI half (3.4).
 *
 * The UI's localStorage half of guest-claim. The server half is CEE's
 * `claim_guest_scenario` RPC (olumi-assistants-service migration
 * 20260710190000): service_role-only by design — its caller contract
 * requires the JWT-verified `sub`, so the browser NEVER calls it. What the
 * browser owns is the draft that only exists locally: the `canvas-storage`
 * graph a guest built before signing in. This module offers a one-time
 * import of that draft through the EXISTING authenticated create/persist
 * path (scenarioService.createScenario + saveGraphViaGatedPath) — no new
 * persistence machinery, real user_id stamped by the existing seam.
 *
 * Order matters: the draft graph is saved into the new scenario row BEFORE
 * any navigation, because /scenario/:id hydrates the canvas store from the
 * server row (useScenario.loadScenario) — navigating first would wipe the
 * draft with an empty server graph.
 */
import { loadState } from '../canvas/persist'
import * as scenarioService from '../services/scenarioService'
import { isRequireLoginEnabled } from '../flags'

export const DRAFT_IMPORT_MARKER_KEY = 'login.draftImport.v1'

export type DraftImportMarker = 'imported' | 'dismissed'

function getMarker(): DraftImportMarker | null {
  try {
    const raw = localStorage.getItem(DRAFT_IMPORT_MARKER_KEY)
    return raw === 'imported' || raw === 'dismissed' ? raw : null
  } catch {
    return null
  }
}

function setMarker(marker: DraftImportMarker): void {
  try {
    localStorage.setItem(DRAFT_IMPORT_MARKER_KEY, marker)
  } catch {
    // Storage unavailable — the offer may reappear next session; harmless.
  }
}

/**
 * The offer is due only when ALL hold: the login flag is on (dark
 * otherwise), a real authenticated user is present (never the guest
 * sentinel), a non-empty draft exists in canvas-storage, and the one-time
 * marker is unset (neither imported nor dismissed before).
 */
export function shouldOfferDraftImport(
  user: { id: string } | null,
  authenticated: boolean,
): boolean {
  if (!isRequireLoginEnabled()) return false
  if (!authenticated || !user || user.id === 'guest') return false
  if (getMarker() !== null) return false
  const draft = loadState()
  return !!draft && draft.nodes.length > 0
}

/** Decline permanently — the one-time offer never reappears. */
export function dismissDraftImport(): void {
  setMarker('dismissed')
}

/**
 * Import the guest draft: create a scenario (existing authenticated path —
 * stamps the real user_id and appends the scenario_created journey event),
 * persist the draft graph into it, then mark imported. The localStorage
 * draft itself is deliberately NOT deleted (never destroy user data); the
 * marker is what prevents re-offers. Throws on failure WITHOUT marking, so
 * the offer can retry.
 *
 * ACCEPTED side effect (review S3): if createScenario succeeds but a later
 * step fails, the created row is orphaned and a retry creates another —
 * visible in the hub and user-deletable. Accepted for the POC over
 * carrying retry state; revisit if real users hit it.
 *
 * DELIBERATE (review S5): the marker is browser-global, not user-scoped —
 * the draft is BROWSER-owned (guest state), so one import consumes it for
 * the browser, and a dismissal speaks for the browser too. A second user
 * on a shared browser inheriting a dismissal is accepted POC behaviour.
 */
export async function importGuestDraft(userId: string): Promise<string> {
  const draft = loadState()
  if (!draft || draft.nodes.length === 0) {
    throw new Error('No guest draft to import')
  }
  const eventId = crypto.randomUUID()
  const row = await scenarioService.createScenario(userId, eventId, 'Imported draft')
  await scenarioService.saveGraphViaGatedPath(
    row.id,
    { nodes: draft.nodes, edges: draft.edges },
    crypto.randomUUID(),
  )
  setMarker('imported')
  return row.id
}

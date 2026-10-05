/**
 * ⭐ THE THIN CLIENT (DL 0df0e1 brief D; spike verdict PASS, #87 5994401558, matrix in CI on the J1 stack).
 *
 * For a SIGNED-IN browser the canvas keeps no saved copy of the model:
 *   · on load, CEE's read (`useServerGraphHydration`) is the only source of the graph;
 *   · after every typed edit, CEE's receipt (`draft_graph`, the whole committed graph) replaces it
 *     (`reconcileAppliedGraph`, unchanged);
 *   · this browser keeps the LAYOUT only (CEE's graph carries no positions), plus the edit in flight, in memory.
 *
 * Every defect class that lives in a browser copy of the model — a second tab re-stamping A's graph after a sign-out
 * (CAN-F2g), a refused removal leaking A's model to B (CAN-F2w), a stale slot, a same-browser reload disagreeing with a
 * fresh browser — has nothing to act on, because the copy is never written and never read. Deletion, not a guard.
 *
 * GUESTS ARE UNCHANGED: they have no server identity, so their local slots are still their only copy.
 *
 * ⚠ WHY THE STORED SESSION AND NOT ONLY `isPersistenceSessionActive`. That flag is published by `CanvasMVP`'s effect
 * after auth resolves, which is AFTER `ReactFlowGraph`'s boot restore runs (a child's mount effect runs before its
 * parent's). The boot must already know not to restore a model, so it also reads the session supabase-js persists
 * synchronously (`sb-<project>-auth-token`, `lib/supabase.ts` `persistSession: true`). A stored session whose refresh
 * then fails boots with no local model restored: that browser's slots belong to whoever signed in there, so not
 * restoring them is the safe direction.
 */
import { isPersistenceSessionActive } from '../../lib/persistenceSession'

/** supabase-js v2's persisted-session key. The PKCE `…-auth-token-code-verifier` key is NOT a session. */
const SUPABASE_SESSION_KEY = /^sb-.+-auth-token$/

function hasStoredSupabaseSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key === null || !SUPABASE_SESSION_KEY.test(key)) continue
      const value = localStorage.getItem(key)
      if (value !== null && value.includes('"access_token"')) return true
    }
  } catch {
    // Storage refused the read: no stored session can be shown.
  }
  return false
}

/**
 * Latched for the PAGE's lifetime once true. A tab that was signed in still holds that account's model in memory after
 * a sign-out (its own, or another tab's: supabase-js removes the shared session and this tab becomes a "guest" with A's
 * graph on screen). Unlatched, that tab's guest autosave would write A's model into the slots the next guest boot
 * restores: CAN-F2g's shape on the guest path. Latched, a page that was ever signed in never writes or reads a local
 * model; the next full load decides afresh. The accepted cost: a guest who stays in the SAME page after
 * signing out gets no local autosave until a reload.
 */
let thinThisPage = false

/** THE ONE PREDICATE. True for a signed-in browser: it then reads and writes no local copy of the model. */
export function isThinClientSession(): boolean {
  if (thinThisPage) return true
  const thin = isPersistenceSessionActive() || hasStoredSupabaseSession()
  // Not latched under the test runner: one module instance serves a whole spec file, so a latch set by one row
  // would silently turn every later guest-path row in that file thin.
  if (thin && import.meta.env.MODE !== 'test') thinThisPage = true
  return thin
}

export function __resetThinClientForTests(): void {
  thinThisPage = false
}

/** The copy the user sees when a change exists only on this screen (factor Confirm has no server carrier yet). */
export const THIN_CLIENT_NOT_SAVED_NOTICE =
  'Confirmed on this screen only. It is not saved to the shared model, so it will not be there after a reload.'

// ── LAYOUT: the one thing this browser keeps ─────────────────────────────────────────────────────────────────────

const LAYOUT_KEY_PREFIX = 'olumi-thin-layout:'

export type ThinLayout = Readonly<Record<string, { readonly x: number; readonly y: number }>>

type PositionedNode = { readonly id?: unknown; readonly position?: { readonly x?: unknown; readonly y?: unknown } }

/** Positions by node id, for one scenario. Never a label, a value or a link: nothing here is the model. */
export function saveThinLayout(
  scenarioId: string | null | undefined,
  nodes: ReadonlyArray<PositionedNode> | null | undefined,
): void {
  if (!scenarioId || !Array.isArray(nodes) || nodes.length === 0) return
  const positions: Record<string, { x: number; y: number }> = {}
  for (const n of nodes) {
    if (typeof n?.id !== 'string' || n.id.length === 0) continue
    const x = n.position?.x
    const y = n.position?.y
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) continue
    positions[n.id] = { x, y }
  }
  if (Object.keys(positions).length === 0) return
  try {
    localStorage.setItem(LAYOUT_KEY_PREFIX + scenarioId, JSON.stringify(positions))
  } catch {
    // Layout is a convenience: a refused write costs a re-layout on the next load, nothing more.
  }
}

export function loadThinLayout(scenarioId: string | null | undefined): ThinLayout | null {
  if (!scenarioId) return null
  try {
    const raw = localStorage.getItem(LAYOUT_KEY_PREFIX + scenarioId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const out: Record<string, { x: number; y: number }> = {}
    for (const [id, p] of Object.entries(parsed as Record<string, unknown>)) {
      const pos = p as { x?: unknown; y?: unknown } | null
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number' && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        out[id] = { x: pos.x, y: pos.y }
      }
    }
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}

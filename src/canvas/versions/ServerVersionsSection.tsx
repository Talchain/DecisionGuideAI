/**
 * ServerVersionsSection — SHARED versions of this scenario's model.
 * British English: visualisation, colour, initialise.
 *
 * ── WHAT THIS IS, AND HOW IT DIFFERS FROM THE LOCAL HISTORY ─────────────────
 * The rest of this panel (#739) is BROWSER-LOCAL: capture + compare of the
 * canvas, localStorage, one device, honest about it. This section is the other
 * half: versions of the SERVER's shared model (`scenarios.graph` — the graph
 * every turn and every analysis is computed from), persisted by CEE in
 * `model_versions`, visible from ANY browser with access to the scenario, and
 * restorable. Two different objects, deliberately side by side:
 *   · a LOCAL version answers "what did I change on this canvas?";
 *   · a SHARED version is a durable state of the team's model itself.
 *
 * ── RESTORE, GUARDED TWICE ──────────────────────────────────────────────────
 * Restore overwrites the working model for everyone with access, so:
 *   1. the UI arms an explicit CONFIRM before calling the server (a mutant
 *      that skips the confirm REDs ServerVersionsSection.spec §PIN 1);
 *   2. the server snapshots the current state FIRST (provenance
 *      `pre_restore`) and names it in the response — rendered here as UNDO.
 * The apply path is `reconcileAppliedGraph` — the receipt-class reconcile
 * with authoritative deletion semantics and layout preservation — never a
 * second bespoke merge. Restores THEMSELVES are versions (the server appends,
 * history is never rewritten), which is why undo is just another restore.
 *
 * ── GUESTS ──────────────────────────────────────────────────────────────────
 * Server-side versions require sign-in (DB-level: guest scenarios cannot own
 * durable rows — CEE's D3 Branch A ruling). Guests see the honest invitation,
 * and their LOCAL history above keeps working exactly as before. No network
 * call is spent to learn what we already know.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadCloud, RotateCcw } from 'lucide-react'
import { PanelSection } from '../panels/_shared/PanelSection'
import { typography } from '../../styles/typography'
import { useAuth } from '../../contexts/AuthContext'
import { useCanvasStore } from '../store'
import {
  listModelVersions,
  restoreModelVersion,
  saveModelVersion,
  type ServerModelVersion,
} from '../../adapters/cee/modelVersions'
import { reconcileAppliedGraph } from '../utils/mergeAppliedGraph'
import { logger } from '../../lib/logger'

/** A scenario CEE can address is a UUID (scenarios.id is a uuid column). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The guest sentinel AuthContext mints; never a Supabase user id. */
const GUEST_USER_ID = 'guest'

/** Storage-scope disclosure — the shared counterpart of the local one. */
export const SERVER_VERSIONS_DISCLOSURE =
  'Shared versions are stored with the scenario. Anyone who can open this scenario can see and restore them, from any browser.'

export const SERVER_VERSIONS_SIGNIN =
  'Sign in to save shared versions. Version history for the shared model is available when you are signed in; the local history above still works in this browser.'

/** Provenance, in the user's terms. Unknown values render as themselves. */
function provenanceLabel(provenance: string | null): string | null {
  switch (provenance) {
    case 'user_save':
      return null // a deliberate save needs no explanation
    case 'commit':
      return 'auto — saved on change'
    case 'pre_restore':
      return 'auto — before a restore'
    case 'restore':
      return 'restored'
    default:
      return provenance
  }
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  try {
    return parsed.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return parsed.toISOString()
  }
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; versions: ServerModelVersion[]; currentVersionId: string | null }
  | { kind: 'disabled' }
  | { kind: 'failed' }

export function ServerVersionsSection() {
  const { user } = useAuth()
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)

  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  /** Row whose confirm is armed (pin 1) — id, never an index. */
  const [armedVersionId, setArmedVersionId] = useState<string | null>(null)
  /** One in-flight write at a time; buttons disable on it. */
  const [busy, setBusy] = useState(false)
  /** Honest, in-place outcome copy (conflicts, no-ops, partial restores). */
  const [message, setMessage] = useState<string | null>(null)
  /** The server-named pre-restore snapshot — restore it to undo. */
  const [undoVersionId, setUndoVersionId] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')
  const mountedRef = useRef(true)

  const userId = user?.id ?? null
  const signedIn =
    typeof userId === 'string' && userId.length > 0 && userId !== GUEST_USER_ID
  const addressable = typeof scenarioId === 'string' && UUID_RE.test(scenarioId)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!addressable || !signedIn || typeof scenarioId !== 'string') return
    const result = await listModelVersions(scenarioId, { userId })
    if (!mountedRef.current) return
    if (result.status === 'list') {
      setPhase({
        kind: 'ready',
        versions: result.versions,
        currentVersionId: result.currentVersionId,
      })
      return
    }
    if (result.status === 'disabled') {
      setPhase({ kind: 'disabled' })
      return
    }
    // notReadable / unavailable / refused / unusable: one honest retry state.
    // A failed read must never render as "no versions" — that would be an
    // empty claim about history we simply could not see.
    setPhase({ kind: 'failed' })
  }, [addressable, signedIn, scenarioId, userId])

  useEffect(() => {
    if (addressable && signedIn) {
      setPhase({ kind: 'loading' })
      void refresh()
    }
  }, [addressable, signedIn, refresh])

  // No server-addressable scenario ⇒ nothing to offer; the local history
  // above is the whole story. Rendering a dead section would be an
  // affordance that cannot keep its promise.
  if (!addressable) return null

  if (!signedIn) {
    return (
      <PanelSection title="Shared versions">
        <p
          className={`${typography.panelBody} text-text-light`}
          data-testid="server-versions-signin"
        >
          {SERVER_VERSIONS_SIGNIN}
        </p>
      </PanelSection>
    )
  }

  const handleSave = async () => {
    if (typeof scenarioId !== 'string') return
    setBusy(true)
    setMessage(null)
    const label = draftLabel.trim()
    const result = await saveModelVersion(scenarioId, {
      userId,
      ...(label.length > 0 ? { label } : {}),
    })
    if (!mountedRef.current) return
    setBusy(false)
    switch (result.status) {
      case 'saved':
        setDraftLabel('')
        if (result.version.deduped) {
          setMessage('This state is already the latest shared version — nothing new to save.')
        }
        await refresh()
        return
      case 'nothingToSave':
        setMessage('There is no model content to version yet. Add to your model, then save.')
        return
      case 'signInRequired':
        setMessage('Saving shared versions requires sign-in.')
        return
      case 'conflict':
        setMessage('The model changed since you last loaded it. Refresh and try again.')
        await refresh()
        return
      case 'disabled':
        setPhase({ kind: 'disabled' })
        return
      default:
        setMessage('The version could not be saved right now. Try again.')
        return
    }
  }

  const handleRestore = async (versionId: string) => {
    if (typeof scenarioId !== 'string' || phase.kind !== 'ready') return
    setBusy(true)
    setMessage(null)
    setArmedVersionId(null)

    // The CAS expectation is the CURRENT head's identity hash — the state the
    // list showed the user. The server chains it through its own pre-restore
    // snapshot, so a concurrent change fails loudly instead of silently losing.
    const head =
      phase.versions.find((v) => v.id === phase.currentVersionId) ?? phase.versions[0]
    const result = await restoreModelVersion(scenarioId, {
      userId,
      versionId,
      ...(head !== undefined ? { expectedGraphIdentityHash: head.graphIdentityHash } : {}),
    })
    if (!mountedRef.current) return
    setBusy(false)

    switch (result.status) {
      case 'restored': {
        // The receipt-class apply: adds + updates + deletions in one history
        // entry, layout preserved, removals gated on acknowledged elements.
        const applied = reconcileAppliedGraph(
          // The restore payload carries only `graph`; the reconcile reads
          // `.graph.nodes/.graph.edges` on exactly this shape.
          { graph: result.graph } as unknown as Parameters<typeof reconcileAppliedGraph>[0],
        )
        const changedNothing =
          applied.addedNodeCount === 0 &&
          applied.addedEdgeCount === 0 &&
          applied.updatedNodeCount === 0 &&
          applied.updatedEdgeCount === 0 &&
          applied.removedNodeCount === 0 &&
          applied.removedEdgeCount === 0
        setUndoVersionId(result.undoVersionId)
        if (result.deduped) {
          setMessage('The model is already at that version — nothing changed.')
        } else if (changedNothing) {
          // Honest about ambiguity: the server restored, but the canvas
          // reconcile reported no change (it may have refused an unrelated
          // graph, or the canvas already matched). Never claim silently.
          setMessage(
            'Restored on the server. If the canvas looks unchanged, reload the page to see the restored model.',
          )
          logger.warn('server_versions.restore_applied_no_canvas_change', { scenarioId })
        } else {
          setMessage('Restored. The shared model and this canvas now show that version.')
        }
        await refresh()
        return
      }
      case 'conflict':
        setMessage('The model changed since you looked. The list has been refreshed — try again.')
        await refresh()
        return
      case 'incomplete':
        setMessage(
          'The restore did not complete: the version was recorded but the working model was not updated. Try again — it is safe to retry.',
        )
        return
      case 'versionNotFound':
        setMessage('That version is no longer available.')
        await refresh()
        return
      case 'signInRequired':
        setMessage('Restoring shared versions requires sign-in.')
        return
      case 'disabled':
        setPhase({ kind: 'disabled' })
        return
      default:
        setMessage('The version could not be restored right now. Nothing was changed.')
        return
    }
  }

  return (
    <PanelSection title="Shared versions">
      <p className={`${typography.panelMeta} text-text-light`} data-testid="server-versions-disclosure">
        {SERVER_VERSIONS_DISCLOSURE}
      </p>

      {phase.kind === 'loading' && (
        <p className={`${typography.panelBody} text-text-light`}>Loading shared versions…</p>
      )}

      {phase.kind === 'disabled' && (
        <p
          className={`${typography.panelBody} text-text-light`}
          data-testid="server-versions-unavailable"
        >
          Shared version history is not available on this service right now.
        </p>
      )}

      {phase.kind === 'failed' && (
        <div className="space-y-1.5">
          <p className={`${typography.panelBody} text-text-light`}>
            Shared versions could not be loaded — this says nothing about whether any exist.
          </p>
          <button
            type="button"
            onClick={() => {
              setPhase({ kind: 'loading' })
              void refresh()
            }}
            className={`${typography.panelBody} px-3 py-1.5 rounded-md border border-panel-border text-text-body hover:bg-panel-hover`}
          >
            Try again
          </button>
        </div>
      )}

      {message !== null && (
        <p
          className={`${typography.panelBody} text-text-body`}
          role="status"
          data-testid="server-versions-message"
        >
          {message}
        </p>
      )}

      {undoVersionId !== null && (
        <button
          type="button"
          data-testid="server-restore-undo"
          disabled={busy}
          onClick={() => {
            const target = undoVersionId
            setUndoVersionId(null)
            if (target !== null) void handleRestore(target)
          }}
          className={`${typography.panelBody} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-panel-border text-text-body hover:bg-panel-hover`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Undo restore
        </button>
      )}

      {phase.kind === 'ready' && (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="server-version-name" className="sr-only">
              Shared version name
            </label>
            <input
              id="server-version-name"
              type="text"
              value={draftLabel}
              disabled={busy}
              onChange={(event) => setDraftLabel(event.target.value)}
              placeholder="Name this shared version"
              className={`${typography.panelBody} flex-1 min-w-0 px-2 py-1.5 rounded-md border border-panel-border bg-panel text-text-body placeholder:text-text-light`}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              aria-label="Save shared version"
              className={`${typography.panelBody} shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-text-on-color disabled:opacity-60`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Save shared version
            </button>
          </div>

          {phase.versions.length === 0 && (
            <p className={`${typography.panelBody} text-text-light`} data-testid="server-versions-empty">
              No shared versions yet. Save one to give the team a restorable state of this model.
            </p>
          )}

          {phase.versions.length > 0 && (
            <ul className="space-y-1">
              {phase.versions.map((version) => {
                const isCurrent = version.id === phase.currentVersionId
                const origin = provenanceLabel(version.provenance)
                const armed = armedVersionId === version.id
                return (
                  <li
                    key={version.id}
                    className="space-y-1"
                    data-testid="server-version-row"
                    data-version-id={version.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1">
                        <span className={`${typography.panelBody} text-text-body`}>
                          v{version.versionNumber}
                          {version.label !== null ? ` · ${version.label}` : ''}
                        </span>
                        <span className={`${typography.panelMeta} text-text-light ml-2`}>
                          {formatTimestamp(version.createdAt)}
                        </span>
                        {origin !== null && (
                          <span
                            className={`${typography.panelMeta} text-text-light ml-2 px-1.5 py-0.5 rounded border border-panel-border`}
                          >
                            {origin}
                          </span>
                        )}
                        {isCurrent && (
                          <span
                            className={`${typography.panelMeta} text-text-light ml-2 px-1.5 py-0.5 rounded border border-panel-border`}
                          >
                            current
                          </span>
                        )}
                      </span>
                      {!isCurrent && !armed && (
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Restore version ${version.versionNumber}`}
                          onClick={() => setArmedVersionId(version.id)}
                          className={`${typography.panelBody} shrink-0 px-2 py-1 rounded-md border border-panel-border text-text-body hover:bg-panel-hover disabled:opacity-60`}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                    {armed && (
                      <div
                        className="space-y-1.5 rounded-md border border-panel-border p-2"
                        data-testid="server-restore-confirm"
                      >
                        <p className={`${typography.panelBody} text-text-body`}>
                          Replace the current shared model with v{version.versionNumber}? The
                          current state is saved first, so you can undo.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRestore(version.id)}
                            className={`${typography.panelBody} px-3 py-1.5 rounded-md bg-primary text-text-on-color disabled:opacity-60`}
                          >
                            Confirm restore
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setArmedVersionId(null)}
                            className={`${typography.panelBody} px-3 py-1.5 rounded-md border border-panel-border text-text-body hover:bg-panel-hover`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </PanelSection>
  )
}

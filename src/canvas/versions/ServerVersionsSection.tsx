/**
 * ServerVersionsSection — SHARED versions of this scenario's model.
 * British English: visualisation, colour, initialise.
 *
 * ── WHAT THIS IS, AND HOW IT DIFFERS FROM THE LOCAL HISTORY ─────────────────
 * The secondary part of this panel (#739) is BROWSER-LOCAL: capture + compare of the
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
 *   2. the server returns an atomic receipt naming the pre-restore snapshot —
 *      rendered here as UNDO.
 * The apply path is `reconcileAppliedGraph` — the receipt-class reconcile
 * with authoritative deletion semantics and layout preservation — never a
 * second bespoke merge. Restores THEMSELVES are versions (the server appends,
 * history is never rewritten), which is why undo is just another restore.
 *
 * ── GUESTS ──────────────────────────────────────────────────────────────────
 * Server-side versions require sign-in (DB-level: guest scenarios cannot own
 * durable rows — CEE's D3 Branch A ruling). Guests see the honest invitation,
 * and their LOCAL checkpoints below keep working exactly as before. No network
 * call is spent to learn what we already know.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadCloud, RotateCcw } from 'lucide-react'
import { PanelSection } from '../panels/_shared/PanelSection'
import { typography } from '../../styles/typography'
import { useAuth } from '../../contexts/AuthContext'
import { useCanvasStore } from '../store'
import {
  compareModelVersions,
  listModelVersions,
  restoreModelVersion,
  saveModelVersion,
  type ListModelVersionsResult,
  type ModelVersionDiffV1,
  type ServerModelVersion,
} from '../../adapters/cee/modelVersions'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { ServerVersionDiff } from './ServerVersionDiff'
import { reconcileAppliedGraph } from '../utils/mergeAppliedGraph'
import { logger } from '../../lib/logger'
import { VERSION_HISTORY_REFRESH_EVENT } from './modelVersionReceipt'

/** A scenario CEE can address is a UUID (scenarios.id is a uuid column). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The guest sentinel AuthContext mints; never a Supabase user id. */
const GUEST_USER_ID = 'guest'

/** Storage-scope disclosure — the shared counterpart of the local one. */
export const SERVER_VERSIONS_DISCLOSURE =
  'This is the authoritative shared model history. It is stored with the scenario, available from any browser, and restorable by people with access.'

export const SERVER_VERSIONS_SIGNIN =
  'Sign in to use the authoritative shared model history. The on-this-device checkpoints below still work in this browser.'

/** V1 provenance is creation-mechanism metadata only, never actor evidence. */
function legacyCreationLabel(provenance: string | null): string {
  switch (provenance) {
    case 'user_save':
      return 'named checkpoint (legacy metadata)'
    case 'commit':
      return 'saved on model change (legacy metadata)'
    case 'pre_restore':
      return 'before restore (legacy metadata)'
    case 'restore':
      return 'restore (legacy metadata)'
    default:
      return 'Unknown (legacy metadata)'
  }
}

function actorLabel(version: ServerModelVersion): string {
  switch (version.actor.kind) {
    case 'system':
      return 'System'
    case 'unknown':
      return 'Unknown'
    case 'known':
      if (version.actor.authoredBy === 'owner') return 'Owner'
      if (version.actor.authoredBy === 'assistant') return 'Olumi assistant'
      return 'Known participant'
  }
}

function creationLabel(version: ServerModelVersion, versions: ServerModelVersion[]): string {
  if (version.contractVersion === 'v1-compat') return legacyCreationLabel(version.provenance)
  switch (version.creation.kind) {
    case 'initial':
      return 'initial model'
    case 'committed_mutation':
      return 'committed model change'
    case 'restore':
    case 'variant_creation':
    case 'variant_promotion': {
      const creation = version.creation
      const source = versions.find((candidate) => candidate.id === creation.sourceVersionId)
      const action =
        creation.kind === 'restore'
          ? 'restore'
          : creation.kind === 'variant_creation'
            ? 'variant creation'
            : 'variant promotion'
      return source === undefined ? `${action} from a recorded version` : `${action} from v${source.versionNumber}`
    }
    case 'unknown':
      return 'Unknown'
  }
}

function lineageLabel(version: ServerModelVersion, versions: ServerModelVersion[]): string {
  if (version.lineage.kind === 'unknown') return 'Unknown'
  if (version.lineage.parentVersionId === null) return 'root version'
  const parentVersionId = version.lineage.parentVersionId
  const parent = versions.find((candidate) => candidate.id === parentVersionId)
  return parent === undefined ? 'known parent' : `parent v${parent.versionNumber}`
}

function generateMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
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
  | {
      kind: 'ready'
      versions: ServerModelVersion[]
      currentVersionId: string | null
      contractVersion: 'v1-compat' | 'v2'
      nextCursor: string | null
    }
  | { kind: 'disabled' }
  | { kind: 'failed' }

type ComparePhase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; diff: ModelVersionDiffV1 }
  | { kind: 'failed'; message: string }

type ListSuccess = Extract<ListModelVersionsResult, { status: 'list' }>

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
  const [compareFromId, setCompareFromId] = useState<string | null>(null)
  const [compareToId, setCompareToId] = useState<string | null>(null)
  const [comparePhase, setComparePhase] = useState<ComparePhase>({ kind: 'idle' })
  const mountedRef = useRef(true)
  const confirmRestoreRef = useRef<HTMLButtonElement | null>(null)
  const restoreButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const returnFocusVersionIdRef = useRef<string | null>(null)
  /** Stable across uncertain retries; changed only after a terminal receipt/refusal. */
  const restoreMutationIdsRef = useRef(new Map<string, string>())

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

  useEffect(() => {
    if (armedVersionId !== null) {
      confirmRestoreRef.current?.focus()
      return
    }
    const versionId = returnFocusVersionIdRef.current
    if (versionId === null) return
    returnFocusVersionIdRef.current = null
    restoreButtonRefs.current.get(versionId)?.focus()
  }, [armedVersionId])

  const adoptList = useCallback((result: ListSuccess) => {
    const toId =
      result.versions.find((version) => version.id === result.currentVersionId)?.id ??
      result.versions[0]?.id ??
      null
    const fromId = result.versions.find((version) => version.id !== toId)?.id ?? null
    setPhase({
      kind: 'ready',
      versions: result.versions,
      currentVersionId: result.currentVersionId,
      contractVersion: result.contractVersion,
      nextCursor: result.nextCursor,
    })
    setCompareFromId(fromId)
    setCompareToId(toId)
    setComparePhase({ kind: 'idle' })
  }, [])

  const refresh = useCallback(async () => {
    if (!addressable || !signedIn || typeof scenarioId !== 'string') return
    const result = await listModelVersions(scenarioId, { userId })
    if (!mountedRef.current) return
    if (result.status === 'list') {
      adoptList(result)
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
  }, [addressable, adoptList, signedIn, scenarioId, userId])

  useEffect(() => {
    if (addressable && signedIn) {
      setPhase({ kind: 'loading' })
      void refresh()
    }
  }, [addressable, signedIn, refresh])

  useEffect(() => {
    const onVerifiedMutation = (event: Event) => {
      const detail = (event as CustomEvent<{ scenarioId?: unknown }>).detail
      if (detail?.scenarioId !== scenarioId) return
      void refresh()
    }
    window.addEventListener(VERSION_HISTORY_REFRESH_EVENT, onVerifiedMutation)
    return () => window.removeEventListener(VERSION_HISTORY_REFRESH_EVENT, onVerifiedMutation)
  }, [refresh, scenarioId])

  // No server-addressable scenario ⇒ nothing to offer; the local history
  // below is the whole story. Rendering a dead section would be an
  // affordance that cannot keep its promise.
  if (!addressable) return null

  if (!signedIn) {
    return (
      <PanelSection title="Shared model history">
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

    // CAS anchors the live working graph, not the latest version row. A
    // layout-only working-graph change may legitimately update this identity
    // without creating a semantic version.
    const currentGraph = await fetchScenarioGraph(scenarioId, { userId })
    if (!mountedRef.current) return
    if (currentGraph.status !== 'graph' || currentGraph.identity === null) {
      setBusy(false)
      setMessage(
        'The current shared graph identity could not be verified, so the restore was not started. Try again after the model reloads.',
      )
      return
    }
    const mutationId = restoreMutationIdsRef.current.get(versionId) ?? generateMutationId()
    restoreMutationIdsRef.current.set(versionId, mutationId)
    const result = await restoreModelVersion(scenarioId, {
      userId,
      versionId,
      mutationId,
      expectedGraphIdentityHash: currentGraph.identity.value,
    })
    if (!mountedRef.current) return
    setBusy(false)

    switch (result.status) {
      case 'restored': {
        restoreMutationIdsRef.current.delete(versionId)
        const receipt = result.receipt
        // The receipt-class apply: adds + updates + deletions in one history
        // entry, layout preserved. A strict mutation receipt authorises the
        // complete snapshot, including removals, without a legacy cache gate.
        const applied = reconcileAppliedGraph(receipt)
        // Component 5 remains the sole freshness authority. Null means no new
        // verdict and therefore retains the existing state.
        if (result.analysisState !== null) {
          useCanvasStore.getState().setAnalysisStateV1(result.analysisState)
        }
        const changedNothing =
          applied.addedNodeCount === 0 &&
          applied.addedEdgeCount === 0 &&
          applied.updatedNodeCount === 0 &&
          applied.updatedEdgeCount === 0 &&
          applied.removedNodeCount === 0 &&
          applied.removedEdgeCount === 0
        setUndoVersionId(receipt.undo_version_id)
        const [listVerification, graphVerification] = await Promise.all([
          listModelVersions(scenarioId, { userId }),
          fetchScenarioGraph(scenarioId, { userId }),
        ])
        if (!mountedRef.current) return
        if (listVerification.status === 'list') {
          adoptList(listVerification)
        } else if (listVerification.status === 'disabled') {
          setPhase({ kind: 'disabled' })
        } else {
          setPhase({ kind: 'failed' })
        }
        const verifiedHead =
          listVerification.status === 'list' &&
          listVerification.currentVersionId === receipt.version_id
            ? listVerification.versions.find(
                (version) => version.id === receipt.version_id,
              )
            : undefined
        const authorityVerified =
          verifiedHead?.graphIdentityHash === receipt.full_hash &&
          graphVerification.status === 'graph' &&
          graphVerification.identity?.value === receipt.full_hash &&
          graphVerification.identity.algorithm === receipt.hash_algorithm &&
          graphVerification.identity.projectionVersion ===
            receipt.identity_projection_version &&
          graphVerification.identity.normaliserVersion ===
            receipt.identity_normaliser_version &&
          graphVerification.identity.graphSchemaVersion === receipt.graph_schema_version

        if (!authorityVerified) {
          setMessage(
            'A restore receipt was received and applied to this canvas, but the shared head and graph could not both be verified afterwards. Reload before relying on this state.',
          )
          logger.warn('server_versions.restore_post_read_unverified', {
            scenarioId,
            receiptVersionId: receipt.version_id,
          })
        } else if (changedNothing) {
          setMessage(
            'The restored shared head and graph were verified. If the canvas looks unchanged, reload the page before continuing.',
          )
          logger.warn('server_versions.restore_applied_no_canvas_change', { scenarioId })
        } else {
          setMessage('Restored and verified. The shared model and this canvas now show that version.')
        }
        return
      }
      case 'conflict':
        setMessage('The model changed since you looked. The list has been refreshed — try again.')
        await refresh()
        return
      case 'mutationIdReused':
        restoreMutationIdsRef.current.delete(versionId)
        setMessage(
          'That restore attempt identifier was already used for another target. This request was refused; try again to start a new restore attempt.',
        )
        return
      case 'versionNotFound':
        restoreMutationIdsRef.current.delete(versionId)
        setMessage('That version is no longer available.')
        await refresh()
        return
      case 'signInRequired':
        restoreMutationIdsRef.current.delete(versionId)
        setMessage('Restoring shared versions requires sign-in.')
        return
      case 'disabled':
        restoreMutationIdsRef.current.delete(versionId)
        setPhase({ kind: 'disabled' })
        return
      default:
        setMessage(
          'We could not verify whether the restore completed. The history has been refreshed; retrying this target will reuse the same restore attempt.',
        )
        await refresh()
        return
    }
  }

  const handleCompare = async () => {
    if (
      typeof scenarioId !== 'string' ||
      phase.kind !== 'ready' ||
      compareFromId === null ||
      compareToId === null
    ) {
      return
    }
    if (compareFromId === compareToId) {
      setComparePhase({ kind: 'failed', message: 'Choose two different shared versions.' })
      return
    }
    setComparePhase({ kind: 'loading' })
    const result = await compareModelVersions(scenarioId, {
      userId,
      fromVersionId: compareFromId,
      toVersionId: compareToId,
    })
    if (!mountedRef.current) return
    switch (result.status) {
      case 'compared':
        setComparePhase({ kind: 'ready', diff: result.diff })
        return
      case 'sameVersion':
        setComparePhase({ kind: 'failed', message: 'Choose two different shared versions.' })
        return
      case 'versionNotFound':
        await refresh()
        setComparePhase({
          kind: 'failed',
          message: 'One of those versions is no longer available. The history has been refreshed.',
        })
        return
      case 'signInRequired':
        setComparePhase({ kind: 'failed', message: 'Comparing shared versions requires sign-in.' })
        return
      default:
        setComparePhase({
          kind: 'failed',
          message:
            'A deterministic shared-model comparison is not available right now. No local checkpoint was substituted.',
        })
        return
    }
  }

  return (
    <PanelSection title="Shared model history">
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
          {phase.contractVersion === 'v1-compat' && (
            <p
              className={`${typography.panelMeta} text-text-light`}
              data-testid="server-versions-legacy-contract"
            >
              This service is returning temporary legacy history. Actor and lineage are Unknown;
              legacy provenance is shown only as a creation mechanism.
            </p>
          )}
          {phase.nextCursor !== null && (
            <p
              className={`${typography.panelMeta} text-text-light`}
              data-testid="server-versions-more-pages"
            >
              Older shared versions are available. This view shows the current page.
            </p>
          )}
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

          {phase.versions.length >= 2 && compareFromId !== null && compareToId !== null && (
            <div className="space-y-2 rounded-md border border-panel-border p-2">
              <p className={`${typography.panelBody} text-text-body font-medium`}>
                Compare shared versions
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="server-version-from"
                    className={`${typography.panelMeta} text-text-light w-10 shrink-0`}
                  >
                    From
                  </label>
                  <select
                    id="server-version-from"
                    value={compareFromId}
                    disabled={comparePhase.kind === 'loading'}
                    onChange={(event) => {
                      setCompareFromId(event.target.value)
                      setComparePhase({ kind: 'idle' })
                    }}
                    className={`${typography.panelBody} flex-1 min-w-0 px-2 py-1.5 rounded-md border border-panel-border bg-panel text-text-body`}
                  >
                    {phase.versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        v{version.versionNumber}
                        {version.label === null ? '' : ` · ${version.label}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="server-version-to"
                    className={`${typography.panelMeta} text-text-light w-10 shrink-0`}
                  >
                    To
                  </label>
                  <select
                    id="server-version-to"
                    value={compareToId}
                    disabled={comparePhase.kind === 'loading'}
                    onChange={(event) => {
                      setCompareToId(event.target.value)
                      setComparePhase({ kind: 'idle' })
                    }}
                    className={`${typography.panelBody} flex-1 min-w-0 px-2 py-1.5 rounded-md border border-panel-border bg-panel text-text-body`}
                  >
                    {phase.versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        v{version.versionNumber}
                        {version.label === null ? '' : ` · ${version.label}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                disabled={comparePhase.kind === 'loading' || compareFromId === compareToId}
                onClick={() => void handleCompare()}
                className={`${typography.panelBody} px-3 py-1.5 rounded-md border border-panel-border text-text-body hover:bg-panel-hover disabled:opacity-60`}
              >
                {comparePhase.kind === 'loading' ? 'Comparing…' : 'Compare shared versions'}
              </button>
              {comparePhase.kind === 'failed' && (
                <p
                  className={`${typography.panelBody} text-text-light`}
                  role="status"
                  data-testid="server-version-compare-message"
                >
                  {comparePhase.message}
                </p>
              )}
              {comparePhase.kind === 'ready' && (() => {
                const fromVersion = phase.versions.find(
                  (version) => version.id === comparePhase.diff.fromVersionId,
                )
                const toVersion = phase.versions.find(
                  (version) => version.id === comparePhase.diff.toVersionId,
                )
                return fromVersion !== undefined && toVersion !== undefined ? (
                  <ServerVersionDiff
                    diff={comparePhase.diff}
                    fromVersion={fromVersion}
                    toVersion={toVersion}
                  />
                ) : (
                  <p className={`${typography.panelBody} text-text-light`} role="status">
                    The compared versions are no longer in this history. Refresh and try again.
                  </p>
                )
              })()}
            </div>
          )}

          {phase.versions.length > 0 && (
            <ul className="space-y-1">
              {phase.versions.map((version) => {
                const isCurrent = version.id === phase.currentVersionId
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
                        <span
                          className={`${typography.panelMeta} text-text-light ml-2 px-1.5 py-0.5 rounded border border-panel-border`}
                          data-testid="server-version-actor"
                        >
                          Actor: {actorLabel(version)}
                        </span>
                        <span
                          className={`${typography.panelMeta} text-text-light ml-2 px-1.5 py-0.5 rounded border border-panel-border`}
                          data-testid="server-version-creation"
                        >
                          Creation: {creationLabel(version, phase.versions)}
                        </span>
                        <span
                          className={`${typography.panelMeta} text-text-light ml-2 px-1.5 py-0.5 rounded border border-panel-border`}
                          data-testid="server-version-lineage"
                        >
                          Lineage: {lineageLabel(version, phase.versions)}
                        </span>
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
                          ref={(node) => {
                            if (node === null) restoreButtonRefs.current.delete(version.id)
                            else restoreButtonRefs.current.set(version.id, node)
                          }}
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
                            ref={confirmRestoreRef}
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
                            onClick={() => {
                              returnFocusVersionIdRef.current = version.id
                              setArmedVersionId(null)
                            }}
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

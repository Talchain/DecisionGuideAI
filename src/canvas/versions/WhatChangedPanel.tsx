/**
 * Version history — the versions surface.
 * British English: visualisation, colour, initialise.
 *
 * RENDERS THE CHANGESET AND NOTHING ELSE. Every line on screen comes from
 * `describeChangeset`, which comes from `diffModelVersions`. There is no copy
 * here that interprets, scores or summarises a change, because none of that is
 * in the changeset and the product has not earned the right to claim it.
 *
 * EXCEPTIONS LOUD, NORMAL QUIET: a failed save says so, in place, with the real
 * reason. A successful save says nothing — the new version simply appears.
 *
 * ── THREE CHANGES, 16 Aug 2026 ───────────────────────────────────────────────
 *
 * (1) VOCABULARY (trap 21). "Version" and "analysis run" are different objects
 *     and this panel said neither. It now says what a version IS and what it is
 *     NOT, from `versionLabels.ts`, and its comparison section is titled
 *     "Changes between these checkpoints" rather than the bare "What changed" it
 *     shared with the run-over-run chip on the analysis surface.
 *
 * (2) NO PREMATURE INVITATION (ledger L-11). With fewer than two versions the
 *     panel used to render the From/To comparison selects anyway — two dropdowns
 *     offering to compare a single version with itself. The comparison UI is now
 *     gated on there being something to compare, and the honest empty state is
 *     the ONLY voice in that case. An affordance that cannot keep its promise is
 *     worse than its absence (the same rule that keeps `restore` unbuilt).
 *
 * (3) AUTOMATIC CAPTURES ARE VISIBLE. `origin` was stored and never rendered,
 *     so pre-ingest captures appeared as rows the user had no memory of
 *     creating. They are now marked, in the list and in the selects, from one
 *     string (`versionLabels.ts`).
 */

import { useCallback, useState } from 'react'
import { History, Save, Trash2 } from 'lucide-react'
import { PanelShell } from '../panels/_shared/PanelShell'
import { PanelSection } from '../panels/_shared/PanelSection'
import { typography } from '../../styles/typography'
import { buildVersionLabelIndex, describeChangeset } from './describeChange'
import { ServerVersionsSection } from './ServerVersionsSection'
import { useModelVersions } from './useModelVersions'
import {
  VERSION_STORAGE_DISCLOSURE,
  VERSION_VS_RUN_DISCLOSURE,
  versionOriginLabel,
  versionOriginSuffix,
} from './versionLabels'
import type { ChangeLine } from './describeChange'
import type { ModelVersion } from './types'

export interface WhatChangedPanelProps {
  isOpen: boolean
  onClose: () => void
}

function formatTimestamp(ms: number): string {
  try {
    return new Date(ms).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return new Date(ms).toISOString()
  }
}

/** One `<option>` caption: name, when, and — for an auto capture — what it is. */
function optionCaption(version: ModelVersion): string {
  return `${version.name} · ${formatTimestamp(version.createdAt)}${versionOriginSuffix(version.origin)}`
}

/** Neutral markers — the change KIND, never a judgement about it. */
const KIND_MARKER: Readonly<Record<ChangeLine['kind'], string>> = {
  added: '+',
  removed: '−',
  modified: '~',
}

const KIND_CLASS: Readonly<Record<ChangeLine['kind'], string>> = {
  added: 'text-success',
  removed: 'text-danger',
  modified: 'text-info',
}

export function WhatChangedPanel({ isOpen, onClose }: WhatChangedPanelProps) {
  const {
    versions,
    fromId,
    toId,
    setFromId,
    setToId,
    changeset,
    from,
    to,
    saveVersion,
    removeVersion,
  } = useModelVersions()

  const [draftName, setDraftName] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = useCallback(() => {
    const name = draftName.trim() || `Version ${new Date().toLocaleString('en-GB')}`
    const outcome = saveVersion(name)
    if (outcome.ok) {
      setDraftName('')
      setSaveError(null)
      return
    }
    setSaveError(outcome.message ?? 'This version could not be saved.')
  }, [draftName, saveVersion])

  if (!isOpen) return null

  const lines =
    changeset && from && to ? describeChangeset(changeset, buildVersionLabelIndex(from, to)) : []

  // THE GATE THAT MAKES THE EMPTY STATE THE ONLY VOICE (L-11). A comparison
  // needs two DISTINCT versions to be about anything; with one (or none) the
  // panel says so plainly and offers nothing else. Deliberately derived from the
  // list rather than from `changeset != null` — the changeset is also null while
  // a selection is being changed, and the user must not watch the comparison
  // controls appear and disappear underneath them.
  const canCompare = versions.length >= 2

  return (
    <div
      className="fixed right-0 z-[2000]"
      style={{ top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)' }}
      data-testid="what-changed-panel"
    >
      <PanelShell
        icon={<History className="w-5 h-5" />}
        title="Version history"
        onClose={onClose}
        width="420px"
      >
        {/* WHAT A VERSION IS — before anything asks the user to make one.
            Stated once, at the top, because every other line in this panel is
            only meaningful if the reader has the right object in mind. */}
        <p
          className={`${typography.panelBody} text-text-light`}
          data-testid="versions-vocabulary-disclosure"
        >
          {VERSION_VS_RUN_DISCLOSURE}
        </p>

        {/* The team's durable, authoritative history is the primary surface.
            It renders honest sign-in/scope guidance for guests, including a
            purely local draft, without offering a dead shared action. */}
        <ServerVersionsSection />

        <PanelSection title="On this device — checkpoints">
          <p className={`${typography.panelMeta} text-text-light`}>
            A local safety history for this browser, not the authoritative shared model history.
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="version-name" className="sr-only">
              Checkpoint name
            </label>
            <input
              id="version-name"
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Name this checkpoint"
              className={`${typography.panelBody} flex-1 min-w-0 px-2 py-1.5 rounded-md border border-panel-border bg-panel text-text-body placeholder:text-text-light`}
            />
            <button
              type="button"
              onClick={handleSave}
              className={`${typography.panelBody} shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-text-on-color`}
            >
              <Save className="w-3.5 h-3.5" />
              Save checkpoint
            </button>
          </div>
          {saveError && (
            <p className={`${typography.panelBody} text-danger`} role="alert">
              {saveError}
            </p>
          )}
          <p
            className={`${typography.panelMeta} text-text-light`}
            data-testid="versions-storage-disclosure"
          >
            {VERSION_STORAGE_DISCLOSURE}
          </p>
        </PanelSection>

        {/* ── The honest empty states. Exactly one of these renders, and when one
            does, the comparison controls below do NOT (see `canCompare`). ── */}
        {versions.length === 0 && (
          <p className={`${typography.panelBody} text-text-light`} data-testid="versions-empty">
            No device checkpoints yet. Save one to keep a local safety copy.
          </p>
        )}

        {versions.length === 1 && (
          <p
            className={`${typography.panelBody} text-text-light`}
            data-testid="versions-single-capture"
          >
            One device checkpoint so far. Save a second to compare them.
          </p>
        )}

        {canCompare && (
          <PanelSection title="Compare device checkpoints">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="version-from"
                  className={`${typography.panelMeta} text-text-light w-10 shrink-0`}
                >
                  From
                </label>
                <select
                  id="version-from"
                  value={fromId ?? ''}
                  onChange={(event) => setFromId(event.target.value)}
                  className={`${typography.panelBody} flex-1 min-w-0 px-2 py-1.5 rounded-md border border-panel-border bg-panel text-text-body`}
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {optionCaption(version)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="version-to"
                  className={`${typography.panelMeta} text-text-light w-10 shrink-0`}
                >
                  To
                </label>
                <select
                  id="version-to"
                  value={toId ?? ''}
                  onChange={(event) => setToId(event.target.value)}
                  className={`${typography.panelBody} flex-1 min-w-0 px-2 py-1.5 rounded-md border border-panel-border bg-panel text-text-body`}
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {optionCaption(version)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </PanelSection>
        )}

        {canCompare && changeset && (
          <PanelSection title="Changes between these checkpoints">
            {changeset.isEmpty ? (
              <p className={`${typography.panelBody} text-text-light`}>
                No differences between these two checkpoints.
              </p>
            ) : (
              <ul className="space-y-1.5" data-testid="what-changed-list">
                {lines.map((line) => (
                  <li key={line.key} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={`${typography.panelBody} ${KIND_CLASS[line.kind]} shrink-0 w-3`}
                    >
                      {KIND_MARKER[line.kind]}
                    </span>
                    <span className={`${typography.panelBody} text-text-body`}>{line.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </PanelSection>
        )}

        {versions.length > 0 && (
          <PanelSection title="All device checkpoints">
            <ul className="space-y-1">
              {versions.map((version) => {
                const originLabel = versionOriginLabel(version.origin)
                return (
                  <li
                    key={version.id}
                    className="flex items-center justify-between gap-2"
                    data-testid="version-row"
                    data-version-origin={version.origin}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`${typography.panelBody} text-text-body truncate`}>
                        {version.name}
                      </span>
                      <span className={`${typography.panelMeta} text-text-light ml-2`}>
                        {formatTimestamp(version.createdAt)}
                      </span>
                      {/* WHO MADE THIS ROW. Shown only for captures the product
                          took by itself — the ones the user cannot otherwise
                          account for. A manual save needs no explanation. */}
                      {originLabel !== null && (
                        <span
                          className={`${typography.panelMeta} text-text-light ml-2 px-1.5 py-0.5 rounded border border-panel-border`}
                          data-testid="version-origin-badge"
                        >
                          {originLabel}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete checkpoint ${version.name}`}
                      onClick={() => removeVersion(version.id)}
                      className="shrink-0 p-1 rounded-md text-text-light hover:text-danger hover:bg-panel-hover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </PanelSection>
        )}

      </PanelShell>
    </div>
  )
}

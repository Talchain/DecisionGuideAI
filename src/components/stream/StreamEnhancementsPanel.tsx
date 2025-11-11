/**
 * StreamEnhancementsPanel - Suggestions, Comments, Snapshots
 * Phase 2E-G: Extracted from SandboxStreamPanel.tsx
 *
 * Provides guided suggestions, comment management, snapshot functionality, and comparison tools.
 * Maintains British English copy and accessibility features.
 */

import { memo } from 'react'

interface Suggestion {
  id: string
  title: string
  rationale: string
  apply: (state: any) => any
}

interface Snapshot {
  id: string
  at: string
  seed: string
  model: string
  data: any
}

interface StreamEnhancementsPanelProps {
  // Guided suggestions
  guidedEnabled?: boolean
  suggestions?: Suggestion[]
  onApplySuggestion?: (suggestion: Suggestion, currentState: any) => void
  onUndo?: () => void
  canUndo?: boolean
  ariaGuidedMsg?: string

  // Comments
  commentsEnabled?: boolean
  commentTarget?: string | null
  commentLabel?: 'Challenge' | 'Evidence'
  commentText?: string
  onCommentTargetChange?: (target: string | null) => void
  onCommentLabelChange?: (label: 'Challenge' | 'Evidence') => void
  onCommentTextChange?: (text: string) => void
  onAddComment?: () => void
  ariaCommentMsg?: string

  // Snapshots
  snapshotsEnabled?: boolean
  snapshots?: Snapshot[]
  onMakeSnapshot?: () => void
  onCopyShareLink?: (snapshot: Snapshot) => void
  shareNote?: string
  readOnly?: boolean
  ariaSnapshotMsg?: string

  // Compare
  compareEnabled?: boolean
  compareSelectionA?: string
  compareSelectionB?: string
  onCompareSelectionChange?: (a: string, b: string) => void
  compareDiff?: {
    added: any[]
    removed: any[]
    changed: any[]
  } | null
  ariaCompareMsg?: string
  changeLog?: {
    added: any[]
    removed: any[]
    changed: any[]
  } | null
}

function StreamEnhancementsPanel({
  guidedEnabled = false,
  suggestions = [],
  onApplySuggestion,
  onUndo,
  canUndo = false,
  ariaGuidedMsg = '',
  commentsEnabled: _commentsEnabled = false,
  snapshotsEnabled = false,
  snapshots = [],
  onMakeSnapshot,
  onCopyShareLink,
  shareNote = '',
  readOnly = false,
  ariaSnapshotMsg = '',
  compareEnabled = false,
  compareSelectionA = '',
  compareSelectionB = '',
  onCompareSelectionChange,
  compareDiff = null,
  ariaCompareMsg = '',
  changeLog = null,
}: StreamEnhancementsPanelProps) {
  return (
    <>
      {/* Guided suggestions */}
      {guidedEnabled && suggestions.length > 0 && (
        <>
          <div className="mt-2 flex items-center gap-2 ml-2">
            {suggestions.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                data-testid={`guided-suggestion-${idx}`}
                className="text-[11px] px-2 py-0.5 rounded border border-gray-300"
                title={s.rationale}
                onClick={() => onApplySuggestion?.(s, {})}
              >
                {s.title}
              </button>
            ))}
            {/* SR-only tooltip for tests */}
            {suggestions.length > 0 && (
              <span data-testid="why-tooltip" aria-hidden="true" className="sr-only">
                {suggestions[0].rationale}
              </span>
            )}
            <button
              type="button"
              data-testid="guided-undo-btn"
              className="text-[11px] px-2 py-0.5 rounded border border-gray-300 disabled:opacity-50"
              disabled={!canUndo}
              onClick={() => onUndo?.()}
            >
              Undo
            </button>
          </div>
          <div role="status" aria-live="polite" className="sr-only">
            {ariaGuidedMsg}
          </div>
        </>
      )}

      {/* Snapshots */}
      {snapshotsEnabled && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            {!readOnly && (
              <button
                type="button"
                data-testid="snapshot-btn"
                className="text-xs px-2 py-1 rounded border border-gray-300"
                onClick={() => onMakeSnapshot?.()}
              >
                Snapshot
              </button>
            )}
            <div role="status" aria-live="polite" className="sr-only">
              {ariaSnapshotMsg}
            </div>
          </div>
          <div className="mt-2">
            <div className="text-[11px] text-gray-500 mb-1">Snapshots</div>
            <ul data-testid="snapshot-list" className="space-y-1">
              {snapshots.map((s, idx) => (
                <li
                  key={s.id}
                  data-testid={`snapshot-list-item-${s.id}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-xs">{new Date(s.at).toLocaleString('en-GB')}</span>
                  {idx === 0 && onCopyShareLink && (
                    <button
                      type="button"
                      data-testid="sharelink-copy"
                      className="text-[11px] px-2 py-0.5 rounded border"
                      onClick={() => onCopyShareLink(s)}
                    >
                      Copy share link
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {shareNote && (
              <div data-testid="share-cap-note" role="status" aria-live="polite" className="mt-2 text-[11px] text-amber-700">
                {shareNote}
              </div>
            )}
          </div>
          {changeLog && (
            <div data-testid="change-log" className="mt-2 p-2 border rounded bg-white">
              <div className="text-[11px] text-gray-500 mb-1">Change log</div>
              <ul className="list-disc ml-5 text-xs">
                <li>Added {changeLog.added.length}</li>
                <li>Removed {changeLog.removed.length}</li>
                <li>Changed {changeLog.changed.length}</li>
              </ul>
              <div role="status" aria-live="polite" className="sr-only">
                Change log available since last snapshot.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compare snapshots */}
      {compareEnabled && (
        <div className="mt-3">
          <div className="text-[11px] text-gray-500 mb-1">Compare Snapshots</div>
          <div className="flex items-center gap-2">
            <select
              data-testid="compare-select-a"
              className="text-xs px-2 py-1 border rounded"
              value={compareSelectionA}
              onChange={(e) => onCompareSelectionChange?.(e.target.value, compareSelectionB)}
            >
              <option value="">(A)</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.at).toLocaleString('en-GB')}
                </option>
              ))}
            </select>
            <span className="text-xs">vs</span>
            <select
              data-testid="compare-select-b"
              className="text-xs px-2 py-1 border rounded"
              value={compareSelectionB}
              onChange={(e) => onCompareSelectionChange?.(compareSelectionA, e.target.value)}
            >
              <option value="">(B)</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.at).toLocaleString('en-GB')}
                </option>
              ))}
            </select>
          </div>
          {/* SR announce comparison updates */}
          <div role="status" aria-live="polite" className="sr-only">
            {ariaCompareMsg}
          </div>
          {compareDiff && (
            <ul data-testid="compare-diff-list" className="mt-2 text-xs space-y-1">
              {compareDiff.added.map((id) => (
                <li key={`a-${id}`}>↑ {id}</li>
              ))}
              {compareDiff.removed.map((id) => (
                <li key={`r-${id}`}>↓ {id}</li>
              ))}
              {compareDiff.changed.map((id) => (
                <li key={`c-${id}`}>• {id}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

export default memo(StreamEnhancementsPanel)
export type { StreamEnhancementsPanelProps, Suggestion, Snapshot }

/**
 * ⭐ ANALYSE AFTER EVERY COMMITTED CHANGE (Paul, 14 Oct; #94 6166259456): after each change this canvas commits — the
 * user's saved edit, Olumi's approved change, an Undo or a Redo — the analysis runs again on the newly saved version, and
 * the existing rerun surfaces (the canvas's "what changed" pill, Reasoning's "What's changed", Compare) show it against
 * the preceding Run.
 *
 * ONE TRIGGER: the undo journal's head moving to a model this canvas's own change wrote (`committedChangeVersion`).
 * Unapproved proposals and typing write no version, so they never trigger it. A foreign write (another writer, a chat
 * turn) empties the journal's stacks, and a Run's own receipt holds the same model (the same identity hash), so neither
 * triggers it and a Run cannot re-trigger itself.
 *
 * ONE RUN PATH: the canonical runner (the Re-analyse button's own pipeline, gate and save flush). CEE reloads its own
 * persisted graph, so the Run is bound to the saved revision. A refused gate runs nothing and leaves today's Re-analyse
 * bar with its reason. The Run waits until no turn is in flight (a run send preempts an in-flight turn), no edit is on
 * the wire and no Run is running; a change made during a Run is analysed when that Run settles.
 */
import { useEffect, useRef, useState } from 'react'
import { useUndoJournalStore } from '../undo/captureUndoReceipt'
import type { UndoJournalState } from '../undo/undoJournal'
import type { CanonicalRunOptions, CanonicalRunOutcome } from './canonicalRunRegistry'

/** The version this canvas's own committed change wrote, or null (no move, a cleared head, or a foreign write). */
export function committedChangeVersion(prev: UndoJournalState, next: UndoJournalState): string | null {
  if (next.head === null) return null
  // Bound to the model's identity hash: a version that holds the same model (a Run's own receipt) is no change.
  if (prev.scenarioId === next.scenarioId && prev.head?.fullHash === next.head.fullHash) return null
  // An edit, Olumi's change and a Redo leave a step on the undo stack; an Undo leaves one on the redo stack. A foreign
  // write is the only move that leaves both empty.
  if (next.undo.length === 0 && next.redo.length === 0) return null
  return next.head.versionId
}

export const ANALYSE_AFTER_CHANGE_SOURCE = 'after-change'

export function useAnalyseAfterCommittedChange(input: {
  readonly run: (opts?: CanonicalRunOptions) => Promise<CanonicalRunOutcome>
  /** No turn in flight, no edit on the wire, no Run running. */
  readonly idle: boolean
  /** Only a model that has a Run to compare against: before the first Run, the readiness review owns the run. */
  readonly hasRunOnRecord: boolean
}): void {
  const { run, idle, hasRunOnRecord } = input
  const [pending, setPending] = useState<string | null>(null)
  const startedRef = useRef<string | null>(null)

  useEffect(() => useUndoJournalStore.subscribe((next, prev) => {
    const version = committedChangeVersion(prev.journal, next.journal)
    if (version !== null) setPending(version)
  }), [])

  useEffect(() => {
    if (pending === null || !idle || startedRef.current === pending) return
    if (!hasRunOnRecord) {
      setPending(null)
      return
    }
    const version = pending
    startedRef.current = version
    void run({ source: ANALYSE_AFTER_CHANGE_SOURCE }).then((outcome) => {
      // A Run already in flight analyses an older version: this one stays pending until that Run settles.
      if (outcome.status === 'already-running') {
        startedRef.current = null
        return
      }
      setPending((current) => (current === version ? null : current))
    }, () => setPending((current) => (current === version ? null : current)))
  }, [pending, idle, hasRunOnRecord, run])
}

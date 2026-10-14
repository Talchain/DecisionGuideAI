/**
 * ⭐ ANALYSE AFTER EVERY CANVAS-LOCAL COMMIT (Paul, 14 Oct; #94 6166259456; DL rule, 14 Oct): after each change this
 * canvas commits on its own — a direct canvas edit CEE saved with its receipt, or a journal Undo/Redo restore — the
 * analysis runs again on the newly saved version, and the existing rerun surfaces (the canvas's "what changed" pill,
 * Reasoning's "What's changed", Compare) show it against the preceding Run.
 *
 * ⛔ CEE OWNS CHANGES MADE THROUGH A CEE TURN. A chat change (an approval, an edit asked in chat) is run by CEE in that
 * turn; it never notes a canvas-local commit, so nothing here runs it a second time.
 *
 * ⛔ DELIVER, DON'T RE-RUN. At dispatch the Run on screen is asked whether it is already current for this model
 * (`selectRunAffirmedCurrent`, the one authority an action reads at dispatch: CEE's verdict comparing the Run's graph hash
 * with the current one, under the composed analysis state). If the commit's own
 * turn already carried a Run for the saved model, that Run is shown and nothing runs again.
 *
 * ONE RUN PATH: the canonical runner (the Re-analyse button's own pipeline, gate and save flush). CEE reloads its own
 * persisted graph, so the Run is bound to the saved revision. A refused gate runs nothing and leaves today's Re-analyse
 * bar with its reason. The Run waits until no turn is in flight (a run send preempts an in-flight turn), no edit is on
 * the wire and no Run is running; a change made during a Run is analysed when that Run settles.
 */
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { useCanvasStore } from '../store'
import { selectRunAffirmedCurrent } from '../state/analysisStateSelector'
import type { CanonicalRunOptions, CanonicalRunOutcome } from './canonicalRunRegistry'

interface CanvasLocalCommit {
  /** Increases once per commit, so two commits of one version id are still two commits. */
  readonly seq: number
  readonly versionId: string | null
}

const useCanvasLocalCommitStore = create<CanvasLocalCommit>(() => ({ seq: 0, versionId: null }))

/** A canvas-local commit landed: a direct canvas edit's receipt, or a journal Undo/Redo restore. */
export function noteCanvasLocalCommit(versionId: string): void {
  useCanvasLocalCommitStore.setState((s) => ({ seq: s.seq + 1, versionId }))
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
  const commitSeq = useCanvasLocalCommitStore((s) => s.seq)
  const [handledSeq, setHandledSeq] = useState(commitSeq)
  const startedRef = useRef<number | null>(null)
  const pending = commitSeq !== handledSeq

  useEffect(() => {
    if (!pending || !idle || startedRef.current === commitSeq) return
    const seq = commitSeq
    // Before the first Run, or when the Run on screen already holds this model, there is nothing to run.
    if (!hasRunOnRecord || selectRunAffirmedCurrent(useCanvasStore.getState())) {
      setHandledSeq(seq)
      return
    }
    startedRef.current = seq
    void run({ source: ANALYSE_AFTER_CHANGE_SOURCE }).then((outcome) => {
      // A Run already in flight analyses an older version: this one stays pending until that Run settles.
      if (outcome.status === 'already-running') {
        startedRef.current = null
        return
      }
      setHandledSeq((current) => Math.max(current, seq))
    }, () => setHandledSeq((current) => Math.max(current, seq)))
  }, [pending, idle, hasRunOnRecord, run, commitSeq])
}

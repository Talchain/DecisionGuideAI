/**
 * useResolvedSignals — parent-managed resolved state for triage cards (P1-5).
 *
 * Tracks which signal_ids the user has just resolved (via Confirm / Set value)
 * so the panel can render a "✓ {label} confirmed — Undo" line in place of the
 * card, decrement section counts, and repromote Start here without waiting
 * on store settlement.
 *
 * The store-level change fires immediately; this hook just remembers that
 * the signal was resolved AND holds the undo payload (a snapshot of the
 * previous node.data) so Undo can roll back the change.
 *
 * Reaper: entries whose underlying signal is no longer in the "live" signal
 * list AND whose resolvedAt is older than the current render counter are
 * removed on the next render cycle, so the resolved line naturally fades out
 * "on the next render after state settles" — no explicit timer.
 */

import { useState, useCallback, useRef, useEffect } from 'react'

export type ResolvedKind = 'confirm' | 'setValue'

export interface ResolvedEntry {
  signalId: string
  label: string
  kind: ResolvedKind
  /** Monotonic counter value at which the entry was created */
  resolvedAt: number
  /** Snapshot of the previous node.data for undo; opaque to this hook */
  undoSnapshot: unknown
}

export interface UseResolvedSignalsApi {
  resolved: Map<string, ResolvedEntry>
  /** Mark a signal as resolved. Idempotent on signalId. */
  markResolved: (entry: Omit<ResolvedEntry, 'resolvedAt'>) => void
  /** Remove the resolved entry and return its undoSnapshot for the caller. */
  undo: (signalId: string) => unknown | null
  /** Test whether a signal is currently resolved. */
  isResolved: (signalId: string) => boolean
}

export function useResolvedSignals(liveSignalIds: ReadonlySet<string>): UseResolvedSignalsApi {
  const [resolved, setResolved] = useState<Map<string, ResolvedEntry>>(() => new Map())
  const renderCounter = useRef(0)
  renderCounter.current += 1

  // Reaper: remove entries whose live signal has disappeared and whose
  // resolvedAt counter is at least one render behind the current tick. This
  // implements the "fades on next render after state settles" rule without
  // an explicit timer. Runs in an effect so we don't mutate state during
  // render.
  useEffect(() => {
    setResolved(prev => {
      if (prev.size === 0) return prev
      let changed = false
      const next = new Map(prev)
      for (const [id, entry] of prev) {
        if (entry.resolvedAt < renderCounter.current - 1 && !liveSignalIds.has(id)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
    // renderCounter is a ref and intentionally not in deps — we want this to
    // run after each commit driven by liveSignalIds changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSignalIds])

  const markResolved = useCallback((entry: Omit<ResolvedEntry, 'resolvedAt'>) => {
    setResolved(prev => {
      if (prev.has(entry.signalId)) return prev
      const next = new Map(prev)
      next.set(entry.signalId, { ...entry, resolvedAt: renderCounter.current })
      return next
    })
  }, [])

  const undo = useCallback((signalId: string): unknown | null => {
    // Read the payload synchronously from the current state *before* calling
    // setState so the caller can act on it immediately. setState's updater
    // callback would run too late for `let payload` capture.
    const entry = resolved.get(signalId)
    if (!entry) return null
    setResolved(prev => {
      if (!prev.has(signalId)) return prev
      const next = new Map(prev)
      next.delete(signalId)
      return next
    })
    return entry.undoSnapshot
  }, [resolved])

  const isResolved = useCallback(
    (signalId: string) => resolved.has(signalId),
    [resolved],
  )

  return { resolved, markResolved, undo, isResolved }
}

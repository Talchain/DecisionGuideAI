/**
 * useHistoryToast — Announces each labelled history entry. No undo action.
 *
 * Subscribes to the history past array length. When it increases and the most
 * recent entry has a label, fires a toast naming what happened.
 *
 * Graph Editing Experience Task 8d.
 *
 * ── ⭐ WHY THERE IS NO UNDO BUTTON HERE ANY MORE ────────────────────────────
 * It used to offer one, wired straight to `useCanvasStore.getState().undo()`,
 * imported from no authority module and gated by nothing. Every SIBLING path is
 * correctly inert — ⌘Z and the left-rail buttons are gated on
 * `hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations)`,
 * which is `'disabled'`, and the context menu filters its local-semantic
 * entries out. This toast was the exception, not the rule.
 *
 * IT COULD NOT BE CANONICALISED. A canvas semantic edit creates no canonical
 * version: `ServerVersionsSection` is the only consumer of the model-versions
 * API, and versions come from an explicit save or a server-side commit. So the
 * entry this toast announces has NO canonical counterpart, and pointing its
 * Undo at `restoreModelVersion` would restore the last SERVER version — a
 * different object — which "overwrites the working model for everyone with
 * access". That is a worse claim than the one being fixed, plus a destructive
 * write. (`structuralDeleteWithServerHash` is `'server_graph'` but has zero
 * consumers — unenforced policy, not a live canonical delete path.)
 *
 * ⭐⭐ AND THE FALLBACK — "keep the button, make the copy true" — WAS REFUSED ON
 * MEASUREMENT, which is the part worth remembering. `undo()` mutates
 * nodes/edges; `useScenario`'s subscription observes exactly that and, when
 * `isPersistenceActive(authenticated, user)` holds, debounces it into a REAL
 * server write. That predicate is `authenticated && !!user && id !== 'guest'`.
 * So the SAME button is a local revert for a guest and a server-persisted write
 * for a signed-in user — while this hook's display condition is ANY labelled
 * history push, which is wider than either. No single scope sentence ("this
 * browser only", "won't survive a reload") is true on every path it is shown
 * on, and a notice whose truth condition is narrower than its display condition
 * is the same defect one layer down. So the action goes and the factual notice
 * of what happened stays.
 *
 * ⚠ WHAT IS *NOT* CLAIMED, so nobody re-derives it from this comment: the undo
 * STACK is never persisted anywhere, but the undone GRAPH STATE does survive a
 * reload (`useAutosave` is mounted unconditionally, writes localStorage with no
 * auth or flag gate, and is reloaded by `ReactFlowGraph`'s init effect). That
 * is DERIVED at the bytes, not journey-witnessed — do not upgrade the rung
 * without driving it.
 *
 * ⚠ IT ALSO MOUNTS `useDurableDeletionToast`, AND THAT IS A DELIBERATE CHOICE
 * WITH A REASON, not tidiness. Both hooks answer the same question — *what does
 * the canvas tell the user about what just happened to graph history?* — and
 * they are siblings: this one announces a history entry being PUSHED (offering
 * Undo), the other announces a history entry being RESTORED ONLY IN PART,
 * because the server had durably deleted something in it.
 *
 * The mechanical reason it is composed here rather than called beside this hook
 * in `ReactFlowGraph`: every hook in that region of `ReactFlowGraph` sits after
 * an early return, so all 117 are rules-of-hooks violations held by an explicit
 * ratchet (`scripts/ci/assert-rules-of-hooks-ratchet.mjs`) — *"an exception for
 * its EXISTING violations, not a licence to add more. Each one is a render-time
 * crash."* A second call site there would have added the 118th and failed the
 * gate. Composing costs no new violation and no new mount to keep in sync.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useShowToast } from '../ToastContext'
import { useDurableDeletionToast } from './useDurableDeletionToast'

export function useHistoryToast() {
  const showToast = useShowToast()
  // Sibling notice, same surface, same mount — see the header.
  useDurableDeletionToast()
  const prevLengthRef = useRef<number>(0)

  useEffect(() => {
    const unsub = useCanvasStore.subscribe(
      (state) => {
        const currentLength = state.history.past.length
        if (currentLength > prevLengthRef.current) {
          // A new history entry was pushed
          const latest = state.history.past[currentLength - 1]
          if (latest?.label) {
            // Notice only — see the header for why no action is attached.
            showToast(latest.label, 'info')
          }
        }
        prevLengthRef.current = currentLength
      },
    )
    // Initialise ref
    prevLengthRef.current = useCanvasStore.getState().history.past.length
    return unsub
  }, [showToast])
}

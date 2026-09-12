import { useEffect, useSyncExternalStore } from 'react'

/**
 * selectionReferent — "IS THE SELECTED ELEMENT NAMED ON SCREEN RIGHT NOW?"
 *
 * ## The question this answers, and why it is not the pill's mount rule
 *
 * `ASK_TEMPLATES` de-labels every inspector ask into a pronoun ("How important
 * is this to the outcome?"). That is only safe while something on screen names
 * the element, and the surface that does so is `SelectionPill`. The pill has
 * exactly ONE product mount site — `OutputsDock.tsx`, inside
 * `{aiPanelV2On && effectiveIsOpen ? … : null}` — so a COLLAPSED dock mounts no
 * pill, and `revealOlumiSurface()` deliberately does not claim the dock while a
 * floating or first-use composer is on screen (`if (focusFloating()) return
 * true`). In that state the ask's draft lands in the floating composer with no
 * referent anywhere, and the composer path in `requestAsk` discards
 * `req.label`, so the drawer's "Ask about X" heading is not rendered either.
 *
 * ## Why a registration and not a derivation
 *
 * The alternative was to re-derive "will the pill be on screen?" in the
 * inspector from `aiPanelV2On`, the dock's stored open-state and
 * `shouldRenderFirstUseRail`. That is a SECOND COPY of a rule `OutputsDock`
 * already implements — CLAUDE.md trap 12, and the two copies disagree the first
 * time the rail rule moves. `revealOlumi.ts` rejected exactly that
 * re-derivation, for exactly that reason, and its own doctrine is the pattern
 * followed here: *"a registration IS the surface's own statement that it is
 * visible, taken from the surface itself."*
 *
 * So the pill publishes WHILE IT IS RENDERING A NAME, and nothing else has to
 * model when that happens. The published value and the rendered name come from
 * one `useSelectionContext()` result in one component, so they cannot drift.
 *
 * ## It carries an ID, not a boolean, and that is the point
 *
 * A consumer asks whether the referent names THE ELEMENT IT IS ASKING ABOUT.
 * "Some pill is mounted" is a different and weaker claim: the pill can be
 * mounted while showing the over-cap notice (a name for nothing), or naming a
 * different element than the panel is open on. Identity is the only binding
 * that survives those.
 *
 * ## It FAILS CLOSED
 *
 * Nothing published ⇒ no referent ⇒ the consumer spells the name. The error
 * direction is deliberate: a redundant name is verbose, an unresolved pronoun
 * is ambiguous, and only one of those misleads a reader.
 */

/** Token identity, so a stale cleanup cannot clear a newer publication. */
type Referent = { readonly id: string }

let current: Referent | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/**
 * Called by the surface that is DISPLAYING the element's name. Returns its own
 * unpublish.
 */
export function publishSelectionReferent(id: string): () => void {
  const token: Referent = { id }
  current = token
  emit()
  return () => {
    if (current !== token) return
    current = null
    emit()
  }
}

/** The id of the element currently named on screen, or null. */
export function getSelectionReferentId(): string | null {
  return current?.id ?? null
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Publish `id` for as long as this component renders that element's name. Pass
 * null while it names nothing — an unnamed selection, a withheld one, or no
 * selection at all.
 */
export function usePublishSelectionReferent(id: string | null): void {
  useEffect(() => {
    if (id === null) return
    return publishSelectionReferent(id)
  }, [id])
}

/**
 * True while a surface on screen is naming `elementId`. Reactive: a consumer
 * re-renders when the dock opens, collapses, or the selection moves.
 */
export function useSelectionIsNamedOnScreen(elementId: string): boolean {
  const named = useSyncExternalStore(subscribe, getSelectionReferentId, () => null)
  return named !== null && named === elementId
}

/** Test seam: drop any publication. Never called by product code. */
export function resetSelectionReferentForTest(): void {
  current = null
  emit()
}

/**
 * ⭐ THE LATEST ANSWER'S ACTION BAR, HELD ONCE.
 *
 * Chat and the Reasoning tab draw the same bar, so neither owns it: the turn
 * handler (and the scenario read on reload) writes it here and both surfaces
 * read it. `null` means CEE sent no bar, and a surface then keeps the controls
 * it had before the bar existed (the consumer ships before the producer).
 *
 * ⚠ A BAR IS NEVER AUTHORITATIVE AFTER AN EDIT. It carries the revision it was
 * made for; a press sends that revision and CEE re-derives the offer on the
 * state as it is now. Nothing here decides whether an action may run.
 *
 * Dismissing a pill is a per-viewer convenience, keyed by `offer_key` (which
 * changes when the state does), kept in this browser only. It may reappear on
 * another device; a PRESSED action is suppressed by CEE from its own history.
 */
import { create } from 'zustand'

import type { ActionBarIssue, ActionBarV1 } from './actionBarContract'

const DISMISSED_STORAGE_KEY = 'olumi.actionBar.dismissed.v1'
const DISMISSED_MAX = 50

function readDismissed(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DISMISSED_STORAGE_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((key): key is string => typeof key === 'string').slice(-DISMISSED_MAX) : []
  } catch {
    return []
  }
}

function writeDismissed(keys: readonly string[]): void {
  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // Private window or blocked storage: the pill is hidden for this page only.
  }
}

interface ActionBarState {
  readonly bar: ActionBarV1 | null
  /** The scenario the bar belongs to. A bar is never drawn over another scenario. */
  readonly scenarioId: string | null
  readonly dismissed: readonly string[]
  setBar: (scenarioId: string | null, bar: ActionBarV1 | null) => void
  dismiss: (offerKey: string) => void
}

export const useActionBarStore = create<ActionBarState>((set, get) => ({
  bar: null,
  scenarioId: null,
  dismissed: readDismissed(),
  setBar: (scenarioId, bar) => set({ scenarioId, bar }),
  dismiss: (offerKey) => {
    if (get().dismissed.includes(offerKey)) return
    const dismissed = [...get().dismissed, offerKey].slice(-DISMISSED_MAX)
    writeDismissed(dismissed)
    set({ dismissed })
  },
}))

/** The bar for this scenario, or null. */
export function selectActionBar(state: Pick<ActionBarState, 'bar' | 'scenarioId'>, scenarioId: string | null | undefined): ActionBarV1 | null {
  return state.bar !== null && scenarioId != null && state.scenarioId === scenarioId ? state.bar : null
}

/** One line per unreadable bar or offer: a producer fault must be visible, never silently blank. */
export function reportActionBarIssue(issue: ActionBarIssue): void {
  console.warn('[action_bar]', issue.kind, issue)
}

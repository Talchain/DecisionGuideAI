import { useUIStore } from '../../stores/uiStore'
import { focusFloating } from '../hooks/useFloatingFocus'
import { isAiPanelV2Enabled } from '../../flags'
import { focusDockedOlumi } from './dockedOlumiFocus'

/**
 * ONE OLUMI, WHEREVER THE USER LEFT IT.
 *
 * This is THE convergence primitive for the whole workspace: every Ask-Olumi,
 * chip, coaching and rerun action launched from the Graph, the Analysis
 * surface or the Inspector arrives here — six direct call sites plus
 * `withOlumiReveal`, which wraps every guidance-store send. Whatever this
 * function does IS what "actions converge on one Olumi interaction model"
 * means in practice.
 *
 * ── WHAT IT USED TO DO, AND WHY THAT WAS TWO DEFECTS ──────────────────────
 *
 *   forceActivateOutputTab('olumi')   // claim the DOCK, unconditionally
 *   focusFloating()                   // focus the FLOATING panel
 *
 * Those two lines fight each other, and the fight is visible to the user.
 * Forcing the docked Olumi tab makes `dockHostsOlumi` true, and
 * `FloatingOlumiPanel` returns null the moment it does
 * (`FloatingOlumiPanel.tsx:856`, `yieldToDockedOlumi`). So:
 *
 *   1. A user working in the floating Olumi window who clicked "Ask Olumi" on
 *      a node had that window CLOSED and the conversation relocated to the
 *      dock. The product overrode the surface the user had chosen — the
 *      opposite of converging on their interaction model.
 *   2. `focusFloating()` then focused the panel that was about to unmount,
 *      while the surface that actually took over — the docked composer in
 *      `PersistentInputStrip` — got no focus, because nothing had ever
 *      registered a channel for it. The action "worked" and the user still had
 *      to click into the box before typing.
 *
 * ── THE RULE, AND WHERE ITS EVIDENCE COMES FROM ───────────────────────────
 *
 * Reveal the surface the user ALREADY HAS; claim the dock only when no Olumi
 * composer is on screen.
 *
 * ⭐ The test for "is a floating/hero composer on screen?" is
 * `focusFloating()`'s OWN RETURN VALUE, and that is deliberate. Both floating
 * surfaces register their focus channel under exactly the condition that makes
 * them paint — `FloatingOlumiPanel` under `isOpen && !yieldToFirstUse &&
 * !yieldToDockedOlumi`, `FirstUseComposer` under its `shouldRender` — and
 * both deregister on cleanup. So a registration IS the surface's own statement
 * that it is visible, taken from the surface itself.
 *
 * The alternative was to re-derive visibility here from the canvas node count,
 * the dock's persisted open-state and the active tab. That would be a SECOND
 * copy of a rule the surfaces already implement (platform trap 12 — the two
 * copies disagree the first time the rail rule moves), and it would have made
 * this module import `OutputsDock`, closing a real cycle
 * (`revealOlumi → OutputsDock → guidanceStore → revealOlumi`). Asking the
 * surface is both cheaper and truer than modelling it.
 *
 * `forceActivateOutputTab` remains the right call on the dock path and does
 * more than switch a tab: it opens a collapsed dock and ends the first-use
 * rail, which is what makes "revealed" true rather than merely selected.
 */
export function revealOlumiSurface(): void {
  // Flag OFF is the rollback posture: `OutputsDock` redirects an 'olumi'
  // activation to 'results', so claiming the dock would front the WRONG tab.
  // Best-effort floating focus, exactly as before — this path is unchanged.
  if (!isAiPanelV2Enabled()) {
    focusFloating()
    return
  }

  // A floating or first-use composer is on screen and has been focused. Do NOT
  // touch the dock: claiming it retires the very surface just revealed, and on
  // an empty canvas it would retire it in favour of a 40px rail that cannot
  // host a composer at all — stranding the user with nowhere to type.
  if (focusFloating()) return

  // Nothing floating is visible, so the dock is (or becomes) the host. Force-
  // activate even when the Olumi tab is already selected: the version counter
  // is what opens a collapsed dock and ends the first-use rail.
  useUIStore.getState().forceActivateOutputTab('olumi')

  // The composer may not be in composer mode yet — the activation above is a
  // store write and `PersistentInputStrip` re-renders after it. Try now (the
  // already-hosting case) and once more on the next frame.
  //
  // ⚠ NO FALLBACK TO `focusFloating()` HERE. It has already returned false, and
  // reaching for it again after claiming the dock is exactly the defect above.
  if (focusDockedOlumi()) return
  scheduleFrame(() => { focusDockedOlumi() })
}

/** rAF where it exists, a macrotask otherwise (jsdom/node without rAF). */
function scheduleFrame(fn: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => fn())
    return
  }
  setTimeout(fn, 0)
}

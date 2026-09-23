import { useUIStore } from '@/stores/uiStore'

/**
 * ⭐ Open the Model tab at ONE option's detail, with its first empty
 * effect-value input focused.
 *
 * THE USER PROBLEM: an option with no effect values is left out of the
 * analysis, and until 23 Sep 2026 the only way to give it one was a sentence
 * typed to Olumi. The Model tab's option detail now renders a direct input per
 * factor the option is linked to and does not yet change. This is the ONE route
 * to it from elsewhere — the canvas node card's "Not in this analysis" pill
 * (owned by the node-card lane) calls it.
 *
 * ⚠ IT RIDES THE EXISTING MECHANISM, and adds only the row-level half.
 * `openModelValueEditor` (`canvas/nodes/shared/`) is the precedent, and its
 * order is kept for its reasons:
 *   1. TAB — `diagnostics` is the Model tab's code id. A pending request on a
 *      tab nobody is on points a surface nobody is looking at.
 *   2. SECTION — `options`, so `ModelTabBody` opens and scrolls to that group
 *      (the outline arrives collapsed by design).
 *   3. OPTION — `pendingOptionValueInput`, which `ModelTabBody` consumes and
 *      hands to the panel; the panel selects the option and its detail region
 *      focuses the first empty input, once.
 *
 * ⚠ NAVIGATION IS NOT A MUTATION. Nothing here consults `CANONICAL_EDIT_AUTHORITY`
 * or writes the model; the input's own authority (`option_intervention_edit`
 * via `useModelEditAuthority.proposeOptionIntervention`) decides what saves.
 *
 * ⚠ IT LIVES OUTSIDE `model-tab-v2/` ON PURPOSE. That directory may not read or
 * write a store, and only `ModelTabBody` may import it
 * (`modelTabV2Boundary.sourceScan`). This file therefore imports nothing from it.
 *
 * An option linked to NO factor still lands: its detail opens, with nothing to
 * focus, and the section notice there says to link it first.
 */
export function openOptionValueInput(optionId: string): void {
  if (!optionId) return
  const ui = useUIStore.getState()
  ui.setActiveOutputTab('diagnostics')
  ui.requestModelTabSection('options')
  ui.requestOptionValueInput(optionId)
}

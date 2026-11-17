import { useUIStore } from '../../stores/uiStore'
import { useViewStore } from '../../olumiView/store'
import { useReveal } from '../../olumiView/reveal'
import { forgetLanded } from '../../olumiView/revealReturn'
import { openOutcome } from './OutcomePanel'

/**
 * THE WAY TO AN OUTCOME FORM, from anywhere in the workspace: the one rule for "no outcome yet", and the one step that opens the existing
 * form (`OutcomePanel`) under its commitment in the Team tab and brings it into view. Nothing is written here: the form's own write is the
 * only one. Callers: the Olumi tab's saved-expectation card (`olumiView/v12/learning`) and the Team tab's nudges.
 */

/** The commitments nobody has recorded an outcome for yet, in the order given. */
export const withoutOutcome = <C extends { readonly outcomes: readonly unknown[] }>(commitments: readonly C[]): C[] =>
  commitments.filter((k) => k.outcomes.length === 0)

/** Open that commitment's outcome form in the Team tab, in view, its first field focused. */
export function goToOutcome(sid: string, id: number): void {
  // Team's forms are held while an earlier version is drawn (TeamTab): nothing opens there.
  if (useViewStore.getState().at !== null) return
  // A reveal or evidence panel fills the Team tab in place of its panels: it steps aside, as it does for the lens bar's Team button.
  forgetLanded(); useReveal.getState().select(null)
  openOutcome(sid, id)
  // The dock's own consumer fronts the results panel and opens a collapsed dock (OutputsDock, on the version this bumps).
  useUIStore.getState().forceActivateOutputTab('team')
  // The form is drawn once the tab is: two frames from outside Team (CardDiffers' openDiffer waits the same).
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const form = document.querySelector(`[data-testid="team-outcome-form-${id}"]`)
    form?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    form?.querySelector<HTMLElement>('textarea')?.focus({ preventScroll: true })
  }))
}

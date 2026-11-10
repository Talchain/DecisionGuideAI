/**
 * Where a LANDED reveal panel returns (P1 fix, V11 lane 10 Nov: after the landing, the journey could neither reach Team's titled panel
 * nor the dock's tabs). The reveal panel is a focused panel that steps the tab strip out of its way, so a panel the person did not open
 * themselves must hand the dock back as it was: closing it fronts the tab that was showing before it landed. A panel the person opened
 * from a chip keeps its old close (back to Team). Kept apart from revealLanding so RevealDock can read it without importing the landing.
 */
import { useUIStore, type OutputTab } from '../stores/uiStore'

let landed: { chip: string; tab: OutputTab } | null = null

/** The landing records the chip it opened and the tab that was fronted before it. */
export function noteLanded(chip: string, tab: OutputTab): void { landed = { chip, tab } }

/** On closing the reveal panel showing `chip`: front the tab it landed over, once; false when this panel did not land. */
export function returnFromLanded(chip: string | null): boolean {
  if (landed === null || chip === null || landed.chip !== chip) return false
  const tab = landed.tab
  landed = null
  useUIStore.getState().forceActivateOutputTab(tab)
  return true
}

/** The person asked for something else (Team from the canvas): the landed panel is gone, and so is where it would return. */
export function forgetLanded(): void { landed = null }

/**
 * P1c (the approved Reveal comp; Codex grade 10 Nov): while a reveal panel or evidence is open in Team on the olumi-core lane, the composer
 * steps aside and the panel's own question and actions are the dock's foot. OutputsDock reads this one rule.
 */
export function composerStepsAside(coreLane: boolean, revealOpen: boolean, tab: OutputTab): boolean {
  return coreLane && revealOpen && tab === 'team'
}

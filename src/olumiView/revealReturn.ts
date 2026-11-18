/**
 * Where a reveal panel returns. A panel is only ever opened by a press (a chip, the Team tab, the canvas's mark); the automatic landing is gone
 * (18 Nov). The dock's tab strip stays visible while it is open, and closing it fronts the tab that was showing before it opened and
 * restores the camera.
 */
import { useUIStore, type OutputTab } from '../stores/uiStore'

let captureCamera: (() => () => void) | null = null
export function registerRevealReturnCamera(capture: () => () => void): () => void {
  captureCamera = capture
  return () => { if (captureCamera === capture) captureCamera = null }
}
const dockScroll = (): Element | null => typeof document === 'undefined' ? null : document.querySelector('[data-testid="view-chat-scroll"], [data-testid="outputs-dock"] .olumi-scrollbar')
let landed: { chip: string; tab: OutputTab; restore: (() => void) | null; scroll: number } | null = null

/** An opening records its chip, originating tab, camera and dock scroll position. */
export function noteLanded(chip: string, tab: OutputTab): void {
  landed = landed === null ? { chip, tab, restore: captureCamera?.() ?? null, scroll: dockScroll()?.scrollTop ?? 0 } : { ...landed, chip }
}

/** On closing the reveal panel showing `chip`: front the tab it landed over, once; false when this panel did not land. */
export function returnFromLanded(chip: string | null): boolean {
  if (landed === null || chip === null || landed.chip !== chip) return false
  const before = landed
  landed = null
  useUIStore.getState().forceActivateOutputTab(before.tab)
  before.restore?.()
  if (typeof window !== 'undefined') window.requestAnimationFrame(() => { const scroll = dockScroll(); if (scroll) scroll.scrollTop = before.scroll })
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

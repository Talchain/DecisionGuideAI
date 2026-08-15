import { useUIStore } from '../../stores/uiStore'
import { focusFloating } from '../hooks/useFloatingFocus'
import { isAiPanelV2Enabled } from '../../flags'

/**
 * Bring the Olumi chat surface into view after an action sends a message, so the
 * user sees their message land and Olumi's reply. Mirrors the live-diagnosed
 * reveal in useConversationActions: forceActivate the docked Olumi tab (bumps the
 * version so the dock reconciles + opens even when the tab value is unchanged;
 * gated on aiPanelV2 because OutputsDock redirects 'olumi'→'results' otherwise),
 * then best-effort focus a hosting floating panel.
 */
export function revealOlumiSurface(): void {
  frontOlumiSurface()
  focusFloating()
}

/**
 * Front the Olumi surface WITHOUT taking keyboard focus.
 *
 * This is the half that the universal "a programmatic send must reveal the
 * chat" rule uses (see `guidanceStore.registerConversationCallbacks`). It is
 * deliberately narrower than `revealOlumiSurface`:
 *
 *  - Fronting is about VISIBILITY — the user must see their message land.
 *    That is the rule Paul stated on 15 Aug and it applies to every send.
 *  - Taking focus is a separate decision, and taking it universally would be
 *    harmful: `useKeyboardShortcuts` bails out of the WHOLE handler when the
 *    event target is an INPUT/TEXTAREA, so parking the caret in the composer
 *    silently kills the V / H / Space canvas tool shortcuts. Surfaces that
 *    genuinely want the caret (the composer-adjacent CTAs) still call
 *    `revealOlumiSurface` and opt into it explicitly.
 *
 * `forceActivateOutputTab` (rather than `setActiveOutputTab`) because only the
 * force variant bumps the version counter that makes OutputsDock un-hide an
 * occluded dock and un-collapse a closed one — a send into a collapsed dock is
 * otherwise invisible even though the tab value is already correct.
 */
export function frontOlumiSurface(): void {
  // Gated on aiPanelV2 because OutputsDock redirects 'olumi'→'results' when
  // the flag is off, which would front the WRONG tab.
  if (isAiPanelV2Enabled()) {
    useUIStore.getState().forceActivateOutputTab('olumi')
  }
}

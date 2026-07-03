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
  if (isAiPanelV2Enabled()) {
    useUIStore.getState().forceActivateOutputTab('olumi')
  }
  focusFloating()
}

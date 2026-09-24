/**
 * The Olumi tab body's FALLBACK registration, as identities — shared between
 * the writer (`OlumiTabBody`) and the one reader that knows when its session
 * ends (`ConversationProvider`). A module of its own so neither imports the
 * other (the provider wraps the tab body).
 *
 * ⭐ WHY THE PROVIDER, NOT THE TAB BODY, RELEASES THEM. The tab body unmounts
 * on a dock COLLAPSE too, and the session its callbacks close over outlives
 * that — after an ask from the pill they are the only registration left, so
 * they must survive it (DOCK COLLAPSE cases). On unmount the tab body only
 * marks them DEPARTED. Only the provider knows the session itself ended.
 *
 * ⚠ WHY A MICROTASK. React runs a deleted tree's passive cleanups PARENT FIRST,
 * so at the provider's own cleanup the tab body is still subscribed and has not
 * marked anything departed: a synchronous release was refilled by the tab
 * body's takeover listener in the same flush (measured: the CANVAS UNMOUNT case
 * stayed RED). Queued, the release runs after every child cleanup of that
 * commit. It releases DEPARTED callbacks only, so a tab body that mounted in
 * the same commit keeps its new ones; and where a LIVE tab body still holds a
 * departed identity (StrictMode's simulated unmount marks the provider's stable
 * `sendMessage`), its takeover listener refills the slot the release empties —
 * pinned by the STRICT MODE case.
 *
 * ⚠ IT NEVER TOUCHES ANOTHER HOST'S SLOT: membership is by identity, and only
 * the tab body adds to this set.
 */
import { useGuidanceStore } from './guidanceStore'

/** Callbacks an UNMOUNTED tab body left in the store; the next tab body may replace them. */
export const departedTabBodyCallbacks = new WeakSet<object>()

/** Null every slot still holding a departed tab body's callback. */
export function releaseTabBodyFallback(): void {
  const s = useGuidanceStore.getState()
  const patch: { _sendMessage?: null; _prefillChat?: null; _dispatchAction?: null } = {}
  if (s._sendMessage && departedTabBodyCallbacks.has(s._sendMessage)) patch._sendMessage = null
  if (s._prefillChat && departedTabBodyCallbacks.has(s._prefillChat)) patch._prefillChat = null
  if (s._dispatchAction && departedTabBodyCallbacks.has(s._dispatchAction)) patch._dispatchAction = null
  if (Object.keys(patch).length > 0) useGuidanceStore.setState(patch)
}

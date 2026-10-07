/**
 * ⭐ THE ONE PRESS PATH FOR AN ACTION BAR OFFER, on every surface.
 *
 * One press sends one chip turn: the offer's own `press_id` (CEE routes on it
 * and nothing else), its `user_line` as the visible user bubble (display only,
 * never routed), and the identity the offer was made for (`offer_key` and the
 * bar's `revision`), so the result can name exactly what it answered.
 *
 * ⚠ A DISABLED OFFER SENDS NOTHING. The surface shows its `disabled_reason`
 * instead; a turn is never spent to be told what the bar already says.
 *
 * The busy and double-press rules are `askAi`'s (same notice, same 500 ms
 * clock), so a bar press and an element question behave alike.
 */
import { useGuidanceStore } from '../../stores/guidanceStore'
import { ASK_BUSY_NOTICE } from '../askAi'
import { revealOlumiSurface } from '../revealOlumi'
import type { ActionBarRevision, ActionOffer } from './actionBarContract'

export type PressOfferResult = 'sent' | 'busy' | 'refire' | 'disabled' | 'none'

const REFIRE_MS = 500
const lastPress = new Map<string, number>()

export function pressOffer(offer: ActionOffer, revision: ActionBarRevision): PressOfferResult {
  if (!offer.enabled) return 'disabled'
  const state = useGuidanceStore.getState()
  const dispatch = state._dispatchAction
  if (!dispatch) return 'none'
  const now = Date.now()
  const previous = lastPress.get(offer.offer_key)
  if (previous !== undefined && now - previous < REFIRE_MS) return 'refire'
  if (state._isConversationBusy?.()) {
    revealOlumiSurface()
    window.dispatchEvent(new CustomEvent('topbar:show-toast', { detail: { message: ASK_BUSY_NOTICE, level: 'warning' } }))
    return 'busy'
  }
  for (const [key, at] of lastPress) if (now - at >= REFIRE_MS) lastPress.delete(key)
  lastPress.set(offer.offer_key, now)
  try {
    dispatch({
      id: offer.press_id,
      label: offer.label,
      message: offer.user_line,
      parameters: { offer_key: offer.offer_key, revision },
      source: 'chip',
    })
  } catch (error) {
    lastPress.delete(offer.offer_key)
    throw error
  }
  revealOlumiSurface()
  return 'sent'
}

/** Test seam: forget the double-press clocks. */
export function resetPressOfferClocks(): void {
  lastPress.clear()
}

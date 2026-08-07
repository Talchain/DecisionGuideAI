/**
 * V7SuggestedChips — the max-2 suggested-action chips (V7 Lane L4).
 *
 * Spec row 5 (V6-RESPEC-2026-07-23): at most TWO chips, reusing the existing
 * chip dispatch path — no new chip plumbing. The chips are the top ≤2 live
 * guidance items (`guidanceStore.guidanceItems`), ordered by the single
 * canonical comparator (`compareGuidanceDisplayOrder` — the same doctrine the
 * strip/inspector use), and each chip hands its question to the REAL
 * conversation via the `onSendMessage` path ResultsBody already threads to
 * DriversSection / StressTestSection. This is the honest fix for the F2
 * finding ("pill answers are canned"): the chip sends a real turn to the
 * conversation engine instead of rendering a fabricated answer.
 *
 * Honest absence: no guidance items, or no `onSendMessage` sink, → nothing
 * renders. The MAX-2 cap is enforced here (slice(0, 2)).
 * COMPLETE borders only (L1 guard): chips carry a full `border`.
 */

import { MessageCircle } from 'lucide-react'
import { typography } from '@/styles/typography'
import { useGuidanceStore, compareGuidanceDisplayOrder, type GuidanceItem } from '@/canvas/stores/guidanceStore'

/** Max chips the top matter ever shows (spec row 5). */
export const MAX_SUGGESTED_CHIPS = 2

export interface V7SuggestedChipsProps {
  /** Existing conversation dispatch path (threaded through ResultsBody). */
  onSendMessage?: (text: string) => void
  /** Test/story override for the guidance items; `undefined` → read the store. */
  items?: GuidanceItem[]
}

/** The message a chip sends — a discuss prompt where present, else the item detail/title. */
function chipMessage(item: GuidanceItem): string {
  if (item.primary_action?.type === 'discuss' && item.primary_action.prompt) {
    return item.primary_action.prompt
  }
  return item.detail ?? item.title
}

export function V7SuggestedChips({ onSendMessage, items: itemsProp }: V7SuggestedChipsProps) {
  const storeItems = useGuidanceStore(s => s.guidanceItems)
  const source = itemsProp !== undefined ? itemsProp : storeItems

  // Honest absence — no conversation sink, or nothing to suggest.
  if (!onSendMessage || source.length === 0) return null

  const chips = [...source].sort(compareGuidanceDisplayOrder).slice(0, MAX_SUGGESTED_CHIPS)
  if (chips.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="v7-suggested-chips" aria-label="Suggested next questions">
      {chips.map(item => (
        <button
          key={item.item_id}
          type="button"
          data-testid="v7-suggested-chip"
          onClick={() => onSendMessage(chipMessage(item))}
          className={`inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-transparent px-2.5 py-1 ${typography.panelMeta} text-text-header hover:border-info hover:bg-panel-hover`}
        >
          <MessageCircle className="h-3 w-3 flex-none text-info" aria-hidden />
          <span className="truncate">{item.actionLabel ?? item.title}</span>
        </button>
      ))}
    </div>
  )
}

export default V7SuggestedChips

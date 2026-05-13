/**
 * HeroActionRow — right-aligned cluster of action icons on a hero row.
 * Thin wrapper around the shared IconBtn primitive; preserves the
 * deterministic action ordering from the VM.
 *
 * (Fix 6 — round 4) Prefill-only actions (ai / discuss / add / challenge
 * / brief) are HIDDEN when the chat-prefill wire is unavailable. The
 * earlier disabled-button treatment looked like dead buttons in the
 * common case (chat minimised by default post-analysis). Edit/Confirm
 * don't need prefill — they call onFocusNode / onConfirm directly — so
 * they stay visible regardless.
 *
 * (Fix 5) Inter-icon gap increased from gap-0.5 (2px) → gap-1 (4px) for
 * a bit of breathing room inside the cluster.
 */

import { IconBtn } from '@/canvas/components/pre-analysis/primitives/IconBtn'
import type { RowAction } from './analysisHeroVM.types'
import { ACTION_ICON } from './tokens'

/** Actions that depend on chat prefill to do anything useful. */
const PREFILL_DEPENDENT_ACTIONS: ReadonlySet<RowAction> = new Set([
  'ai', 'discuss', 'add', 'challenge', 'brief',
])

export interface HeroActionRowProps {
  actions: RowAction[]
  chatPrompt: string
  targetNodeId: string | undefined
  dispatchAction: (action: RowAction, payload: { chatPrompt: string; targetNodeId: string | undefined }) => void
  /** When false, prefill-only actions are hidden (not just disabled). */
  chatPrefillAvailable: boolean
}

export function HeroActionRow({
  actions, chatPrompt, targetNodeId, dispatchAction, chatPrefillAvailable,
}: HeroActionRowProps) {
  // Filter prefill-only actions out entirely when chat is closed —
  // edit/confirm remain. If the filter empties the list, render nothing.
  const visibleActions = chatPrefillAvailable
    ? actions
    : actions.filter(a => !PREFILL_DEPENDENT_ACTIONS.has(a))
  if (visibleActions.length === 0) return null
  return (
    <div className="flex items-center gap-1 flex-shrink-0" role="group" aria-label="Row actions">
      {visibleActions.map(a => {
        const def = ACTION_ICON[a]
        return (
          <IconBtn
            key={a}
            icon={def.Icon}
            tooltip={def.tooltip}
            variant={def.variant}
            onClick={() => dispatchAction(a, { chatPrompt, targetNodeId })}
            ariaLabel={def.tooltip}
          />
        )
      })}
    </div>
  )
}

/**
 * ActOnItActionRow — right-aligned cluster of action icons on an act-on-it row.
 * Thin wrapper around the shared IconBtn primitive; preserves the
 * deterministic action ordering from the row model.
 *
 * Salvaged from `analysisHeroV17/HeroActionRow.tsx`.
 *
 * Chat-dependent actions (ai / discuss / add / challenge / brief) are HIDDEN
 * when no chat wire is registered — a disabled button reads as a dead button
 * in the common case (chat minimised post-analysis). Edit/Confirm don't need
 * the wire (they call onFocusNode / onConfirm directly) so they stay visible.
 */

import { IconBtn } from '@/canvas/components/pre-analysis/primitives/IconBtn'
import type { RowAction, RowActionDispatcher } from './types'
import { ACTION_ICON } from './tokens'

/** Actions that depend on the chat wire to do anything useful. */
const CHAT_DEPENDENT_ACTIONS: ReadonlySet<RowAction> = new Set([
  'ai', 'discuss', 'add', 'challenge', 'brief',
])

export interface ActOnItActionRowProps {
  actions: RowAction[]
  chatPrompt: string
  targetNodeId: string | undefined
  dispatchAction: RowActionDispatcher
  /** When false, chat-dependent actions are hidden (not just disabled). */
  chatAvailable: boolean
}

export function ActOnItActionRow({
  actions, chatPrompt, targetNodeId, dispatchAction, chatAvailable,
}: ActOnItActionRowProps) {
  const visibleActions = chatAvailable
    ? actions
    : actions.filter(a => !CHAT_DEPENDENT_ACTIONS.has(a))
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

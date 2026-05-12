/**
 * HeroActionRow — right-aligned cluster of action icons on a hero row.
 * Thin wrapper around the shared IconBtn primitive; preserves the
 * deterministic action ordering from the VM.
 *
 * Prefill-only actions (ai / discuss / add / challenge / brief) render as
 * disabled when the chat-prefill wire is unavailable (the conversation
 * panel hasn't mounted, or has been unmounted). Edit/Confirm don't need
 * prefill — they call onFocusNode / onConfirm directly — so they stay
 * enabled regardless. (Per the "dead buttons" improvement in review.)
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
  /** When false, prefill-only actions render as disabled. */
  chatPrefillAvailable: boolean
}

export function HeroActionRow({
  actions, chatPrompt, targetNodeId, dispatchAction, chatPrefillAvailable,
}: HeroActionRowProps) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" role="group" aria-label="Row actions">
      {actions.map(a => {
        const def = ACTION_ICON[a]
        const disabled = !chatPrefillAvailable && PREFILL_DEPENDENT_ACTIONS.has(a)
        return (
          <IconBtn
            key={a}
            icon={def.Icon}
            tooltip={disabled ? `${def.tooltip} — open the chat panel to use this action` : def.tooltip}
            variant={def.variant}
            onClick={() => dispatchAction(a, { chatPrompt, targetNodeId })}
            ariaLabel={def.tooltip}
            disabled={disabled}
          />
        )
      })}
    </div>
  )
}

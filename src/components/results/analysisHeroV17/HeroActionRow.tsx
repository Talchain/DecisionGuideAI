/**
 * HeroActionRow — right-aligned cluster of action icons on a hero row.
 * Thin wrapper around the shared IconBtn primitive; preserves the
 * deterministic action ordering from the VM.
 */

import { IconBtn } from '@/canvas/components/pre-analysis/primitives/IconBtn'
import type { RowAction } from './analysisHeroVM.types'
import { ACTION_ICON } from './tokens'

export interface HeroActionRowProps {
  actions: RowAction[]
  chatPrompt: string
  targetNodeId: string | undefined
  dispatchAction: (action: RowAction, payload: { chatPrompt: string; targetNodeId: string | undefined }) => void
}

export function HeroActionRow({ actions, chatPrompt, targetNodeId, dispatchAction }: HeroActionRowProps) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" role="group" aria-label="Row actions">
      {actions.map(a => {
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

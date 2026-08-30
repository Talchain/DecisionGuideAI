/**
 * An open door at the end of a tier.
 *
 * Generalises `GhostOptionNode`, which shipped this pattern for options alone:
 * a dashed placeholder that, when opened, asks Olumi to help the user think of
 * something the model does not yet contain. That was the most reasoning-shaped
 * affordance already on the canvas, and it existed on one of four tiers.
 *
 * ⚠ IT ADDS NOTHING TO THE MODEL. Opening it sends a QUESTION. Whatever comes
 * back is the user's to accept, argue with or ignore — a ghost that inserted a
 * node would make the AI the author of the model, which inverts the one thing
 * this product is for.
 */

import { memo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useGuidanceStore } from '../stores/guidanceStore'
import { typography } from '../../styles/typography'

export const GHOST_TIER_TESTID = 'ghost-tier-node'

export const GhostTierNode = memo((props: NodeProps) => {
  const data = (props.data ?? {}) as { label?: string; prompt?: string; tier?: string }
  const label = data.label ?? 'Add'
  const prompt = data.prompt

  const open = useCallback(() => {
    if (!prompt) return
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(prompt)
  }, [prompt])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid={GHOST_TIER_TESTID}
      data-tier={data.tier}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      className="rounded-lg cursor-pointer hover:bg-panel-hover transition-colors flex flex-col items-center justify-center gap-1 nodrag nopan"
      style={{
        // Matches GhostOptionNode's measured 3:1 non-text contrast outline —
        // the dashes are the only thing marking this affordance's bounds.
        //
        // ⚠ This read `var(--panel-border, #C7C7C7)`, and --panel-border is
        // not a defined custom property, so it always resolved to the
        // hardcoded #C7C7C7: a fixed light grey in both themes, and NOT the
        // colour it claimed to match. The comment above asserted a contrast
        // property the code could not have. Now it reads the same token
        // GhostOptionNode does, so the claim is true rather than aspirational.
        width: 132,
        height: 64,
        border: '1.5px dashed var(--text-body, #3F3F3E)',
        background: 'transparent',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Plus className="w-4 h-4 text-text-light" aria-hidden="true" />
      <span className={`${typography.nodeLabel} text-text-light text-center px-1`}>{label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
})

GhostTierNode.displayName = 'GhostTierNode'

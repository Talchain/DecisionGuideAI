/**
 * GhostOptionNode — dashed placeholder node that invites the user to explore another option.
 * Click triggers sendMessage via guidanceStore._sendMessage.
 *
 * Visible: pre-analysis always (both views). Post-analysis: Model view only.
 */
import { memo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useGuidanceStore } from '../stores/guidanceStore'
import { typography } from '../../styles/typography'

export const GhostOptionNode = memo((_props: NodeProps) => {
  const handleClick = useCallback(() => {
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send('Suggest an additional option I haven\'t considered for this decision')
  }, [])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Add another option"
      className="rounded-lg cursor-pointer hover:bg-panel-hover transition-colors flex items-center justify-center nodrag nopan"
      style={{
        border: '1.5px dashed var(--border-secondary, #d1d5db)',
        background: 'var(--bg-panel, #FEFEFE)',
        minHeight: '56px',
        minWidth: '140px',
        maxWidth: '160px',
        padding: '12px',
      }}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
    >
      {/* Hidden handles so React Flow doesn't warn about missing handles */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />

      <div className="flex items-center gap-1.5">
        <Plus size={14} className="text-text-light" />
        <span className={`${typography.edgeLabel} text-text-light`}>
          + Explore another option
        </span>
      </div>
    </div>
  )
})

GhostOptionNode.displayName = 'GhostOptionNode'

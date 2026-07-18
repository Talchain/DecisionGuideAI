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
        // A11y (WCAG 1.4.11, 3:1 non-text contrast). The outline is the only
        // thing that marks this affordance's bounds, so it is measured against
        // BOTH adjacent colours: the node's own --bg-panel #FEFEFE fill inside
        // (background-clip is border-box, so the dash GAPS show it too) and the
        // --bg-canvas #F4F0EA body behind — verified in a live browser to be the
        // first opaque ancestor, with accumulated opacity 1.0 through the whole
        // react-flow chain. --text-body clears 3:1 on both (10.45:1 / 9.29:1).
        //
        // It is louder than a ghost ideally wants. Every quieter token either
        // fails 3:1 (--text-light #908D8D is 3.26 on the fill but 2.90 on the
        // canvas) or collides with a neighbouring canvas state: --danger-hover
        // sits ΔE2000 5.3 from the --danger risk border, --info-hover 19.5 from
        // the --info focus/AI-highlight ring. A NEUTRAL is also the correct
        // three-channel choice — every semantic token would make a health claim
        // this placeholder cannot support. The palette has no quiet neutral
        // between #908D8D and #3F3F3E; closing that gap is a brand.css decision.
        //
        // Quietness is carried by the dashed 1.5px stroke, not by hue. Note the
        // incomplete-node border is ALSO dashed (2px --warning #FFA656), so hue
        // is the only channel separating the two: ΔE2000 55.0 normal vision,
        // 49.9 worst-case red-green CVD (was 22.3 / 19.7 with --border-emphasis).
        border: '1.5px dashed var(--text-body, #3F3F3E)',
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

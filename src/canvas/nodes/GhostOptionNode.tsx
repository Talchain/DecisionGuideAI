/**
 * GhostOptionNode — dashed placeholder node that invites the user to explore another option.
 * Click sends the question its `data.prompt` carries, via guidanceStore._sendMessage.
 *
 * Visible: pre-analysis always (both views). Post-analysis: Model view only.
 *
 * ⭐ THE SENTENCE IS BUILT FROM THE MODEL, AND NOT HERE.
 *
 * This component used to send a hardcoded "Suggest an additional option I
 * haven't considered for this decision" — which would read identically in any
 * product, about any decision, and is verbatim the generic line
 * `utils/ghostTiers.ts` holds up as the bad example that `#1060` existed to
 * abolish. It survived that work because the canvas never routed the option
 * tier through `withGhostTiers`: `ReactFlowGraph.tsx` builds this node by hand
 * (its position is derived from the rightmost option) and used to pass
 * `data: {}`, so the model-aware option prompt was composed for a node nobody
 * mounted while this string was what users actually sent.
 *
 * `ghostOptionPrompt(nodes)` now composes it at the mount, from the same tier
 * table every other door uses. The node is a renderer; the sentence has one
 * author.
 *
 * ⚠ AND THERE IS NO FALLBACK, DELIBERATELY. Handed no prompt, this door sends
 * nothing rather than a generic sentence — a dead door is a visible failure, a
 * model-blind sentence is confident wrongness, and a static safety net would
 * silently re-open exactly what was just closed the first time a caller forgot.
 * `GhostTierNode` already behaves this way; the two doors agree rather than each
 * inventing a policy.
 *
 * ⭐⭐ AND THE VISIBLE COPY NOW COMES FROM THE SAME PLACE, for the same reason.
 * This door said "+ Explore another option" while its `aria-label` said "Add
 * another option" — two hand-kept strings for one idea, neither of which asked
 * anything. Both are now `GHOST_OPTION_DOOR_LABEL`, the option tier's own
 * question, so the sighted user and the screen-reader user get the same
 * sentence (WCAG 2.5.3 label-in-name) and a rewording cannot reach one and
 * miss the other.
 *
 * ⚠ THE GEOMETRY AND THE OUTLINE COLOUR ARE UNTOUCHED, DELIBERATELY. They
 * carry a measured WCAG 1.4.11 result pinned by `GhostOptionNode.contrast.spec.ts`;
 * this change is a string. `min-height` means the card GROWS for the longer
 * sentence rather than clipping it — measured 56px at counter-scale 1 and
 * 102px at the bound, unchanged from the old copy, which needed the same two
 * and three lines respectively.
 */
import { memo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useGuidanceStore } from '../stores/guidanceStore'
import { typography } from '../../styles/typography'
import { GHOST_OPTION_DOOR_LABEL } from '../utils/ghostTiers'

export const GhostOptionNode = memo((props: NodeProps) => {
  const prompt = (props.data as { prompt?: string } | undefined)?.prompt

  const handleClick = useCallback(() => {
    if (!prompt) return
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(prompt)
  }, [prompt])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={GHOST_OPTION_DOOR_LABEL}
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
        // It is louder than a ghost ideally wants. The quieter tokens either
        // collide with a neighbouring canvas state — --danger-hover sits ΔE2000
        // 5.3 from the --danger risk border, --info-hover 19.5 from the --info
        // focus/AI-highlight ring — or, historically, failed 3:1. A NEUTRAL is
        // also the correct three-channel choice: every semantic token would
        // make a health claim this placeholder cannot support.
        //
        // ⚠ THE CONSTRAINT THAT PICKED --text-body HAS SINCE BEEN LIFTED, and
        // this comment used to assert it as still-true. --text-light was
        // rejected here because at #908D8D it measured 3.26 on the fill and
        // 2.90 on the canvas — a 3:1 failure. It was retinted to #6E6B6B on
        // WCAG 1.4.3 grounds (it was not a legal TEXT colour at any size), and
        // now measures 5.23 / 4.65 — it clears 3:1 on both adjacent colours
        // with room to spare, and is exactly the "quiet neutral" this comment
        // says the palette lacks. Quieting this outline to --text-light is
        // therefore now AVAILABLE. It is deliberately NOT taken in the retint
        // PR: that change alters this affordance's appearance and wants its
        // own review, not a free ride on a token edit. Whoever takes it must
        // re-measure both grounds here rather than trusting this note.
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
          {GHOST_OPTION_DOOR_LABEL}
        </span>
      </div>
    </div>
  )
})

GhostOptionNode.displayName = 'GhostOptionNode'

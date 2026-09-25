/**
 * GhostOptionNode — dashed placeholder node that invites the user to explore another option.
 * Click puts the question its `data.prompt` carries in Olumi's composer, via
 * `requestAsk` — prefill-and-confirm, never send (Experience Design, #63
 * 5807363175, 24 Sep 2026). The person reads it and chooses to send it.
 *
 * ⭐ THE OPTION QUESTION'S ONE ENTRY POINT (contract v3.1 pt 6; gap U9). No card
 * repeats it. S4 (ED #63 5806207128): it is the options row's ROW-END PROMPT,
 * one of four, placed by `withGhostTiers` at the end of the family's final
 * sub-row and drawn at the 160-unit prompt box the layout reserves.
 *
 * ⚠ Its click still SENDS via `_sendMessage` (served behaviour). The switch to
 * prefill (`requestAsk`) is held back: from a minimised Olumi panel that path
 * left the conversation callbacks unregistered (#1926 Browser Gate,
 * NORMALZOOMDIAG canAsk=false). It returns with that fix and its own proof.
 *
 * Visible in every view and phase (the post-analysis gate was retired by Paul,
 * 1 Sep — see the `nodesWithGhost` memo in `ReactFlowGraph.tsx`).
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
 * `withGhostTiers` now composes it — the option tier's own prompt, from the
 * same tier table every other door uses (S4 retired the hand-built node in
 * `ReactFlowGraph.tsx`). The node is a renderer; the sentence has one author.
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
import { requestAsk } from '../ui/inspector-v2/askSemantic'
import { typography } from '../../styles/typography'
import { GHOST_OPTION_DOOR_LABEL } from '../utils/ghostTiers'
import { useCanvasStore } from '../store'
import { selectLodBodyHidden } from '../utils/zoomLegibility'
import { ROW_PROMPT_H, ROW_PROMPT_PADDING_PX, ROW_PROMPT_W } from '../utils/nodeLayoutConstants'
import { CANVAS_GAP_CLASSES, CANVAS_GLYPH_SIZE_CLASSES } from './shared/canvasGlyphScale'

export const GhostOptionNode = memo((props: NodeProps) => {
  const prompt = (props.data as { prompt?: string } | undefined)?.prompt
  // ED S4: row-end prompts hide at the far (`line`) rung — the same shared
  // predicate the cards read. Hidden, not unmounted: the box stays reserved.
  const farRung = useCanvasStore(selectLodBodyHidden)

  const handleClick = useCallback(() => {
    if (!prompt) return
    // ⛔ Never `_sendMessage`: that put a sentence in the user's transcript,
    // under their name, that they had not said. `requestAsk` fills the
    // composer (or the Ask drawer) and reveals Olumi; the person sends.
    requestAsk({ text: prompt, label: GHOST_OPTION_DOOR_LABEL, source: 'ghost-door' })
  }, [prompt])

  return (
    <div
      role="button"
      tabIndex={farRung ? -1 : 0}
      aria-label={GHOST_OPTION_DOOR_LABEL}
      aria-hidden={farRung ? true : undefined}
      // This is a flex ROW, so `justify-*` is the HORIZONTAL axis and
      // `justify-center` centred the icon+label block inside the door.
      // `items-center` is the vertical axis here and stays. The displacement
      // was small at the shipped geometry — the box settles at its 140px
      // minWidth with the content occupying most of it — but the shape is the
      // same defect as the ghost tier door one line-wrap away, and one reword
      // of the label makes it visible.
      // `rounded-sm` (8px): the same corner as every card (contract v3.1
      // FRAME-01 `.node{border-radius:8px}`); `rounded-lg` rendered 14px.
      className="rounded-sm cursor-pointer hover:bg-panel-hover transition-colors flex items-center nodrag nopan text-left"
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
        // ⭐ TAKEN, contract v3.1 T12 (contract `--muted`; DS v5 §3.12: neutral
        // borders are chrome). The darkest line on the canvas was a
        // placeholder's. `--text-light` is `rgb(110 107 107)` = #6E6B6B at this
        // tip (brand.css `--text-light-rgb`); against the two grounds named
        // above, #FEFEFE and #F4F0EA, WCAG relative luminance gives 5.23:1 and
        // 4.65:1 — both clear SC 1.4.11's 3:1 for the only mark bounding this
        // affordance. Dash and width unchanged.
        //
        // Quietness is carried by the dashed 1.5px stroke, not by hue. (The
        // incomplete-node border this note once compared against is no longer
        // dashed or amber — Paul's 8 Sep ruling moved that state to a badge.)
        border: '1.5px dashed var(--text-light, #6E6B6B)',
        background: 'var(--bg-panel, #FEFEFE)',
        // ⭐ S4: exactly the row-end prompt box the layout reserves (ED: "160px
        // … inside the row budget"), the same as the other three prompts. It
        // was 140–160 and content-sized, so the row's reservation and the card
        // could disagree by up to 20 units.
        width: ROW_PROMPT_W,
        minHeight: ROW_PROMPT_H,
        padding: ROW_PROMPT_PADDING_PX,
        visibility: farRung ? 'hidden' : undefined,
      }}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
    >
      {/* Hidden handles so React Flow doesn't warn about missing handles */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />

      <div className={`flex items-center ${CANVAS_GAP_CLASSES[6]}`}>
        <Plus size={14} className={`text-text-light shrink-0 ${CANVAS_GLYPH_SIZE_CLASSES[14]}`} aria-hidden="true" />
        <span className={`${typography.edgeLabel} text-text-light break-words min-w-0`}>
          {GHOST_OPTION_DOOR_LABEL}
        </span>
      </div>
    </div>
  )
})

GhostOptionNode.displayName = 'GhostOptionNode'

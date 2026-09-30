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
import { openWhatElseFromDoor } from '../components/WhatElseChooser'
import { GHOST_OPTION_DOOR_LABEL } from '../utils/ghostTiers'
import { useCanvasStore } from '../store'
import { selectLodBodyHidden } from '../utils/zoomLegibility'
import { RowEndPromptIcon } from './shared/RowEndPromptIcon'

export const GHOST_OPTION_TESTID = 'ghost-option-node'

export const GhostOptionNode = memo((props: NodeProps) => {
  const prompt = (props.data as { prompt?: string } | undefined)?.prompt
  // ED S4: row-end prompts hide at the far (`line`) rung — the same shared
  // predicate the cards read. Hidden, not unmounted: the box stays reserved.
  const farRung = useCanvasStore(selectLodBodyHidden)

  // ⭐ E4: the door opens the "What else…?" chooser; its Option chip keeps this door's own question. ⛔ Never
  // `_sendMessage`: the chooser fills the composer (or the Ask drawer) through `requestAsk`; the person sends.
  const handleClick = useCallback((e: { clientX?: number; clientY?: number; currentTarget: EventTarget | null }) => {
    if (!prompt) return
    openWhatElseFromDoor(e, 'option', prompt)
  }, [prompt])

  // ⭐ Paul 30 Sep: an icon with a hover state, not a 160-unit tile (`RowEndPromptIcon`).
  return (
    <RowEndPromptIcon label={GHOST_OPTION_DOOR_LABEL} tier="option" testId={GHOST_OPTION_TESTID} hidden={farRung} onOpen={handleClick} />
  )
})

GhostOptionNode.displayName = 'GhostOptionNode'

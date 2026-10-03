/**
 * An open door at the end of a tier.
 *
 * Generalises `GhostOptionNode`, which shipped this pattern for options alone:
 * a dashed placeholder that, when opened, asks Olumi to help the user think of
 * something the model does not yet contain. That was the most reasoning-shaped
 * affordance already on the canvas, and it existed on one of four tiers.
 *
 * ⚠ IT ADDS NOTHING TO THE MODEL AND IT SENDS NOTHING. Opening it PRE-FILLS a
 * question (`requestAsk`, prefill-and-confirm) and the user presses Send.
 * Whatever comes back is the user's to accept, argue with or ignore — a ghost
 * that inserted a node would make the AI the author of the model, which inverts
 * the one thing this product is for.
 *
 * ⛔ S4 FIX: this used to call `_sendMessage(prompt)` — a SILENT SEND on click,
 * against ED S4 ("clicking engages the appropriate ideation/coaching action.
 * They do not silently mutate the model") and against its own sibling
 * `GhostOptionNode`, which already went through `requestAsk`. Latent while the
 * door was unmounted (#1606); live the moment S4 restored it, so fixed here.
 *
 * ⚠ AND THE DOOR SAYS THE QUESTION OUT LOUD. The label is composed in
 * `utils/ghostTiers.ts` and is a question there; this file must not summarise
 * it, prefix it, or fall back to a noun. `data.label ?? 'Add'` was the old
 * fallback and it is gone: a door handed no label renders none, for the same
 * reason it sends no prompt when handed none — a visible failure beats a
 * generic one.
 */

import { memo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { openWhatElseFromDoor } from '../components/WhatElseChooser'
import { useCanvasStore } from '../store'
import { selectLodBodyHidden } from '../utils/zoomLegibility'
import { RowEndPromptIcon } from './shared/RowEndPromptIcon'
import { ROW_PROMPT_H, ROW_PROMPT_W } from '../utils/nodeLayoutConstants'

export const GHOST_TIER_TESTID = 'ghost-tier-node'

/* ── GEOMETRY: THE LAYOUT'S RESERVATION, NOT THIS FILE'S ───────────────────
 *
 * ⭐ S4 (Experience Design, #63 5806207128 / 5806266691): "Row-end reasoning
 * prompts stay at the row end, 160px, inside the row budget." The box is
 * `ROW_PROMPT_W` wide and at least `ROW_PROMPT_H` tall — the SAME numbers
 * `layoutGraph` reserves at the end of each family's final sub-row, so the
 * prompt lands in space the board already paid for and a stacked Outcome + Risk
 * column cannot hang into the next row. Both are derived in
 * `nodeLayoutConstants.ts` (text measures scale; chrome does not).
 *
 * ⚠ This superseded a 187-wide door sized so every question fit TWO lines at
 * the counter-scale bound (88 declared px of measure, measured 3 Sep). At 160 the
 * risk and outcome questions take three — which is why `ROW_PROMPT_H` is three
 * lines — and the height is a FLOOR (`min-height`, no `overflow: hidden`, and
 * `break-words`), so a wrong line count costs height, never a clipped word.
 * Whether three lines hold at the live font is a browser question
 * (`e2e/geometry/ghostDoorVisibility.measure.ts`), not a jsdom one.
 */
export const GHOST_DOOR_W_PX = ROW_PROMPT_W
export const GHOST_DOOR_MIN_H_PX = ROW_PROMPT_H

export const GhostTierNode = memo((props: NodeProps) => {
  const data = (props.data ?? {}) as { label?: string; prompt?: string; tier?: string }
  const label = data.label
  const prompt = data.prompt
  /**
   * ED S4: "hide/reduce these at the far/line rung." The rung is the ONE shared
   * predicate the cards and `CanvasLodNotice` read, so the prompt cannot claim a
   * different zoom state from the board it stands on. Hidden, not unmounted:
   * the node keeps its box (the fit and the layout already reserved it) and
   * leaves the tab order and the accessibility tree.
   */
  const farRung = useCanvasStore(selectLodBodyHidden)

  // ⭐ E4: the door opens the "What else…?" chooser (Factor / Risk / Option / Outcome + free text); this door's kind
  // keeps this door's own question. ⛔ Still never `_sendMessage` — the chooser prefills through `requestAsk`
  // (Experience Design, #63 5807363175).
  const open = useCallback((e: { clientX?: number; clientY?: number; currentTarget: EventTarget | null }) => {
    if (!prompt || !label) return
    openWhatElseFromDoor(e, data.tier, prompt)
  }, [prompt, label, data.tier])

  // ⭐ Paul 30 Sep: an icon with a hover state, not a 160-unit tile (`RowEndPromptIcon`).
  return <RowEndPromptIcon label={label} tier={data.tier} testId={GHOST_TIER_TESTID} hidden={farRung} onOpen={open} />
})

GhostTierNode.displayName = 'GhostTierNode'

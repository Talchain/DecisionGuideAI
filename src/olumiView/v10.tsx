/**
 * The v10 design on the olumi-core lane (DL, 4 Nov): the features Paul approved on #/canvas2 (#3085–#3101), here drawn from the View.
 * The lane's own components stay current; v10 reaches them three ways, all from src/presentation:
 *
 * - **v10's CSS rulings** (`v10.css`, index.css `v10-lit`): the lane sets `data-presentation="v10"` on <html> while its canvas is up
 *   (`useV10Lane`). So the person's own primary buttons are ink and only Olumi's elements are blue, nothing on the canvas dims, and
 *   a lit card shows its ring. No JS behaviour changes with the attribute.
 * - **v10's card controls** (`ViewCardV10`): each View card is drawn inside `V10Scope`, so its quick actions drop their Olumi door and
 *   the card carries v10's Olumi corner (`NodeCornerOlumi`): a click puts "About <card>: " in the composer and sends nothing. The card
 *   face itself is untouched (it is the DGAI session's).
 * - **The ring** (`ringCards`): the cards a reply's next step is about (core's `chat[].answer.next.about`, the only place the View
 *   names records in the chat) are lit while that line is hovered or focused, and nothing else changes.
 *
 * - **What would change** (`ViewDriverBadge`, v10 #3098): an option card core gives a `driver` carries v10's driver badge on its corner,
 *   an icon at rest; hovering or focusing it says core's own sentence, verbatim, with Olumi's mark. Out of flow, so no card changes
 *   height; nothing dims. A card with no driver draws none.
 *
 * The method chips are v10's own component (`V10MethodChips`), above the composer in ViewChat.tsx.
 */
import { useEffect } from 'react'
import { Activity } from 'lucide-react'
import Tooltip from '../components/Tooltip'
import { OlumiAiIcon } from '../components/results/analysisNew/OlumiAiIcon'
import { CANVAS_GLYPH_SIZE_CLASSES } from '../canvas/nodes/shared/canvasGlyphScale'
import { NODE_TOOLTIP_DELAY_MS } from '../canvas/nodes/shared/nodeTooltip'
import { V10_CHANGE_COPY } from '../presentation/V10ChangeLens'
import type { ViewCardData } from '../canvas/nodes/ViewCardNode'
import type { NodeProps } from '@xyflow/react'
import { V10Scope } from '../presentation/v10'
export { ringCards } from './ring'
import { ViewCardNode } from '../canvas/nodes/ViewCardNode'
import { NodeCornerOlumi } from '../canvas/nodes/shared/NodeCornerOlumi'

/** v10's rulings for the whole lane while its canvas is up: the attribute v10's stylesheets are scoped to. */
export function useV10Lane(): void {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.presentation = 'v10'
    return () => { delete root.dataset.presentation }
  }, [])
}

/** v10's "What would change" badge for one card, from core's `driver`: its sentence verbatim on hover or focus, with Olumi's mark. */
export function ViewDriverBadge({ card }: { card: ViewCardData['card'] }) {
  if (card.driver === null) return null
  const disclosure = (
    <span className="inline-flex items-start gap-1.5">
      <OlumiAiIcon size={12} aria-hidden="true" data-testid={`view-driver-mark-${card.id}`} className={`mt-[2px] flex-none ${CANVAS_GLYPH_SIZE_CLASSES[12]}`} />
      <span data-view={`${card.id}.driver.text`}>{card.driver.text}</span>
    </span>
  )
  return (
    <Tooltip asChild content={disclosure} delay={NODE_TOOLTIP_DELAY_MS}>
      <span data-testid={`view-driver-${card.id}`} data-node-tooltip="true" role="img" tabIndex={0} aria-label={V10_CHANGE_COPY.driverAria}
        className="nodrag pointer-events-auto absolute -right-2 -top-2 z-10 inline-grid h-5 w-5 place-items-center rounded-full border border-panel-border bg-panel text-text-light shadow-1">
        <Activity aria-hidden="true" className="h-3 w-3" />
      </span>
    </Tooltip>
  )
}

/** A View card as v10 draws its controls: the card, the Olumi corner that asks about it, and its driver badge. */
export function ViewCardV10(props: NodeProps) {
  return (
    <V10Scope>
      <div className="group relative" data-testid="view-card-v10">
        <ViewCardNode {...props} />
        <NodeCornerOlumi nodeId={props.id} selected={props.selected === true} />
        <ViewDriverBadge card={(props.data as ViewCardData).card} />
      </div>
    </V10Scope>
  )
}

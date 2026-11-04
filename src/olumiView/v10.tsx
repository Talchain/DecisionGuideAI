/**
 * The v10 design on the olumi-core lane (DL, 4 Nov): the features Paul approved on #/canvas2 (#3085–#3101), here drawn from the View.
 * The lane's own components stay current; v10 reaches them three ways, all from src/presentation:
 *
 * - **v10's CSS rulings** (`v10.css`, index.css `v10-lit`): the lane sets `data-presentation="v10"` on <html> while its canvas is up
 *   (`useV10Lane`). So the person's own primary buttons are ink and only Olumi's elements are blue, nothing on the canvas dims, and
 *   a lit card shows its ring. No JS behaviour changes with the attribute.
 * - **v10's card controls** (`ViewCardV10`): each View card is drawn inside `V10Scope`, so its quick actions drop their Olumi door and
 *   the card carries v10's Olumi corner (`NodeCornerOlumi`): a click puts "About <card>: " in the composer and sends nothing. The card
 *   face is DGAI's shell (`ViewCardNode`, the original look); v10 fills its named places (`VIEW_CARD_SLOTS`) by portal and changes
 *   nothing else on it: the corner in `olumi-badge`, the driver badge in `driver-badge`.
 * - **The ring** (`ringCards`): the cards a reply's next step is about (core's `chat[].answer.next.about`, the only place the View
 *   names records in the chat) are lit while that line is hovered or focused, and nothing else changes.
 *
 * - **What would change** (`ViewDriverBadge`, v10 #3098): an option card core gives a `driver` carries v10's driver badge on its corner,
 *   an icon at rest, in the shell's top-right place; hovering or focusing it says core's own sentence, verbatim, with Olumi's mark. Out
 *   of flow, so no card changes height; nothing dims. A card with no driver draws none.
 *
 * The methods are v10's (`V10_METHODS`), the composer's icon row in ViewChat.tsx.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity } from 'lucide-react'
import Tooltip from '../components/Tooltip'
import { OlumiAiIcon } from '../components/results/analysisNew/OlumiAiIcon'
import { CANVAS_GLYPH_SIZE_CLASSES } from '../canvas/nodes/shared/canvasGlyphScale'
import { NODE_TOOLTIP_DELAY_MS } from '../canvas/nodes/shared/nodeTooltip'
import { V10_CHANGE_COPY } from '../presentation/V10ChangeLens'
import { VIEW_CARD_SLOTS, type ViewCardData } from '../canvas/nodes/ViewCardNode'
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
        className="nodrag pointer-events-auto relative z-10 inline-grid h-5 w-5 place-items-center rounded-full border border-panel-border bg-panel text-text-light shadow-1">
        <Activity aria-hidden="true" className="h-3 w-3" />
      </span>
    </Tooltip>
  )
}

type Places = { readonly olumi: Element | null; readonly driver: Element | null }

/** A View card as v10 draws its controls: DGAI's card, with the Olumi corner and the driver badge in the card's own named places. */
export function ViewCardV10(props: NodeProps) {
  const box = useRef<HTMLDivElement>(null)
  const [places, setPlaces] = useState<Places>({ olumi: null, driver: null })
  // The card draws its places; v10 finds them each time the card is drawn from new data (a card that changes family gains or loses its
  // driver place).
  useLayoutEffect(() => {
    const at = (name: string) => box.current?.querySelector(`[data-slot="${name}"]`) ?? null
    const olumi = at(VIEW_CARD_SLOTS.olumiBadge), driver = at(VIEW_CARD_SLOTS.driverBadge)
    setPlaces((p) => (p.olumi === olumi && p.driver === driver ? p : { olumi, driver }))
  }, [props.data])
  return (
    <V10Scope>
      <div ref={box} data-testid="view-card-v10">
        <ViewCardNode {...props} />
        {places.olumi === null ? null : createPortal(<NodeCornerOlumi nodeId={props.id} selected={props.selected === true} />, places.olumi)}
        {places.driver === null ? null : createPortal(<ViewDriverBadge card={(props.data as ViewCardData).card} />, places.driver)}
      </div>
    </V10Scope>
  )
}

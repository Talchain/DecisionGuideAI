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
 * The method chips are v10's own component (`V10MethodChips`), above the composer in ViewChat.tsx.
 */
import { useEffect } from 'react'
import type { NodeProps } from '@xyflow/react'
import { V10Scope } from '../presentation/v10'
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

/** Light exactly these cards (v10's ring, a class on each card's own node), and only these: none, to clear. */
export function ringCards(ids: readonly string[]): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll('.react-flow__node.v10-lit').forEach((el) => el.classList.remove('v10-lit'))
  for (const id of ids) document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`)?.classList.add('v10-lit')
}

/** A View card as v10 draws its controls: the card, and the Olumi corner that asks about it. */
export function ViewCardV10(props: NodeProps) {
  return (
    <V10Scope>
      <div className="group relative" data-testid="view-card-v10">
        <ViewCardNode {...props} />
        <NodeCornerOlumi nodeId={props.id} selected={props.selected === true} />
      </div>
    </V10Scope>
  )
}

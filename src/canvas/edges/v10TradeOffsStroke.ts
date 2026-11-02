/**
 * v10 Trade-offs, on the canvas (#/canvas2 only; design board "Trade-offs"): the picked option's routes are coloured by
 * which way they push the goal, and every other cause-and-effect link rests in grey. Nothing dims: the grey is a colour
 * at full strength, never an opacity.
 *
 * ⛔ COLOUR ONLY. A link keeps its own width (width is strength) and its own dash (a dash is doubt that the link exists);
 * the lens changes the stroke colour and nothing else.
 *
 * ⛔ NO SIGN THE PRODUCER DID NOT GIVE (DL ruling, 2 Nov). Green and rose are drawn only for a link whose route effect
 * holds under every option and is fully directed (`tradeOffRouteDrawing`). A mixed link, one that helps under some
 * options only, or one on a route with an undirected link is `none`: it takes the rest grey, never its own green or rose
 * polarity colour (that would state a sign the lens has just declined to give), and keeps its own width and dash.
 *
 * ⛔ A DISPUTED SIGN KEEPS ITS WARNING (`resolveEdgeStroke`'s `contested_direction_disputed`): where two review passes
 * disagree about a link's sign, that stroke wins over the lens colour, on a route or off it.
 *
 * Returns null wherever the current design, another lens, a structural link, a disputed link or an option without
 * routes is drawn as it always was.
 */
import type { Presentation } from '../../presentation/v10'
import type { LensMode } from '../store'

/** `undefined`: no routes to draw (change nothing); `null`: a link on none of the picked option's routes. */
export type V10RouteDrawing = 'gains' | 'gives_up' | 'none' | null | undefined

export function v10TradeOffsStroke(input: {
  presentation: Presentation
  lens: LensMode
  drawing: V10RouteDrawing
  structural: boolean
  /** The link's sign is in dispute: its warning stroke is kept. */
  disputed: boolean
}): { readonly stroke: string } | null {
  if (input.presentation !== 'v10' || input.lens !== 'tradeoffs' || input.structural || input.disputed || input.drawing === undefined) return null
  switch (input.drawing) {
    case 'gains': return { stroke: 'var(--edge-positive)' }
    case 'gives_up': return { stroke: 'var(--edge-negative)' }
    default: return { stroke: 'var(--edge-neutral)' } // `none` (on a route, no settled sign) and off-route: the rest grey
  }
}

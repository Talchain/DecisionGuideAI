/**
 * v10 Trade-offs, on the canvas (#/canvas2 only; design board "Trade-offs"): the picked option's routes are coloured by
 * which way they push the goal, and every other cause-and-effect link rests in grey. Nothing dims: the grey is a colour
 * at full strength, never an opacity. Green and rose are the canvas's own direction colours (`directionStroke.ts`); a
 * route with a link whose direction nobody set is dotted grey, because a dot means "not set" and nothing else.
 *
 * Returns null wherever the current design (or any other lens, or a structural link) draws as it always did.
 */
import type { Presentation } from '../../presentation/v10'
import type { LensMode } from '../store'

export type V10RouteEffect = 'gains' | 'gives_up' | 'not_set'

export interface V10TradeOffsStroke {
  readonly stroke: string
  readonly strokeWidth: number | null
  readonly dash: string | null
}

export function v10TradeOffsStroke(input: {
  presentation: Presentation
  lens: LensMode
  /** The way this link's route moves the goal, or null when the link is on none of the picked option's routes. */
  routeEffect: V10RouteEffect | null
  structural: boolean
}): V10TradeOffsStroke | null {
  if (input.presentation !== 'v10' || input.lens !== 'tradeoffs' || input.structural) return null
  switch (input.routeEffect) {
    case 'gains': return { stroke: 'var(--edge-positive)', strokeWidth: null, dash: null }
    case 'gives_up': return { stroke: 'var(--edge-negative)', strokeWidth: null, dash: null }
    case 'not_set': return { stroke: 'var(--edge-neutral)', strokeWidth: null, dash: '1 5' }
    default: return { stroke: 'var(--edge-neutral)', strokeWidth: 1, dash: null }
  }
}

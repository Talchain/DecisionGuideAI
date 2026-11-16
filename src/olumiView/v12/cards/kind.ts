/**
 * V12 card shapes by kind (canvas rule 5, the boards' shape language). Read from the View's structure only, never from its words:
 *  - option: a square-cornered rectangle in the option colour;
 *  - input: an uncertain figure the model takes as given: a rounded pill;
 *  - calculated: a figure worked out from inputs: a double outline, `pending` while it waits on an input (`figure.state` waits) and
 *    `withheld` where core could not calculate it for an option (contract.ts withheldValues);
 *  - aim: an aim or limit: a diamond mark with its label;
 *  - assumption: a dashed pill with its tag;
 *  - risk: a warning-triangle mark;
 *  - other: any other card, drawn as before.
 * "Input with a range" has no field of its own, so every figure that is not calculated is an input, as the boards draw them.
 */
import type { View, ViewCard, ViewModel } from '../../client'
import { drawKindOf } from '../../layout'
import { isWorkedOut } from '../../look/WorkedSteps'
import { withheldValues } from '../contract'

export type CardShape = 'option' | 'input' | 'calculated' | 'aim' | 'assumption' | 'risk' | 'other'
export type CalculatedState = 'done' | 'pending' | 'withheld'
export interface CardKind { readonly shape: CardShape; readonly state: CalculatedState | null }

const plain = (shape: CardShape): CardKind => ({ shape, state: null })
const OPTION = plain('option'), INPUT = plain('input'), AIM = plain('aim'), ASSUMPTION = plain('assumption'), RISK = plain('risk'), OTHER = plain('other')

/** Whether core holds this figure as worked out from others: its own working, a wait on an input, a relation with a sized term into it,
 *  or the outcome tier the board already draws it in. A figure that only carries per-option values (an input the options set) is not. */
function isCalculated(card: ViewCard, model: ViewModel | null, view: View | null): boolean {
  if (card.worked != null || card.figure?.state === 'waits') return true
  if (view !== null && isWorkedOut(view, card.id)) return true
  return model !== null && drawKindOf(card, model) === 'outcome'
}

/** The card's shape, and for a calculated card its state. `view` adds the relation records where the caller has them. */
export function cardKindOf(card: ViewCard, model: ViewModel | null, view: View | null = null): CardKind {
  if (card.family === 'option') return OPTION
  if (card.bound != null || card.family === 'goal' || card.family === 'limit') return AIM
  if (card.family === 'assumption') return ASSUMPTION
  if (card.family === 'risk') return RISK
  if (card.family !== 'quantity') return OTHER
  if (!isCalculated(card, model, view)) return INPUT
  return { shape: 'calculated', state: card.figure?.state === 'waits' ? 'pending' : withheldValues(card).length > 0 ? 'withheld' : 'done' }
}

/** The design system's kinds (Olumi_Design_System_v5 section 10): shape says what a thing is. One mapping for the badge and the border hue. */
export type DsKind = 'factor' | 'option' | 'goal' | 'outcome' | 'risk' | 'decision'

/** A BaseNode / layout kind mapped into the DS set. Anything the DS has no shape for falls to the nearest: an action is the thing a person does (option). */
function dsKindOfDraw(draw: string | null | undefined): DsKind {
  switch (draw) {
    case 'option': case 'action': return 'option'
    case 'goal': return 'goal'
    case 'outcome': return 'outcome'
    case 'risk': return 'risk'
    case 'decision': case 'question': return 'decision'
    default: return 'factor'
  }
}

/** The DS kind of a card: option -> option, input -> factor, calculated -> outcome, aim -> goal, risk -> risk, assumption -> factor (drawn dashed,
 *  see `isAssumptionShape`), other -> the kind the board already draws it as (`drawKind`, layout.ts drawKindOf). */
export function dsKindOf(shape: CardShape | null | undefined, drawKind?: string | null): DsKind {
  switch (shape) {
    case 'option': return 'option'
    case 'input': case 'assumption': return 'factor'
    case 'calculated': return 'outcome'
    case 'aim': return 'goal'
    case 'risk': return 'risk'
    default: return dsKindOfDraw(drawKind)
  }
}

/** An assumption is unverified: the DS doubt meaning, so its shape outline is dashed. */
export const isAssumptionShape = (shape: CardShape | null | undefined): boolean => shape === 'assumption'

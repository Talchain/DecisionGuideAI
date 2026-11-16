/**
 * V12 option letters (fixed UI chrome, decided 16 Nov): A, B, C... in core's own option card order (`model.cards`, family `option`). One
 * source for the chip on an option card, the letter beside an outcome bar, and any other lane that names an option by letter.
 */
import type { View, ViewModel } from '../../client'

/** The letter at a place in the order: A to Z, then AA, AB... so no two options ever share one. */
export function letterAt(i: number): string {
  let s = ''
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s
  return s
}

/** Each option card's letter, by card id, in core's option card order. Takes the View or its model; an empty map where there is none.
 *  A new map each call (the caller's own); a component that asks on every draw keeps it with `useMemo` on the model. */
export function optionLetters(view: View | ViewModel | null | undefined): Map<string, string> {
  const model = view == null ? null : 'cards' in view ? view : view.model
  return new Map((model?.cards ?? []).filter((c) => c.family === 'option').map((c, i) => [c.id, letterAt(i)] as const))
}

/**
 * The person's own message as a method chip (V12 Solo-Ask): when what they said is, word for word, one of core's menu questions
 * (`session.methods[].text`), the bubble shows an icon beside it. The words stay core's and stay in the bubble; the chip adds only the mark.
 * Core's figure-first offer is not a question the person sends as a message, so it is never matched (as isMethodReply).
 */
import { MessageCircleQuestion } from 'lucide-react'
import type { View } from '../../client'
import { sessionOf } from '../../layout'
import { FIGURE_FIRST_ID } from '../actions'

/** The core menu question this said text is, or null (a person's own words are never a chip). */
export function methodOfSaid(view: View | null, said: string): { id: string; i: number } | null {
  const methods = view === null ? null : sessionOf(view)?.methods
  const i = methods?.findIndex((m) => m.id !== FIGURE_FIRST_ID && m.text === said) ?? -1
  return methods === undefined || methods === null || i < 0 ? null : { id: methods[i]!.id, i }
}

export function MethodMark({ id }: { id: string }): JSX.Element {
  return <MessageCircleQuestion className="mr-1.5 inline h-3.5 w-3.5 flex-none align-text-bottom text-text-light" strokeWidth={1.75} aria-hidden="true" data-testid="view-method-chip" data-method={id} />
}

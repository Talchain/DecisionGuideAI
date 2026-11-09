/**
 * Answers to Olumi's question as choices (V11 #5, DL 9 Nov; core `chat[].answer.next.choices`, v3 only). Core sends them on the newest reply
 * only: the coach's answers in its own order, then core's "Something else" and "Not sure". Every word is core's, drawn as given and in its
 * order; none is preselected, highlighted or ranked, and every one is the same neutral chip (UI lane conditions, 9 Nov).
 *  - an answer, or "Not sure": sent as an ordinary reply with its label, through the chat's own send (`say`), as if typed;
 *  - "Something else" (`own`): sends nothing; the person is put in the composer for their own words.
 * While a write is in flight, Olumi is answering, or a past version is on the canvas, the chips are held, as the composer's Send is.
 */
import type { ReactNode } from 'react'
import type { ViewTurn } from './client'
import { VIEW_CHIP_CLASS } from '../v5/blocks/chipClass'

export type ViewChoice = NonNullable<NonNullable<ViewTurn['answer']>['next']['choices']>[number]

/** The composer's text box (ViewComposer's `view-chat-text`), where "Something else" puts the person. */
const COMPOSER = 'view-chat-text'

export function ViewChoices({ choices, at, held, say }: { choices: readonly ViewChoice[]; at: string; held: boolean; say: (text: string) => Promise<boolean> }): ReactNode {
  if (choices.length === 0) return null
  const tap = (c: ViewChoice) => {
    if (c.kind === 'own') { document.getElementById(COMPOSER)?.focus(); return }
    void say(c.label)
  }
  return (
    <div role="group" className="flex flex-wrap items-center gap-1.5" data-testid="view-chat-choices">
      {choices.map((c, i) => (
        <button key={`${c.kind}:${c.label}`} type="button" disabled={held} data-testid="view-chat-choice" data-kind={c.kind} data-view={`${at}.${i}.label`}
          className={`${VIEW_CHIP_CLASS} disabled:opacity-40 disabled:cursor-not-allowed`} onClick={() => tap(c)}>{c.label}</button>
      ))}
    </div>
  )
}

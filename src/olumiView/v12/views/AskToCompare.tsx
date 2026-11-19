/**
 * Ask Olumi from the Team tab, sent on the press (./askOlumi.ts; Paul 18 Nov). `AskButton` is the one control: it sends its question once
 * (each press is a turn), then says what happened in plain words. `AskToCompare` asks Olumi to compare the round's revealed views: offered
 * once two or more people's views are revealed to this viewer, before a model is approved too (then it only fills the message box).
 * Olumi's answer comes back on the ordinary reply path, in the conversation, as Olumi's own provisional reading beside each person's words.
 */
import { useState } from 'react'
import type { View } from '../../client'
import { OkIcon } from '../../look/icons'
import { ASK, META } from '../../../olumiCore/team/ui'
import { twoPeopleRevealed } from './differGroups'
import { ASK_SAID, askOlumi, COMPARE_REQUEST, type AskOutcome } from './askOlumi'

/** Fixed chrome (the page's words, about no scenario). */
export const ASK_TO_COMPARE = { label: 'Ask Olumi to compare these views', request: COMPARE_REQUEST } as const

/** One deliberate press sends `question` about `target` (its full words are the control's title). The line under it says what really happened:
 *  sending, then sent or not sent (read from the chat's own state, Codex review 2 #1); a press is refused only while it is sending or sent. */
export function AskButton({ label, question, target = null, at }: { label: string; question: string; /** The model card the ask is about (sent as its `about`), or none. */ target?: string | null; at: string }): JSX.Element {
  const [done, setDone] = useState<{ q: string; out: AskOutcome } | null>(null)
  const said = done !== null && done.q === question ? done.out : null
  return (
    <div className="grid justify-items-start gap-1" data-testid={at}>
      <button type="button" className={ASK} data-testid={`${at}-go`} title={question} disabled={said === 'sending' || said === 'sent'} data-question={question}
        onClick={() => setDone({ q: question, out: askOlumi(question, target, (out) => setDone({ q: question, out })) })}>
        <OkIcon id="olumi-mark" size={14} decorative />{label}
      </button>
      <p role="status" className={META} data-testid={`${at}-said`}>{said === null ? '' : ASK_SAID[said]}</p>
    </div>
  )
}

export function AskToCompare({ view, at }: { view: View; at: string }): JSX.Element | null {
  if (!twoPeopleRevealed(view)) return null
  return <AskButton label={ASK_TO_COMPARE.label} question={ASK_TO_COMPARE.request} at={`${at}-ask-compare`} />
}

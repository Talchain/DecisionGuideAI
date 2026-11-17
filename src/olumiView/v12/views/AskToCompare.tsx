/**
 * "Ask Olumi to compare these views" (Codex root, 17 Nov 22:23Z): once two or more people's views are revealed to this viewer, one press puts
 * an editable REQUEST in the person's own message box. Nothing is sent until they press Send; the request holds none of anyone's words and
 * no claim about the views, only what to compare (shared ground, differences, what could help resolve them). Olumi's answer comes back on
 * the ordinary reply path, in the conversation, as Olumi's own provisional reading beside each person's words, which stay as they wrote them.
 *
 * It is offered before a model is approved too: views in words can be compared in words. Core's figure comparison and its version gates are
 * untouched (./WhereWeDiffer `Differences`).
 */
import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import type { View } from '../../client'
import { prefillComposer } from '../../ViewChat'
import { OkIcon } from '../../look/icons'
import { META } from '../../../olumiCore/team/ui'
import { twoPeopleRevealed } from './differGroups'

/** Fixed chrome (the page's words, about no scenario): the control, the request it offers, and what it did. */
export const ASK_TO_COMPARE = {
  label: 'Ask Olumi to compare these views',
  request: 'Compare the views we have revealed: what do we agree on, where do we differ, and what could help us resolve it?',
  placed: 'Your request is in the message box. Edit it if you like, then send it.',
} as const

export function AskToCompare({ view, at }: { view: View; at: string }): JSX.Element | null {
  const [placed, setPlaced] = useState(false)
  if (!twoPeopleRevealed(view)) return null
  return (
    <div className="grid justify-items-start gap-1" data-testid={`${at}-ask-compare`}>
      <Button size="sm" variant="secondary" data-testid={`${at}-ask-compare-go`} onClick={() => { prefillComposer(ASK_TO_COMPARE.request); setPlaced(true) }}>
        <span className="inline-flex items-center gap-1.5"><OkIcon id="olumi-mark" size={14} decorative />{ASK_TO_COMPARE.label}</span>
      </Button>
      <p role="status" className={META} data-testid={`${at}-ask-compare-placed`}>{placed ? ASK_TO_COMPARE.placed : ''}</p>
    </div>
  )
}

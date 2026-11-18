/**
 * Ask Olumi from the Team tab, SENT on the press (Paul, 18 Nov ~23:45Z: "Send it and ensure it's optimal and contextually optimised";
 * this reverses the 17 Nov rule that the compare request only filled the message box).
 *
 * What is sent is stored as the person's own message, so it stays lean: one question in fixed chrome, shaped by what kind of difference it
 * is, naming the card and the aim by core's exact labels (the words the chat's packet uses for the same card: `tells_apart.card_name`,
 * `revealed_figures.card_name`) and the people by name. It quotes nobody's figures or words and states no chance: the packet already carries
 * each revealed figure, its effect and what would tell the views apart, and a figure or a chance in the person's message would be a claim
 * under their name that they did not write.
 *
 * Before a model is saved, the chat treats words as a brief that starts a new scenario (`takesBrief`): there the question is only put in the
 * message box, never sent.
 */
import type { View } from '../../client'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { isAnswering, prefillComposer, takesBrief, useViewChat } from '../../ViewChat'
import { useViewStore } from '../../store'
import type { Difference } from '../../../olumiCore/team/differences'

/** Fixed chrome: the controls and what a press did. */
export const ASK_WORDS = {
  difference: 'Ask Olumi about this difference',
  answer: 'Answer this',
  send: 'Send to Olumi',
  answerLabel: 'Your answer',
  sent: 'Sent. Olumi answers in the conversation.',
  placed: 'Your question is in the message box: send it when you are ready.',
  busy: 'Olumi is still answering. Your question is in the message box: send it once it has.',
} as const

const q = (s: string) => `'${s}'`
/** "Priya and Tom", "Ana, Ben and Cara". */
const names = (xs: readonly string[]) => xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
const forAim = (d: Difference) => d.goal_label ? ` for ${q(d.goal_label)}` : ''

/**
 * The one question for a difference. "We" when the viewer is one of its sides, else the holders by name. By kind:
 * - figure: what could explain the gap and what evidence would tell the figures apart (core's settle lines are in the packet);
 * - link: what could explain the different readings and what would show whether the link holds;
 * - factor (one person thinks the model leaves it out): whether it matters for the aim and what figure, with a range, it could take.
 */
export function differenceQuestion(view: View, d: Difference): string {
  const holders = [...new Set(d.sides.map((s) => s.holder))]
  const mine = d.sides.some((s) => s.holder_id === view.you_id)
  const who = mine ? 'we' : names(holders)
  const whose = mine ? 'our' : `${names(holders)}'s`
  switch (d.kind) {
    case 'link':
      return `On the link ${d.label}${forAim(d)}: what could explain why ${who} read it differently, and what evidence would show whether it holds?`
    case 'factor': {
      const by = mine && holders.length === 1 ? 'I think' : `${names(holders)} ${holders.length === 1 ? 'thinks' : 'think'}`
      return `${by} the model leaves out ${q(d.label)}. How could we tell whether it matters${forAim(d) || ' for the aim'}, and what figure, with a range, could it take?`
    }
    default:
      return `On ${q(d.label)}${forAim(d)}: what could explain why ${whose} figures differ, and what evidence would tell them apart?`
  }
}

/** The person's own answer to Olumi's one question for the round (core's `collab.next`), with the question it answers. */
export const answerMessage = (question: string, words: string): string => `Answering your question "${question.trim()}": ${words.trim()}`

/** Compare the round's revealed views (the 17 Nov request, unchanged words; now sent). */
export const COMPARE_REQUEST = 'Compare the views we have revealed: what do we agree on, where do we differ, and what could help us resolve it?'

export type AskOutcome = 'sent' | 'placed' | 'busy'

/**
 * Send words to Olumi as the person's message, through the chat's own writer (`useGuidanceStore._sendMessage`, which brings the conversation
 * into view and keeps the words in the message box if they do not go through). Put in the message box instead when the chat would take them
 * as a new brief, or when nothing on the page answers asks; said as "busy" while Olumi is still answering (the writer keeps them then too).
 */
export function askOlumi(text: string): AskOutcome {
  const { sid, view } = useViewStore.getState()
  const g = useGuidanceStore.getState()
  if (takesBrief(sid, view) || g._sendMessage === null) { prefillComposer(text); return 'placed' }
  const busy = useViewChat.getState().busy || isAnswering(view) || (g._isConversationBusy?.() ?? false)
  g._sendMessage(text)
  return busy ? 'busy' : 'sent'
}

export const ASK_SAID: Record<AskOutcome, string> = { sent: ASK_WORDS.sent, placed: ASK_WORDS.placed, busy: ASK_WORDS.busy }

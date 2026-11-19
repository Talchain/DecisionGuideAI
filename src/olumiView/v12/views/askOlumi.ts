/**
 * Ask Olumi from the Team tab, SENT on a deliberate press (Paul, 18 Nov ~23:45Z: "Send it and ensure it's optimal and contextually optimised";
 * Codex ROOT 23:48:16Z: a clearly labelled press may send, through the normal submit path, never `_sendMessage`). It goes through the canvas's
 * own ask path, ViewChat `askOnPress` (the body of `_dispatchAction` → `press` → `say` → `write`/`act`: its busy guard, the page's scenario,
 * the words kept in the message box when it does not go through), whose returned result is the status (Codex ROOT HOLD 01:11:46Z).
 *
 * The typed target travels the normal way (Codex review 3 #2): `say` sends, as the message's `about`, the one model card selected on the canvas
 * (ViewChat `selectedRecord`, the composer's "About: <card>"). So the ask's own card is selected on the canvas first, and stays selected (the
 * person sees what was asked about); an ask with no single card (a link, a missing factor, the whole round) is sent with nothing selected,
 * and the person's selection is put back at once.
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
import { revealOlumiSurface } from '../../../canvas/conversation/revealOlumi'
import { useCanvasStore } from '../../../canvas/store'
import { armedIntent } from '../../armedIntent'
import { askOnPress, isAnswering, prefillComposer, takesBrief, useViewChat } from '../../ViewChat'
import { useViewStore } from '../../store'
import type { Difference } from '../../../olumiCore/team/differences'

/** Fixed chrome: the controls and what a press did. */
export const ASK_WORDS = {
  difference: 'Ask Olumi about this difference',
  answer: 'Answer this',
  send: 'Send to Olumi',
  answerLabel: 'Your answer',
  sending: 'Sending to Olumi…',
  sent: 'Sent. Olumi answers in the conversation.',
  failed: 'Not sent. Your question is in the message box: send it from there.',
  earlier: 'Your answer is to Olumi’s earlier question:',
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
  switch (d.kind as string) {
    // Core's text-only framing kinds (Codex review 2 #3, its exact wording): qualitative positions, never "figures".
    case 'question': case 'aim': case 'option': case 'link_added':
      return `Compare the revealed views on ${q(d.label)}: where do they differ, and what could help us clarify those differences?`
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

export type AskOutcome = 'placed' | 'busy' | 'sending' | 'sent' | 'failed'

/**
 * Ask Olumi with `text`, about the model card `target` (or none). Placed in the message box (never sent) where the chat would take words as a
 * new brief. Otherwise sent through the ask path; `onSettled` gets the write's own returned result: sent, or not sent (the chat keeps the words
 * in the message box beside its own sentence).
 */
export function askOlumi(text: string, target: string | null, onSettled: (out: AskOutcome) => void): AskOutcome {
  const { sid, view } = useViewStore.getState()
  const g = useGuidanceStore.getState()
  if (takesBrief(sid, view)) { prefillComposer(text); return 'placed' }
  // A past version is open: the chat refuses every write there (PAST_HELD) and the Team tab's controls are held; nothing is sent.
  if (useViewStore.getState().at !== null) return 'failed'
  // While Olumi is still answering, the question waits in the message box and nothing is dispatched: the chat's own sentence is left to the
  // write in flight, whose result another ask's "still answering" must never overwrite (Codex review 7 #1).
  if (useViewChat.getState().busy || isAnswering(view) || (g._isConversationBusy?.() ?? false)) { prefillComposer(text); return 'busy' }
  const card = target !== null && view?.model?.cards.some((c) => c.id === target) ? target : null
  // A challenge waiting for a card would be sent by the selection below (ViewChat's armed pick, Codex review 4 #1): this deliberate ask is the
  // person's new intent, so the waiting challenge stands down first, as words typed in the message box make it.
  armedIntent.cancel()
  const canvas = useCanvasStore.getState(), before = canvas.selection
  if (card !== null) canvas.selectNodes([card])
  else useCanvasStore.setState({ selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null } })
  const result = askOnPress({ message: text })
  if (card === null) useCanvasStore.setState({ selection: before })
  try { revealOlumiSurface() } catch { /* the conversation is shown where the page can; the ask goes either way */ }
  // The write's own returned result decides (Codex ROOT HOLD 01:11:46Z), never busy timing or the message box. A question left in the box by
  // an earlier failed try is taken out once a retry goes through, so it is never sent twice.
  void result.then((sent) => {
    if (sent) { const lines = useViewChat.getState().text.split('\n'); if (lines.includes(text)) useViewChat.setState({ text: lines.filter((l) => l !== text).join('\n') }) }
    onSettled(sent ? 'sent' : 'failed')
  })
  return 'sending'
}

export const ASK_SAID: Record<AskOutcome, string> = { placed: ASK_WORDS.placed, busy: ASK_WORDS.busy, sending: ASK_WORDS.sending, sent: ASK_WORDS.sent, failed: ASK_WORDS.failed }

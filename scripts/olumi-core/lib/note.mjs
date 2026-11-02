/**
 * Where Olumi's next step points, as the note DGAI holds beside a card. Both the words and the place are core's own:
 *   - the words are `coach.next.text`, with the findings it cites written in from the reply's own `cited` map, and nothing added;
 *   - the place is the first record in `coach.next.about` that is a card on the canvas.
 * DGAI draws a card for an option, a factor (a limit is one), a goal, a risk and an outcome. A record of any other kind (an
 * assumption, a claim, a condition, dissent, evidence, something left out, a relation) has no card to point at, so it gets no note:
 * the next step then stays in the chat, where it is always said in full.
 */

import { splices } from './labels.mjs'

/** What a marker reads as when core did not explain it (its own page's fallback for a finding it has no sentence for). */
export const UNEXPLAINED = 'a finding from the Run'

/**
 * A reply's text with the findings it cites by marker (`[F5]`) written in from that reply's OWN `cited` map (API.md: `chat[].cited`).
 * Fact ids belong to one Run and a later change renumbers them, so a marker is never looked up in the current Run's facts.
 *
 * With the science fields on, the reply carries `cited_facts` (`{ id, kind, value, text, about }[]`), and then only a WRITTEN-IN kind that is not
 * fixed (a sampled chance, range, limit, outside, driver, input) is spliced from `cited[id]`. Anything else (a leader, a blocker, a science
 * module's marker, a fixed chance or limit, a kind this code does not know, an id `cited_facts` does not carry) gets the neutral phrase, so no
 * digit and no status word is ever spliced into prose by code. Without `cited_facts` (flag off) it is exactly what it always was.
 */
export const fillCited = (text, cited = {}, citedFacts = null) => text.replace(/\[(F\d+)\](\.?)/g, (_, id, dot) => {
  const said = splicedFor(id, cited, citedFacts)
  return /[.!?]$/.test(said) ? said : `${said}${dot}`
})
function splicedFor(id, cited, citedFacts) {
  const own = typeof cited?.[id] === 'string' && cited[id].trim() !== '' ? cited[id].trim() : UNEXPLAINED
  if (!Array.isArray(citedFacts) || citedFacts.length === 0) return own
  const fact = citedFacts.find((x) => x?.id === id)
  const kind = fact?.about?.kind ?? fact?.kind
  return fact && splices(kind, fact.about) ? own : UNEXPLAINED
}

/** The cards a pointer can land on. */
const POINTABLE = new Set(['option', 'factor', 'goal', 'risk', 'outcome'])

/**
 * The note for a reply, or null. `nodes` are the cards of the model the turn shows; `known` (optional) are the card ids the page
 * already holds, so a note is never aimed at a card that does not exist there yet (DGAI would drop it, and the next step with it).
 * A reply core flagged with problems points nowhere: its next step is not trusted to.
 */
export function noteOf(coach, cited, nodes, known = null, citedFacts = null) {
  if (!coach?.next || !Array.isArray(coach.problems) || coach.problems.length > 0) return null
  const text = typeof coach.next.text === 'string' ? fillCited(coach.next.text, cited, citedFacts).trim() : ''
  if (text === '') return null
  const about = Array.isArray(coach.next.about) ? coach.next.about : []
  const card = about.map((id) => nodes.find((n) => n.id === id)).find((n) => n && POINTABLE.has(n.kind) && (known === null || known.has(n.id)))
  return card ? { element_id: card.id, text } : null
}

/**
 * Respond sends the person's own words as theirs: a chipless composer turn, exactly as typed.
 *
 * Why chipless and no parameters: CEE credits a turn's words to the user only on a chipless `composer` turn
 * (`stated-by-user.ts` `typedByUser`; `turn-executor.ts` runs its typed-constraint door only off chip sources), and it
 * reads the WHOLE message as the user's. Typed parameters force a chip, which demotes the user's words; no CEE reader
 * consumes them (`method_id`, `block_id`, …). The intervention's target still travels typed, as `selected_elements`.
 *
 * THE HEADING (DL ruling, 14 Oct 2026, honouring c5806258826 §3): `On ‘<title>’:` stays for a METHOD reply only, because
 * a method title comes from the technique catalogue — fixed product copy that carries no node label and no figure, so
 * crediting it with the reply costs the person nothing and names the method they are answering. Every other title is
 * dropped: an intervention's title is built from the model ("Test whether £54 beats £59 on Price", "Budget under
 * $40,000"), and on a composer turn CEE would credit its figures to the person.
 *
 * Method-vs-other is decided by IDENTITY, never by the title's text: the reply's `method.id` must resolve in
 * `METHOD_CATALOGUE`, and the heading prints the CATALOGUE's title for that id (not the title the caller passed). A title
 * that merely reads like a method name — an intervention called "Run a pre-mortem", or an entry whose id is not in the
 * catalogue — gets no heading.
 */
import { askAi, type AskAiResult } from '../../../canvas/conversation/askAi'
import { useCanvasStore } from '../../../canvas/store'
import { METHOD_CATALOGUE, type MethodEntry } from '../decision-overview/actionsCatalogue'
import type { Recommendation } from '../strengthen/strengthenTypes'

/** The catalogue's own title for this method id, or null when the id is not a catalogue method. */
function catalogueTitle(methodId: string): string | null {
  return METHOD_CATALOGUE.find(m => m.id === methodId)?.title ?? null
}

export function respondToMethod(method: MethodEntry, text: string): AskAiResult {
  const title = catalogueTitle(method.id)
  return askAi({ userWords: title === null ? text : `On ‘${title}’:\n${text}` })
}
export function respondToIntervention(rec: Recommendation, text: string): AskAiResult {
  const isEdge = useCanvasStore.getState().edges.some(e => e.id === rec.targetId)
  return askAi({ userWords: text,
    nodeIds: rec.targetId && !isEdge ? [rec.targetId] : [],
    edgeIds: rec.targetId && isEdge ? [rec.targetId] : [],
  })
}

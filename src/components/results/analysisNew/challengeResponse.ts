/**
 * "Respond" (prototype `exercise`, P:540/665) — sends the READER'S OWN WORDS
 * about the Challenge card through the SAME existing ask route every other
 * act on this card already uses (`openAskOlumi`). This is not a new write
 * path: Send dispatches a conversation-typed turn exactly like the AI icon
 * does (`ChallengeCard`'s `run`), except the draft carries what the reader
 * typed instead of the producer's default prompt.
 *
 * ⛔⛔ THE DRAFT IS THE HEADING VERBATIM, NEVER A COMPOSED QUESTION.
 * `ChallengeCard`'s own docblock is the reason: `Recommendation` carries no
 * question field, and a picked method's heading is the catalogue's own title,
 * not something assessed as applying here. Ruling `c5806258826.md` §3 states
 * it directly — "if the producer gives a question, it can read as a
 * question; otherwise present it as a finding/challenge, not an interrogative
 * rewrite" — so this module never authors one. It takes the SAME heading the
 * card already renders and appends the reader's own sentence beneath it,
 * exactly the shape the prototype sends (`${m.question}\n\nMy thinking:
 * ${text}`, P:665) with the render layer's own claim removed.
 *
 * ⭐ ONE PAYLOAD BUILDER PER SOURCE, MIRRORING THE ROUTES ALREADY SHIPPED.
 * `respondToMethod` mirrors `runMethod.ts` (same `context`, `label`,
 * `parameters.method_id`, `intent`, `source`); `respondToIntervention`
 * mirrors `AnalysisNewTabBody.tsx`'s `runIntervention` (same `context`,
 * `label`, `targetId`, `action.parameters`, `attentionNote`). Neither route
 * is re-derived from scratch — TB's closure cannot be imported without
 * editing TB, so this rebuilds the same fields from the SAME data
 * (`Recommendation` / `MethodEntry`) the card already holds, rather than
 * inventing a third shape.
 *
 * ⚠ WHY `attentionNote` AND `parameters` ARE NOT OPTIONAL EXTRAS.
 * `everyRecBearingAskCarriesTheNote.spec.ts` and
 * `everyAskCarriesItsBlockId.spec.ts` derive, from the source tree, that
 * every `openAskOlumi` call reading fields off a `rec` must carry both — so a
 * Respond route built without them would fail guards this PR did not touch,
 * on files this PR does not own.
 */
import { openAskOlumi } from '../coaching/askOlumiStore'
import { attentionNoteForRecommendation } from '../strengthen/recommendationAttention'
import type { MethodEntry } from '../decision-overview/actionsCatalogue'
import type { Recommendation } from '../strengthen/strengthenTypes'

/** `${heading}\n\nMy thinking: ${text}` — the prototype's own join, P:665. */
const withReaderText = (heading: string, text: string): string => `${heading}\n\nMy thinking: ${text}`

/** Respond on a method the reader picked themselves (`Shown.kind === 'method'`). */
export function respondToMethod(method: MethodEntry, text: string): void {
  openAskOlumi({
    context: method.description,
    draft: withReaderText(method.title, text),
    label: method.title,
    parameters: { method_id: method.id },
    ...(method.intent ? { intent: method.intent } : {}),
    source: 'chip',
  })
}

/** Respond on the run's own top finding (`Shown.kind === 'intervention'`). */
export function respondToIntervention(rec: Recommendation, text: string): void {
  openAskOlumi({
    context: rec.whyNow || rec.signal,
    draft: withReaderText(rec.title, text),
    label: rec.action.label,
    ...(rec.targetId ? { targetId: rec.targetId } : {}),
    ...(rec.action.parameters ? { parameters: rec.action.parameters } : {}),
    attentionNote: attentionNoteForRecommendation(rec),
  })
}

/**
 * CEE's words for what each option most likely gives, in the goal's own units, and whether the likely ranges separate
 * (`OPTION_OUTCOME_WORDS`, CEE `goal-target/option-outcome-words.ts`; Paul 21 Oct: no win / on-top / share-of-runs framing).
 * CEE builds the sentences; the UI says them verbatim and composes none of its own. Read from the Run's
 * `inference_warnings`, where CEE stores them beside the goal-chance licence. A malformed record reads as none.
 */
export interface OptionOutcomeWords {
  readonly options: readonly { readonly optionId: string; readonly words: string }[]
  /** "Their likely ranges clearly separate." / "… overlap, so this model can't clearly separate them.", or null. */
  readonly separation: string | null
}

const isRec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

export function readOptionOutcomeWords(inferenceWarnings: unknown): OptionOutcomeWords | null {
  if (!Array.isArray(inferenceWarnings)) return null
  const record = inferenceWarnings.find((w) => isRec(w) && w.code === 'OPTION_OUTCOME_WORDS')
  if (!isRec(record) || !Array.isArray(record.options) || typeof record.message !== 'string') return null
  const options = record.options.flatMap((o) =>
    isRec(o) && typeof o.option_id === 'string' && typeof o.words === 'string' && o.words.trim() !== ''
      ? [{ optionId: o.option_id, words: o.words }] : [])
  const separation = record.message.trim() === '' ? null : record.message
  return options.length === 0 && separation === null ? null : { options, separation }
}

/** The words as one reading: each option's sentence, then the separation sentence once. */
export function optionOutcomeReading(words: OptionOutcomeWords | null): string | null {
  if (words === null) return null
  const parts = [...words.options.map((o) => o.words), ...(words.separation === null ? [] : [words.separation])]
  return parts.length === 0 ? null : parts.join(' ')
}

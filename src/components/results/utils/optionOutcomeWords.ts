/**
 * CEE's words for what each option most likely gives, in the goal's own units, and whether the likely ranges separate
 * (`OPTION_OUTCOME_WORDS`, CEE `goal-target/option-outcome-words.ts`; Paul 21 Oct: no win / on-top / share-of-runs framing).
 * CEE builds the sentences; the UI says them verbatim and composes none of its own. Read from the Run's
 * `inference_warnings`, where CEE stores them beside the goal-chance licence, after `useResultsSectionData` carries the
 * `options` array through. A malformed record reads as NONE, whole: one bad option entry withholds every sentence, since
 * a partial set would let the separation sentence speak about options the user cannot see.
 */
export const OPTION_OUTCOME_WORDS_CODE = 'OPTION_OUTCOME_WORDS'

export interface OptionOutcomeWords {
  readonly options: readonly { readonly optionId: string; readonly words: string }[]
  /** "Their likely ranges clearly separate." / "… overlap, so this model can't clearly separate them.", or null. */
  readonly separation: string | null
}

const isRec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const said = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

export function readOptionOutcomeWords(inferenceWarnings: unknown): OptionOutcomeWords | null {
  if (!Array.isArray(inferenceWarnings)) return null
  const record = inferenceWarnings.find((w) => isRec(w) && w.code === OPTION_OUTCOME_WORDS_CODE)
  // `message` is '' for a single ranged option; the adapter turns '' into undefined.
  if (!isRec(record) || !Array.isArray(record.options) || !(record.message === undefined || typeof record.message === 'string')) return null
  if (!record.options.every((o) => isRec(o) && said(o.option_id) && said(o.words))) return null
  const options = record.options.map((o) => ({ optionId: o.option_id as string, words: o.words as string }))
  const separation = said(record.message) ? record.message : null
  return options.length === 0 && separation === null ? null : { options, separation }
}

/** The words as one reading: each option's sentence, then the separation sentence once. */
export function optionOutcomeReading(words: OptionOutcomeWords | null): string | null {
  if (words === null) return null
  const parts = [...words.options.map((o) => o.words), ...(words.separation === null ? [] : [words.separation])]
  return parts.length === 0 ? null : parts.join(' ')
}

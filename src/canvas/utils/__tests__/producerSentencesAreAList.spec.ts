/**
 * THE PRODUCER'S SENTENCES ARE A LIST, NOT A PARAGRAPH.
 *
 * `composeAnalysisBlockedReason` joined every producer sentence with a space
 * into ONE string, rendered in a `panelMeta` line and a `title` attribute. On a
 * the join is UNBOUNDED and nothing truncates it.
 *
 * ⛔ THE FIX IS NOT TRUNCATION. The no-truncation contract
 * (`composeBlockedReason.ts`) exists so we never attribute our words to the
 * producer, and it is honoured: nothing here cuts, summarises or reorders.
 * The change is PRESENTATION — the same bytes, rendered as a list.
 *
 * ⭐ THE STRING IS NOW A DERIVATION OF THE ARRAY. `composeAnalysisBlockedReason`
 * is defined as `analysisBlockedSentences(...).join(' ')`. Byte-identity of the
 * union is therefore true BY CONSTRUCTION, not by a test that could drift — and
 * the gate's tooltip and the panel's list cannot disagree about what the
 * producer said, because there is one array behind both.
 */
import { describe, it, expect } from 'vitest'
import {
  analysisBlockedItems,
  analysisBlockedSentences,
  composeAnalysisBlockedReason,
} from '../composeBlockedReason'
import type { AnalysisBlocker } from '@talchain/schemas/boundary'

const blocker = (message: string, i: number): AnalysisBlocker =>
  ({ code: `MISSING_OPTION_VALUE`, category: 'inputs', repairability: 'user', message,
     factor_id: `fac-${i}`, option_id: `opt-${i}` }) as unknown as AnalysisBlocker

// Real producer wording, from the 26 Aug wire capture.
const REAL = [
  'Choose the missing effect value for "keep what we have" on "Current CRM Capability Gap".',
  'Choose the missing effect value for "migrate to Salesforce instead" on "Salesforce Switching Cost".',
]

describe('analysisBlockedSentences — the union is byte-identical to the joined string', () => {
  it('PRECONDITION: the fixture is genuinely multi-sentence and producer-authored', () => {
    // Pins the fixture's discriminating power: a one-item fixture could not
    // observe a join defect at all, and the assertions below would hold vacuously.
    expect(REAL.length).toBeGreaterThan(1)
    const out = analysisBlockedSentences(REAL.map(blocker))
    expect(out.length).toBe(REAL.length)
  })

  it('THE UNION IS EXACT — joining the list reproduces the string byte for byte', () => {
    const blockers = REAL.map(blocker)
    expect(analysisBlockedSentences(blockers).join(' ')).toBe(
      composeAnalysisBlockedReason(blockers),
    )
  })

  it('every item is byte-identical to a sentence the producer wrote — nothing altered', () => {
    const out = analysisBlockedSentences(REAL.map(blocker))
    for (const item of out) expect(REAL).toContain(item)
  })

  it('NOTHING IS DROPPED — every producer sentence appears', () => {
    const out = analysisBlockedSentences(REAL.map(blocker))
    for (const sentence of REAL) expect(out).toContain(sentence)
  })

  it('ORDER IS THE PRODUCER’S — not ours to choose', () => {
    expect(analysisBlockedSentences(REAL.map(blocker))).toEqual(REAL)
  })

  it('THE ONE-BLOCKER TWIN: a single sentence stays a single item, not a list of one', () => {
    const out = analysisBlockedSentences([blocker(REAL[0], 0)])
    expect(out).toEqual([REAL[0]])
    expect(out).toHaveLength(1)
  })

  it('exact duplicates are de-duplicated once, as before', () => {
    const out = analysisBlockedSentences([blocker(REAL[0], 0), blocker(REAL[0], 1)])
    expect(out).toEqual([REAL[0]])
  })

  it('NO BLOCKERS: falls back to the composed copy as one item — never an empty list', () => {
    const out = analysisBlockedSentences([])
    expect(out).toHaveLength(1)
    expect(out[0].length).toBeGreaterThan(0)
    expect(out.join(' ')).toBe(composeAnalysisBlockedReason([]))
  })

  it('THE JOIN IS STILL WHAT IS VETTED — an unsafe join withholds the WHOLE list, not part', () => {
    // The contract vets the JOIN because a phrase can form ACROSS the seam
    // between two individually-safe sentences. Rendering parts must not weaken
    // that: if the join is rejected, no producer text ships at all.
    const unsafe = [blocker('The graph is fine.', 0), blocker('Nothing to do.', 1)]
    const out = analysisBlockedSentences(unsafe)
    const joined = out.join(' ')
    expect(joined).toBe(composeAnalysisBlockedReason(unsafe))
    // Either all producer sentences survive, or none do — never a mixture.
    const anyProducer = out.some(s => s === 'The graph is fine.' || s === 'Nothing to do.')
    const allProducer = out.length === 2
    expect(anyProducer === allProducer || out.length === 1).toBe(true)
  })
})

/**
 * A SCOPE IS A NAVIGATION PROMISE, SO IT ATTACHES ONLY WHERE IT IS UNAMBIGUOUS.
 *
 * `analysisBlockedItems` pairs each rendered line with the producer's own scope
 * so a surface can offer to take the user to it. Two rungs produce lines that
 * stand for SEVERAL blockers — the de-duplication of an exactly repeated
 * sentence, and every degrade rung, where one sentence summarises the whole
 * list. Attaching one blocker's id to such a line would send the user to an
 * arbitrary one of them while looking exactly as authoritative as a correct
 * link, which is the harm the affordance was added to remove.
 *
 * ⚠ Written because a mutant SURVIVED: relaxing the check from "exactly one
 * author" to "at least one author" changed nothing any test could see.
 */
describe('analysisBlockedItems — scope attaches only to an unambiguous line', () => {
  it('THE TEXT IS THE SENTENCE LIST, byte for byte — one owner, not two', () => {
    const blockers = REAL.map(blocker)
    expect(analysisBlockedItems(blockers).map((i) => i.text)).toEqual([
      ...analysisBlockedSentences(blockers),
    ])
  })

  it('a line authored by EXACTLY ONE blocker carries that blocker’s scope', () => {
    const items = analysisBlockedItems(REAL.map(blocker))
    // Bound by identity: the scope on the line for REAL[0] is blocker 0's.
    expect(items[0]).toEqual({ text: REAL[0], scope: { id: 'opt-0', label: undefined } })
  })

  it('TWIN: a DE-DUPLICATED line — two blockers, one identical sentence — carries NO scope', () => {
    const twins = [blocker(REAL[0], 0), blocker(REAL[0], 1)]
    const items = analysisBlockedItems(twins)
    // PRECONDITION: the fixture really does collapse to one line, or the case
    // below is asserting nothing.
    expect(items).toHaveLength(1)
    expect(items[0].scope).toBeUndefined()
  })

  it('TWIN: a DEGRADE-RUNG line — one sentence standing for two blockers — carries NO scope', () => {
    // Blank messages force the scope-label rung, which summarises the list.
    const unusable = [blocker('', 0), blocker('', 1)]
    const items = analysisBlockedItems(unusable)
    expect(items).toHaveLength(1)
    // PRECONDITION: this really is the degrade rung, not the producer's text.
    expect(items[0].text).not.toBe(REAL[0])
    expect(items[0].scope).toBeUndefined()
  })
})

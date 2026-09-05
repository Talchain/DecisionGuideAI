/**
 * The figure-tally sentence, ENUMERATED over its whole quantity domain.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE SAMPLING FAILED THREE TIMES. Each earlier pass
 * added the case its reviewer had just named, shipped, and was found to have
 * created a new instance of the same defect one arm across:
 *
 *   "1 of 1 figures you mentioned aren't in the model yet"
 *   "0 of 1 figures you mentioned are in the model"
 *   "1 of the 0 figures…" / "2 of the 1 figure … are"   (caught pre-merge, here)
 *
 * A per-case suite can only ever contain the cases someone imagined. So this
 * walks the grid and asserts PROPERTIES, and the third defect above was found
 * by it and by nothing else.
 */
import { describe, expect, it } from 'vitest'

import { figureTallySubtitle, type FigureTally } from '../figureTallySubtitle'

/** Every combination in the box, including the incoherent ones the parser admits. */
function domain(): FigureTally[] {
  const out: FigureTally[] = []
  for (let total = 0; total <= 4; total++)
    for (let inModel = 0; inModel <= 4; inModel++)
      for (let proseOnly = 0; proseOnly <= 3; proseOnly++)
        for (let absent = 0; absent <= 3; absent++) out.push({ total, inModel, proseOnly, absent })
  return out
}

const CELLS = 5 * 5 * 4 * 4

describe('figureTallySubtitle — properties over the whole quantity domain', () => {
  it('the domain really is the whole box (anti-vacuity)', () => {
    // Without this, a broken generator would leave every property below
    // passing over an empty or tiny set.
    expect(domain()).toHaveLength(CELLS)
    expect(new Set(domain().map(figureTallySubtitle)).size).toBeGreaterThan(10)
  })

  it('a noun always agrees with the number immediately before it', () => {
    // ⚠ THE FIRST VERSION OF THIS INVARIANT WAS WRONG AND FLAGGED 33 CORRECT
    // SENTENCES. It read the number next to the noun as the SUBJECT, so
    // "1 of 2 figures you mentioned isn't in the model yet" — correct English —
    // came out as a disagreement. Satisfying it would have corrupted a sentence
    // that was already right. An invariant over natural language is a claim,
    // and it needs checking against the language, not against the code.
    const bad: string[] = []
    for (const t of domain()) {
      const s = figureTallySubtitle(t)
      for (const m of s.matchAll(/(\d+) (figures?)\b/g)) {
        const want = Number(m[1]) === 1 ? 'figure' : 'figures'
        if (m[2] !== want) bad.push(`${JSON.stringify(t)} → ${s}`)
      }
    }
    expect(bad, `plural/singular noun disagreement:\n${bad.join('\n')}`).toEqual([])
  })

  it('a verb always agrees with its subject', () => {
    const bad: string[] = []
    for (const t of domain()) {
      const s = figureTallySubtitle(t)
      const none = /^None of the (\d+)/.exec(s)
      const lead = /^(\d+)/.exec(s)
      const subject = none ? Number(none[1]) : lead ? Number(lead[1]) : null
      if (subject === null) continue
      const verb = /(isn't|aren't|is|are)/.exec(s)?.[1]
      const allowed = subject === 1 ? ['is', "isn't"] : ['are', "aren't"]
      if (verb && !allowed.includes(verb)) bad.push(`${JSON.stringify(t)} → ${s}`)
    }
    expect(bad, `verb disagreement:\n${bad.join('\n')}`).toEqual([])
  })

  it('never claims ALL are in the model unless inModel === total', () => {
    const bad = domain()
      .filter((t) => /^All /.test(figureTallySubtitle(t)) && t.inModel !== t.total)
      .map((t) => `${JSON.stringify(t)} → ${figureTallySubtitle(t)}`)
    expect(bad, `false all-clear:\n${bad.join('\n')}`).toEqual([])
  })

  it('never prints a denominator of zero', () => {
    const bad = domain()
      .filter((t) => / of 0 | of the 0 /.test(figureTallySubtitle(t)))
      .map((t) => `${JSON.stringify(t)} → ${figureTallySubtitle(t)}`)
    expect(bad, `"N of 0 figures" is not a sentence about anything:\n${bad.join('\n')}`).toEqual([])
  })

  it('never says there is nothing to track while any count is non-zero', () => {
    const bad = domain()
      .filter(
        (t) =>
          /No figures to track/.test(figureTallySubtitle(t)) &&
          t.total + t.inModel + t.proseOnly + t.absent > 0,
      )
      .map((t) => JSON.stringify(t))
    expect(bad, `an all-clear over a payload that names missing figures:\n${bad.join('\n')}`).toEqual([])
  })

  /**
   * ⭐ THE ANTI-VACUITY TWIN FOR THE FIVE PROPERTIES ABOVE. Each one is an
   * absence assertion, and an absence assertion needs to be shown capable of
   * firing — otherwise `figureTallySubtitle` could return `''` for every cell
   * and the whole file would be green.
   */
  it('the properties CAN fire — each is checked against a deliberately wrong sentence', () => {
    const nounBad = '0 of 1 figures you mentioned are in the model'
    expect([...nounBad.matchAll(/(\d+) (figures?)\b/g)].some((m) => m[2] !== (Number(m[1]) === 1 ? 'figure' : 'figures'))).toBe(true)
    const verbBad = "1 of 2 figures you mentioned aren't in the model yet"
    expect(/^(\d+)/.exec(verbBad)?.[1]).toBe('1')
    expect(['is', "isn't"].includes(/(isn't|aren't|is|are)/.exec(verbBad)![1])).toBe(false)
    expect(/ of 0 /.test('2 of 0 figures you mentioned are in the model')).toBe(true)
  })
})

/**
 * The named states, bound by EXACT SENTENCE. The previous suite asserted three
 * loose predicates that the plain-tally arm also satisfied, so a mutant
 * breaking the all-clear gate for n = 1 left all 58 cases green on a sentence
 * carrying the defect. An exact match cannot land on the wrong arm.
 */
describe('figureTallySubtitle — the named states, by exact sentence', () => {
  it.each([
    ['nothing recorded', { total: 0, inModel: 0, proseOnly: 0, absent: 0 }, 'No figures to track from your brief yet'],
    ['one figure, it landed', { total: 1, inModel: 1, proseOnly: 0, absent: 0 }, 'The figure you mentioned is in the model'],
    ['one figure, it did not', { total: 1, inModel: 0, proseOnly: 0, absent: 1 }, "The figure you mentioned isn't in the model yet"],
    ['all of many landed', { total: 5, inModel: 5, proseOnly: 0, absent: 0 }, 'All 5 figures you mentioned are in the model'],
    ['one of many missing', { total: 4, inModel: 3, proseOnly: 0, absent: 1 }, "1 of 4 figures you mentioned isn't in the model yet"],
    ['several missing', { total: 4, inModel: 2, proseOnly: 1, absent: 1 }, "2 of 4 figures you mentioned aren't in the model yet"],
    // The finding-5 state: notYetCount is 0 and inModel < total, so an
    // all-clear would be false and the shortfall sentence would be too.
    ['unreconciled, some in the model', { total: 5, inModel: 3, proseOnly: 0, absent: 0 }, '3 of 5 figures you mentioned are in the model'],
    // The finding-1 state — the one the previous pass rendered as
    // "0 of 1 figures you mentioned are in the model".
    ['unreconciled, none in the model, n = 1', { total: 1, inModel: 0, proseOnly: 0, absent: 0 }, 'None of the 1 figure you mentioned is in the model'],
    ['unreconciled, none in the model, n > 1', { total: 3, inModel: 0, proseOnly: 0, absent: 0 }, 'None of the 3 figures you mentioned are in the model'],
    // The finding-3 state: `total === 0` must not pre-empt a real shortfall.
    ['no total, but figures marked absent', { total: 0, inModel: 0, proseOnly: 0, absent: 2 }, "2 figures you mentioned aren't in the model yet"],
    // Over-count — admitted by the parser, and the draft rendered
    // "2 of the 1 figure … are".
    ['over-count', { total: 1, inModel: 2, proseOnly: 0, absent: 0 }, '2 figures you mentioned are in the model'],
    ['no manifest at all', null, "I can't show this yet"],
  ])('%s', (_name, tally, expected) => {
    expect(figureTallySubtitle(tally as FigureTally | null)).toBe(expected)
  })
})

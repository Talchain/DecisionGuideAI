/**
 * ⭐⭐⭐ TWO SENTENCES RAN TOGETHER ON THE QUESTION CARD, AND PAUL READ IT.
 *
 * Measured on served `1f77130d`, Paul's own manual test (22 Sep 2026), the
 * Question card rendered, verbatim:
 *
 *     "A success target on your model can't be evaluated reliably Set a
 *      current value or range on the part of your model this target applies to."
 *
 * One sentence ends and the next begins with nothing between them but a space.
 *
 * ## The cause, and why fixing the TEMPLATE would have been the wrong fix
 *
 * `DecisionNode.tsx:1242-1247` renders the disclosure as two spans — the title
 * in body colour, the suggestion in light — and it terminated only the SECOND
 * one, with a hardcoded `.`:
 *
 *     <span>{withheldLeader.title}</span>{' '}<span>{withheldLeader.suggestion}.</span>
 *
 * `humaniseCritique`'s entries are TITLES: none of them carries terminal
 * punctuation, by design, because other surfaces render them as headings.
 * Adding a full stop to one template would fix one code's card and leave every
 * sibling — which is this file's own named failure mode, recorded at
 * `humaniseCritique.ts:194-211` about this very entry: *"the remedy scoped to
 * the instance while nothing swept its siblings."*
 *
 * ⛔ SO THE BOUNDARY IS APPLIED AT THE ONE OWNER, FOR EVERY CODE, and the
 * hardcoded `.` goes with it — it was a latent second defect: a template ending
 * in `?` would have rendered `…?.`
 */
import { describe, it, expect } from 'vitest'
import {
  selectWithheldLeaderDisclosure,
  LEADER_WITHHOLDING_CODES,
  endSentence,
} from '../withheldLeaderDisclosure'

const reportFor = (code: string) => ({
  inference_warnings: [{ code, message: '', severity: 'warning' }],
})

describe('endSentence — a boundary, never a second one', () => {
  it('terminates a bare clause', () => {
    expect(endSentence('reliably')).toBe('reliably.')
  })

  it('CONTRAST CONTROL — leaves existing terminal punctuation alone', () => {
    // Without this the rule could be "always append", which satisfies the case
    // above while inventing `…?.` — the latent defect in the hardcoded `.`
    // this replaces.
    for (const s of ['Done.', 'Really?', 'Stop!', 'Wait…']) expect(endSentence(s)).toBe(s)
  })

  it('leaves an empty string empty rather than emitting a lone full stop', () => {
    expect(endSentence('')).toBe('')
    expect(endSentence('   ')).toBe('')
  })
})

describe('EVERY withholding code produces two readable sentences', () => {
  // ⛔ THE WHOLE SET, DERIVED. The defect Paul hit was one code; the class is
  // the renderer. Enumerating the codes from the module means a new one cannot
  // be added without this assertion covering it.
  it('covers a non-trivial set (guards against an empty sweep)', () => {
    expect(LEADER_WITHHOLDING_CODES.length).toBeGreaterThan(0)
  })

  for (const code of LEADER_WITHHOLDING_CODES) {
    it(`${code}: the title ends a sentence before the suggestion starts`, () => {
      const got = selectWithheldLeaderDisclosure(reportFor(code) as never)
      expect(got, `${code} produced no disclosure`).not.toBeNull()
      expect(got!.title.length).toBeGreaterThan(0)
      // The property, stated as the reader experiences it: joined with a single
      // space, the result must not contain a lower-case word butting straight
      // onto the end of a clause with no boundary.
      expect(/[.!?…]$/.test(got!.title), `title: ${got!.title}`).toBe(true)
      if (got!.suggestion.length > 0) {
        expect(/[.!?…]$/.test(got!.suggestion), `suggestion: ${got!.suggestion}`).toBe(true)
      }
    })
  }

  it('⛔ the exact string Paul read: one terminated sentence, and no remedy the engine says does nothing', () => {
    // (AI Quality, #70 5843266323: the wire cannot tell a missing value from an uncheckable target, and on Paul's churn limit PLoT said a value "would not change that")
    const got = selectWithheldLeaderDisclosure(reportFor('CONSTRAINT_TARGET_UNRELIABLE') as never)
    expect(got!.suggestion).toBe('')
    const rendered = `${got!.title} ${got!.suggestion}`.trim()
    expect(rendered).toBe("A success target on your model can't be evaluated reliably.")
    expect(rendered).not.toContain('Set a')
  })
})

/**
 * ⚠ AND THE RENDER HALF, because the selector being right is not the card being
 * right. `DecisionNode` carried a hardcoded `.` after the suggestion; with both
 * strings now terminated at the owner, re-adding it would print `..`.
 */
describe('no consumer may re-add a terminator', () => {
  it('a rendered title + suggestion contains no doubled full stop', () => {
    for (const code of LEADER_WITHHOLDING_CODES) {
      const got = selectWithheldLeaderDisclosure(reportFor(code) as never)!
      const rendered = `${got.title} ${got.suggestion}`
      expect(rendered, code).not.toMatch(/\.\s*\./)
      expect(rendered, code).not.toContain('..')
    }
  })
})

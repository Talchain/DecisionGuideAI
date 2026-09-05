/**
 * Every sentence this panel COMPOSES from a list reads as English at every
 * arity the producer can send.
 *
 * ── THE WITNESSED DEFECT (Paul, deployed `a9c2e050`, 5 Sep 2026) ────────────
 * The amber ribbon at the top of the panel — the most prominent position on the
 * surface — rendered:
 *
 *     This analysis is partial — the win share, the robustness check did not come back.
 *
 * `provisionalNaming` joined its parts with `', '` and nothing else, so the
 * sentence was correct at n=1 and ungrammatical at every n≥2. The panel's one
 * job is to be trustworthy about a chain of reasoning; a broken sentence in the
 * warning ribbon costs more than the warning buys.
 *
 * ── WHY THE EXISTING SPEC DID NOT SEE IT ───────────────────────────────────
 * `AnalysisNewTabBody.spec.tsx:568` pins this ribbon — at n=1, which is the one
 * arity the defect could not reach. That is CLAUDE.md trap 22 exactly: a corpus
 * drawn from the author's head cannot see the class the author did not imagine.
 * So this file asserts across the ARITY RANGE rather than at an example, and
 * the singular case is kept as the contrast control that proves the composer is
 * still being exercised.
 *
 * ── THE AUTHORITY, NOT A HAND-ROLLED JOINER ────────────────────────────────
 * `Intl.ListFormat('en-GB', { type: 'conjunction' })` is already this repo's
 * established answer (`OptionPreview.tsx:439`, spec'd at
 * `OptionPreview.spec.tsx:401`). Reusing it means one joiner rather than two,
 * and it is right about the en-GB comma rules without anyone maintaining them.
 */
import { describe, expect, it } from 'vitest'
import { ANALYSIS_NEW_COPY as COPY, formatConjunctionList } from '../analysisNewCopy'

const NAME = (n: number) =>
  Object.values(COPY.status.missingResultLabels).slice(0, n)

describe('the partial-result ribbon is a sentence at every arity', () => {
  it('CONTROL: the composer is reached and still names one result', () => {
    // Without this, every assertion below could pass against a composer that
    // had been reduced to a constant. It also pins the arity the shipped spec
    // already covers, so a fix here cannot silently regress that one.
    const s = COPY.status.provisionalNaming(['the robustness check'])
    expect(s).toBe('This analysis is partial — the robustness check did not come back.')
  })

  it('two results are joined by a conjunction, not a bare comma', () => {
    const s = COPY.status.provisionalNaming(['the win share', 'the robustness check'])
    expect(s, `the witnessed defect: "${s}"`).toBe(
      'This analysis is partial — the win share and the robustness check did not come back.',
    )
  })

  it('three or more read as an English list', () => {
    const s = COPY.status.provisionalNaming([
      'the win share',
      'the sensitivity check',
      'the robustness check',
    ])
    // Asserted against `Intl.ListFormat` itself rather than a literal, so this
    // cannot drift from the authority it is meant to be delegating to — and it
    // states the property (an en-GB conjunction list), not one example of it.
    const expected = formatConjunctionList([
      'the win share',
      'the sensitivity check',
      'the robustness check',
    ])
    expect(s).toBe(`This analysis is partial — ${expected} did not come back.`)
    expect(s, 'a list must not end on a bare comma-joined pair').not.toMatch(
      /,\s*the robustness check did not/,
    )
  })

  it('DISCRIMINATOR: no arity the producer can send leaves a dangling comma', () => {
    // The closed vocabulary is seven keys, so every reachable arity is cheap to
    // enumerate. Asserting over the RANGE is the point — the shipped guard
    // tested the single arity that could not fail.
    const all = Object.values(COPY.status.missingResultLabels)
    expect(all.length, 'the label map must not be empty').toBeGreaterThan(2)
    for (let n = 1; n <= all.length; n += 1) {
      const labels = NAME(n)
      const s = COPY.status.provisionalNaming(labels)
      expect(s, `n=${n} produced: "${s}"`).toMatch(
        /^This analysis is partial — \S.* did not come back\.$/,
      )
      // ⚠ THE PROPERTY IS "THE FINAL ITEM IS INTRODUCED BY A CONJUNCTION", NOT
      // "there are no commas". My first cut banned any comma before the closing
      // clause and REDDED on `A, B and C` — which is correct en-GB. Written
      // against the failure I had seen rather than against the spec, exactly
      // the shape CLAUDE.md trap 13d names. The assertion below states what
      // English requires and nothing more.
      const last = labels[labels.length - 1]!
      expect(s, `n=${n} must introduce its last item with a conjunction: "${s}"`).toContain(
        n > 1 ? `and ${last} did not come back.` : `${last} did not come back.`,
      )
      expect(s, `n=${n} must not join the last two items with a bare comma: "${s}"`).not.toContain(
        `, ${last} did not come back.`,
      )
    }
  })

  it('an empty list never emits a fragment', () => {
    // The call site guards this today (`AtAGlance.tsx:239`), so this is a
    // belt-and-braces property held BY THE STRING rather than by its one caller
    // — a second caller would otherwise reintroduce "partial —  did not come
    // back." with no red anywhere.
    expect(COPY.status.provisionalNaming([])).toBe(COPY.status.provisional)
  })
})

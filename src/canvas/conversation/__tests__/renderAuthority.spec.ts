/**
 * ONE RENDER AUTHORITY — the suppression primitives (L-16 / NEW-9 / item 7).
 *
 * ## What this pins, and why in this shape
 *
 * The defect is not "a copy bug". CEE DERIVES `assistant_text` from the answer
 * shape (`deriveAnswerTextFromShape`, read at the CEE bytes on staging
 * `2988eacf`), so the two channels are byte-equal BY PRODUCER DESIGN. The same
 * plan then appears a third time on the consent card the turn renders. Nothing
 * upstream is wrong; the UI was simply rendering the same bytes more than once.
 *
 * These tests are written against the SPEC of the rule ("a lower tier never
 * re-renders a whole segment a higher tier already rendered"), never against
 * the sample that motivated it — the platform's trap 13d: an invariant written
 * with the same asymmetry as the code it tests is a guard agreeing with itself.
 * So every positive case has an OPPOSITE-DIRECTION TWIN: for each suppression
 * there is a near-miss that must survive untouched.
 */
import { describe, it, expect } from 'vitest'
import {
  collectConsentSurfaceText,
  composeMessage,
  assertTotalPartition,
  dedupeRenderedText,
  renderSegmentKey,
  splitRenderSegments,
} from '../messageComposition'
import type { ConversationBlock } from '../types'

describe('renderSegmentKey', () => {
  it('is insensitive to whitespace shape and case — the two channels differ in both', () => {
    expect(renderSegmentKey('  The   model\nchanged.  ')).toBe('the model changed.')
    expect(renderSegmentKey('THE MODEL CHANGED.')).toBe('the model changed.')
  })

  it('does NOT normalise punctuation or word order (no fuzzy matching)', () => {
    expect(renderSegmentKey('The model changed')).not.toBe(renderSegmentKey('The model changed.'))
    expect(renderSegmentKey('a b')).not.toBe(renderSegmentKey('b a'))
  })

  it('maps a blank segment to the empty key', () => {
    expect(renderSegmentKey('   \n  ')).toBe('')
  })
})

describe('splitRenderSegments', () => {
  it('splits on newlines and keeps blank lines as paragraph markers', () => {
    expect(splitRenderSegments('one\n\ntwo')).toEqual(['one', '', 'two'])
  })

  it('does NOT split sentences — the deliberate limit (trap 22f)', () => {
    // One paragraph, two sentences, ONE segment. This is the stated limit of
    // the rule: separating sentences needs a predicate over natural language,
    // which this platform has watched oscillate for four rounds. The limit is
    // pinned here so it can never become an undisclosed gap.
    expect(splitRenderSegments('First sentence. Second sentence.')).toHaveLength(1)
  })
})

describe('dedupeRenderedText — a lower tier never repeats a higher tier', () => {
  const CARD = 'Add option Hire 2 Mid-Level Engineers (Under £45k)'

  it('withholds a whole segment the higher tier already rendered', () => {
    const prose = `Here is the plan.\n${CARD}\nNothing moves until you confirm.`
    const result = dedupeRenderedText(prose, [CARD])
    expect(result.suppressedCount).toBe(1)
    expect(result.text).toBe('Here is the plan.\nNothing moves until you confirm.')
  })

  it('OPPOSITE TWIN — a segment that merely CONTAINS the higher tier survives whole', () => {
    // Suppression is whole-segment equality, never substring containment. A
    // substring rule would delete a sentence the user has not read, which is
    // content loss dressed as tidiness.
    const prose = `Here is the plan.\n${CARD} — and two more like it.\nDone.`
    const result = dedupeRenderedText(prose, [CARD])
    expect(result.suppressedCount).toBe(0)
    expect(result.text).toBe(prose)
  })

  it('OPPOSITE TWIN — an almost-identical segment survives (no fuzzy distance)', () => {
    const prose = `Add option Hire 2 Mid-Level Engineers (Under £46k)`
    const result = dedupeRenderedText(prose, [CARD])
    expect(result.suppressedCount).toBe(0)
    expect(result.text).toBe(prose)
  })

  /**
   * ⚠ PIN FLIPPED — this file previously asserted the OPPOSITE, and the
   * opposite was a content-loss bug.
   *
   * The old rule accumulated the input's own segments, so with an empty
   * `alreadyRendered` — the default path, i.e. every ordinary assistant turn —
   * the second occurrence of any identical line was deleted. An adversarial
   * review proved it at the rendered HTML. The three cases below are that
   * review's, kept verbatim as the corpus, because the case this lane wrote for
   * itself (one long unique sentence) could not see the class it broke: SHORT,
   * STRUCTURALLY REPEATED lines.
   *
   * Cross-tier suppression is a FACT (the caller supplies the other surface's
   * text). Within-text repetition is a GUESS about the producer's intent. They
   * cannot share a predicate (trap 22b), so only the fact is implemented.
   */
  it('PRESERVES a line the same text repeats under two headings', () => {
    const text = 'Risks\nTimeline slips\nMitigations\nTimeline slips'
    const result = dedupeRenderedText(text)
    expect(result.suppressedCount).toBe(0)
    expect(result.text).toBe(text)
  })

  it('PRESERVES repeated short status lines (three rows, three "not stated")', () => {
    const text = [
      'Option A',
      'Confidence: not stated',
      'Option B',
      'Confidence: not stated',
      'Option C',
      'Confidence: not stated',
    ].join('\n')
    const result = dedupeRenderedText(text)
    expect(result.suppressedCount).toBe(0)
    expect(result.text).toBe(text)
  })

  it('PRESERVES a long sentence the producer genuinely repeated', () => {
    // Deliberately the shape the ORIGINAL (wrong) rule was written for: even
    // here the answer is "leave it alone", because nothing in the text
    // distinguishes an accidental repeat from a deliberate one.
    const only = 'There is only one analysis run so far, so there is nothing to compare yet.'
    const text = `${only}\n${only}\nRun the analysis again after a change.`
    expect(dedupeRenderedText(text).text).toBe(text)
  })

  it('STILL withholds that same line when a HIGHER TIER stated it — both copies', () => {
    // The discriminating twin: identical input, one prior. Suppression is about
    // the tier, never about the repetition.
    const only = 'There is only one analysis run so far, so there is nothing to compare yet.'
    const text = `${only}\n${only}\nRun the analysis again after a change.`
    const result = dedupeRenderedText(text, [only])
    expect(result.suppressedCount).toBe(2)
    expect(result.text).toBe('Run the analysis again after a change.')
  })

  it('is byte-identical to its input for ANY text when there are no priors', () => {
    // The property the old rule violated, stated as a property rather than as
    // an example — no input may be changed on the default path.
    for (const sample of [
      'a\na',
      'x\n\nx\n\nx',
      'Same line\nSame line\nSame line',
      'One.\nTwo.\nOne.',
    ]) {
      expect(dedupeRenderedText(sample).text).toBe(sample)
      expect(dedupeRenderedText(sample).suppressedCount).toBe(0)
    }
  })

  it('is a pure identity when there is nothing to withhold', () => {
    const prose = 'One.\n\nTwo.\n\nThree.'
    const result = dedupeRenderedText(prose, ['Something else entirely.'])
    expect(result.suppressedCount).toBe(0)
    // Byte-identical, not merely equivalent: every surface with no duplicate
    // must be provably unchanged by this lane.
    expect(result.text).toBe(prose)
  })

  it('is a pure identity with no priors at all (the un-opted-in caller)', () => {
    const prose = 'Alpha.\n\nBeta.'
    expect(dedupeRenderedText(prose).text).toBe(prose)
    expect(dedupeRenderedText(prose).suppressedCount).toBe(0)
  })

  it('never treats blank lines as duplicates of each other', () => {
    const prose = 'One.\n\nTwo.\n\nThree.'
    expect(dedupeRenderedText(prose, []).text).toBe(prose)
  })

  it('leaves no stranded blank run where a paragraph was withheld', () => {
    const result = dedupeRenderedText('Intro.\n\nDUPE\n\nOutro.', ['DUPE'])
    expect(result.suppressedCount).toBe(1)
    expect(result.text).toBe('Intro.\n\nOutro.')
  })

  it('never withholds FROM the higher tier — authority is one-directional', () => {
    // The prior is passed by value and read only. Suppressing a card because the
    // prose said the same thing would hide the consent control's own copy.
    const card = 'Confirm: delete the option.'
    const result = dedupeRenderedText(card, [])
    expect(result.text).toBe(card)
    // and the reverse call is the one that suppresses
    expect(dedupeRenderedText(card, [card]).suppressedCount).toBe(1)
  })
})

describe('collectConsentSurfaceText — tier 0', () => {
  const held = {
    type: 'v5_held_proposal',
    proposal_id: 'gmh_1',
    summary: 'Add option A\nAdd factor B',
    mutation_class: 'structural',
    reason_code: 'REMOVE_UNCONFIRMED',
    confirm: { label: 'Confirm', message: 'confirm' },
  } as unknown as ConversationBlock

  it('collects a held proposal card summary', () => {
    expect(collectConsentSurfaceText([held])).toEqual(['Add option A\nAdd factor B'])
  })

  it('EXCLUDES commentary even though commentary is PINNED', () => {
    // Deliberate: commentary is prose, not a consent control, and its
    // duplication is already resolved at ingest. Two mechanisms on one seam is
    // how this estate ships a defect and its exact inverse (trap 22b).
    const commentary = { type: 'commentary', text: 'Some narrative.' } as ConversationBlock
    expect(collectConsentSurfaceText([commentary])).toEqual([])
  })

  it('EXCLUDES non-pinned blocks — a demoted card is not a rendered authority', () => {
    const coaching = {
      type: 'v5_coaching',
      block_id: 'c1',
      summary: 'Coaching summary',
    } as unknown as ConversationBlock
    expect(collectConsentSurfaceText([coaching])).toEqual([])
  })

  it('returns [] for an absent or empty block list', () => {
    expect(collectConsentSurfaceText(undefined)).toEqual([])
    expect(collectConsentSurfaceText([])).toEqual([])
  })
})

describe('the #717 invariants are unchanged by this lane', () => {
  const blocks = [
    { type: 'v5_held_proposal' },
    { type: 'v5_coaching' },
    { type: 'v5_coaching' },
    { type: 'v5_coaching' },
    { type: 'v5_coaching' },
    { type: 'fact' },
  ] as unknown as ConversationBlock[]

  it('still produces a TOTAL PARTITION', () => {
    const composition = composeMessage(blocks)
    expect(assertTotalPartition(blocks.length, composition)).toBeNull()
  })

  it('still NEVER fabricates a headline', () => {
    expect(composeMessage(blocks).headline).toBeNull()
  })

  it('still keeps PRODUCER ORDER within every class', () => {
    const composition = composeMessage(blocks)
    for (const cls of [composition.pinned, composition.points, composition.detail]) {
      const indices = cls.map((e) => e.index)
      expect(indices).toEqual([...indices].sort((a, b) => a - b))
    }
  })
})

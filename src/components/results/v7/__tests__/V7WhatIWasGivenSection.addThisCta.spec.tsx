/**
 * The "Not modelled yet" CTA — it must not promise a change it cannot make.
 *
 * ── WHY THIS FILE EXISTS, AND WHAT SETTLED IT ──────────────────────────────
 * The button said "Add this" and the message it composed was
 * `Please add "£31m" from my brief to the model.` It fired a real turn and the
 * model never changed. Round 1 root-caused that far and stopped, because the
 * brief required the accepted phrasing be derived from the LIVE router and it
 * could not do that.
 *
 * It was derived. 12 arms, 12 fresh scenarios, byte-identical brief, one arm per
 * scenario so only the phrasing varied; outcomes classified from the producer's
 * own typed channel (`details.rejection_code` / `violation_codes` vs
 * `held_proposal` / `details.verdict`), never from the prose:
 *
 *   bare figure, the shipped phrasing        no mutation; a specific question back
 *   figure + brief sentence                  REFUSED  ORPHAN_NODE
 *   named factor + value                     REFUSED  ORPHAN_NODE
 *   named factor + "connect to the options"  REFUSED  NO_PATH_TO_GOAL
 *   named factor + a valid causal target     **HELD** → confirm → applied
 *   control: "Change X to Y." (proven grammar) APPLIED — so the refusals are
 *                                              evidence about the phrasings and
 *                                              not about a sick service
 *   the ASK phrasings (3 variants)           answered with concrete, model-grounded
 *                                              options; no orphan, no error
 *
 * The acceptance condition is therefore a fact about the USER'S intent — what
 * the figure should causally influence — which a receipt cannot know. A CTA that
 * picked one would be the product inventing causality on the user's behalf.
 *
 * ⭐ THE MEASUREMENT THAT DECIDED THE SHAPE, and it is counter-intuitive: adding
 * the brief sentence to an ADD instruction made the outcome WORSE (a structural
 * error instead of a useful question), while adding it to an ASK made the answer
 * BETTER (the reply named the specific existing factor the figure would attach
 * to). Same context, opposite effect, depending on the verb. That is why the
 * sentence ships and the imperative does not.
 */
import { describe, it, expect } from 'vitest'
import { composeNotModelledQuestion, recoverBriefSentence } from '../V7WhatIWasGivenSection'
import type { NotModelledItem } from '../../../../adapters/cee/notModelled'

const BRIEF =
  'Should we replace our current CRM with HubSpot next quarter, or keep what we have? ' +
  'We are a 34-person B2B sales team with annual revenue of £31m. ' +
  'Annual CRM cost is about £50,000 and switching would cost roughly £20,000 one-off.'

function itemAt(literal: string): NotModelledItem {
  const charOffset = BRIEF.indexOf(literal)
  if (charOffset < 0) throw new Error(`fixture error: "${literal}" is not in the brief`)
  return { literal, kind: 'money', charOffset, verdict: 'absent', matchedNodeId: null }
}

describe('recoverBriefSentence — the offset CEE already sends, finally used', () => {
  it('recovers the sentence the figure sits in', () => {
    expect(recoverBriefSentence(BRIEF, BRIEF.indexOf('£31m'))).toBe(
      'We are a 34-person B2B sales team with annual revenue of £31m.',
    )
  })

  it('does not cut a sentence at a DECIMAL POINT', () => {
    // The exact defect CLAUDE.md trap 22 records: a guard that was correct and
    // pointed at the wrong bytes, because `[.!?]` also matches the decimal in
    // "£1.5 million". A naive splitter returns "1" here.
    const brief = 'Our budget ceiling is £1.5 million for the whole programme. That is firm.'
    expect(recoverBriefSentence(brief, brief.indexOf('£1.5 million'))).toBe(
      'Our budget ceiling is £1.5 million for the whole programme.',
    )
  })

  it('recovers the FIRST sentence when the figure is in it (no preceding boundary)', () => {
    const brief = 'We have £2m in reserve. Everything else is committed.'
    expect(recoverBriefSentence(brief, brief.indexOf('£2m'))).toBe('We have £2m in reserve.')
  })

  it('returns null rather than quoting the wrong text when the offset is out of range', () => {
    expect(recoverBriefSentence(BRIEF, 99_999)).toBeNull()
    expect(recoverBriefSentence(null, 3)).toBeNull()
    expect(recoverBriefSentence(BRIEF, -1)).toBeNull()
  })
})

describe('composeNotModelledQuestion — the turn the CTA fires', () => {
  it('asks where the figure belongs and carries the brief sentence, VERBATIM', () => {
    expect(composeNotModelledQuestion(itemAt('£31m'), BRIEF)).toBe(
      'My brief mentions £31m, which isn\'t in the model. ' +
        'The brief says: "We are a 34-person B2B sales team with annual revenue of £31m." ' +
        "What could this figure influence in this decision, and where would it belong? " +
        "Don't change the model yet — tell me the options first.",
    )
  })

  it('does NOT instruct an add — the construction the live router refuses with ORPHAN_NODE', () => {
    const msg = composeNotModelledQuestion(itemAt('£31m'), BRIEF)
    // Bound to the imperative construction the probe measured, not to a vague
    // "contains the word add": the message may legitimately contain "add" in
    // other grammar, and a substring ban would be a guard watching the wrong door.
    expect(
      /(^|[.!?]\s+)(please\s+)?add\b/i.test(msg),
      'the CTA composed an add instruction; measured against the live router, every add phrasing that does not ' +
        'name a causal target is refused ORPHAN_NODE and the user is shown a structural error',
    ).toBe(false)
  })

  it('still asks a usable question when the brief is unavailable — never quotes nothing', () => {
    const msg = composeNotModelledQuestion(itemAt('£31m'), null)
    expect(msg).not.toContain('The brief says')
    expect(msg).toContain('My brief mentions £31m, which isn\'t in the model.')
    expect(msg).toContain('What could this figure influence in this decision')
  })

  it('binds the quote to THIS figure by offset, not by value — the same literal twice is two facts', () => {
    // Trap 19 in its exact form: two occurrences of one figure in different
    // sentences. A value-predicate lookup (`indexOf(literal)`) would give both
    // rows the FIRST sentence; the offset gives each its own.
    const brief = 'We spend £50,000 a year on the current CRM. Migration would also cost £50,000 up front.'
    const first: NotModelledItem = { literal: '£50,000', kind: 'money', charOffset: brief.indexOf('£50,000'), verdict: 'absent', matchedNodeId: null }
    const second: NotModelledItem = { literal: '£50,000', kind: 'money', charOffset: brief.lastIndexOf('£50,000'), verdict: 'absent', matchedNodeId: null }

    expect(first.charOffset).not.toBe(second.charOffset) // precondition, pinned in-test
    expect(composeNotModelledQuestion(first, brief)).toContain('We spend £50,000 a year on the current CRM.')
    expect(composeNotModelledQuestion(second, brief)).toContain('Migration would also cost £50,000 up front.')
    expect(
      composeNotModelledQuestion(second, brief),
      'the second occurrence was quoted with the first occurrence\'s sentence — the lookup is by value, not identity',
    ).not.toContain('We spend £50,000 a year')
  })
})
